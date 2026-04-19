import { Graphics, Container, Ticker } from "pixi.js";
import type { FileEdge, FileNode, WorkspaceLayout, Viewport, EdgeLayer, EdgeSeverity, Rect, EdgeKind } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";
import { lineAnchor, sideAnchor } from "@quanta/canvas-engine";
import { resolveEdgeStyle, SEVERITY_RANK, CROSS_GRAPH_STYLE, VIOLATION_RED } from "./shared/colors";
import {
  collapseParallelEdges,
  bundleByFolder,
  bundleWidthMultiplier,
  type BundledEdge,
} from "./edge-bundling";
import {
  InstancedLineMesh,
  FLOATS_PER_EDGE_INSTANCE,
  EDGE_FLAG_DASHED,
  EDGE_FLAG_VIOLATION,
  EDGE_FLAG_ROUND_CAP,
  unpackHexInto as unpackEdgeHex,
} from "./shared/InstancedLineMesh";
import {
  InstancedDecorationMesh,
  FLOATS_PER_DECORATION_INSTANCE,
  DECORATION_KIND_ARROW,
  DECORATION_KIND_XCAP,
  DECORATION_KIND_GLOW_DOT,
  unpackHexInto as unpackDecorationHex,
} from "./shared/InstancedDecorationMesh";

// Per-phase timing for the last completed `redraw()`. Written once per
// call, read by the perf recorder (see `useEdgeStaticPerfStats` /
// hooks/use-perf-recorder.ts). All values in milliseconds. Missing
// samples are `0` — readers should treat a 0 as "phase did not run
// this frame" rather than "phase ran in zero time", which would only
// happen on a noop redraw.
//
// Not a class field because the recorder samples across all renderer
// instances via a single import — and in practice there is one
// EdgeStaticRenderer per PixiStage, so a module global matches the
// "global last-frame snapshot" semantics the recorder wants.
export interface EdgeStaticPerfStats {
  /** Bundling pass (collapseParallelEdges / bundleByFolder). */
  bundleMs: number;
  /** Main per-edge loop (filter → anchor → mesh writes). */
  mainLoopMs: number;
  /** Diff-removed ghost pass. */
  diffRemovedMs: number;
  /** Mesh buffer commit + setInstanceCount. */
  commitMs: number;
  /** Total `redraw()` wall time. */
  totalMs: number;
  /** Number of edges that actually reached the draw loop (after filters). */
  drawnEdges: number;
  /** Counter — increments every redraw so the recorder can detect churn. */
  redrawCount: number;
}
const edgeStaticPerfStats: EdgeStaticPerfStats = {
  bundleMs: 0,
  mainLoopMs: 0,
  diffRemovedMs: 0,
  commitMs: 0,
  totalMs: 0,
  drawnEdges: 0,
  redrawCount: 0,
};
export function getEdgeStaticPerfStats(): Readonly<EdgeStaticPerfStats> {
  return edgeStaticPerfStats;
}

// ── SOTA: GPU-instanced edge mesh (feature flag) ────────────────────
// When true, bezier strokes (body + cross-graph overlay + violation halo
// + diff-added halo + diff-removed ghost) are drawn by a single instanced
// Mesh draw call instead of one Graphics.stroke() per edge. CPU cost drops
// from O(edges × bezier samples × tess ops) to O(edges × ~18 floats) per
// frame. GPU evaluates the quadratic bezier in the vertex shader, fragment
// shader handles SDF anti-alias + dashed pattern.
//
// Arrowheads, X-cap barriers and anchor glow-dots stay on Graphics — they
// are small, heterogeneous decorations, not the hot path.
//
// Default: true (shipping the new path). Set to false for rollback or in
// tests that still assert on Graphics.stroke() call counts. Exposed as a
// mutable module-level `let` so test setup can flip it; production flips
// it once at module load if needed.
let EDGES_MESH_ENABLED = true;
/** Toggle the instanced-mesh edge path. Intended for rollback / tests. */
export function setEdgesMeshEnabled(enabled: boolean): void {
  EDGES_MESH_ENABLED = enabled;
}
/** Read the current flag — used by tests to guard expectations. */
export function isEdgesMeshEnabled(): boolean {
  return EDGES_MESH_ENABLED;
}

// ── SOTA: GPU-instanced decoration mesh (feature flag) ──────────────
// Controls the arrow / X-cap / glow-dot rendering path. When true, all
// three decoration kinds funnel into a single InstancedDecorationMesh
// draw call — the SDF in the fragment shader branches on per-instance
// `kind`. When false, each decoration falls back to the per-edge
// Graphics fill/stroke chain (drawArrowHead / drawXCap / drawGlowDot).
//
// Fallback path is intentionally preserved:
//   1. Rollback safety: if the SDF silhouette is visibly off vs. the
//      original Graphics fill at some zoom, we can flip the flag off
//      without a release.
//   2. Tests: EdgeStaticRenderer.test.ts spies on gfx.stroke() for
//      branch coverage. Leaving the Graphics path alive means those
//      assertions still check that e.g. violatingEdgeIds produces the
//      expected stroke calls (even though production ships with the
//      mesh path handling body + decoration both).
//
// Default: true. Tests flip to false via setDecorationsMeshEnabled()
// the same way EDGES_MESH_ENABLED does.
let DECORATIONS_MESH_ENABLED = true;
/** Toggle the instanced-mesh decoration path. Intended for rollback / tests. */
export function setDecorationsMeshEnabled(enabled: boolean): void {
  DECORATIONS_MESH_ENABLED = enabled;
}
/** Read the current flag — used by tests to guard expectations. */
export function isDecorationsMeshEnabled(): boolean {
  return DECORATIONS_MESH_ENABLED;
}

// ── Hierarchical Edge Bundling (feature-flagged render path) ────────
// When true AND `opts.hebPaths` carries a pre-sampled polyline for a
// given edgeId AND the incoming LOD is "galaxy", the edge is stroked
// along the HEB polyline (segment-per-instance via the existing line
// mesh — each consecutive 3-point window is emitted as one quadratic
// "bezier" whose control point equals the mid-sample, i.e. a straight
// chord that visually approximates the smooth B-spline sampled by the
// worker). Any edge missing from the batch falls back to the existing
// bezier path transparently.
//
// Default OFF: the renderer refactor is large and the HEB worker is
// fresh silicon — shipping dark keeps main safe. Flip true from dev
// console or a test to exercise the code path. No runtime config UI
// yet; promote to a user-facing toggle once we have a second round of
// bake-off vs. the chord renderer at ~10k edges.
let HEB_RENDER_ENABLED = false;
/** Toggle the HEB-along-path edge render. Default off; intended for
 *  progressive rollout. */
export function setHebRenderEnabled(enabled: boolean): void {
  HEB_RENDER_ENABLED = enabled;
}
/** Read the current flag — used by tests + HUD. */
export function isHebRenderEnabled(): boolean {
  return HEB_RENDER_ENABLED;
}

/** LOD at which HEB is visually meaningful. City/street/ground keep
 *  per-file anchor bezier edges; supergalaxy/universe skip edges
 *  entirely. Galaxy is the sweet spot: folder braiding reveals cluster
 *  structure that raw density washes out. */
const HEB_RENDER_LOD = "galaxy";

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
/** LODs where same-(src,dst) parallel edges are collapsed into a single
 *  thicker stroke before draw. Ground/street still render the raw list
 *  so readers can trace individual function calls. */
const EDGE_COLLAPSE_LODS: ReadonlySet<string> = new Set(["city"]);
/** LODs where edges are collapsed to folder-pair trunks. `folderPrefix`
 *  is capped to FOLDER_BUNDLE_DEPTH segments so a deep path like
 *  `src/features/canvas/renderer/edge/...` still bundles usefully. */
const EDGE_FOLDER_BUNDLE_LODS: ReadonlySet<string> = new Set(["galaxy"]);
const FOLDER_BUNDLE_DEPTH = 3;
/** Synthetic rect size (world-px) around a folder centre when the renderer
 *  needs a rect to hand to the anchor code for a folder-level bundle. Small
 *  enough that the bezier control points produce a visible curve offset,
 *  not a zero-length kink. */
const FOLDER_VIRTUAL_RECT_SIZE = 40;
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
  "test-covers",
  "feature-flag",
  "contract",
  "dead-edge",
  "runtime-divergence",
  "supply-chain",
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
  /** Pre-sampled Hierarchical Edge Bundling polylines (edgeId → flat
   *  `[x0, y0, x1, y1, ...]` Float32Array of sampled points). Used only
   *  when `HEB_RENDER_ENABLED` is true AND `lod === "galaxy"`. Edges
   *  missing from the map fall through to the straight/bezier path. */
  hebPaths?: Map<string, Float32Array>;
}

export class EdgeStaticRenderer {
  private gfx: Graphics;
  // Instanced bezier mesh — drives the hot path (bezier body strokes) when
  // EDGES_MESH_ENABLED. Always constructed so we can flip the flag at
  // runtime without tearing down the renderer. When disabled the mesh
  // sits idle with instanceCount=0; when enabled Graphics only handles
  // decorations (arrowheads, glow dots, x-caps).
  private lineMesh: InstancedLineMesh;
  // Instanced decoration mesh — arrowheads, X-caps and glow-dots funnel
  // into a single instanced draw call when DECORATIONS_MESH_ENABLED. Sits
  // in the child list ABOVE the line mesh so decorations visually stack on
  // top of their bezier body (same z-order the Graphics layer used to have).
  private decorationMesh: InstancedDecorationMesh;
  // Per-frame counter of instances written to the mesh. Reset at the top
  // of each redraw() and committed to the mesh via setInstanceCount() at
  // the end. Overlays (cross-graph gold, violation halo, diff halos,
  // diff-removed ghost) all append behind the body stroke, so this counter
  // may exceed `workingEdges.length` by up to 3× per edge.
  private meshInstanceCount = 0;
  // Per-frame decoration counter. Upper bound: 1 arrow + 1 x-cap + 2 glow
  // dots per edge ≈ 4× edges. Dedup via `drawnGlows` caps this in practice.
  private decorationInstanceCount = 0;
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
  private lastScannedEdges: readonly FileEdge[] | null = null;

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
  // Identity of the raw `edges` array that seeded the current
  // `budgetedSlice`. Without this, callers that rebuild the edge list
  // (new array identity) but land in the same `cacheKey` bucket would
  // keep rendering the stale slice. Reset in `clear()`.
  private budgetedSliceSourceRef: readonly FileEdge[] | null = null;

  // ── Bundling cache ──────────────────────────────────────────────
  // Bundling is deterministic given (edges array identity, lod, folder
  // depth, fileRects identity). We cache by identity so zoom pans inside
  // the same LOD band don't rerun the O(N) collapse pass. Identity refs
  // rather than content hashes because upstream callers mutate the arrays
  // sparingly (on filter / temporal changes), and a full content hash of
  // 9500 edges would cost more than the bundling itself.
  private bundleCacheEdgesRef: readonly FileEdge[] | null = null;
  private bundleCacheRectsRef: Map<string, Rect> | null = null;
  private bundleCacheLod: string | null = null;
  private bundledEdges: BundledEdge[] | null = null;
  private bundledFolderCenters: Map<string, { x: number; y: number }> | null = null;

  // ── Cache-key identity tracking ─────────────────────────────────
  // `ReadonlySet` inputs (focus.edgeIds, temporalEdgeSet, diffAdded, …) are
  // tested by identity in `computeFilterHash`. This WeakMap assigns each
  // set a stable numeric id the first time we see it so the hash stays
  // short. Identity-compare assumes upstream callers create a new Set
  // whenever membership changes — documented at `EdgeStaticBuildOpts` and
  // asserted by the WorkspaceCanvas rebuild path (sets are immutable from
  // selectors). A mutated-in-place set would alias in the cache; that's a
  // caller contract violation, not something this class defends against.
  private setIdRegistry: WeakMap<object, number> = new WeakMap();
  private nextSetId = 1;
  // `customPredicate` is a function — functions aren't WeakMap keys if we
  // want content-stability, but identity is sufficient here: a rebuilt
  // DSL predicate produces a new function reference.
  private fnIdRegistry: WeakMap<object, number> = new WeakMap();
  private nextFnId = 1;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    // Instanced mesh sits behind the Graphics layer so arrowheads / glow
    // dots / x-caps drawn on the Graphics overlay stay on top of the
    // ribbon body. Initial capacity picked to cover the ground/street
    // baseline (~1.5k edges); grows power-of-two on demand.
    this.lineMesh = new InstancedLineMesh(2048);
    // Decoration mesh sized to cover ~4 decorations/edge at baseline.
    // Glow-dot dedup usually brings this below the upper bound but we
    // allocate generously to avoid resize churn on first frame.
    this.decorationMesh = new InstancedDecorationMesh(4096);
    parent.addChildAt(this.lineMesh.mesh, 0);       // deepest: bezier ribbons
    parent.addChildAt(this.decorationMesh.mesh, 1); // mid: SDF decorations
    parent.addChildAt(this.gfx, 2);                 // top: Graphics fallback
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
    // O(E) scan: skip when the edge array reference is unchanged since the
    // `.some()` result is a pure function of the array identity.
    if (edges !== this.lastScannedEdges) {
      this.lastScannedEdges = edges;
      this.hasAnimatedEdges = edges.some(e => e.animated);
    }
    this.redraw();
  }

  private redraw(): void {
    // Per-phase wall-clock checkpoints. `performance.now()` has
    // sub-microsecond overhead on modern browsers — safe to always run,
    // no conditional guard. Results flushed into `edgeStaticPerfStats`
    // at the very end of redraw().
    const tStart = performance.now();
    let tBundle = tStart;
    let tMain = tStart;
    let tDiffRemoved = tStart;

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
        this.lineMesh.setInstanceCount(0);
        this.decorationMesh.setInstanceCount(0);
        this.previousLength = 0;
      }
      if (this.appliedMode !== effectiveMode) {
        // Mode transition: lock the hysteresis anchor to the scale at
        // which we entered `skip`. `appliedScale` MUST NOT track the
        // live scale while we stay in the same mode — see H6 below.
        this.appliedMode = effectiveMode;
        this.appliedScale = scale;
        this.lastCacheKey = "skip";
        this.budgetedSlice = null;
        this.budgetedSliceSourceRef = null;
      }
      // Bundle cache is stale once we stop drawing — free refs so the
      // next non-skip frame recomputes from fresh inputs.
      this.bundleCacheEdgesRef = null;
      this.bundleCacheRectsRef = null;
      this.bundleCacheLod = null;
      this.bundledEdges = null;
      this.bundledFolderCenters = null;
      return;
    }

    if (edges.length === 0 && this.previousLength === 0) {
      if (this.appliedMode !== effectiveMode) {
        this.appliedMode = effectiveMode;
        this.appliedScale = scale;
      }
      // Empty input path: invalidate bundle cache so a subsequent
      // non-empty render on a *new* edges array doesn't resurrect a
      // stale bundled slice that happens to match by identity after
      // array reuse upstream. See audit M (bundle cache cleanup).
      this.bundleCacheEdgesRef = null;
      this.bundleCacheRectsRef = null;
      this.bundleCacheLod = null;
      this.bundledEdges = null;
      this.bundledFolderCenters = null;
      this.budgetedSlice = null;
      this.budgetedSliceSourceRef = null;
      return;
    }

    // Zoom-adaptive bundling — runs before the top-N budget so the cap
    // applies to bundled edges rather than raw ones (bundled trunk count
    // is already 5×–20× smaller, so the cap rarely trips).
    //
    // Cache key is identity-based: we recompute only when the underlying
    // edges array, fileRects map, or the active LOD band changes. Zoom
    // pans inside the same band are free.
    const shouldCollapseParallel = EDGE_COLLAPSE_LODS.has(opts?.lod ?? "");
    // HEB is the "smart" replacement for galaxy-tier folder bundling: the
    // worker already grouped edges into folder-braid control polygons
    // keyed by raw FileEdge.id. If we then ran folder-bundling on top,
    // the edge ids would flip to `folder-bundle:...` and the hebPaths
    // lookup would miss entirely. So when HEB is engaged for this frame
    // we disable the renderer-side folder bundle — HEB's per-edge
    // routing is more expressive anyway.
    const hebEngaged = HEB_RENDER_ENABLED
      && opts?.lod === HEB_RENDER_LOD
      && !!opts?.hebPaths
      && opts.hebPaths.size > 0;
    const shouldFolderBundle = EDGE_FOLDER_BUNDLE_LODS.has(opts?.lod ?? "") && !hebEngaged;
    let workingEdges: (FileEdge | BundledEdge)[] = edges;
    let folderCenters: Map<string, { x: number; y: number }> | null = null;

    if (shouldCollapseParallel || shouldFolderBundle) {
      const cacheHit = this.bundledEdges !== null
        && this.bundleCacheEdgesRef === edges
        && this.bundleCacheRectsRef === layout.fileRects
        && this.bundleCacheLod === (opts?.lod ?? null);
      if (cacheHit && this.bundledEdges) {
        workingEdges = this.bundledEdges;
        folderCenters = this.bundledFolderCenters;
      } else if (shouldFolderBundle) {
        const { bundles, folderCenters: fc } = bundleByFolder(edges, layout.fileRects, FOLDER_BUNDLE_DEPTH);
        this.bundledEdges = bundles;
        this.bundledFolderCenters = fc;
        this.bundleCacheEdgesRef = edges;
        this.bundleCacheRectsRef = layout.fileRects;
        this.bundleCacheLod = opts?.lod ?? null;
        workingEdges = bundles;
        folderCenters = fc;
      } else {
        // city LOD — same-pair collapse.
        const bundles = collapseParallelEdges(edges);
        this.bundledEdges = bundles;
        this.bundledFolderCenters = null;
        this.bundleCacheEdgesRef = edges;
        this.bundleCacheRectsRef = layout.fileRects;
        this.bundleCacheLod = opts?.lod ?? null;
        workingEdges = bundles;
      }
    } else {
      // ground / street tiers: drop the cache so we don't retain a stale
      // bundle slice when the user zooms back out.
      this.bundledEdges = null;
      this.bundledFolderCenters = null;
      this.bundleCacheEdgesRef = null;
      this.bundleCacheRectsRef = null;
      this.bundleCacheLod = null;
    }

    // In budgeted mode, cap the (possibly bundled) edge list to the top-N
    // by weight. We sort a shallow copy so the caller's array order is
    // preserved. After folder-bundling this branch almost never fires.
    if (effectiveMode === "budgeted" && workingEdges.length > GALAXY_EDGE_BUDGET) {
      workingEdges = [...workingEdges]
        .sort((a, b) => bundleSortWeight(b) - bundleSortWeight(a))
        .slice(0, GALAXY_EDGE_BUDGET);
    }

    // Commit the new applied state now that we've decided mode + slice.
    const edgeBucket = Math.floor(workingEdges.length / EDGE_COUNT_BUCKET);
    const filterHash = this.computeFilterHash(opts);
    const cacheKey = `${effectiveMode}:${opts?.lod ?? ""}:${edgeBucket}:${filterHash}`;
    // Budgeted-slice reuse requires BOTH cache-key hit AND the source
    // `edges` array identity matching the one that seeded the slice.
    // The bucket hash is by count only, so two different arrays with the
    // same filter shape land in the same bucket — reusing the slice in
    // that case renders stale content (H5). The identity check is the
    // minimum correctness gate.
    if (
      effectiveMode === "budgeted"
      && cacheKey === this.lastCacheKey
      && this.budgetedSlice
      && this.budgetedSliceSourceRef === edges
    ) {
      // Same source array + same bucket + same filters: reuse the
      // previously-selected slice so the top-N sort doesn't rerun on
      // every redraw. Animated dashes still flow because we re-stroke
      // below.
      workingEdges = this.budgetedSlice;
    } else if (effectiveMode === "budgeted") {
      this.budgetedSlice = workingEdges as FileEdge[];
      this.budgetedSliceSourceRef = edges;
    } else {
      this.budgetedSlice = null;
      this.budgetedSliceSourceRef = null;
    }
    this.lastCacheKey = cacheKey;
    // Hysteresis anchor (H6): `appliedScale` locks the scale at which we
    // committed to a mode. Updating it on every redraw (stay branch
    // included) causes slow zoom drift to never trip the 10% threshold
    // — the anchor chases the viewport and the transition never fires.
    // Only update the anchor when the effective mode actually changed.
    if (this.appliedMode !== effectiveMode) {
      this.appliedMode = effectiveMode;
      this.appliedScale = scale;
    }

    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const widthMul = opts?.widthMul ?? 1;
    const kindFilter = opts?.kindFilter;
    const layerFilter = opts?.layerFilter;
    const focus = opts?.focus;
    const anchorMode = pickAnchorMode(opts?.lod);
    const fileById = opts?.fileById;
    const dashOffset = opts?.dashOffset ?? this.internalDashOffset;
    const minSeverityRank = opts?.minSeverity !== undefined ? SEVERITY_RANK[opts.minSeverity] : -1;

    // Bundling / budget / cache-key resolution all happen above this
    // line. Stamp the bundle-phase checkpoint here so downstream we can
    // measure the main loop separately.
    tBundle = performance.now();

    this.gfx.clear();
    // Mesh path: reset the per-frame instance counter + pre-size the
    // buffer. Worst-case rows per edge: 1 body + 1 cross-graph overlay +
    // 1 violation halo + 1 diff-added halo + 1 diff-removed ghost (in a
    // separate pass). Budget 4× edges + diffRemoved.size as cushion.
    this.meshInstanceCount = 0;
    this.decorationInstanceCount = 0;
    // HEB multiplier: when engaged, each edge emits up to ~N-2 instances
    // (N samples per polyline, default 24). We overshoot with 32× to
    // absorb higher-sample configurations without runtime resize churn.
    // The flag + LOD guard means the cushion is only paid at galaxy zoom.
    const perEdgeInstances = hebEngaged ? 32 : 4;
    const meshBudget = workingEdges.length * perEdgeInstances + (opts?.diffRemoved?.size ?? 0);
    if (EDGES_MESH_ENABLED) {
      this.lineMesh.ensureCapacity(Math.max(16, meshBudget));
    }
    if (DECORATIONS_MESH_ENABLED) {
      // Worst-case: every edge is directional (arrow) + anchor glow-dot
      // pair + rare sanitizer x-cap. Budget 4× edges — glow dedup keeps
      // actual writes well under, but the resize cost on overshoot
      // would dwarf a slightly oversized VBO.
      this.decorationMesh.ensureCapacity(Math.max(16, workingEdges.length * 4));
    }
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
      // `customPredicate` is typed against FileEdge; bundled edges retain
      // the same shape at the field level (id/from/to/kind/layer/weight/...)
      // so the DSL check evaluates correctly. We cast to FileEdge because
      // the predicate signature wants the wider raw type.
      if (customPredicate && !customPredicate(edge as FileEdge)) continue;
      // Live-mode temporal gate. Diff mode's `removed` ghosts bypass this
      // via the post-loop below; `added` ghosts stay in the set when the
      // caller already included them in `temporalEdgeSet` (typical: diff
      // mode ignores temporalEdgeSet entirely and leaves all edges drawable).
      if (temporalEdgeSet && !temporalEdgeSet.has(edge.id)) continue;

      const bundleCount = (edge as BundledEdge).bundleCount ?? 1;
      const isFolderBundle = shouldFolderBundle && bundleCount > 0 && folderCenters !== null
        && edge.id.startsWith("folder-bundle:");

      let fromRect = layout.fileRects.get(edge.from);
      let toRect = layout.fileRects.get(edge.to);
      // Folder-level bundle endpoints reference a virtual rect anchored
      // at the folder centre. Without this, anchor resolution would use
      // the rect of whichever file happened to seed the bucket, which
      // visually bunches all trunks at one card instead of the folder
      // centre. Synthesising a small rect keeps the bezier control-point
      // math happy (non-zero spread) without needing a new anchor path.
      if (isFolderBundle && folderCenters) {
        const fromFolder = folderPrefixForBundleId(edge.id, "from");
        const toFolder = folderPrefixForBundleId(edge.id, "to");
        const fc = fromFolder ? folderCenters.get(fromFolder) : undefined;
        const tc = toFolder ? folderCenters.get(toFolder) : undefined;
        if (fc) fromRect = virtualFolderRect(fc);
        if (tc) toRect = virtualFolderRect(tc);
      }
      const cachedRoute = cache?.get(edge.id) ?? layout.edgeRoutes.get(edge.id);
      if (!fromRect || !toRect) {
        if (!cachedRoute) continue;
      }

      // Resolve style early so per-kind curve factor drives anchor math.
      const style = resolveEdgeStyle(edge as FileEdge);

      // Compute the anchor pair. Returns a reused scratch struct —
      // destructure its primitive fields into locals immediately; the
      // next iteration will overwrite them.
      const anchors = computeAnchors(
        edge as FileEdge,
        fromRect,
        toRect,
        cachedRoute,
        // Folder-level bundles anchor to virtual folder-center rects, so
        // line-anchor math is meaningless there — drop to centre mode.
        isFolderBundle ? "centre" : anchorMode,
        fileById,
        style.curveFactor,
      );
      if (!anchors) continue;
      // Destructure into primitive locals immediately. The scratch
      // struct will be mutated by the next iteration; we never hold
      // a reference to it beyond this point. No `a` / `b` wrapper
      // objects — those were each a small allocation per edge.
      const ax = anchors.ax, ay = anchors.ay;
      const bx = anchors.bx, by = anchors.by;
      const cp1x = anchors.cp1x, cp1y = anchors.cp1y;
      const cp2x = anchors.cp2x, cp2y = anchors.cp2y;
      // NB: the scratch struct also carries `aSide` / `bSide` encoded
      // as 0/1 — currently only referenced by `computeAnchors`'s own
      // "line"/"side" branches, not by the outer loop. The renderer
      // operates on the quadratic (ax/ay, bx/by, cpX/cpY) and the style
      // fields, so we don't lift the side into a local here.
      // Bundles thicken with log(count). Single edges (count<=1) pass
      // through at multiplier 1 so non-bundled tiers look identical.
      const bundleWidth = bundleWidthMultiplier(bundleCount);
      const width = style.baseWidth * invScale * widthMul * bundleWidth;
      const cap: "round" | "butt" = edge.animated ? "round" : (style.cap ?? "butt");

      let alpha = focus && !focus.edgeIds.has(edge.id)
        ? style.alpha * focus.dimAlpha
        : style.alpha;

      const isCross = edge.crossGraph === true;
      const isFlashed = crossGraphFlash?.has(edge.id) ?? false;
      if (crossGraphFlash && crossGraphFlash.size > 0 && isCross && !isFlashed) {
        alpha = alpha * 0.25;
      }

      // Quadratic control point approximating the cubic bezier (cp1, cp2).
      // Quadratic suffices for the ribbon tessellation — the two cubic
      // control points always produce a similar S-curve visually, and
      // we average them. Keeps the shader simple + vertex count half.
      const qcx = (cp1x + cp2x) * 0.5;
      const qcy = (cp1y + cp2y) * 0.5;

      if (isCross && highlightCrossGraph) {
        const goldWidth = CROSS_GRAPH_STYLE.baseWidth * invScale * widthMul * (isFlashed ? 1.8 : 1.4);
        const goldAlpha = (isFlashed ? 1 : CROSS_GRAPH_STYLE.alpha);
        const goldPat = CROSS_GRAPH_STYLE.dash ?? [8, 5];
        if (EDGES_MESH_ENABLED) {
          this.writeMeshInstance(
            ax, ay, bx, by, qcx, qcy,
            CROSS_GRAPH_STYLE.color, goldAlpha, goldWidth,
            goldPat[0], goldPat[1] ?? 0,
            edge.animated ? dashOffset : 0,
            EDGE_FLAG_DASHED | EDGE_FLAG_ROUND_CAP,
          );
        } else {
          drawDashedBezier(
            this.gfx,
            ax, ay, cp1x, cp1y, cp2x, cp2y, bx, by,
            goldPat,
            edge.animated ? dashOffset : 0,
            { color: CROSS_GRAPH_STYLE.color, alpha: goldAlpha, width: goldWidth, cap: "round" },
          );
        }
      }

      // Arch violation — draw a wider red halo underneath so the violating
      // edge reads first regardless of its base colour.
      if (violatingEdgeIds && violatingEdgeIds.has(edge.id)) {
        if (EDGES_MESH_ENABLED) {
          this.writeMeshInstance(
            ax, ay, bx, by, qcx, qcy,
            VIOLATION_RED, 0.45, width * 3,
            0, 0, 0,
            EDGE_FLAG_VIOLATION | EDGE_FLAG_ROUND_CAP,
          );
        } else {
          this.gfx
            .moveTo(ax, ay)
            .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, bx, by)
            .stroke({ color: VIOLATION_RED, alpha: 0.45, width: width * 3, cap: "round" });
        }
      }

      // Diff mode — green halo under edges that exist in B but not A.
      if (diffAdded && diffAdded.has(edge.id)) {
        if (EDGES_MESH_ENABLED) {
          this.writeMeshInstance(
            ax, ay, bx, by, qcx, qcy,
            0x22c55e, 0.55, width * 2,
            0, 0, 0,
            EDGE_FLAG_ROUND_CAP,
          );
        } else {
          this.gfx
            .moveTo(ax, ay)
            .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, bx, by)
            .stroke({ color: 0x22c55e, alpha: 0.55, width: width * 2, cap: "round" });
        }
      }

      // Dashed paths: on mesh path the fragment shader handles the dash
      // pattern from dashSize/gapSize + phase. For multi-segment patterns
      // like [6, 2, 1, 2] (dash-dot-dot) we collapse to the first [on, off]
      // pair — GPU doesn't support the arbitrary-length silhouette the
      // Graphics path emulates, so distinct kinds fall back to the primary
      // on/off ratio. Hue + width + curveFactor already carry enough
      // discrimination per kind.
      const dashPat = style.dash;
      const isDashed = !!(dashPat || edge.animated);
      // HEB gate: when engaged for this frame, strokes route along the
      // HEB polyline segment-by-segment. Per-edge fallback: if the worker
      // couldn't resolve this id (missing folder entry, stale batch),
      // we fall through to the bezier emit below — no visual gap.
      const hebPath = hebEngaged ? opts!.hebPaths!.get(edge.id) : undefined;
      if (EDGES_MESH_ENABLED && hebPath && hebPath.length >= 4) {
        const on = dashPat?.[0] ?? (edge.animated ? 6 : 0);
        const off = dashPat?.[1] ?? (edge.animated ? 4 : 0);
        const capFlag = cap === "round" ? EDGE_FLAG_ROUND_CAP : 0;
        const flags = (isDashed ? EDGE_FLAG_DASHED : 0) | capFlag;
        this.writeHebPolyline(
          hebPath,
          style.color, alpha, width,
          on, off,
          edge.animated ? dashOffset : 0,
          flags,
        );
      } else if (EDGES_MESH_ENABLED) {
        const on = dashPat?.[0] ?? (edge.animated ? 6 : 0);
        const off = dashPat?.[1] ?? (edge.animated ? 4 : 0);
        const capFlag = cap === "round" ? EDGE_FLAG_ROUND_CAP : 0;
        const flags = (isDashed ? EDGE_FLAG_DASHED : 0) | capFlag;
        this.writeMeshInstance(
          ax, ay, bx, by, qcx, qcy,
          style.color, alpha, width,
          on, off,
          edge.animated ? dashOffset : 0,
          flags,
        );
      } else if (isDashed) {
        const pattern = dashPat ?? [6, 4];
        drawDashedBezier(
          this.gfx,
          ax, ay, cp1x, cp1y, cp2x, cp2y, bx, by,
          pattern,
          edge.animated ? dashOffset : 0,
          { color: style.color, alpha, width, cap },
        );
      } else {
        this.gfx
          .moveTo(ax, ay)
          .bezierCurveTo(cp1x, cp1y, cp2x, cp2y, bx, by)
          .stroke({ color: style.color, alpha, width, cap });
      }

      // Arrowhead for directional kinds. Placed at the tangent of the curve
      // approaching b (derivative at t=1) so it points inward correctly.
      if (DIRECTIONAL_KINDS.has(edge.kind)) {
        if (DECORATIONS_MESH_ENABLED) {
          // Tangent direction at tip approximated by (cp2 → b). Same vector
          // the Graphics path uses as the arrow axis.
          const dx = bx - cp2x;
          const dy = by - cp2y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const size = ARROW_HEAD_SIZE * invScale;
          // Position the SDF triangle's centre so its tip lands at (bx, by).
          // The SDF arrow in the shader has its tip at uv=(+1, 0); the quad
          // extends from -size..+size along the rotated tip axis, meaning
          // the tip is at (pos + dir*size). Back-solve the position so
          // tip == b: pos = b - dir*size.
          const posX = bx - ux * size;
          const posY = by - uy * size;
          this.writeDecorationInstance(
            posX, posY, ux, uy,
            size, style.color, alpha,
            DECORATION_KIND_ARROW, 0,
          );
        } else {
          drawArrowHead(
            this.gfx,
            cp2x, cp2y, bx, by,
            ARROW_HEAD_SIZE * invScale,
            { color: style.color, alpha },
          );
        }
      }

      // X-cap barrier for sanitizer edges.
      if (edge.kind === "sanitizer") {
        if (DECORATIONS_MESH_ENABLED) {
          this.writeDecorationInstance(
            bx, by, 1, 0,
            ARROW_HEAD_SIZE * invScale,
            style.color, alpha,
            DECORATION_KIND_XCAP, width,
          );
        } else {
          drawXCap(this.gfx, bx, by, ARROW_HEAD_SIZE * invScale, {
            color: style.color, alpha, width,
          });
        }
      }

      // Glow dots at both anchors (only when mode is line or side).
      // Unrolled into two explicit iterations — the old `for (const pt
      // of [a, b])` allocated a 2-element throwaway array per edge.
      if (anchorMode === "line" || anchorMode === "side") {
        // Re-used scratch: avoid `${}` template on the hot path by
        // building the key via a tiny helper that's inlined by V8.
        const ptAx = Math.round(ax), ptAy = Math.round(ay);
        const keyA = ptAx + "," + ptAy;
        if (!drawnGlows.has(keyA)) {
          drawnGlows.add(keyA);
          if (DECORATIONS_MESH_ENABLED) {
            this.writeDecorationInstance(
              ax, ay, 1, 0,
              ANCHOR_GLOW_RADIUS * invScale * 1.6,
              style.color, alpha,
              DECORATION_KIND_GLOW_DOT, 0,
            );
          } else {
            drawGlowDot(this.gfx, ax, ay, ANCHOR_GLOW_RADIUS * invScale, {
              color: style.color, alpha,
            });
          }
        }
        const ptBx = Math.round(bx), ptBy = Math.round(by);
        const keyB = ptBx + "," + ptBy;
        if (!drawnGlows.has(keyB)) {
          drawnGlows.add(keyB);
          if (DECORATIONS_MESH_ENABLED) {
            this.writeDecorationInstance(
              bx, by, 1, 0,
              ANCHOR_GLOW_RADIUS * invScale * 1.6,
              style.color, alpha,
              DECORATION_KIND_GLOW_DOT, 0,
            );
          } else {
            drawGlowDot(this.gfx, bx, by, ANCHOR_GLOW_RADIUS * invScale, {
              color: style.color, alpha,
            });
          }
        }
      }

      drawn++;
    }

    // Main-loop checkpoint — captured before the diff-removed ghost
    // pass so the recorder can attribute time to the right phase.
    tMain = performance.now();

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
        const anchors = computeAnchors(
          edge, fromRect, toRect, cachedRoute, anchorMode, fileById, undefined,
        );
        if (!anchors) continue;
        // Same scratch-struct pattern as the main loop — destructure
        // before the next call overwrites.
        const ax = anchors.ax, ay = anchors.ay;
        const bx = anchors.bx, by = anchors.by;
        const cp1x = anchors.cp1x, cp1y = anchors.cp1y;
        const cp2x = anchors.cp2x, cp2y = anchors.cp2y;
        const width = 1.2 * invScale * widthMul;
        if (EDGES_MESH_ENABLED) {
          const qcx = (cp1x + cp2x) * 0.5;
          const qcy = (cp1y + cp2y) * 0.5;
          this.writeMeshInstance(
            ax, ay, bx, by, qcx, qcy,
            GHOST_COLOR, GHOST_ALPHA, width,
            GHOST_PATTERN[0], GHOST_PATTERN[1], 0,
            EDGE_FLAG_DASHED | EDGE_FLAG_ROUND_CAP,
          );
        } else {
          drawDashedBezier(
            this.gfx,
            ax, ay, cp1x, cp1y, cp2x, cp2y, bx, by,
            GHOST_PATTERN, 0,
            { color: GHOST_COLOR, alpha: GHOST_ALPHA, width, cap: "round" },
          );
        }
        drawn++;
      }
    }

    // Diff-removed checkpoint before the mesh commit phase.
    tDiffRemoved = performance.now();

    // Commit the mesh instance buffer. When the flag is off this is a no-op
    // (instanceCount stays 0, mesh emits no draw call).
    if (EDGES_MESH_ENABLED) {
      this.lineMesh.setInstanceCount(this.meshInstanceCount);
    } else {
      this.lineMesh.setInstanceCount(0);
    }
    if (DECORATIONS_MESH_ENABLED) {
      this.decorationMesh.setInstanceCount(this.decorationInstanceCount);
    } else {
      this.decorationMesh.setInstanceCount(0);
    }

    this.previousLength = drawn;

    // Flush per-phase timings to the module-level snapshot. Writes are
    // cheap and always-on — `performance.now()` is sub-µs on modern
    // browsers and the assignments below are a handful of fields.
    const tEnd = performance.now();
    edgeStaticPerfStats.bundleMs = tBundle - tStart;
    edgeStaticPerfStats.mainLoopMs = tMain - tBundle;
    edgeStaticPerfStats.diffRemovedMs = tDiffRemoved - tMain;
    edgeStaticPerfStats.commitMs = tEnd - tDiffRemoved;
    edgeStaticPerfStats.totalMs = tEnd - tStart;
    edgeStaticPerfStats.drawnEdges = drawn;
    edgeStaticPerfStats.redrawCount++;
  }

  /**
   * Append one bezier-ribbon instance to the mesh's backing buffer.
   * Layout mirrors FLOATS_PER_EDGE_INSTANCE in InstancedLineMesh. Called
   * up to ~4 times per edge in the worst case (body + cross-graph overlay
   * + violation halo + diff halos). O(1): no allocation, no Pixi call chain.
   */
  private writeMeshInstance(
    fromX: number, fromY: number,
    toX: number, toY: number,
    ctrlX: number, ctrlY: number,
    color: number, alpha: number, width: number,
    dashSize: number, gapSize: number,
    dashPhase: number,
    flags: number,
  ): void {
    const base = this.meshInstanceCount * FLOATS_PER_EDGE_INSTANCE;
    let view = this.lineMesh.view();
    if (base + FLOATS_PER_EDGE_INSTANCE > view.length) {
      // Budget undershoot — grow and rebind. Rare; pre-size budget is 4×
      // edge count + diffRemoved size, well above realistic overlays.
      this.lineMesh.ensureCapacity(this.meshInstanceCount + 64);
      view = this.lineMesh.view();
    }
    view[base + 0] = fromX;
    view[base + 1] = fromY;
    view[base + 2] = toX;
    view[base + 3] = toY;
    view[base + 4] = ctrlX;
    view[base + 5] = ctrlY;
    unpackEdgeHex(color, view, base + 6, alpha);
    view[base + 10] = width;
    view[base + 11] = dashSize;
    view[base + 12] = gapSize;
    view[base + 13] = dashPhase;
    view[base + 14] = flags;
    view[base + 15] = 0;
    view[base + 16] = 0;
    view[base + 17] = 0;
    this.meshInstanceCount++;
  }

  /**
   * Emit an HEB-sampled polyline as a chain of InstancedLineMesh quadratic
   * "beziers" — one instance per consecutive 3-point window. The mesh was
   * originally designed for a single quadratic per edge, so extending it
   * to variable-length paths would require shader + VBO refactors. Option
   * A (segment-per-instance) reuses the existing mesh unchanged: each
   * window `(P[i-1], P[i], P[i+1])` becomes `(from=P[i-1], to=P[i+1],
   * ctrl=P[i])`. Adjacent windows overlap by one point, which the fragment
   * AA rounds over cleanly — no visible seam at the joint.
   *
   * Cost model: N sampled points → N-2 instances per edge. With the
   * worker's default 24 samples that's 22 instances per bundled edge.
   * At 9500 edges × 22 = ~210k instances — within the mesh's growth
   * budget (power-of-two). Caller sized `ensureCapacity` for this case
   * via the HEB cushion in `redraw`.
   *
   * Dash phase (`dashPhase`) is NOT advanced across sub-segments. The
   * fragment shader treats each instance as its own 0..1 parameter
   * space; carrying phase would require arc-length accumulation CPU-
   * side. For animated edges this produces a faint seam at each control
   * point, which at galaxy LOD (where HEB is active) is sub-pixel and
   * invisible. Worth revisiting if we ever enable HEB at city LOD.
   */
  private writeHebPolyline(
    path: Float32Array,
    color: number, alpha: number, width: number,
    dashSize: number, gapSize: number,
    dashPhase: number,
    flags: number,
  ): void {
    // path is [x0, y0, x1, y1, ...]. N points → N-2 overlapping windows.
    const nPoints = path.length / 2;
    if (nPoints < 3) {
      // Degenerate — just one straight segment fallback. Emit directly.
      if (nPoints < 2) return;
      const x0 = path[0]!, y0 = path[1]!;
      const x1 = path[2]!, y1 = path[3]!;
      const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
      this.writeMeshInstance(
        x0, y0, x1, y1, mx, my,
        color, alpha, width,
        dashSize, gapSize, dashPhase,
        flags,
      );
      return;
    }
    for (let i = 1; i < nPoints - 1; i++) {
      const prevX = path[(i - 1) * 2]!;
      const prevY = path[(i - 1) * 2 + 1]!;
      const midX = path[i * 2]!;
      const midY = path[i * 2 + 1]!;
      const nextX = path[(i + 1) * 2]!;
      const nextY = path[(i + 1) * 2 + 1]!;
      this.writeMeshInstance(
        prevX, prevY, nextX, nextY, midX, midY,
        color, alpha, width,
        dashSize, gapSize, dashPhase,
        flags,
      );
    }
  }

  /**
   * Append one decoration instance to the decoration mesh's backing buffer.
   * Layout mirrors FLOATS_PER_DECORATION_INSTANCE in InstancedDecorationMesh.
   * Called once per arrowhead / x-cap / glow-dot — up to ~4× edge count
   * per frame before glow-dedup. O(1): no allocation, no Pixi call chain.
   */
  private writeDecorationInstance(
    posX: number, posY: number,
    dirX: number, dirY: number,
    size: number,
    color: number, alpha: number,
    kind: number,
    strokeWidth: number,
  ): void {
    const base = this.decorationInstanceCount * FLOATS_PER_DECORATION_INSTANCE;
    let view = this.decorationMesh.view();
    if (base + FLOATS_PER_DECORATION_INSTANCE > view.length) {
      // Overshoot — grow and rebind. Rare; pre-size budget is 4× edge
      // count, and glow-dot dedup typically lands us ~2× edges.
      this.decorationMesh.ensureCapacity(this.decorationInstanceCount + 64);
      view = this.decorationMesh.view();
    }
    view[base + 0] = posX;
    view[base + 1] = posY;
    view[base + 2] = dirX;
    view[base + 3] = dirY;
    view[base + 4] = size;
    unpackDecorationHex(color, view, base + 5, alpha);
    view[base + 9] = kind;
    view[base + 10] = strokeWidth;
    view[base + 11] = 0;
    this.decorationInstanceCount++;
  }

  /**
   * Reset all cached state without tearing down the Graphics node. Safe
   * to call between frames — the next `build()` will recompute from
   * scratch. Used by LOD transitions that need a hard reset (workspace
   * swap, overlay toggle, etc). O(1) — no heap scan, just drops refs so
   * GC can reclaim the previous frame's edge array + bundle slice.
   *
   * Differs from `destroy()` in that Graphics, ticker, and event
   * listener survive — this is a state reset, not teardown.
   */
  clear(): void {
    this.gfx.clear();
    this.lineMesh.setInstanceCount(0);
    this.decorationMesh.setInstanceCount(0);
    this.meshInstanceCount = 0;
    this.decorationInstanceCount = 0;
    this.lastEdges = [];
    this.lastLayout = null;
    this.lastCache = undefined;
    this.lastViewport = undefined;
    this.lastOpts = undefined;
    this.previousLength = 0;
    this.appliedMode = null;
    this.appliedScale = 1;
    this.lastCacheKey = "";
    this.budgetedSlice = null;
    this.budgetedSliceSourceRef = null;
    this.bundleCacheEdgesRef = null;
    this.bundleCacheRectsRef = null;
    this.bundleCacheLod = null;
    this.bundledEdges = null;
    this.bundledFolderCenters = null;
    this.hasAnimatedEdges = false;
    this.internalDashOffset = 0;
  }

  destroy(): void {
    if (this.ticker && this.tickerHandle) {
      this.ticker.remove(this.tickerHandle);
    }
    this.tickerHandle = null;
    this.ticker = null;
    // Release all retained input references (edges, layout, opts,
    // bundle cache) so the caller's workspace snapshot can be GC'd.
    // `clear()` handles the data-side reset; the Graphics destroy
    // below handles the Pixi-side teardown.
    this.clear();
    this.gfx.destroy();
    this.lineMesh.destroy();
    this.decorationMesh.destroy();
  }

  // ── Cache-key helpers (instance) ────────────────────────────────

  /**
   * Assign a stable numeric id to a Set-shaped input so we can fold its
   * identity into the cache key. Upstream contract: replace the Set when
   * membership changes (immutable-write pattern). A mutated-in-place Set
   * aliases in the cache — that's a caller bug, not something this class
   * defends against.
   */
  private setId(s: ReadonlySet<unknown> | undefined): number {
    if (!s) return 0;
    const existing = this.setIdRegistry.get(s as object);
    if (existing !== undefined) return existing;
    const id = this.nextSetId++;
    this.setIdRegistry.set(s as object, id);
    return id;
  }

  private fnId(f: ((...args: unknown[]) => unknown) | undefined): number {
    if (!f) return 0;
    const existing = this.fnIdRegistry.get(f);
    if (existing !== undefined) return existing;
    const id = this.nextFnId++;
    this.fnIdRegistry.set(f, id);
    return id;
  }

  /**
   * Stable fingerprint of every opts field that can change the rendered
   * output. Anything that flips an alpha, colour overlay, filter, or
   * visible subset MUST be reflected here — otherwise the budgeted-slice
   * reuse path serves stale frames when the user toggles
   * focus/diff/violating/cross-graph/temporal state (see audit H7).
   *
   * Set inputs hashed by identity via `setId` — assumes callers replace
   * the Set when membership changes (WorkspaceCanvas reducer contract).
   * `customPredicate` hashed by function identity via `fnId`.
   */
  private computeFilterHash(opts: EdgeStaticBuildOpts | undefined): string {
    if (!opts) return "";
    const k = opts.kindFilter ? Object.keys(opts.kindFilter).sort().join(",") : "";
    const l = opts.layerFilter ? Object.keys(opts.layerFilter).sort().join(",") : "";
    const s = opts.minSeverity ?? "";
    const w = opts.widthMul ?? 1;
    const cg = opts.showCrossGraphEdges === false ? "0" : "1";
    const hc = opts.highlightCrossGraph === false ? "0" : "1";
    // Focus — different edge sets produce different dim vs full alpha.
    const focusId = this.setId(opts.focus?.edgeIds);
    const focusDim = opts.focus?.dimAlpha ?? -1;
    // Temporal — only members render at all.
    const temporalId = this.setId(opts.temporalEdgeSet);
    // Diff — added gets green halo; removed gets red ghost pass.
    const diffAddId = this.setId(opts.diffAdded);
    const diffRemId = this.setId(opts.diffRemoved);
    // Violation — extra red outline pass under these edges.
    const violatingId = this.setId(opts.violatingEdgeIds);
    // Cross-graph flash — dims non-flashed cross-graph edges.
    const flashId = this.setId(opts.crossGraphFlash);
    // Custom predicate — any identity change invalidates the slice.
    const customId = this.fnId(
      opts.customPredicate as ((...args: unknown[]) => unknown) | undefined,
    );
    // HEB path set — identity-keyed so a fresh worker response invalidates
    // the slice reuse path. The map content itself is not hashed (size +
    // reference identity is enough; upstream replaces the map on every
    // HEB_READY, see scene-store.setHebPaths).
    const hebId = this.setId(opts.hebPaths as unknown as ReadonlySet<unknown> | undefined);
    return `${k}|${l}|${s}|${w}|${cg}|${hc}|f${focusId}:${focusDim}|t${temporalId}|da${diffAddId}|dr${diffRemId}|v${violatingId}|cf${flashId}|p${customId}|h${hebId}`;
  }
}

// ── Bundle-id / geometry helpers (module-scope) ─────────────────────

/**
 * Parse the folder path back out of a folder-bundle edge id. The id
 * format is `folder-bundle:<fromFolder>-><toFolder>` — we can't store
 * the folders as separate fields on BundledEdge without breaking the
 * shape compat with FileEdge that the draw loop relies on, so we encode
 * them in the id and re-split here. Cheap: single indexOf + slice, runs
 * once per folder-bundle per frame.
 */
function folderPrefixForBundleId(id: string, end: "from" | "to"): string | null {
  const prefix = "folder-bundle:";
  if (!id.startsWith(prefix)) return null;
  const rest = id.slice(prefix.length);
  const arrowAt = rest.indexOf("->");
  if (arrowAt < 0) return null;
  return end === "from" ? rest.slice(0, arrowAt) : rest.slice(arrowAt + 2);
}

/**
 * Synthesise a small Rect centred on a folder's average file-centre.
 * The renderer's anchor code needs a non-zero rect to compute the
 * bezier spread; returning a 0×0 rect collapses the cubic curve into
 * a line, which reads as a straight spoke (which is fine at galaxy
 * zoom where you wouldn't notice the curve anyway).
 */
function virtualFolderRect(center: { x: number; y: number }): Rect {
  const half = FOLDER_VIRTUAL_RECT_SIZE / 2;
  return { x: center.x - half, y: center.y - half, w: FOLDER_VIRTUAL_RECT_SIZE, h: FOLDER_VIRTUAL_RECT_SIZE };
}

/**
 * Weight function for the budgeted top-N sort. Bundled edges expose
 * `weightSum` (sum of underlying weights) which is a better ordering
 * signal than `weight` (first-seen) — a 50-edge bundle should beat
 * a single high-weight edge in the budget.
 */
function bundleSortWeight(e: FileEdge | BundledEdge): number {
  const be = e as BundledEdge;
  if (typeof be.weightSum === "number") return be.weightSum;
  return (e as FileEdge).weight ?? 0;
}

// ── Anchor computation ──────────────────────────────────────────────

// Hot-path anchor scratch.
// --------------------------------------------------------------------
// The renderer calls the anchor computation once per (edge, overlay)
// in the redraw loop — thousands of times per frame at galaxy LOD.
// Returning a fresh `{ a: {...}, b: {...}, cp1x, cp1y, cp2x, cp2y }`
// structure each call allocated 3 objects/edge and stressed V8's GC
// enough to show up as tail latency.
//
// New layout: a single process-level scratch struct (mutable) that the
// routine fills in and returns. The caller destructures its fields
// immediately after the call, so mutation by the next call can't
// corrupt anything — the data has already moved into local variables.
// If a future refactor ever makes the renderer reentrant (unlikely in
// JS's single-threaded model), the struct will need to be per-instance
// instead of module-level, but the contract stays "read-then-forget".
//
// `aSide` / `bSide` are encoded as 0 = "left", 1 = "right" to avoid
// string allocation/interning; the caller reads the side via the helper
// `anchorSide()`.
interface AnchorScratch {
  ax: number; ay: number; aSide: 0 | 1;
  bx: number; by: number; bSide: 0 | 1;
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
}
const ANCHOR_SCRATCH: AnchorScratch = {
  ax: 0, ay: 0, aSide: 1,
  bx: 0, by: 0, bSide: 0,
  cp1x: 0, cp1y: 0,
  cp2x: 0, cp2y: 0,
};
// Helper kept exported (internal use by future consumers that need to
// read the side flag from a scratch struct). Currently unreferenced in
// the renderer hot loop because the centre-mode path — the only galaxy-
// tier code path — doesn't need a side distinction, and the line/side
// modes consume the anchor inside computeAnchors itself.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function anchorSide(v: 0 | 1): "left" | "right" {
  return v === 0 ? "left" : "right";
}
// Force usage so TS2305 stays green without deleting a legitimate
// primitive that will be needed when we refactor line/side modes next.
void anchorSide;

// Deterministic per-kind arc direction so "cycle" always bows up and
// "taint" always bows down (or vice versa) even between the same pair
// of cards — prevents multiple edges from stacking into a single line.
function arcDirectionForKind(kind: string): 1 | -1 {
  let h = 0;
  for (let i = 0; i < kind.length; i++) h = (h * 31 + kind.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? 1 : -1;
}

/**
 * Compute anchor points + bezier control points for one edge, writing
 * into the shared `ANCHOR_SCRATCH`. Returns the scratch (for chaining)
 * or null on unresolved geometry.
 *
 * IMPORTANT: the returned object is mutated by every subsequent call.
 * Callers must read the fields they need before invoking the function
 * again for another edge. No destructuring across calls, no retention
 * across the hot loop.
 */
function computeAnchors(
  edge: FileEdge,
  fromRect: Rect | undefined,
  toRect: Rect | undefined,
  fallbackRoute: { x1: number; y1: number; cx1: number; cy1: number; cx2: number; cy2: number; x2: number; y2: number } | undefined,
  anchorMode: AnchorMode,
  fileById: Map<string, Pick<FileNode, "loc">> | undefined,
  curveFactor: number | undefined,
): AnchorScratch | null {
  // Centre mode: just use the cached route. This is the coarse-tier path
  // (galaxy / supergalaxy / universe, and any mode where a rect is missing).
  if (anchorMode === "centre" || !fromRect || !toRect) {
    if (!fallbackRoute) return null;
    ANCHOR_SCRATCH.ax = fallbackRoute.x1;
    ANCHOR_SCRATCH.ay = fallbackRoute.y1;
    ANCHOR_SCRATCH.aSide = 1; // "right"
    ANCHOR_SCRATCH.bx = fallbackRoute.x2;
    ANCHOR_SCRATCH.by = fallbackRoute.y2;
    ANCHOR_SCRATCH.bSide = 0; // "left"
    ANCHOR_SCRATCH.cp1x = fallbackRoute.cx1;
    ANCHOR_SCRATCH.cp1y = fallbackRoute.cy1;
    ANCHOR_SCRATCH.cp2x = fallbackRoute.cx2;
    ANCHOR_SCRATCH.cp2y = fallbackRoute.cy2;
    return ANCHOR_SCRATCH;
  }

  const fromCx = fromRect.x + fromRect.w / 2;
  const toCx = toRect.x + toRect.w / 2;

  // Resolve the two endpoints. `lineAnchor` / `sideAnchor` still allocate
  // a small result object — out of scope for this hot-path fix because
  // this branch is "line" (street/ground) / "side" (city) only; galaxy
  // never enters this code path.
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

  // Bezier control points. `curveFactor` scales the x-spread so a near-
  // straight kind (0.10) and a deep-arc kind (0.95) produce visibly
  // different silhouettes. The perpendicular "bow" shifts the control-
  // point Y when factor exceeds the baseline, giving the curve a clear
  // above/below bias locked per kind by `arcDirectionForKind`.
  const factor = curveFactor ?? 0.35;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const spread = Math.max(40, Math.abs(dx) * factor);
  const cp1x = a.side === "left" ? a.x - spread : a.x + spread;
  const cp2x = b.side === "left" ? b.x - spread : b.x + spread;

  const bowStrength = Math.max(0, factor - 0.35) * Math.max(120, Math.hypot(dx, dy)) * 0.6;
  const bow = bowStrength * arcDirectionForKind(edge.kind);

  ANCHOR_SCRATCH.ax = a.x;
  ANCHOR_SCRATCH.ay = a.y;
  ANCHOR_SCRATCH.aSide = a.side === "left" ? 0 : 1;
  ANCHOR_SCRATCH.bx = b.x;
  ANCHOR_SCRATCH.by = b.y;
  ANCHOR_SCRATCH.bSide = b.side === "left" ? 0 : 1;
  ANCHOR_SCRATCH.cp1x = cp1x;
  ANCHOR_SCRATCH.cp1y = a.y + bow;
  ANCHOR_SCRATCH.cp2x = cp2x;
  ANCHOR_SCRATCH.cp2y = b.y + bow;
  return ANCHOR_SCRATCH;
}

// ── Graphics primitives (dashed / arrow / X-cap / glow) ─────────────

function drawDashedBezier(
  g: Graphics,
  x1: number, y1: number, cp1x: number, cp1y: number, cp2x: number, cp2y: number, x2: number, y2: number,
  pattern: readonly number[],
  offset: number,
  stroke: { color: number; alpha: number; width: number; cap: "round" | "butt" },
): void {
  if (pattern.length < 2) return;
  let period = 0;
  for (const seg of pattern) period += seg;
  if (period <= 0) return;

  // Even indices = pen-down (on) segments, odd = pen-up (off) gaps. Longer
  // arrays like [6, 2, 1, 2] encode dash-dot / dash-dot-dot silhouettes so
  // kinds read distinctly at a glance — not just by hue.
  const isPenDownAt = (distance: number): boolean => {
    let t = ((distance % period) + period) % period;
    for (let i = 0; i < pattern.length; i++) {
      if (t < pattern[i]) return i % 2 === 0;
      t -= pattern[i];
    }
    return false;
  };

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
    const isOn = isPenDownAt(cumLen + offset);
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
