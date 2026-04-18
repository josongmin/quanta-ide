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
  // One Text per slot; we keep MAX_CHIPS + 1 (the overflow slot) × visible
  // files worth of pool entries. Pool grows as needed, LRU-reset between
  // build() calls (visible not set this frame → hidden).
  private textPool: Text[] = [];
  private textPoolIdx = 0;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.eventMode = "none";
    parent.addChild(this.container);
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  build(
    files: readonly FileNode[],
    effects: Record<string, FileEffects> | undefined,
    layout: WorkspaceLayout,
    viewport: Viewport,
    lod: LodLevel,
  ): void {
    this.gfx.clear();
    this.resetTexts();
    if (!effects || !tierAllows(lod)) return;

    const scale = viewport.scale;
    // World-px per screen-px at this zoom. We paint chip geometry in world
    // units so Pixi's camera scaling gives the right on-screen size; the
    // font size is pre-divided so it doesn't grow at zoom-in.
    const invScale = Math.min(8, Math.max(0.5, 1 / scale));
    const chipH = CHIP_H * invScale;
    const chipW = CHIP_W * invScale;
    const gap = CHIP_GAP * invScale;
    const rowGapY = ROW_GAP_Y * invScale;
    const radius = CHIP_RADIUS * invScale;
    const fontSize = CHIP_FONT;

    for (const file of files) {
      const entry = effects[file.id];
      if (!entry || entry.effects.length === 0) continue;
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      this.drawRow(rect, entry.effects, chipW, chipH, gap, rowGapY, radius, fontSize, invScale);
    }
  }

  clear(): void {
    this.gfx.clear();
    this.resetTexts();
  }

  destroy(): void {
    for (const t of this.textPool) t.destroy();
    this.textPool.length = 0;
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
      this.gfx
        .roundRect(x, y, chipW, chipH, radius)
        .fill({ color: style.color, alpha: 0.92 });

      const label = this.acquireText();
      label.text = style.glyph;
      label.style.fontSize = fontSize;
      label.style.fill = 0xffffff;
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
      this.gfx
        .roundRect(x, y, chipW, chipH, radius)
        .fill({ color: OVERFLOW_COLOR, alpha: 0.85 });
      const label = this.acquireText();
      label.text = OVERFLOW_GLYPH;
      label.style.fontSize = fontSize;
      label.style.fill = 0xffffff;
      label.scale.set(invScale);
      label.position.set(
        x + chipW / 2 - label.width / 2,
        y + chipH / 2 - label.height / 2,
      );
      label.visible = true;
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
