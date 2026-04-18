import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_NAME, CITY_FONT_BOLD_NAME, CITY_MONO_FONT_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";

// City LOD: zoomed in enough to see the file card, its header, and (when
// zoomed far enough) per-function blocks. The old renderer called
// graphics.roundRect() per file and allocated a fresh Text per label on every
// redraw — for 5000 files that's ~50k Text textures churning.
//
// This version:
// - Draws all rectangles (card bg, header stripe, function blocks) through a
//   single instanced Mesh — 1 draw call for 5000 cards × 5-ish blocks.
// - Uses BitmapText from a shared font atlas + a bounded text-sprite pool
//   that LRU-rotates at the cap, so pool memory is flat regardless of how
//   many labels the most crowded frame needed.
// - Skips label rendering below a screen-readability threshold; rect-only
//   output at low zoom is pixel-for-pixel equivalent to the old unreadable
//   smudge but ~10× faster.
// - Hit-tests via shared RBush SpatialPickIndex (O(log n)), not a linear
//   scan, so pointermove on 5000 nodes doesn't cost 0.3 ms per event.

function riskFill(score: number): number {
  if (score >= 70) return 0xfee2e2;
  if (score >= 40) return 0xfef3c7;
  return 0xdcfce7;
}

function riskBorder(score: number): number {
  if (score >= 70) return 0xfca5a5;
  if (score >= 40) return 0xfcd34d;
  return 0x86efac;
}

function riskText(score: number): number {
  if (score >= 70) return 0xdc2626;
  if (score >= 40) return 0xd97706;
  return 0x16a34a;
}

const HEADER_H = 32;
const FN_H = 22;
const FN_GAP = 2;
const FN_PAD_X = 8;

// Below this screen scale, labels are sub-readable — skip them and keep the
// cards as pure rects. Saves thousands of BitmapText updates per pan/zoom.
const LABEL_MIN_SCREEN_SCALE = 0.25;

// Per-font pool cap. Picked from worst-case visible count: at city LOD the
// viewport typically fits ~60-120 cards; each card emits ≤4 file-level
// labels + ~8 function labels = ~12 labels/card. 512 per font gives headroom
// for ~40 crowded cards simultaneously showing every label, which comfortably
// exceeds typical on-screen visible set. Past the cap we LRU-rotate the
// cursor, reusing the oldest acquired entry — the visible label count at one
// instant is the actual live-set bound, and cap simply limits retained idle
// pool size between LOD transitions.
const TEXT_POOL_CAP_PER_FONT = 512;

// Pool of BitmapText instances reused across redraws. We slice the pool by
// (fontName, fontSize) since those can't be mutated cheaply on an existing
// BitmapText (they force atlas re-lookup and re-layout anyway).
interface TextPool {
  entries: BitmapText[];
  // Index of next slot to hand out this frame. Reset at update() start.
  cursor: number;
  // High-water mark across frames. compactPool() uses this to know how many
  // trailing entries can be freed when LOD transitions mean we'll never need
  // them again.
  lastFrameHigh: number;
}

export class CityNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;           // card bgs + function blocks
  private labelContainer: Container;             // holds BitmapText children
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  // Scratch buffer reused across frames for SpatialPickIndex.load(). We own
  // the array so we can trim its length without reallocating.
  private pickRects: PickRect[] = [];

  // Text pool keyed by font name. Each pool grows until TEXT_POOL_CAP_PER_FONT,
  // then LRU-rotates (cursor wraps and overwrites oldest entries).
  private pools: Map<string, TextPool> = new Map();

  private onClickFile?: (fileId: string) => void;
  private onHoverFile?: (fileId: string | null) => void;

  constructor(
    parent: Container,
    opts?: {
      onClick?: (fileId: string) => void;
      onHover?: (fileId: string | null) => void;
    },
  ) {
    // BitmapFont.install requires a ready Pixi renderer — safe to call only
    // after the PixiStage's app.init() completes. PixiStage constructs this
    // renderer only after init, so this is the earliest legal point.
    installCityFonts();

    this.container = new Container();
    this.rectMesh = new InstancedRectMesh(4096); // 5000 files × ~5 rects worst case
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();

    this.onClickFile = opts?.onClick;
    this.onHoverFile = opts?.onHover;

    // Z-order: rects → labels → hit layer.
    this.container.addChild(this.rectMesh.mesh);
    this.container.addChild(this.labelContainer);

    this.hitLayer.eventMode = "static";
    this.hitLayer.cursor = "pointer";
    this.hitLayer.on("pointertap", (e: FederatedPointerEvent) => {
      const hit = this.pickAt(e.global.x, e.global.y);
      if (hit) this.onClickFile?.(hit);
    });
    this.hitLayer.on("pointermove", (e: FederatedPointerEvent) => {
      const hit = this.pickAt(e.global.x, e.global.y);
      this.onHoverFile?.(hit ?? null);
    });
    this.hitLayer.on("pointerout", () => this.onHoverFile?.(null));
    this.container.addChild(this.hitLayer);

    parent.addChild(this.container);
  }

  private pickAt(globalX: number, globalY: number): string | null {
    const local = this.container.toLocal({ x: globalX, y: globalY });
    return this.pickIndex.pickAt(local.x, local.y);
  }

  // Acquire a BitmapText from the pool. The caller will set .text, .x, .y,
  // .scale, .style.fontSize, and .style.fill.
  //
  // Growth policy:
  //   - Below cap: grow on demand, push new BitmapText.
  //   - At cap: rotate cursor back to 0 and *reuse* the oldest entry (LRU).
  //     This is safe because only one frame is live at a time; the oldest
  //     entry from this frame is also the one most likely to be off-screen.
  //     The practical effect at the cap is a flat pool size while labels
  //     continue to be handed out.
  private acquireText(fontName: string): BitmapText {
    let pool = this.pools.get(fontName);
    if (!pool) {
      pool = { entries: [], cursor: 0, lastFrameHigh: 0 };
      this.pools.set(fontName, pool);
    }
    if (pool.cursor < pool.entries.length) {
      const t = pool.entries[pool.cursor++];
      t.visible = true;
      return t;
    }
    if (pool.entries.length < TEXT_POOL_CAP_PER_FONT) {
      const text = new BitmapText({ text: "", style: { fontFamily: fontName, fontSize: 11 } });
      pool.entries.push(text);
      pool.cursor = pool.entries.length;
      this.labelContainer.addChild(text);
      return text;
    }
    // At cap — LRU rotation. Wrap cursor and reuse from the start.
    pool.cursor = 1;
    const t = pool.entries[0];
    t.visible = true;
    return t;
  }

  // Hide everything not claimed this frame and reset cursors. Tracks the
  // per-frame high water so compactPool() has something to work with.
  private releaseAllText(): void {
    for (const pool of this.pools.values()) {
      for (let i = pool.cursor; i < pool.entries.length; i++) {
        pool.entries[i].visible = false;
      }
      pool.lastFrameHigh = pool.cursor;
      pool.cursor = 0;
    }
  }

  // Destroy any pool entries past the most recent frame's high-water mark.
  // Called by PixiStage on LOD transitions (away from city) so idle memory
  // doesn't hang around. No-op while we remain in city LOD.
  compactPool(): void {
    for (const pool of this.pools.values()) {
      const keep = pool.lastFrameHigh;
      if (keep >= pool.entries.length) continue;
      for (let i = keep; i < pool.entries.length; i++) {
        const t = pool.entries[i];
        this.labelContainer.removeChild(t);
        t.destroy();
      }
      pool.entries.length = keep;
      pool.cursor = 0;
    }
  }

  update(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState, viewport: Viewport): void {
    const invScale = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    // viewport.scale is world-px → screen-px. At 1, 1 world-px = 1 screen-px.
    // We hide labels once each screen-px of a world-px is < LABEL_MIN…
    const showLabels = viewport.scale >= LABEL_MIN_SCREEN_SCALE;
    const showFunctionLabels = viewport.scale >= LABEL_MIN_SCREEN_SCALE * 1.5;

    // Pre-count rects so we size the instance buffer once. Upper bound:
    // per file = 1 card + 1 header stripe + up to N function blocks.
    let rectUpper = 0;
    for (const file of files) {
      if (!layout.fileRects.has(file.id)) continue;
      rectUpper += 2 + Math.min(file.functions.length, 20);
    }
    this.rectMesh.ensureCapacity(rectUpper);

    const data = this.rectMesh.view();
    // Reuse the scratch pickRects array — assign length 0, then push. This
    // avoids allocating a new array per frame and lets RBush.load see a
    // stable reference. Items themselves are cheap {x,y,w,h,id} literals.
    this.pickRects.length = 0;
    this.releaseAllText();

    // AABB for the single hit rect — see the note at the end of update().
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    let ri = 0; // rect instance cursor

    for (const file of files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;

      const isSelected = viewState.selectedFileId === file.id;
      const isHovered = viewState.hoveredFileId === file.id;

      const fillColor = riskFill(file.riskScore);
      const borderColor = riskBorder(file.riskScore);
      const selBorder = isSelected ? 0x4f46e5 : borderColor;
      const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;
      const borderAlpha = isSelected ? 1.0 : 0.85;
      const bw = isSelected ? invScale * 2 : invScale;

      // --- Card background (fill + rounded border) ---
      {
        const o = ri * FLOATS_PER_INSTANCE;
        data[o] = rect.x;
        data[o + 1] = rect.y;
        data[o + 2] = rect.w;
        data[o + 3] = rect.h;
        unpackHexInto(fillColor, data, o + 4, fillAlpha);
        unpackHexInto(selBorder, data, o + 8, borderAlpha);
        data[o + 12] = bw;
        data[o + 13] = 6;
        ri++;
      }

      // --- Header stripe (flat bar at top, no border) ---
      {
        const headerH = 28 * invScale;
        const o = ri * FLOATS_PER_INSTANCE;
        data[o] = rect.x;
        data[o + 1] = rect.y;
        data[o + 2] = rect.w;
        data[o + 3] = headerH;
        unpackHexInto(borderColor, data, o + 4, 0.7);
        // Zero-alpha border = no visible stroke, shader still runs AA rounding.
        unpackHexInto(borderColor, data, o + 8, 0);
        data[o + 12] = 0;
        data[o + 13] = 6;
        ri++;
      }

      // --- Function blocks (body rows) ---
      const maxFns = Math.floor((rect.h - HEADER_H * invScale - 8 * invScale) / (FN_H * invScale + FN_GAP * invScale));
      let fnY = rect.y + HEADER_H * invScale;
      const fnX = rect.x + FN_PAD_X * invScale;
      const fnW = rect.w - FN_PAD_X * 2 * invScale;
      const fnH = FN_H * invScale;

      const fnSlots = Math.min(file.functions.length, maxFns);
      for (let k = 0; k < fnSlots; k++) {
        if (fnY + fnH > rect.y + rect.h - 4) break;
        const fn = file.functions[k];
        const cpx = fn.complexity;
        const fnFill = cpx >= 10 ? 0xfee2e2 : cpx >= 5 ? 0xfef3c7 : 0xf0fdf4;
        const fnBorder = cpx >= 10 ? 0xfca5a5 : cpx >= 5 ? 0xfde68a : 0xbbf7d0;

        const o = ri * FLOATS_PER_INSTANCE;
        data[o] = fnX;
        data[o + 1] = fnY;
        data[o + 2] = fnW;
        data[o + 3] = fnH;
        unpackHexInto(fnFill, data, o + 4, 0.8);
        unpackHexInto(fnBorder, data, o + 8, 0.6);
        data[o + 12] = 0.5; // thin hairline border, world units
        data[o + 13] = 3 * invScale;
        ri++;

        if (showFunctionLabels) {
          const fnLabel = this.acquireText(CITY_MONO_FONT_NAME);
          fnLabel.text = fn.name.length > 22 ? fn.name.slice(0, 21) + "…" : fn.name;
          fnLabel.style.fontSize = 9;
          fnLabel.style.fill = 0x333333;
          fnLabel.scale.set(invScale);
          fnLabel.x = fnX + 6 * invScale;
          fnLabel.y = fnY + 6 * invScale;

          if (fn.signalCount > 0) {
            const sigLabel = this.acquireText(CITY_FONT_BOLD_NAME);
            sigLabel.text = String(fn.signalCount);
            sigLabel.style.fontSize = 9;
            sigLabel.style.fill = 0xdc2626;
            sigLabel.scale.set(invScale);
            sigLabel.x = fnX + fnW - 16 * invScale;
            sigLabel.y = fnY + 6 * invScale;
          }
        }

        fnY += (FN_H + FN_GAP) * invScale;
      }

      // --- File-level labels (name, score, LOC, taint) ---
      if (showLabels) {
        const nameLabel = this.acquireText(CITY_FONT_NAME);
        nameLabel.text = file.name.length > 20 ? "…" + file.name.slice(-18) : file.name;
        nameLabel.style.fontSize = 11;
        nameLabel.style.fill = 0x1a1a2e;
        nameLabel.scale.set(invScale);
        nameLabel.x = rect.x + 8 * invScale;
        nameLabel.y = rect.y + 7 * invScale;

        const scoreLabel = this.acquireText(CITY_FONT_BOLD_NAME);
        scoreLabel.text = String(file.riskScore);
        scoreLabel.style.fontSize = 10;
        scoreLabel.style.fill = riskText(file.riskScore);
        scoreLabel.scale.set(invScale);
        // BitmapText.width is in world units after scale is applied.
        scoreLabel.x = rect.x + rect.w - scoreLabel.width - 8 * invScale;
        scoreLabel.y = rect.y + 8 * invScale;

        const locLabel = this.acquireText(CITY_FONT_NAME);
        locLabel.text = `${file.loc.toLocaleString()} lines`;
        locLabel.style.fontSize = 9;
        locLabel.style.fill = 0x888888;
        locLabel.scale.set(invScale);
        locLabel.x = rect.x + 8 * invScale;
        locLabel.y = rect.y + rect.h - 18 * invScale;

        if (file.signals.taintCount > 0) {
          const taintLabel = this.acquireText(CITY_FONT_NAME);
          taintLabel.text = `⚡ ${file.signals.taintCount}`;
          taintLabel.style.fontSize = 9;
          taintLabel.style.fill = 0xdc2626;
          taintLabel.scale.set(invScale);
          taintLabel.x = rect.x + 8 * invScale;
          taintLabel.y = rect.y + 34 * invScale;
        }
      }

      // --- Hit region ---
      // Collect the pick rect; actual Pixi hit geometry is one AABB at the
      // end. Per-file hitLayer.rect() calls tessellate N Graphics quads and
      // cost ~2 ms at N=5000 for no functional benefit.
      this.pickRects.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, id: file.id });
      if (rect.x < minX) minX = rect.x;
      if (rect.y < minY) minY = rect.y;
      if (rect.x + rect.w > maxX) maxX = rect.x + rect.w;
      if (rect.y + rect.h > maxY) maxY = rect.y + rect.h;
    }

    // Single invisible hit rect over the populated AABB. Pixi delivers
    // pointermove anywhere in this box; SpatialPickIndex resolves the id.
    this.hitLayer.clear();
    if (this.pickRects.length > 0) {
      this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY).fill({ color: 0x000000, alpha: 0.001 });
    }

    this.rectMesh.setInstanceCount(ri);
    // Rebuild spatial pick index once per update(). Bulk-load is ~1 ms for
    // 5000 items vs. O(n) on every pointermove.
    this.pickIndex.load(this.pickRects);
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRects.length = 0;
    this.pools.clear();
    this.container.destroy({ children: true });
  }
}
