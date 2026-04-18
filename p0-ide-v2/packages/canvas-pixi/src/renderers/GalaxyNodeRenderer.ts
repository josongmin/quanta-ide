import { Container } from "pixi.js";
import type { FileNode, WorkspaceLayout, WorkspaceMetrics, ViewState, Viewport, FileLatency, Rect } from "@quanta/canvas-engine";
import { latencyColor, mixHex } from "@quanta/canvas-engine";
import { FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { type PickRect } from "./shared/SpatialPickIndex";
import { RectNodeRenderer } from "./shared/RectNodeRenderer";
import { riskFill, riskBorder, SELECTION_ACCENT } from "./shared/colors";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";
import { makeGrowingPool, type GrowingPool } from "./shared/pixi-guards";

// Cost-overlay tint strength, matches CityNodeRenderer's LATENCY_MIX_K so
// the two tiers agree visually when the user scrolls between them.
const LATENCY_MIX_K = 0.35;

// Galaxy LOD (scale < 0.15): the whole codebase from far away. Each file card
// is tens of CSS pixels — text would be unreadable. This renderer is stripped
// to rectangles-only and draws them via an instanced Mesh: 5000 files → 1
// draw call, no per-file Graphics allocation, no vertex-buffer churn.
//
// Hit testing: the base class' hitLayer Graphics covers every card's AABB with
// a near-zero-alpha fill so Pixi's event system can detect pointerover the
// whole node region, but the actual per-rect lookup is done via
// SpatialPickIndex (RBush).

export class GalaxyNodeRenderer extends RectNodeRenderer<FileNode> {
  // Scratch — captured from update() so renderInstance() can see the
  // per-frame viewport/viewState without re-wiring every call site.
  private frameViewState: ViewState | null = null;
  private frameLayout: WorkspaceLayout | null = null;
  // Per-file centrality metrics. When present, `renderInstance` scales the
  // dot by log(1 + degree) — hub files render noticeably larger so users
  // can spot them at a glance (Sourcegraph/Gephi-style centrality sizing).
  private frameMetrics: WorkspaceMetrics | null = null;
  private frameStrokeW = 1;
  private frameLatency: Record<string, FileLatency> | null = null;
  private frameShowLatency = false;

  // File id → instance row index. Maintained across full rebuilds so a
  // selection-only change can rewrite just 2 rows (old + new) instead of
  // repacking the whole 5000-instance buffer.
  private fileIdToInstanceIdx: Map<string, number> = new Map();
  private prevSelectedFileId: string | null = null;
  private prevHoveredFileId: string | null = null;
  // Same id-set hash as SpatialPickIndex uses internally — when the visible
  // file set is unchanged we can short-circuit to the partial path.
  private prevFileIdsKey: string | null = null;
  private prevInstanceCount = 0;
  // Last-frame cost-overlay flag. Flipping it changes every file's colour,
  // so we must force the full rebuild path even if the id set is unchanged.
  private prevShowLatency = false;
  // Last-frame metrics reference. `writeRow` reads `metrics.perFile.get(id)?.degree`
  // to scale hub rects — if the upstream swaps the metrics object (canvas-engine
  // rebuilds a fresh `Map` on every recompute, see graph/metrics.ts) but the
  // visible id set is unchanged, the partial path would otherwise leave 4998/5000
  // rows with stale scale. Identity compare is sufficient because computeMetrics
  // always returns a new object (never mutates in place).
  private prevMetricsRef: WorkspaceMetrics | null = null;
  // Last-frame latency record. Even when `showLatencyOverlay` flag is stable,
  // the per-file p95 numbers inside `latency` can change; partial path would
  // miss that. Same identity-compare rationale as metrics.
  private prevLatencyRef: Record<string, FileLatency> | null = null;

  // Pool of PickRect slots reused across frames. renderInstance returns a
  // slot from here instead of `{ x, y, w, h, id }` — on a full 5000-file
  // rebuild that avoids 5000 object literals per frame. The base class
  // clears its `pickRects` reference array each updateBase, but the slots
  // themselves survive because we keep this pool's capacity pinned.
  private pickRectPool: GrowingPool<PickRect> = makeGrowingPool<PickRect>(
    () => ({ x: 0, y: 0, w: 0, h: 0, id: "" }),
  );
  // Cursor advances once per renderInstance call inside a single updateBase.
  // Reset to 0 before each full rebuild; partial updates don't use the pool
  // (they mutate existing buffer rows, not pickRects).
  private pickRectCursor = 0;

  constructor(
    parent: Container,
    opts?: {
      onClick?: (fileId: string) => void;
      onHover?: (fileId: string | null) => void;
    },
  ) {
    super(parent, 1024, { onClick: opts?.onClick, onHover: opts?.onHover }, "galaxy");
  }

  // Fill one instance row for a file. Base class tracks AABB + pickRect.
  protected renderInstance(file: FileNode, i: number, data: Float32Array): PickRect | null {
    const layout = this.frameLayout!;
    const rect = layout.fileRects.get(file.id);
    if (!rect) return null;
    const { x, y, w, h } = this.writeRow(file, rect, i, data);

    this.fileIdToInstanceIdx.set(file.id, i);
    // Pick rect mirrors the rendered (possibly scaled) AABB so hover targets
    // the visually larger hub, not the underlying small card position.
    // Pooled slot — cursor advances as the base iterates renderInstance on
    // the full-rebuild path. `pickRectCursor` is pre-reset to 0 in update()
    // before updateBase, and the pool was grown to `valid.length` there.
    const slot = this.pickRectPool.slots[this.pickRectCursor++];
    slot.x = x;
    slot.y = y;
    slot.w = w;
    slot.h = h;
    slot.id = file.id;
    return slot;
  }

  // Shared data-buffer write. Used by both full (via renderInstance) and
  // partial (via partialUpdateSelection) paths. Returns the on-screen AABB
  // so the full path can hand it back to the pick-rect pool — the partial
  // path discards the return value because the pickRects list is unchanged
  // (selection flips don't move cards).
  private writeRow(file: FileNode, rect: Rect, i: number, data: Float32Array): Rect {
    const viewState = this.frameViewState!;
    const isSelected = viewState.selectedFileId === file.id;
    const isHovered = viewState.hoveredFileId === file.id;

    let fillColor = riskFill(file.riskScore);
    let baseBorder = riskBorder(file.riskScore);
    // Galaxy cost tint: apply the same LATENCY_MIX_K drift as city so the
    // two tiers stay visually consistent as the user zooms. At galaxy each
    // card is only a few screen-px, so the tint is the primary signal —
    // tiny rects still communicate "cold green" vs "hot red" at a glance.
    if (this.frameShowLatency && this.frameLatency) {
      const entry = this.frameLatency[file.id];
      if (entry) {
        const latCol = latencyColor(entry.p95);
        fillColor = mixHex(fillColor, latCol, LATENCY_MIX_K);
        baseBorder = mixHex(baseBorder, latCol, LATENCY_MIX_K);
      }
    }
    const borderColor = isSelected ? SELECTION_ACCENT : baseBorder;
    const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;
    const borderAlpha = isSelected ? 1.0 : 0.7;
    const bw = isSelected ? this.frameStrokeW * 2 : this.frameStrokeW;

    // Degree-based hub sizing. Scale = clamp(1 + log1p(degree) * 0.3, 1, 2.5)
    // keeps leaves at their base size (scale=1) and makes a 30-degree hub
    // render ≈2.0× wider — noticeable without breaking layout collisions
    // because we scale around the rect centre rather than the top-left.
    // Without `frameMetrics` this degenerates to the unscaled card.
    let scale = 1;
    if (this.frameMetrics) {
      const m = this.frameMetrics.perFile.get(file.id);
      const deg = m?.degree ?? 0;
      if (deg > 0) {
        const s = 1 + Math.log1p(deg) * 0.3;
        scale = s < 1 ? 1 : s > 2.5 ? 2.5 : s;
      }
    }
    const w = rect.w * scale;
    const h = rect.h * scale;
    const x = rect.x - (w - rect.w) * 0.5;
    const y = rect.y - (h - rect.h) * 0.5;

    const o = i * FLOATS_PER_INSTANCE;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = w;
    data[o + 3] = h;
    unpackHexInto(fillColor, data, o + 4, fillAlpha);
    unpackHexInto(borderColor, data, o + 8, borderAlpha);
    data[o + 12] = bw;
    data[o + 13] = 6; // corner radius

    return { x, y, w, h };
  }

  update(
    files: FileNode[],
    layout: WorkspaceLayout,
    viewState: ViewState,
    viewport: Viewport,
    metrics: WorkspaceMetrics | null = null,
    latency: Record<string, FileLatency> | null = null,
    showLatencyOverlay = false,
  ): void {
    this.frameStrokeW = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    this.frameLayout = layout;
    this.frameViewState = viewState;
    this.frameMetrics = metrics;
    this.frameLatency = latency;
    this.frameShowLatency = showLatencyOverlay;

    // Build the id-set cache key (same rounding scheme as SpatialPickIndex
    // so the two caches invalidate in lockstep).
    const idsKey = this.buildIdsKey(files, layout);
    const selection = viewState.selectedFileId ?? null;
    const hover = viewState.hoveredFileId ?? null;
    const selectionChanged = selection !== this.prevSelectedFileId || hover !== this.prevHoveredFileId;

    const overlayChanged = showLatencyOverlay !== this.prevShowLatency;
    // Metrics / latency identity must be stable for partial path: writeRow
    // reads per-file degree (metrics) and per-file p95 (latency) to compute
    // scale + tint. If either ref changed we cannot safely skip 4998/5000
    // rows — every row might need a new scale/colour. Cheap ref compare;
    // canvas-engine recomputes produce fresh objects, so this catches all
    // real changes without a hash walk.
    const metricsChanged = metrics !== this.prevMetricsRef;
    const latencyChanged = latency !== this.prevLatencyRef;
    if (
      idsKey === this.prevFileIdsKey &&
      selectionChanged &&
      !overlayChanged &&
      !metricsChanged &&
      !latencyChanged &&
      this.prevInstanceCount > 0
    ) {
      // Partial path: the visible file set is unchanged; only the selection
      // or hover flipped. Rewrite at most 2 rows (old + new) instead of the
      // whole buffer (for 5000 files, that's ~10 bytes of writes instead of
      // 280 KB). Pixi's `Buffer.update(sizeInBytes)` only supports a prefix
      // upload, so we still re-upload all bytes — but skipping 5000 JS
      // loops around `unpackHexInto` etc. is the win.
      this.partialUpdateSelection(files, layout, viewState);
      this.prevSelectedFileId = selection;
      this.prevHoveredFileId = hover;
      return;
    }

    // Full path.
    this.fileIdToInstanceIdx.clear();
    // updateBase uses rect index → fileId iteration; null returns (missing
    // in layout) mean we write fewer meaningful rows than we advance — skip
    // those by filtering ahead so the row/index stay aligned.
    const valid: FileNode[] = [];
    for (const f of files) {
      if (layout.fileRects.has(f.id)) valid.push(f);
    }
    // Pre-grow the pick-rect pool to the upper bound before the base walks
    // renderInstance — the cursor increments inside each call, so the
    // capacity has to be in place first. Reset cursor so the first call
    // lands on slot 0.
    this.pickRectPool.grow(valid.length);
    this.pickRectCursor = 0;
    this.prevInstanceCount = this.updateBase(valid);
    this.prevFileIdsKey = idsKey;
    this.prevSelectedFileId = selection;
    this.prevHoveredFileId = hover;
    this.prevShowLatency = showLatencyOverlay;
    // Record identity of inputs that `writeRow` reads beyond files+layout.
    // The partial path re-enters only if these are strictly the same object.
    this.prevMetricsRef = metrics;
    this.prevLatencyRef = latency;
  }

  // Partial rewrite: only the affected instance rows (old selection, new
  // selection, old hover, new hover — union up to 4 rows). All other rows
  // in the Float32Array are already correct from the last full rebuild.
  private partialUpdateSelection(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState): void {
    const data = this.rectMesh.view();
    const affected = new Set<string>();
    if (this.prevSelectedFileId) affected.add(this.prevSelectedFileId);
    if (this.prevHoveredFileId) affected.add(this.prevHoveredFileId);
    if (viewState.selectedFileId) affected.add(viewState.selectedFileId);
    if (viewState.hoveredFileId) affected.add(viewState.hoveredFileId);

    // Saved per-frame scratch from the full path — still valid for a
    // selection-only tick (viewport.scale may have changed slightly but we
    // gate on scaleBucket up in PixiStage; selection ticks won't change it).
    const prevViewState = this.frameViewState;
    this.frameViewState = viewState;
    this.frameLayout = layout;

    // Direct `writeRow` — deliberately bypasses renderInstance (and its
    // pick-rect pool write) because selection flips don't move the file's
    // on-screen AABB. base.pickRects from the last full rebuild still points
    // at the correct pool slot for every file, so the pickIndex stays
    // consistent without us re-loading it.
    for (const file of files) {
      if (!affected.has(file.id)) continue;
      const idx = this.fileIdToInstanceIdx.get(file.id);
      if (idx === undefined) continue;
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;
      this.writeRow(file, rect, idx, data);
    }

    // Upload the prefix that contains all our written rows. Pixi doesn't
    // expose byteOffset on update(), so we have to upload from 0 to the
    // last-touched row end. Over 5000 rows this still beats the full
    // repack's allocation+packing cost: the JS work is tiny.
    this.rectMesh.setInstanceCount(this.prevInstanceCount);
    // Restore scratch — avoids leaking state if a downstream renderer
    // shares any of the frameLayout reference semantics.
    void prevViewState;
  }

  private buildIdsKey(files: FileNode[], layout: WorkspaceLayout): string {
    if (files.length === 0) return "";
    let s = String(files.length);
    for (const f of files) {
      const r = layout.fileRects.get(f.id);
      if (!r) continue;
      s += "|" + f.id + "," + (r.x | 0) + "," + (r.y | 0) + "," + (r.w | 0) + "," + (r.h | 0);
    }
    return s;
  }

  override clear(): void {
    super.clear();
    this.fileIdToInstanceIdx.clear();
    this.prevFileIdsKey = null;
    this.prevSelectedFileId = null;
    this.prevHoveredFileId = null;
    this.prevInstanceCount = 0;
    this.pickRectCursor = 0;
    // Drop identity refs so the next update() cannot accidentally enter the
    // partial path against a pre-clear metrics/latency object.
    this.prevMetricsRef = null;
    this.prevLatencyRef = null;
    this.prevShowLatency = false;
  }

  override destroy(): void {
    this.fileIdToInstanceIdx.clear();
    this.pickRectPool.reset();
    this.prevMetricsRef = null;
    this.prevLatencyRef = null;
    super.destroy();
  }
}

// Self-register with the LOD tier registry. Import side-effect; the renderers
// barrel pulls this module at app init so `PixiStage` finds the factory.
registerRenderer("galaxy", (parent, callbacks): RendererHandle => {
  const inst = new GalaxyNodeRenderer(parent, {
    onClick: callbacks.onFileClick,
    onHover: callbacks.onFileHover,
  });
  return {
    update(ctx: RenderContext): void {
      // Galaxy only activates at `sceneKind === "files"`. Any other ctx here
      // is a PixiStage dispatch bug — ignore rather than throw (a console
      // warn would drown the hot path; silent no-op is safest).
      if (ctx.sceneKind !== "files") return;
      // Galaxy deliberately ignores `ctx.elevationMode` — the tier may
      // render 5000+ files; a per-file shadow overlay would blow the
      // instanced fast path. Elevation activates at city and finer tiers.
      // Cost overlay is cheap (a single mix per rect) and opt-in.
      inst.update(
        ctx.files,
        ctx.layout,
        ctx.viewState,
        ctx.viewport,
        ctx.metrics ?? null,
        ctx.latency ?? null,
        ctx.showLatencyOverlay ?? false,
      );
    },
    clear(): void { inst.clear(); },
    destroy(): void { inst.destroy(); },
  };
});
