import type { Rect } from "../graph/types";
import type { ClusterEdge } from "./cluster-edge-aggregate";
import type { WorkspaceMetrics } from "../graph/metrics";

export interface BezierRoute {
  x1: number; y1: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  x2: number; y2: number;
}

/**
 * Orthogonal (L / Z / staircase) poly-line route — an alternative to
 * `BezierRoute` for IDE-flavor edges that prefer right angles over curves.
 * First and last points anchor on rect edges (not centers) so arrowheads
 * draw flush.
 *
 * Produced by `buildOrthogonalRoutes` and stored under
 * `WorkspaceLayout.edgeRoutesOrtho`. Renderer integration is deferred —
 * for now it's data-only.
 */
export interface OrthogonalRoute {
  points: Array<{ x: number; y: number }>;
}

/**
 * Cluster-level bundled edge — a single "trunk" that collapses all
 * underlying file→file edges between a pair of clusters. Used at the
 * supergalaxy LOD tier so 5000+ edges render as a handful of thick lines.
 *
 * Directions are merged (unordered pair), so `fromClusterId`/`toClusterId`
 * just identify which pair; callers needing direction should sum per-edge
 * routes instead.
 */
export interface BundledEdge {
  fromClusterId: string;
  toClusterId: string;
  count: number;                    // # underlying edges in the bundle
  midpoint: { x: number; y: number };
}

export interface LodAggregateCache {
  commentsByFunction: Map<string, number>;   // `${fileId}:${funcName}` → count
  commentsByFile: Map<string, number>;
  commentedLines: Map<string, Set<number>>;  // fileId → Set<lineNumber>
}

/**
 * Metadata attached to a cluster rect. A cluster is one top-level
 * directory (crate/folder) — used at the `supergalaxy` LOD tier so
 * 5000+ file repos can render as a handful of boxes instead of per-file.
 */
export interface ClusterMeta {
  id: string;        // cluster id (directory path)
  rect: Rect;
  fileCount: number;
  locSum: number;
}

export interface WorkspaceLayout {
  fileRects: Map<string, Rect>;
  edgeRoutes: Map<string, BezierRoute>;
  aggregates: LodAggregateCache;
  totalBounds: Rect;
  /**
   * Cluster id → bounding rect (one per top-level directory). Present when
   * the treemap layout was used; grid / ELK layouts omit this field.
   */
  clusterRects?: Map<string, Rect>;
  /** Full cluster metadata (parallel to clusterRects keys). */
  clusters?: ClusterMeta[];
  /**
   * Supercluster id → bounding rect, one per top-level directory *without*
   * cluster drill-through (i.e. the level above `clusters`). Used at the
   * `universe` LOD tier so a multi-service monorepo collapses to a handful
   * of service boxes. Present only when the treemap layout was used.
   */
  superclusterRects?: Map<string, Rect>;
  /** Full supercluster metadata (parallel to superclusterRects keys). */
  superclusters?: ClusterMeta[];
  /**
   * Optional orthogonal (poly-line) routes indexed by edge id, parallel
   * to `edgeRoutes`. Emitted by layouts that opt in to `buildOrthogonalRoutes`.
   * Renderer integration is deferred — presence here is purely data.
   */
  edgeRoutesOrtho?: Map<string, OrthogonalRoute>;
  /**
   * Optional cluster-level bundled edges — one "trunk" per pair of
   * connected clusters with a `count` of underlying file→file edges.
   * Consumed at supergalaxy LOD; renderer integration deferred.
   */
  bundledEdges?: BundledEdge[];
  /**
   * Optional aggregated cluster-cluster super-edges bucketed by
   * (from, to, kind) — consumed by the supergalaxy tier's
   * `ClusterEdgeRenderer` to show kind-coloured directional strength
   * between clusters. Populated by `aggregateClusterEdges` +
   * `routeClusterEdges` during layout.
   */
  clusterEdges?: ClusterEdge[];
  /**
   * Optional graph-theoretic centrality metrics for the workspace — per-file
   * in/out/total degree and (when `computeBetweenness` was requested) a
   * normalized betweenness rank. Populated once at layout time by
   * `computeWorkspaceMetrics`; consumed by the galaxy tier for dot sizing
   * and by the HUD for "top files by centrality" listings. Absent on
   * layouts produced outside the treemap/grid paths (tests etc.).
   */
  metrics?: WorkspaceMetrics;
  /**
   * Optional strongly-connected components (cycles) in the file-level
   * import/call graph, as returned by `findStronglyConnectedComponents`.
   * Each inner array is one cycle's members; trivial non-cyclic SCCs are
   * omitted. Consumed by the galaxy-tier `SCCBubbleRenderer` to draw a
   * soft orange enclosure around each cycle and by the HUD's "cycles"
   * section. Populated behind `computeSccs` in layout options (default on).
   */
  sccs?: readonly (readonly string[])[];
  /**
   * AI-assist ranked "you should look here first" list. Computed from
   * centrality + entry-point heuristics + risk score by `rankStartHere`.
   * Consumed by the badge overlay and the HUD's graph tab.
   */
  startHere?: readonly import("../graph/start-here").StartHereEntry[];
  /**
   * Architecture-violation edge ids. Populated by `detectArchViolations`
   * during layout compute. Used by the renderer to highlight edges that
   * cross architectural boundaries (e.g. domain → infra) and by the HUD
   * to display a violation-count badge per layer pair.
   */
  archViolations?: {
    edgeIds: readonly string[];
    byPair: Readonly<Record<string, number>>;
  };
}

// Canonical file-card dimensions. Cards are sized to fit a header stripe
// + function-block stack at legible zoom. Both the layout packer (engine)
// and the renderer (canvas-pixi re-exports via `@quanta/canvas-engine`)
// consume these — single source of truth lives here to avoid drift.
export const FILE_CARD_W = 560;
export const FILE_CARD_H = 720;
export const GRID_GAP_X  = 100;
export const GRID_GAP_H  = 60;
export const GRID_COLS   = 8;
