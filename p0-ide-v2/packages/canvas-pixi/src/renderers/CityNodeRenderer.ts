import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport, FileLatency, Rect } from "@quanta/canvas-engine";
import { elevationFromRisk, latencyColor, mixHex } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_NAME, CITY_FONT_BOLD_NAME, CITY_MONO_FONT_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";
import {
  riskFill,
  riskBorder,
  riskText,
  complexityFill,
  complexityBorder,
  SELECTION_ACCENT,
  SIGNAL_ACCENT,
} from "./shared/colors";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";

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

const HEADER_H = 32;
const FN_H = 22;
const FN_GAP = 2;
const FN_PAD_X = 8;

// Cost-overlay tint factor: how far to drift the risk fill toward the
// latency colour. 0.35 keeps the risk hue readable while the latency shift
// is unmistakable — picked so a green "low risk" card with a red hot path
// reads as warm-amber (you can tell something is wrong without losing the
// risk baseline).
const LATENCY_MIX_K = 0.35;

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

interface InstanceStyle {
  fillColor: number;
  borderColor: number;
  selBorder: number;
  fillAlpha: number;
  borderAlpha: number;
  isSelected: boolean;
}

interface FrameCtx {
  data: Float32Array;
  ri: number;
  invScale: number;
  showLabels: boolean;
  showFunctionLabels: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// BitmapText style setters trigger atlas re-lookup and re-layout inside Pixi
// even when the new value equals the old one — walking thousands of labels
// per frame, this turns into one of the biggest allocators in a dev-build.
// Guarded assignment is the cheapest fix: TypeScript's own narrowing lets
// V8 inline both branches. Colour fills are compared numerically because
// .style.fill may also accept colour objects; we only ever write numbers
// here so number-equality is sufficient.
function setFontSize(bt: BitmapText, size: number): void {
  if (bt.style.fontSize !== size) bt.style.fontSize = size;
}
function setFill(bt: BitmapText, color: number): void {
  if (bt.style.fill !== color) bt.style.fill = color;
}

// Per-file render-state cache used as a dirty-flag. If every field in this
// snapshot matches the one from the previous frame, the file's label text
// and risk/complexity colours haven't changed — we can skip the text-mutation
// and string-formatting work entirely (the instanced rect mesh still needs
// its slot written, but that's a plain Float32Array write, not a setter).
//
// NOTE: position-related fields (card.x/y/w/h, invScale, showLabels) are
// *intentionally excluded* — those change every pan/zoom frame, and the
// labels themselves don't need re-computed text when only geometry shifts.
// We re-apply x/y/scale each frame regardless; the dirty flag only gates
// the expensive path (new text string, style.fontSize setter, style.fill
// setter — all of which trigger BitmapText invalidation inside Pixi).
interface FileLabelSnapshot {
  name: string;
  nameLen: number;
  riskScore: number;
  loc: number;
  taintCount: number;
  fnCount: number;
  // Function signature hash — counts + first N names concatenated. We don't
  // need a perfect hash: if two distinct function sets collide here it only
  // means we miss one dirty-invalidation, and the label text stays one frame
  // stale. Acceptable for a render-only cache.
  fnSig: string;
  showFunctionLabels: boolean;
  // Cached pre-computed label strings — reused when snapshot matches.
  nameLabel: string;
  scoreLabel: string;
  locLabel: string;
  taintLabel: string;
  // Cached fn text per slot (matches fnSlots from last dirty pass).
  fnLabels: string[];
  fnSigLabels: (string | null)[];
}

export class CityNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;           // card bgs + function blocks
  private shadowLayer: Graphics;                 // elevation drop shadows (pre-mesh pass)
  private labelContainer: Container;             // holds BitmapText children
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  // Scratch buffer reused across frames for SpatialPickIndex.load(). We own
  // the array so we can trim its length without reallocating.
  private pickRects: PickRect[] = [];

  // Text pool keyed by font name. Each pool grows until TEXT_POOL_CAP_PER_FONT,
  // then LRU-rotates (cursor wraps and overwrites oldest entries).
  private pools: Map<string, TextPool> = new Map();

  // Per-file dirty-flag cache. In city LOD most frames are pan/zoom — the
  // FileNode content itself isn't mutating, only the camera. Comparing the
  // current snapshot against the cached one lets us skip the expensive
  // label-formatting (string concat + substring + toLocaleString) and the
  // BitmapText setter chain (text / style.fontSize / style.fill each force
  // an atlas/layout invalidation in Pixi) when nothing changed.
  private labelCache: Map<string, FileLabelSnapshot> = new Map();

  // Pool-allocated pick rects. Pre-grown to the visible-file count so the
  // hot loop can overwrite existing `{x,y,w,h,id}` slots in place instead
  // of pushing a fresh object literal per file per frame.
  private pickRectsCapacity = 0;

  // Rolling hash of (id, elevation, card geometry) for the last frame's
  // elevated set. Shadow layer only needs re-painting when the hash or the
  // elevated-file count changes — pan/zoom leaves both invariant because
  // card rects are world-space and the parent Container handles the view
  // transform.
  private lastShadowHash = 0;
  private lastShadowCount = 0;

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
    this.shadowLayer = new Graphics();
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();

    this.onClickFile = opts?.onClick;
    this.onHoverFile = opts?.onHover;

    // Z-order: shadows → rects → labels → hit layer. The shadow layer is
    // a single Graphics the elevation pass paints offset rects into —
    // ~one rect per elevated file, drawn *before* the instanced mesh so
    // the card body visually sits atop its own shadow.
    this.container.addChild(this.shadowLayer);
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

  update(
    files: FileNode[],
    layout: WorkspaceLayout,
    viewState: ViewState,
    viewport: Viewport,
    elevationMode = false,
    latency?: Record<string, FileLatency>,
    showLatencyOverlay = false,
  ): void {
    const invScale = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    // viewport.scale is world-px → screen-px. At 1, 1 world-px = 1 screen-px.
    // We hide labels once each screen-px of a world-px is < LABEL_MIN…
    const showLabels = viewport.scale >= LABEL_MIN_SCREEN_SCALE;
    const showFunctionLabels = viewport.scale >= LABEL_MIN_SCREEN_SCALE * 1.5;

    let rectUpper = 0;
    for (const file of files) {
      if (!layout.fileRects.has(file.id)) continue;
      rectUpper += 2 + Math.min(file.functions.length, 20);
    }
    this.rectMesh.ensureCapacity(rectUpper);

    const data = this.rectMesh.view();
    // Pre-grow pick-rect pool so the loop can overwrite slots in place
    // instead of allocating a new `{x,y,w,h,id}` object per file per frame.
    this.ensurePickRectCapacity(files.length);
    let pickCount = 0;
    this.releaseAllText();

    const frame: FrameCtx = {
      data,
      ri: 0,
      invScale,
      showLabels,
      showFunctionLabels,
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };

    // Accumulate a rolling hash over elevated cards. If the hash and count
    // match last frame's, we can skip the whole shadow-pass (clear + N
    // roundRect() calls) because the previous Graphics still reflects the
    // same scene — pan/zoom is handled at the Container level.
    let shadowHash = 0;
    let shadowCount = 0;

    for (const file of files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;

      const instance = this.resolveInstance(file, viewState, latency, showLatencyOverlay);
      const elevation = elevationMode ? elevationFromRisk(file.riskScore) : 0;
      const card = this.computeCardRect(rect, elevation);

      if (elevation > 0) {
        // Bitwise-OR-with-zero coerces to i32, keeping the hash numeric
        // (no intermediate strings). Collision risk is irrelevant — a
        // false-negative only costs one wasted shadow redraw.
        shadowHash = (shadowHash * 31 + ((card.x | 0) ^ ((card.y | 0) << 1))) | 0;
        shadowHash = (shadowHash * 31 + ((card.w | 0) ^ ((card.h | 0) << 1))) | 0;
        shadowHash = (shadowHash * 31 + (elevation | 0)) | 0;
        shadowCount++;
      }

      this.updateCardShell(frame, card, instance, elevation);
      this.updateHeader(frame, file, card, instance);
      this.updateFunctionBlocks(frame, file, card);
      this.updateFooter(frame, file, card);

      // Overwrite in place — slot is guaranteed to exist thanks to
      // ensurePickRectCapacity.
      const slot = this.pickRects[pickCount++];
      slot.x = card.x;
      slot.y = card.y;
      slot.w = card.w;
      slot.h = card.h;
      slot.id = file.id;

      if (card.x < frame.minX) frame.minX = card.x;
      if (card.y < frame.minY) frame.minY = card.y;
      if (card.x + card.w > frame.maxX) frame.maxX = card.x + card.w;
      if (card.y + card.h > frame.maxY) frame.maxY = card.y + card.h;
    }

    // Truncate logical length — entries past pickCount are retained but
    // invisible to SpatialPickIndex.load. Next frame we'll overwrite them
    // if the visible set grows again.
    this.pickRects.length = pickCount;

    // Re-paint shadow layer only when elevated-card set has changed.
    if (shadowHash !== this.lastShadowHash || shadowCount !== this.lastShadowCount) {
      this.shadowLayer.clear();
      if (elevationMode && shadowCount > 0) {
        for (const file of files) {
          const rect = layout.fileRects.get(file.id);
          if (!rect) continue;
          const elevation = elevationFromRisk(file.riskScore);
          if (elevation <= 0) continue;
          const card = this.computeCardRect(rect, elevation);
          this.updateShadow(card, elevation);
        }
      }
      this.lastShadowHash = shadowHash;
      this.lastShadowCount = shadowCount;
    }

    this.hitLayer.clear();
    if (pickCount > 0) {
      this.hitLayer
        .rect(frame.minX, frame.minY, frame.maxX - frame.minX, frame.maxY - frame.minY)
        .fill({ color: 0x000000, alpha: 0.001 });
    }

    this.rectMesh.setInstanceCount(frame.ri);
    this.pickIndex.load(this.pickRects, "city");
  }

  // Pre-size the pick-rect pool to at least `n` slots. Each new slot is a
  // freshly-minted mutable object so the inner loop can overwrite fields
  // rather than pushing fresh literals. pickRectsCapacity never shrinks —
  // PixiStage holds the renderer for the lifetime of the bundle.
  private ensurePickRectCapacity(n: number): void {
    while (this.pickRectsCapacity < n) {
      this.pickRects.push({ x: 0, y: 0, w: 0, h: 0, id: "" });
      this.pickRectsCapacity++;
    }
    // Expose all allocated slots so indexed writes land on live entries;
    // `update()` trims logical length at the end of the frame.
    if (this.pickRects.length < this.pickRectsCapacity) {
      this.pickRects.length = this.pickRectsCapacity;
    }
  }

  // Build (or reuse) the per-file label snapshot. Returns the cached snapshot
  // object so callers can pull pre-formatted strings when `dirty === false`.
  // Mutates the cache in place to avoid re-allocating the snapshot every
  // frame — the same entry is mutated for each file.id on clean frames too,
  // just without the string-formatting branch.
  private getLabelSnapshot(file: FileNode, showFunctionLabels: boolean): { snap: FileLabelSnapshot; dirty: boolean } {
    let snap = this.labelCache.get(file.id);
    const fnCount = file.functions.length;
    // Cheap fn-signature: count + first function's name. Good enough because
    // a real invalidation (someone editing a file) almost always changes
    // function count or the top function; cosmetic changes lower down take
    // one frame to appear, which is invisible to a user panning around.
    const fnSig = fnCount > 0 ? fnCount + "|" + file.functions[0].name : "0";

    if (snap
      && snap.name === file.name
      && snap.riskScore === file.riskScore
      && snap.loc === file.loc
      && snap.taintCount === file.signals.taintCount
      && snap.fnCount === fnCount
      && snap.fnSig === fnSig
      && snap.showFunctionLabels === showFunctionLabels
    ) {
      return { snap, dirty: false };
    }

    if (!snap) {
      snap = {
        name: "",
        nameLen: 0,
        riskScore: -1,
        loc: -1,
        taintCount: -1,
        fnCount: -1,
        fnSig: "",
        showFunctionLabels,
        nameLabel: "",
        scoreLabel: "",
        locLabel: "",
        taintLabel: "",
        fnLabels: [],
        fnSigLabels: [],
      };
      this.labelCache.set(file.id, snap);
    }

    snap.name = file.name;
    snap.nameLen = file.name.length;
    snap.riskScore = file.riskScore;
    snap.loc = file.loc;
    snap.taintCount = file.signals.taintCount;
    snap.fnCount = fnCount;
    snap.fnSig = fnSig;
    snap.showFunctionLabels = showFunctionLabels;

    // Pre-format label strings. These are the allocations we were paying
    // per-frame before the cache; now they fire only on actual content
    // change.
    snap.nameLabel = file.name.length > 20 ? "…" + file.name.slice(-18) : file.name;
    snap.scoreLabel = String(file.riskScore);
    snap.locLabel = file.loc.toLocaleString() + " lines";
    snap.taintLabel = file.signals.taintCount > 0 ? "⚡ " + file.signals.taintCount : "";

    // Per-function labels. Cached lazily — only build if we'll actually draw
    // function labels at the current zoom, since dirty state is already
    // distinguished by `showFunctionLabels`.
    if (showFunctionLabels) {
      if (snap.fnLabels.length < fnCount) snap.fnLabels.length = fnCount;
      if (snap.fnSigLabels.length < fnCount) snap.fnSigLabels.length = fnCount;
      for (let k = 0; k < fnCount; k++) {
        const fn = file.functions[k];
        snap.fnLabels[k] = fn.name.length > 22 ? fn.name.slice(0, 21) + "…" : fn.name;
        snap.fnSigLabels[k] = fn.signalCount > 0 ? String(fn.signalCount) : null;
      }
      // Trim trailing stale slots if the function count shrank.
      snap.fnLabels.length = fnCount;
      snap.fnSigLabels.length = fnCount;
    }

    return { snap, dirty: true };
  }

  private resolveInstance(
    file: FileNode,
    viewState: ViewState,
    latency: Record<string, FileLatency> | undefined,
    showLatencyOverlay: boolean,
  ): InstanceStyle {
    const baseFill = riskFill(file.riskScore);
    const baseBorder = riskBorder(file.riskScore);
    let fillColor = baseFill;
    let borderColor = baseBorder;
    if (showLatencyOverlay && latency) {
      const entry = latency[file.id];
      if (entry) {
        const latColor = latencyColor(entry.p95);
        fillColor = mixHex(baseFill, latColor, LATENCY_MIX_K);
        borderColor = mixHex(baseBorder, latColor, LATENCY_MIX_K);
      }
    }
    const isSelected = viewState.selectedFileId === file.id;
    const isHovered = viewState.hoveredFileId === file.id;
    return {
      fillColor,
      borderColor,
      selBorder: isSelected ? SELECTION_ACCENT : borderColor,
      fillAlpha: isSelected ? 1.0 : isHovered ? 0.95 : 0.88,
      borderAlpha: isSelected ? 1.0 : 0.85,
      isSelected,
    };
  }

  private computeCardRect(rect: Rect, elevation: number): Rect {
    const scaleK = 1 + elevation / 1000;
    const w = rect.w * scaleK;
    const h = rect.h * scaleK;
    return {
      x: rect.x - (w - rect.w) * 0.5,
      y: rect.y - (h - rect.h) * 0.5,
      w,
      h,
    };
  }

  private updateShadow(card: Rect, elevation: number): void {
    if (elevation <= 0) return;
    const sx = card.x + elevation * 0.3;
    const sy = card.y + elevation * 0.4;
    const sa = Math.min(0.45, elevation / 160);
    this.shadowLayer
      .roundRect(sx, sy, card.w, card.h, 6)
      .fill({ color: 0x000000, alpha: sa });
  }

  private updateCardShell(
    frame: FrameCtx,
    card: Rect,
    instance: InstanceStyle,
    elevation: number,
  ): void {
    const { data } = frame;
    const bw = instance.isSelected ? frame.invScale * 2 : frame.invScale;
    const o = frame.ri * FLOATS_PER_INSTANCE;
    data[o] = card.x;
    data[o + 1] = card.y;
    data[o + 2] = card.w;
    data[o + 3] = card.h;
    unpackHexInto(instance.fillColor, data, o + 4, instance.fillAlpha);
    const tintK = Math.min(0.5, elevation / 160);
    const bColor = tintK > 0 ? mixHex(instance.selBorder, 0x000000, tintK) : instance.selBorder;
    unpackHexInto(bColor, data, o + 8, instance.borderAlpha);
    data[o + 12] = bw;
    data[o + 13] = 6;
    frame.ri++;
  }

  private updateHeader(
    frame: FrameCtx,
    file: FileNode,
    card: Rect,
    instance: InstanceStyle,
  ): void {
    const { data, invScale } = frame;
    const headerH = 28 * invScale;
    const o = frame.ri * FLOATS_PER_INSTANCE;
    data[o] = card.x;
    data[o + 1] = card.y;
    data[o + 2] = card.w;
    data[o + 3] = headerH;
    unpackHexInto(instance.borderColor, data, o + 4, 0.7);
    unpackHexInto(instance.borderColor, data, o + 8, 0);
    data[o + 12] = 0;
    data[o + 13] = 6;
    frame.ri++;

    if (!frame.showLabels) return;

    const { snap } = this.getLabelSnapshot(file, frame.showFunctionLabels);

    const nameLabel = this.acquireText(CITY_FONT_NAME);
    // BitmapText.text setter rebuilds glyph geometry on *every* assignment,
    // even if the string is identical — guard at call site.
    if (nameLabel.text !== snap.nameLabel) nameLabel.text = snap.nameLabel;
    setFontSize(nameLabel, 11);
    setFill(nameLabel, 0x1a1a2e);
    nameLabel.scale.set(invScale);
    nameLabel.x = card.x + 8 * invScale;
    nameLabel.y = card.y + 7 * invScale;

    const scoreLabel = this.acquireText(CITY_FONT_BOLD_NAME);
    if (scoreLabel.text !== snap.scoreLabel) scoreLabel.text = snap.scoreLabel;
    setFontSize(scoreLabel, 10);
    setFill(scoreLabel, riskText(file.riskScore));
    scoreLabel.scale.set(invScale);
    scoreLabel.x = card.x + card.w - scoreLabel.width - 8 * invScale;
    scoreLabel.y = card.y + 8 * invScale;
  }

  private updateFunctionBlocks(frame: FrameCtx, file: FileNode, card: Rect): void {
    const { data, invScale, showFunctionLabels } = frame;
    const maxFns = Math.floor((card.h - HEADER_H * invScale - 8 * invScale) / (FN_H * invScale + FN_GAP * invScale));
    let fnY = card.y + HEADER_H * invScale;
    const fnX = card.x + FN_PAD_X * invScale;
    const fnW = card.w - FN_PAD_X * 2 * invScale;
    const fnH = FN_H * invScale;
    const fnSlots = Math.min(file.functions.length, maxFns);

    const snap = showFunctionLabels
      ? this.getLabelSnapshot(file, showFunctionLabels).snap
      : null;

    for (let k = 0; k < fnSlots; k++) {
      if (fnY + fnH > card.y + card.h - 4) break;
      const fn = file.functions[k];
      const fnFill = complexityFill(fn.complexity);
      const fnBorder = complexityBorder(fn.complexity);

      const o = frame.ri * FLOATS_PER_INSTANCE;
      data[o] = fnX;
      data[o + 1] = fnY;
      data[o + 2] = fnW;
      data[o + 3] = fnH;
      unpackHexInto(fnFill, data, o + 4, 0.8);
      unpackHexInto(fnBorder, data, o + 8, 0.6);
      data[o + 12] = 0.5;
      data[o + 13] = 3 * invScale;
      frame.ri++;

      if (snap) {
        const fnLabel = this.acquireText(CITY_MONO_FONT_NAME);
        const txt = snap.fnLabels[k] ?? "";
        if (fnLabel.text !== txt) fnLabel.text = txt;
        setFontSize(fnLabel, 9);
        setFill(fnLabel, 0x333333);
        fnLabel.scale.set(invScale);
        fnLabel.x = fnX + 6 * invScale;
        fnLabel.y = fnY + 6 * invScale;

        const sigTxt = snap.fnSigLabels[k];
        if (sigTxt !== null && sigTxt !== undefined) {
          const sigLabel = this.acquireText(CITY_FONT_BOLD_NAME);
          if (sigLabel.text !== sigTxt) sigLabel.text = sigTxt;
          setFontSize(sigLabel, 9);
          setFill(sigLabel, SIGNAL_ACCENT);
          sigLabel.scale.set(invScale);
          sigLabel.x = fnX + fnW - 16 * invScale;
          sigLabel.y = fnY + 6 * invScale;
        }
      }

      fnY += (FN_H + FN_GAP) * invScale;
    }
  }

  private updateFooter(frame: FrameCtx, file: FileNode, card: Rect): void {
    if (!frame.showLabels) return;
    const { invScale } = frame;

    const { snap } = this.getLabelSnapshot(file, frame.showFunctionLabels);

    const locLabel = this.acquireText(CITY_FONT_NAME);
    if (locLabel.text !== snap.locLabel) locLabel.text = snap.locLabel;
    setFontSize(locLabel, 9);
    setFill(locLabel, 0x888888);
    locLabel.scale.set(invScale);
    locLabel.x = card.x + 8 * invScale;
    locLabel.y = card.y + card.h - 18 * invScale;

    if (file.signals.taintCount > 0) {
      const taintLabel = this.acquireText(CITY_FONT_NAME);
      if (taintLabel.text !== snap.taintLabel) taintLabel.text = snap.taintLabel;
      setFontSize(taintLabel, 9);
      setFill(taintLabel, SIGNAL_ACCENT);
      taintLabel.scale.set(invScale);
      taintLabel.x = card.x + 8 * invScale;
      taintLabel.y = card.y + 34 * invScale;
    }
  }

  // Parity with the other tier renderers — PixiStage clears every
  // non-active tier per frame. City already de facto clears via `update([])`
  // but exposing clear() lets the registry hand PixiStage a uniform handle.
  clear(): void {
    this.rectMesh.setInstanceCount(0);
    this.hitLayer.clear();
    this.shadowLayer.clear();
    this.pickRects.length = 0;
    this.pickRectsCapacity = 0;
    this.pickIndex.clear();
    this.releaseAllText();
    // Invalidate dirty-flag caches so the next city frame recomputes from
    // scratch — the scene genuinely regenerated, per-file snapshots from a
    // previous tier may no longer reflect what's about to be drawn.
    this.labelCache.clear();
    this.lastShadowHash = 0;
    this.lastShadowCount = 0;
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRects.length = 0;
    this.pickRectsCapacity = 0;
    this.pools.clear();
    this.labelCache.clear();
    this.container.destroy({ children: true });
  }
}

registerRenderer("city", (parent, callbacks): RendererHandle => {
  const inst = new CityNodeRenderer(parent, {
    onClick: callbacks.onFileClick,
    onHover: callbacks.onFileHover,
  });
  return {
    update(ctx: RenderContext): void {
      if (ctx.sceneKind !== "files") return;
      inst.update(
        ctx.files,
        ctx.layout,
        ctx.viewState,
        ctx.viewport,
        ctx.elevationMode ?? false,
        ctx.latency,
        ctx.showLatencyOverlay ?? false,
      );
    },
    clear(): void { inst.clear(); },
    destroy(): void { inst.destroy(); },
  };
});
