import type { Rect } from "../graph/types";

export interface BezierRoute {
  x1: number; y1: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  x2: number; y2: number;
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
}

export const FILE_CARD_W = 560;
export const FILE_CARD_H = 720;
export const GRID_GAP_X  = 100;
export const GRID_GAP_H  = 60;
export const GRID_COLS   = 8;
