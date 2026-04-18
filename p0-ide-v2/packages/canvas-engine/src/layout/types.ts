import type { Rect } from "../graph/types";

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
}

export const FILE_CARD_W = 560;
export const FILE_CARD_H = 720;
export const GRID_GAP_X  = 100;
export const GRID_GAP_H  = 60;
export const GRID_COLS   = 8;
