import { Graphics, Container, Text } from "pixi.js";
import type {
  FileNode,
  WorkspaceLayout,
  Viewport,
  LodLevel,
  FileEffects,
  EffectKind,
  Rect,
} from "@quanta/canvas-engine";
import { EFFECT_STYLE } from "@quanta/canvas-engine";
import { NEUTRAL_GREY } from "./shared/colors";
import { setFontSize, setFill, setText, hashStep, hashStringStep } from "./shared/pixi-guards";
import {
  InstancedCircleMesh,
  FLOATS_PER_CIRCLE_INSTANCE,
  unpackHexInto,
} from "./shared/InstancedCircleMesh";

// Feature flag. When true, chip backgrounds are drawn via a single instanced
// mesh draw call. When false, we fall back to the CPU Graphics path (which
// is what the renderer's unit tests spy on). Rollback handle for runtime
// triage, not just tests — if the shader ever misbehaves on a given GPU we
// can flip it off without a rebuild.
let BADGES_MESH_ENABLED = true;
/** Toggle the instanced-mesh badge/ring path. Intended for rollback / tests. */
export function setBadgesMeshEnabled(enabled: boolean): void {
  BADGES_MESH_ENABLED = enabled;
}
/** Read the current flag — used by tests to guard expectations. */
export function isBadgesMeshEnabled(): boolean {
  return BADGES_MESH_ENABLED;
}

// Per-file effect chips rendered as a row below the card's bottom edge.
// Each chip is a rounded rect + 2-3 letter ASCII glyph (no emoji). Readers
// glance at the row and know "this file talks to DB + net" without opening
// anything.
//
// Tier gate: galaxy cards are tens of CSS px — chips would be unreadable.
// Enabled at city / street / ground; a no-op everywhere else.
//
// Direct-mount overlay (like SCCBubbleRenderer / StartHereBadgeRenderer) —
// the renderer registry keys by LodRendererKind and this pass isn't a
// tier, it's a cross-tier overlay.
//
// Optimization pass: rebuild hash over (fileId, effectKinds, invScale
// bucket). When the visible effect set and zoom bucket haven't changed,
// the Graphics.clear() + per-chip fills can be skipped entirely. The chip
// count here is bounded by MAX_CHIPS × visible cards, but tier gating keeps
// that reasonable at street/ground — the win is avoiding the Graphics path
// rebuild on plain pan frames.

type TierGate = "city" | "street" | "ground";

function tierAllows(lod: LodLevel): lod is TierGate {
  return lod === "city" || lod === "street" || lod === "ground";
}

// Layout math. Chips sit below the card in a single row, separated by
// CHIP_GAP. CHIP_W is wide enough for a 3-char glyph at 10px font;
// overflow is handled by capping at MAX_CHIPS and rendering a "..." chip.
const CHIP_W = 22;
const CHIP_H = 12;
const CHIP_GAP = 3;
const CHIP_RADIUS = 3;
const CHIP_FONT = 9;
const ROW_GAP_Y = 4;
const MAX_CHIPS = 4;
const OVERFLOW_GLYPH = "...";
const OVERFLOW_COLOR = NEUTRAL_GREY;

export class EffectBadgeRenderer {
  private container: Container;
  private gfx: Graphics;
  // Instanced-circle mesh; painted when BADGES_MESH_ENABLED. Replaces the
  // per-chip Graphics.roundRect() + fill() pair with a single draw call
  // across every visible chip. Always constructed so we can flip the flag
  // at runtime without a restart.
  private chipMesh: InstancedCircleMesh;
  private chipInstanceCount = 0;
  // One Text per slot; we keep MAX_CHIPS + 1 (the overflow slot) × visible
  // files worth of pool entries. Pool grows as needed, LRU-reset between
  // build() calls (visible not set this frame → hidden).
  private textPool: Text[] = [];
  private textPoolIdx = 0;
  // Rebuild gate. The inputs are: visible file set × their effect kinds ×
  // LOD tier × invScale bucket. If all identical, the paint is identical
  // and we skip the Graphics.clear() + fills + label walk.
  private lastHash = 0;
  private lastCount = 0;
  private lastInvScaleBucket = -1;
  private lastLod: LodLevel | null = null;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.eventMode = "none";
    parent.addChild(this.container);
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    // Mesh sits alongside the Graphics layer. Added under the Text pool so
    // glyphs read on top. The mesh is a no-op draw when instanceCount=0 so
    // the Graphics fallback owns the pixels under the flag.
    this.chipMesh = new InstancedCircleMesh(128);
    this.container.addChild(this.chipMesh.mesh);
  }

  build(
    files: readonly FileNode[],
    effects: Record<string, FileEffects> | undefined,
    layout: WorkspaceLayout,
    viewport: Viewport,
    lod: LodLevel,
  ): void {
    if (!effects || !tierAllows(lod)) {
      this.gfx.clear();
      this.chipMesh.setInstanceCount(0);
      this.chipInstanceCount = 0;
      this.resetTexts();
      this.lastHash = 0;
      this.lastCount = 0;
      this.lastLod = lod;
      return;
    }

    const scale = viewport.scale;
    // World-px per screen-px at this zoom. We paint chip geometry in world
    // units so Pixi's camera scaling gives the right on-screen size; the
    // font size is pre-divided so it doesn't grow at zoom-in.
    const invScale = Math.min(8, Math.max(0.5, 1 / scale));
    // Coarse invScale bucket — same trick as CityNodeRenderer's LABEL_MIN_
    // threshold. Rebuilds only when the effective chip size bucket shifts.
    const invScaleBucket = Math.round(invScale * 4);

    // Build the dirty hash in the same pass we'd walk anyway. If the hash
    // matches we bail before touching the Graphics.
    let hash = 0;
    let count = 0;
    for (const file of files) {
      const entry = effects[file.id];
      if (!entry || entry.effects.length === 0) continue;
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      count++;
      hash = hashStringStep(hash, file.id);
      hash = hashStep(hash, entry.effects.length);
      for (let i = 0; i < entry.effects.length; i++) {
        // Fold the full kind string — `charCodeAt(0)` would collide on any
        // two EffectKinds starting with the same letter (e.g. `net`/`nop`
        // style additions), and order swaps of same-first-letter kinds
        // would hash identically. hashStringStep is the canonical path for
        // every string field in the renderer suite.
        hash = hashStringStep(hash, entry.effects[i]);
      }
    }

    if (
      hash === this.lastHash
      && count === this.lastCount
      && invScaleBucket === this.lastInvScaleBucket
      && lod === this.lastLod
    ) {
      return;
    }

    this.gfx.clear();
    this.resetTexts();

    const chipH = CHIP_H * invScale;
    const chipW = CHIP_W * invScale;
    const gap = CHIP_GAP * invScale;
    const rowGapY = ROW_GAP_Y * invScale;
    const radius = CHIP_RADIUS * invScale;
    const fontSize = CHIP_FONT;

    // Upper-bound chip count: MAX_CHIPS per file. Growing once per build
    // avoids multiple reallocations inside drawRow().
    this.chipMesh.ensureCapacity(files.length * MAX_CHIPS);
    this.chipInstanceCount = 0;

    for (const file of files) {
      const entry = effects[file.id];
      if (!entry || entry.effects.length === 0) continue;
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      this.drawRow(rect, entry.effects, chipW, chipH, gap, rowGapY, radius, fontSize, invScale);
    }

    // Commit mesh instance count; a zero-count mesh emits no draw. When
    // the flag is off we leave the count zero so only Graphics paints.
    if (BADGES_MESH_ENABLED) {
      this.chipMesh.setInstanceCount(this.chipInstanceCount);
    } else {
      this.chipMesh.setInstanceCount(0);
    }

    this.lastHash = hash;
    this.lastCount = count;
    this.lastInvScaleBucket = invScaleBucket;
    this.lastLod = lod;
  }

  clear(): void {
    this.gfx.clear();
    this.chipMesh.setInstanceCount(0);
    this.chipInstanceCount = 0;
    this.resetTexts();
    this.lastHash = 0;
    this.lastCount = 0;
    this.lastInvScaleBucket = -1;
    this.lastLod = null;
  }

  destroy(): void {
    for (const t of this.textPool) t.destroy();
    this.textPool.length = 0;
    this.chipMesh.destroy();
    this.gfx.destroy();
    this.container.destroy();
  }

  private drawRow(
    rect: Rect,
    effects: readonly EffectKind[],
    chipW: number,
    chipH: number,
    gap: number,
    rowGapY: number,
    radius: number,
    fontSize: number,
    invScale: number,
  ): void {
    const overflow = effects.length > MAX_CHIPS;
    // Reserve the last slot for "..." when overflow. We render MAX_CHIPS
    // entries total in that case — (MAX_CHIPS - 1) real + 1 overflow — so
    // the row width stays stable and a reader can tell more were hidden.
    const visibleCount = overflow ? MAX_CHIPS - 1 : Math.min(MAX_CHIPS, effects.length);
    const slotCount = overflow ? visibleCount + 1 : visibleCount;
    const rowWidth = slotCount * chipW + (slotCount - 1) * gap;
    // Anchor row below the card bottom, horizontally centered against the
    // card. Left-align would stack with other bottom-edge elements (e.g.
    // loc label inside the card); centered keeps chips visually tied to
    // the file while staying out of the card's interior.
    const startX = rect.x + (rect.w - rowWidth) / 2;
    const y = rect.y + rect.h + rowGapY;

    for (let i = 0; i < visibleCount; i++) {
      const kind = effects[i];
      const style = EFFECT_STYLE[kind];
      const x = startX + i * (chipW + gap);
      this.drawChip(x, y, chipW, chipH, radius, style.color, 0.92);

      const label = this.acquireText();
      setText(label, style.glyph);
      setFontSize(label, fontSize);
      setFill(label, 0xffffff);
      label.scale.set(invScale);
      // Center glyph in chip. Text width (post-scale) is `label.width`.
      label.position.set(
        x + chipW / 2 - label.width / 2,
        y + chipH / 2 - label.height / 2,
      );
      label.visible = true;
    }

    if (overflow) {
      const x = startX + visibleCount * (chipW + gap);
      this.drawChip(x, y, chipW, chipH, radius, OVERFLOW_COLOR, 0.85);
      const label = this.acquireText();
      setText(label, OVERFLOW_GLYPH);
      setFontSize(label, fontSize);
      setFill(label, 0xffffff);
      label.scale.set(invScale);
      label.position.set(
        x + chipW / 2 - label.width / 2,
        y + chipH / 2 - label.height / 2,
      );
      label.visible = true;
    }
  }

  /**
   * Paint a single chip background. In Graphics mode we emit a rounded rect
   * (preserves the original pill look + keeps test spies observable). In
   * mesh mode we emit a circle instance approximately the chip width —
   * circles pack as cleanly in a row and read as "badge dots", and the
   * instanced path is one draw call for the whole scene.
   */
  private drawChip(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: number,
    alpha: number,
  ): void {
    if (BADGES_MESH_ENABLED) {
      const data = this.chipMesh.view();
      const o = this.chipInstanceCount * FLOATS_PER_CIRCLE_INSTANCE;
      // Centre at chip midpoint; radius approximates half the shorter
      // edge so the dot fits the row height without overlapping neighbours.
      data[o] = x + w / 2;
      data[o + 1] = y + h / 2;
      data[o + 2] = Math.min(w, h) * 0.5;
      data[o + 3] = 0;                     // filled disc
      unpackHexInto(color, data, o + 4, alpha);
      // No explicit border — leave zeroed.
      data[o + 8] = 0; data[o + 9] = 0; data[o + 10] = 0; data[o + 11] = 0;
      data[o + 12] = 0;
      data[o + 13] = 0;                    // no pulse
      this.chipInstanceCount++;
    } else {
      this.gfx
        .roundRect(x, y, w, h, radius)
        .fill({ color, alpha });
    }
  }

  private acquireText(): Text {
    let t = this.textPool[this.textPoolIdx];
    if (!t) {
      t = new Text({
        text: "",
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: CHIP_FONT,
          fontWeight: "700",
          fill: 0xffffff,
        },
      });
      t.eventMode = "none";
      this.container.addChild(t);
      this.textPool[this.textPoolIdx] = t;
    }
    this.textPoolIdx++;
    return t;
  }

  private resetTexts(): void {
    for (let i = 0; i < this.textPoolIdx; i++) this.textPool[i].visible = false;
    this.textPoolIdx = 0;
  }
}
