import { Graphics, Container, Ticker } from "pixi.js";
import type { FileEdge, FileNode, WorkspaceLayout, Viewport, EdgeLayer, EdgeSeverity, Rect, EdgeKind } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";
import { lineAnchor, sideAnchor } from "@quanta/canvas-engine";
import { resolveEdgeStyle, SEVERITY_RANK, CROSS_GRAPH_STYLE, VIOLATION_RED } from "./shared/colors";

// Line-anchored edges with per-kind visual vocabulary:
//   - call / dataflow / impact / taint: arrowhead at target
//   - taint-propagation (animated): flowing dashed stroke (source → sink)
//   - sanitizer: X-cap at target indicating "barrier"
//   - cycle: arc with small badge (rendered by SCC bubble renderer, not here)
//   - reference / effect / alias: dashed pattern (simulated via bezier sampling)
//
// Street/Ground tier: edges attach to perimeter glow dots at the source
// line's Y position inside the file card — Sourcetrail convention.
// City tier: side-centre attachment (still knows direction, not line).
// Galaxy and coarser: rect-centre fallback, same as before.
//
// Animation: `edge.animated === true` shifts the dash pattern by a time
// offset each frame via a single shared ticker.
//
// LOD gating (perf):
//   - street/ground/city:    draw everything the caller passed in.
//   - galaxy:                if visibleEdges > GALAXY_EDGE_BUDGET, downsample
//                             to the top-weighted GALAXY_EDGE_BUDGET edges so
//                             draw cost stays bounded. ~2500 edges at 23fps
//                             (see perf-*.ndjson) drops to ~1200 smooth.
//   - supergalaxy / universe: skip entirely — at that zoom edges are sub-pixel
//                              noise and each bezier still costs draw ops.
//
// Hysteresis:
//   LOD churn (slow↔recovering↔fast boundaries at the perf recorder)
//   produced 83 transitions in a single capture, each one forcing a full
//   edge rebuild. We track the last-applied effective LOD + the scale at
//   which we locked it, and refuse to switch effective modes unless the
//   scale has moved more than LOD_HYSTERESIS_SCALE_FRAC (±10%) from that
//   lock-point. Small jitter near the LOD boundary keeps rendering at the
//   previous mode.

/** Arc-length sampling resolution when we emit dashed segments. Higher =
 *  smoother dash spacing but more draw ops. 24 samples is good to ~1k edges. */
const DASH_SAMPLES_PER_CURVE = 24;
/** Arrow head size in world px, scaled by invScale at draw time. */
const ARROW_HEAD_SIZE = 4;
/** Anchor glow-dot radius (world px), scaled by invScale. */
const ANCHOR_GLOW_RADIUS = 2.2;
/** Shared pixi ticker — one per renderer instance, used to advance dash offset. */

// Tiers where line anchors make sense. Below street the card is too small
// to show lines, so we drop to side or centre anchoring.
const LINE_ANCHOR_TIERS: ReadonlyArray<"street" | "ground"> = ["street", "ground"] as const;
const SIDE_ANCHOR_TIERS: ReadonlyArray<"city"> = ["city"] as const;

/** When galaxy LOD has more edges than this, we downsample to the top-N by
 *  weight. Picked to keep draw cost bounded at ~1200 bezier strokes, which
 *  the perf recorder shows staying under the 45fps slow threshold. */
const GALAXY_EDGE_BUDGET = 1200;
/** LODs that never render edges — pure file-rect / cluster-bubble view. */
const EDGE_SKIP_LODS: ReadonlySet<string> = new Set(["supergalaxy", "universe"]);
/** LODs where we may cap the edge list to GALAXY_EDGE_BUDGET by weight. */
const EDGE_BUDGETED_LODS: ReadonlySet<string> = new Set(["galaxy"]);
/** Fractional scale change required to switch out of the last-applied
 *  effective LOD. Below this we keep rendering in the previous mode to
 *  absorb boundary jitter. 0.1 = ±10%. */
const LOD_HYSTERESIS_SCALE_FRAC = 0.1;
/** Edge-count bucket width used in the cache-key. Small buckets mean tiny
 *  filter changes still hit the same key; too-small and we churn. */
const EDGE_COUNT_BUCKET = 128;

type EffectiveLodMode = "full" | "budgeted" | "skip";

function modeForLod(lod: string | undefined): EffectiveLodMode {
  if (!lod) return "full";
  if (EDGE_SKIP_LODS.has(lod)) return "skip";
  if (EDGE_BUDGETED_LODS.has(lod)) return "budgeted";
  return "full";
}

type AnchorMode = "line" | "side" | "centre";

function pickAnchorMode(lod?: string): AnchorMode {
  if (!lod) return "centre";
  if ((LINE_ANCHOR_TIERS as readonly string[]).includes(lod)) return "line";
  if ((SIDE_ANCHOR_TIERS as readonly string[]).includes(lod)) return "side";
  return "centre";
}

const DIRECTIONAL_KINDS: ReadonlySet<EdgeKind> = new Set<EdgeKind>([
  "call",
  "dataflow",
  "taint-propagation",
  "impact",
  "blast",
  "inheritance",
  "reference",
  "dependency",
]);

export interface EdgeStaticBuildOpts {
  kindFilter?: Partial<Record<EdgeKind, boolean>>;
  layerFilter?: Partial<Record<EdgeLayer, boolean>>;
  minSeverity?: EdgeSeverity;
  widthMul?: number;
  focus?: {
    edgeIds: ReadonlySet<string>;
    dimAlpha: number;
  };
  /**
   * Tier hint — when "street"/"ground", edges attach to per-line glow dots
   * on the file card edge. When "city", attach to side centres. Coarser
   * tiers use rect centres. Defaults to "centre" behaviour if missing.
   */
  lod?: string;
  /** File node map — used to resolve per-file line counts for line anchors. */
  fileById?: Map<string, Pick<FileNode, "loc">>;
  /** Animation offset (world-px). Owned by caller when the driver wants to
   *  share one clock across many frames; otherwise the renderer's internal
   *  ticker drives it. */
  dashOffset?: number;
  /** DSL-compiled additional predicate (layer/kind/severity filter from the
   *  HUD's live query box). Applied AFTER structured filters. */
  customPredicate?: (edge: FileEdge) => boolean;
  /** Arch-violation edge ids. When highlighted, these edges render with an
   *  extra red outline pass so violating cross-layer dependencies stand out. */
  violatingEdgeIds?: ReadonlySet<string>;
  /** Temporal live mode: only edges whose id is in this set render. */
  temporalEdgeSet?: ReadonlySet<string>;
  /** Diff mode: edges to highlight as "added between A and B" (green halo). */
  diffAdded?: ReadonlySet<string>;
  /** Diff mode: edges to render as "removed between A and B" (red dashed
   *  ghost). These are drawn even if they'd otherwise be culled by the
   *  temporal set. */
  diffRemoved?: ReadonlySet<string>;
  /** When false, edges with `crossGraph===true` are skipped entirely. */
  showCrossGraphEdges?: boolean;
  /** When true, cross-graph edges get the gold overlay. When false, they
   *  render with their regular kind/layer style only. */
  highlightCrossGraph?: boolean;
  /** Cross-graph focus flash — when present, these edge ids render at full
   *  alpha and dim others. Used by the HUD "graph sources" row flash. */
  crossGraphFlash?: ReadonlySet<string>;
}

export class EdgeStaticRenderer {
  private gfx: Graphics;
  private previousLength = 0;
  private tickerHandle: ((ticker: Ticker) => void) | null = null;
  private ticker: Ticker | null = null;
  // Internal shared dash offset, advanced by the ticker. Consumed each build()
  // so animated edges "flow" from source to sink. Reset to 0 on destroy().
  private internalDashOffset = 0;
  // Last-build inputs — cached so the ticker can re-draw animated edges
  // without the parent re-submitting the full edge list every frame.
  private lastEdges: FileEdge[] = [];
  private lastLayout: WorkspaceLayout | null = null;
  private lastCache: EdgeGeometryCache | undefined;
  private lastViewport: Viewport | undefined;
  private lastOpts: EdgeStaticBuildOpts | undefined;
  private hasAnimatedEdges = false;

  // ── Hysteresis + cache-key state ────────────────────────────────
  // The effective LOD mode we actually rendered at last build. When the
  // incoming LOD flips (e.g. galaxy ↔ supergalaxy at a boundary), we keep
  // rendering in this mode until the viewport scale has moved far enough
  // away from `appliedScale` to justify a switch. Without this, a scale
  // oscillating across the LOD threshold re-runs the full edge loop on
  // every frame for no visual gain.
  private appliedMode: EffectiveLodMode | null = null;
  private appliedScale = 1;
  // Cache key covering (mode, lod-bucket, edge-count-bucket, filter-hash).
  // Used only to skip redundant geometry work — the final Graphics.clear()
  // + re-stroke still runs so animated dash offsets advance. See
  // `shouldSkipFullRebuild` below.
  private lastCacheKey = "";
  // Pre-sorted + capped edge slice we last emitted in budgeted mode. When
  // the cache key matches, we reuse this slice instead of re-sorting the
  // full edge list.
  private budgetedSlice: FileEdge[] | null = null;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChildAt(this.gfx, 0); // behind everything
    // Shared pixi ticker runs every frame; we early-return when no animated
    // edges exist, so the per-tick cost is a single predicate check.
    this.ticker = Ticker.shared;
    this.tickerHandle = (ticker: Ticker) => {
      if (!this.hasAnimatedEdges) return;
      // 0.25 px/world-unit/tick → ~15 px/s at 60fps. Tunable.
      this.internalDashOffset = (this.internalDashOffset + 0.25 * ticker.deltaTime) % 1000;
      this.redraw();
    };
    this.ticker.add(this.tickerHandle);
  }

  build(
    edges: FileEdge[],
    layout: WorkspaceLayout,
    cache?: EdgeGeometryCache,
    viewport?: Viewport,
    opts?: EdgeStaticBuildOpts,
  ): void {
    this.lastEdges = edges;
    this.lastLayout = layout;
    this.lastCache = cache;
    this.lastViewport = viewport;
    this.lastOpts = opts;
    this.hasAnimatedEdges = edges.some(e => e.animated);
    this.redraw();
  }

  private redraw(): void {
    const edges = this.lastEdges;
    const layout = this.lastLayout;
    if (!layout) return;
    const cache = this.lastCache;
    const viewport = this.lastViewport;
    const opts = this.lastOpts;

    const scale = viewport?.scale ?? 1;

    // ── LOD gate w/ hysteresis ─────────────────────────────────────
    // Decide the effective mode (full / budgeted / skip). Hysteresis
    // keeps us in the previously-applied mode when the incoming LOD flips
    // but the scale has barely moved. This is the main churn-blocker for
    // the 83-transition boundary behaviour surfaced in the perf recorder.
    const incomingMode = modeForLod(opts?.lod);
    let effectiveMode: EffectiveLodMode = incomingMode;
    if (this.appliedMode !== null && this.appliedMode !== incomingMode) {
      const baseScale = this.appliedScale || 1;
      const rel = Math.abs(scale - baseScale) / Math.max(baseScale, 1e-6);
      if (rel < LOD_HYSTERESIS_SCALE_FRAC) {
        // Stay in the previously-locked mode — not enough zoom movement.
        effectiveMode = this.appliedMode;
      }
    }

    // Skip mode: blank the layer, record state, and bail. Supergalaxy /
    // universe tiers never draw edges — at that zoom the curves are
    // sub-pixel and each stroke still costs draw ops.
    if (effectiveMode === "skip") {
      if (this.previousLength !== 0) {
        this.gfx.clear();
        this.previousLength = 0;
      }
      if (this.appliedMode !== effectiveMode) {
        this.appliedMode = effectiveMode;
        this.appliedScale = scale;
        this.lastCacheKey = "skip";
        this.budgetedSlice = null;
      }
      return;
    }

    if (edges.length === 0 && this.previousLength === 0) {
      if (this.appliedMode !== effectiveMode) {
        this.appliedMode = effectiveMode;
        this.appliedScale = scale;
      }
      return;
    }

    // In budgeted mode, cap the edge list to the top-N by weight. We sort
    // a shallow copy so the caller's array order is preserved.
    let workingEdges: FileEdge[] = edges;
    if (effectiveMode === "budgeted" && edges.length > GALAXY_EDGE_BUDGET) {
      workingEdges = [...edges]
        .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
        .slice(0, GALAXY_EDGE_BUDGET);
    }

    // Commit the new applied state now that we've decided mode + slice.
    const edgeBucket = Math.floor(workingEdges.length / EDGE_COUNT_BUCKET);
    const filterHash = computeFilterHash(opts);
    const cacheKey = `${effectiveMode}:${opts?.lod ?? ""}:${edgeBucket}:${filterHash}`;
    if (effectiveMode === "budgeted" && cacheKey === this.lastCacheKey && this.budgetedSlice) {
      // Same bucket + filters: reuse the previously-selected slice so
      // the top-N sort doesn't rerun on every redraw. Animated dashes
      // still flow because we re-stroke below.
      workingEdges = this.budgetedSlice;
    } else if (effectiveMode === "budgeted") {
      this.budgetedSlice = workingEdges;
    } else {
      this.budgetedSlice = null;
    }
    this.lastCacheKey = cacheKey;
    this.appliedMode = effectiveMode;
    this.appliedScale = scale;

    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const widthMul = opts?.widthMul ?? 1;
    const kindFilter = opts?.kindFilter;
    const layerFilter = opts?.layerFilter;
    const focus = opts?.focus;
    const anchorMode = pickAnchorMode(opts?.lod);
    const fileById = opts?.fileById;
    const dashOffset = opts?.dashOffset ?? this.internalDashOffset;
    const minSeverityRank = opts?.minSeverity !== undefined ? SEVERITY_RANK[opts.minSeverity] : -1;

    this.gfx.clear();
    let drawn = 0;

    // Deduplicate glow dots so crossings at the same anchor don't over-render.
    const drawnGlows = new Set<string>();

    const customPredicate = opts?.customPredicate;
    const violatingEdgeIds = opts?.violatingEdgeIds;
    const temporalEdgeSet = opts?.temporalEdgeSet;
    const diffAdded = opts?.diffAdded;
    const diffRemoved = opts?.diffRemoved;
    const showCrossGraphEdges = opts?.showCrossGraphEdges ?? true;
    const highlightCrossGraph = opts?.highlightCrossGraph ?? true;
    const crossGraphFlash = opts?.crossGraphFlash;

    // In diff mode the removed-ghost set may contain edges that are NOT in
    // the live edge list (they existed in snapshot A only). We render them
    // by synthesising a second pass over `diffRemoved` after the main loop.
    // First: main loop that honours all the standard filters plus the live
    // temporal set. In budgeted (galaxy) mode `workingEdges` is a top-N
    // slice of the input; in full mode it's the input array unchanged.
    for (const edge of workingEdges) {
      if (edge.crossGraph && !showCrossGraphEdges) continue;
      if (kindFilter && kindFilter[edge.kind] === false) continue;
      if (layerFilter && layerFilter[edge.layer] === false) continue;
      if (minSeverityRank >= 0) {
        const rank = SEVERITY_RANK[edge.severity ?? "low"];
        if (rank < minSeverityRank) continue;
      }
      if (customPredicate && !customPredicate(edge)) continue;
      // Live-mode temporal gate. Diff mode's `removed` ghosts bypass this
      // via the post-loop below; `added` ghosts stay in the set when the
      // caller already included them in `temporalEdgeSet` (typical: diff
      // mode ignores temporalEdgeSet entirely and leaves all edges drawable).
      if (temporalEdgeSet && !temporalEdgeSet.has(edge.id)) continue;

      const fromRect = layout.fileRects.get(edge.from);
      const toRect = layout.fileRects.get(edge.to);
      const cachedRoute = cache?.get(edge.id) ?? layout.edgeRoutes.get(edge.id);
      if (!fromRect || !toRect) {
        if (!cachedRoute) continue;
      }

      // Compute the anchor pair based on tier + line-anchor availability.
      const anchors = computeAnchors({
        edge,
        fromRect,
        toRect,
        fallbackRoute: cachedRoute,
        anchorMode,
        fileById,
      });
      if (!anchors) continue;
      const { a, b, cp1x, cp1y, cp2x, cp2y } = anchors;

      const style = resolveEdgeStyle(edge);
      const width = style.baseWidth * invScale * widthMul;
      const cap: "round" | "butt" = edge.animated ? "round" : (style.cap ?? "butt");

      let alpha = focus && !focus.edgeIds.has(edge.id)
        ? style.alpha * focus.dimAlpha
        : style.alpha;

      const isCross = edge.crossGraph === true;
      const isFlashed = crossGraphFlash?.has(edge.id) ?? false;
      if (crossGraphFlash && crossGraphFlash.size > 0 && isCross && !isFlashed) {
        alpha = alpha * 0.25;
      }

      if (isCross && highlightCrossGraph) {
        const goldWidth = CROSS_GRAPH_STYLE.baseWidth * invScale * widthMul * (isFlashed ? 1.8 : 1.4);
        const goldAlpha = (isFlashed ? 1 : CROSS_GRAPH_STYLE.alpha);
        drawDashedBezier(
          this.gfx,
          a.x, a.y, cp1x, cp1y, cp2x, cp2y, b.x, b.y,
          CROSS_GRAPH_STYLE.dash ?? [8, 5],
          edge.animated ? dashOffset : 0,
          { color: CROSS_GRAPH_STYLE.color, alpha: goldAlpha, width: goldWidth, cap: "round" },
        );
      }

      // Arch violation — draw a wider red halo underneath so the violating
      // edge reads first regardless of its base colour.
      if (violatingEdgeIds && violatingEdgeIds.has(edge.id)) {
        this.gfx
          .moveTo(a.x, a.y)
          .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
          .stroke({ color: VIOLATION_RED, alpha: 0.45, width: width * 3, cap: "round" });
      }

      // Diff mode — green halo under edges that exist in B but not A.
      if (diffAdded && diffAdded.has(edge.id)) {
        this.gfx
          .moveTo(a.x, a.y)
          .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
          .stroke({ color: 0x22c55e, alpha: 0.55, width: width * 2, cap: "round" });
      }

      // Dashed paths are simulated via arc-length sampling — Pixi v8 Graphics
      // lacks native dashing. Animated dashed edges (taint flow) shift the
      // pattern offset each tick so the user sees source→sink motion.
      if (style.dash || edge.animated) {
        const pattern = style.dash ?? [6, 4];
        drawDashedBezier(
          this.gfx,
          a.x, a.y, cp1x, cp1y, cp2x, cp2y, b.x, b.y,
          pattern,
          edge.animated ? dashOffset : 0,
          { color: style.color, alpha, width, cap },
        );
      } else {
        this.gfx
          .moveTo(a.x, a.y)
          .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y)
          .stroke({ color: style.color, alpha, width, cap });
      }

      // Arrowhead for directional kinds. Placed at the tangent of the curve
      // approaching b (derivative at t=1) so it points inward correctly.
      if (DIRECTIONAL_KINDS.has(edge.kind)) {
        drawArrowHead(
          this.gfx,
          cp2x, cp2y, b.x, b.y,
          ARROW_HEAD_SIZE * invScale,
          { color: style.color, alpha },
        );
      }

      // X-cap barrier for sanitizer edges.
      if (edge.kind === "sanitizer") {
        drawXCap(this.gfx, b.x, b.y, ARROW_HEAD_SIZE * invScale, {
          color: style.color, alpha, width,
        });
      }

      // Glow dots at both anchors (only when mode is line or side).
      if (anchorMode === "line" || anchorMode === "side") {
        for (const pt of [a, b]) {
          const k = `${Math.round(pt.x)},${Math.round(pt.y)}`;
          if (drawnGlows.has(k)) continue;
          drawnGlows.add(k);
          drawGlowDot(this.gfx, pt.x, pt.y, ANCHOR_GLOW_RADIUS * invScale, {
            color: style.color, alpha,
          });
        }
      }

      drawn++;
    }

    // Diff mode — ghost pass for "removed between A and B" edges. These may
    // include edges excluded from the live set above; we paint them here so
    // the reader sees what disappeared alongside what stayed. Short dashes
    // in low-alpha red read as "gone" without competing with the living
    // strokes.
    if (diffRemoved && diffRemoved.size > 0) {
      const GHOST_PATTERN: readonly [number, number] = [4, 4];
      const GHOST_COLOR = 0xef4444;
      const GHOST_ALPHA = 0.35;
      for (const edge of edges) {
        if (!diffRemoved.has(edge.id)) continue;
        const fromRect = layout.fileRects.get(edge.from);
        const toRect = layout.fileRects.get(edge.to);
        const cachedRoute = cache?.get(edge.id) ?? layout.edgeRoutes.get(edge.id);
        if (!fromRect || !toRect) {
          if (!cachedRoute) continue;
        }
        const anchors = computeAnchors({
          edge, fromRect, toRect,
          fallbackRoute: cachedRoute,
          anchorMode, fileById,
        });
        if (!anchors) continue;
        const { a, b, cp1x, cp1y, cp2x, cp2y } = anchors;
        const width = 1.2 * invScale * widthMul;
        drawDashedBezier(
          this.gfx,
          a.x, a.y, cp1x, cp1y, cp2x, cp2y, b.x, b.y,
          GHOST_PATTERN, 0,
          { color: GHOST_COLOR, alpha: GHOST_ALPHA, width, cap: "round" },
        );
        drawn++;
      }
    }

    this.previousLength = drawn;
  }

  destroy(): void {
    if (this.ticker && this.tickerHandle) {
      this.ticker.remove(this.tickerHandle);
    }
    this.tickerHandle = null;
    this.ticker = null;
    this.gfx.destroy();
  }
}

// ── Cache-key helpers ───────────────────────────────────────────────

/**
 * Cheap stable-ish fingerprint of the filter-shape inputs. Used only as
 * a cache key for the budgeted-mode top-N slice — collisions just cause
 * an extra sort, never a visual bug. We intentionally avoid hashing the
 * contents of `edgeFocus` / temporal sets since those flip every frame
 * in some modes and would defeat the cache; when the user changes those,
 * the rebuild is appropriate anyway.
 */
function computeFilterHash(opts: EdgeStaticBuildOpts | undefined): string {
  if (!opts) return "";
  const k = opts.kindFilter ? Object.keys(opts.kindFilter).sort().join(",") : "";
  const l = opts.layerFilter ? Object.keys(opts.layerFilter).sort().join(",") : "";
  const s = opts.minSeverity ?? "";
  const w = opts.widthMul ?? 1;
  const cg = opts.showCrossGraphEdges === false ? "0" : "1";
  const hc = opts.highlightCrossGraph === false ? "0" : "1";
  return `${k}|${l}|${s}|${w}|${cg}|${hc}`;
}

// ── Anchor computation ──────────────────────────────────────────────

interface Anchors {
  a: { x: number; y: number; side: string };
  b: { x: number; y: number; side: string };
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
}

function computeAnchors(args: {
  edge: FileEdge;
  fromRect?: Rect;
  toRect?: Rect;
  fallbackRoute?: { x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number };
  anchorMode: AnchorMode;
  fileById?: Map<string, Pick<FileNode, "loc">>;
}): Anchors | null {
  const { edge, fromRect, toRect, fallbackRoute, anchorMode, fileById } = args;

  // Centre mode: just use the cached route. This is the coarse-tier path.
  if (anchorMode === "centre" || !fromRect || !toRect) {
    if (!fallbackRoute) return null;
    return {
      a: { x: fallbackRoute.x1, y: fallbackRoute.y1, side: "right" },
      b: { x: fallbackRoute.x2, y: fallbackRoute.y2, side: "left" },
      cp1x: fallbackRoute.cx1, cp1y: fallbackRoute.cy1,
      cp2x: fallbackRoute.cx2, cp2y: fallbackRoute.cy2,
    };
  }

  const fromCx = fromRect.x + fromRect.w / 2;
  const toCx = toRect.x + toRect.w / 2;

  let a: { x: number; y: number; side: string };
  let b: { x: number; y: number; side: string };

  if (anchorMode === "line") {
    const fromLoc = fileById?.get(edge.from)?.loc ?? 100;
    const toLoc = fileById?.get(edge.to)?.loc ?? 100;
    if (edge.fromLine !== undefined) {
      a = lineAnchor({ rect: fromRect, line: edge.fromLine, totalLines: fromLoc, partnerCenterX: toCx });
    } else {
      a = sideAnchor(fromRect, toCx);
    }
    if (edge.toLine !== undefined) {
      b = lineAnchor({ rect: toRect, line: edge.toLine, totalLines: toLoc, partnerCenterX: fromCx });
    } else {
      b = sideAnchor(toRect, fromCx);
    }
  } else {
    a = sideAnchor(fromRect, toCx);
    b = sideAnchor(toRect, fromCx);
  }

  // Bezier control points — kink direction based on anchor side so the curve
  // exits the card perpendicular to the edge it attaches to.
  const dx = b.x - a.x;
  const spread = Math.max(40, Math.abs(dx) * 0.35);
  const cp1x = a.side === "left" ? a.x - spread : a.x + spread;
  const cp2x = b.side === "left" ? b.x - spread : b.x + spread;
  return {
    a, b,
    cp1x, cp1y: a.y,
    cp2x, cp2y: b.y,
  };
}

// ── Graphics primitives (dashed / arrow / X-cap / glow) ─────────────

function drawDashedBezier(
  g: Graphics,
  x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number,
  pattern: readonly [number, number],
  offset: number,
  stroke: { color: number; alpha: number; width: number; cap: "round" | "butt" },
): void {
  const [on, off] = pattern;
  const period = on + off;
  if (period <= 0) return;
  // Sample bezier into polyline, accumulate arc length, emit segments whose
  // running length lands inside "on" windows of the (offset + dist) modulo.
  const pts: { x: number; y: number }[] = new Array(DASH_SAMPLES_PER_CURVE + 1);
  for (let i = 0; i <= DASH_SAMPLES_PER_CURVE; i++) {
    const t = i / DASH_SAMPLES_PER_CURVE;
    const mt = 1 - t;
    const x = mt * mt * mt * x1 + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * x2;
    const y = mt * mt * mt * y1 + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * y2;
    pts[i] = { x, y };
  }
  let cumLen = 0;
  let penDown = false;
  for (let i = 1; i <= DASH_SAMPLES_PER_CURVE; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const startCycle = ((cumLen + offset) % period);
    const isOn = startCycle < on;
    if (isOn) {
      if (!penDown) {
        g.moveTo(prev.x, prev.y);
        penDown = true;
      }
      g.lineTo(cur.x, cur.y);
    } else {
      if (penDown) {
        g.stroke(stroke);
        penDown = false;
      }
    }
    cumLen += segLen;
  }
  if (penDown) g.stroke(stroke);
}

function drawArrowHead(
  g: Graphics,
  cpx: number, cpy: number, tipX: number, tipY: number,
  size: number,
  stroke: { color: number; alpha: number },
): void {
  // Tangent direction at the tip (approximated by control-point→tip vector).
  const dx = tipX - cpx;
  const dy = tipY - cpy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Perpendicular.
  const px = -uy;
  const py = ux;
  const baseX = tipX - ux * size * 1.2;
  const baseY = tipY - uy * size * 1.2;
  const leftX = baseX + px * size * 0.6;
  const leftY = baseY + py * size * 0.6;
  const rightX = baseX - px * size * 0.6;
  const rightY = baseY - py * size * 0.6;

  g.moveTo(tipX, tipY)
    .lineTo(leftX, leftY)
    .lineTo(rightX, rightY)
    .closePath()
    .fill({ color: stroke.color, alpha: stroke.alpha });
}

function drawXCap(
  g: Graphics,
  x: number, y: number,
  size: number,
  stroke: { color: number; alpha: number; width: number },
): void {
  const s = size;
  g.moveTo(x - s, y - s).lineTo(x + s, y + s).stroke({ color: stroke.color, alpha: stroke.alpha, width: stroke.width });
  g.moveTo(x + s, y - s).lineTo(x - s, y + s).stroke({ color: stroke.color, alpha: stroke.alpha, width: stroke.width });
}

function drawGlowDot(
  g: Graphics,
  x: number, y: number,
  r: number,
  stroke: { color: number; alpha: number },
): void {
  g.circle(x, y, r * 1.6).fill({ color: stroke.color, alpha: stroke.alpha * 0.25 });
  g.circle(x, y, r).fill({ color: stroke.color, alpha: stroke.alpha });
}
