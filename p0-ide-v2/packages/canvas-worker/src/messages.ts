import type {
  WorkspaceGraph,
  WorkspaceLayout,
  LodAggregateCache,
  BezierRoute,
  ClusterMeta,
  Rect,
} from "@quanta/canvas-engine";

// ── Requests (main → worker) ─────────────────────────────────────

export type LayoutStrategy = "grid" | "grid-then-elk";

export type WorkerRequest =
  | {
      type: "BUILD_LAYOUT";
      id: string; // job id for correlation
      payload: {
        graph: WorkspaceGraph;
        strategy: LayoutStrategy;
        pinnedNodes?: Record<string, { x: number; y: number; w: number; h: number }>;
      };
    }
  | {
      type: "PARTIAL_RELAYOUT";
      id: string;
      payload: {
        graph: WorkspaceGraph;
        layout: SerializedLayout;
        changedFileIds: string[];
      };
    }
  | {
      type: "BUILD_AGGREGATES";
      id: string;
      payload: { graph: WorkspaceGraph };
    }
  | {
      type: "BUILD_EDGE_GEOMETRY";
      id: string;
      payload: { graph: WorkspaceGraph; layout: SerializedLayout };
    }
  | { type: "CANCEL"; id: string };

// ── Responses (worker → main) ────────────────────────────────────

export interface EdgeGeometryBatch {
  // Flat Float32Array: [x1,y1,cx1,cy1,cx2,cy2,x2,y2, x1,y1,...] per edge
  positions: Float32Array;
  // Parallel array of edge IDs
  edgeIds: string[];
}

export type LayoutStage = "grid-ready" | "elk-start" | "elk-skipped" | "elk-failed";

export type WorkerResponse =
  | { type: "LAYOUT_READY";     id: string; payload: SerializedLayout; stage: "grid" | "elk" }
  | { type: "LAYOUT_PROGRESS";  id: string; stage: LayoutStage; filesCount: number; elapsedMs: number }
  | { type: "AGGREGATES_READY"; id: string; payload: SerializedAggregates }
  | { type: "GEOMETRY_READY";   id: string; payload: EdgeGeometryBatch }
  | { type: "WORKER_ERROR";     id: string; message: string };

// ── Serialization helpers (Maps are not structured-clone-safe) ────

export interface SerializedLayout {
  fileRects: [string, { x: number; y: number; w: number; h: number }][];
  edgeRoutes: [string, BezierRoute][];
  aggregates: SerializedAggregates;
  totalBounds: { x: number; y: number; w: number; h: number };
  /** Present only when treemap layout was used. */
  clusterRects?: [string, Rect][];
  clusters?: ClusterMeta[];
  /** Parent boxes of clusters for the `universe` LOD tier. */
  superclusterRects?: [string, Rect][];
  superclusters?: ClusterMeta[];
}

export interface SerializedAggregates {
  commentsByFunction: [string, number][];
  commentsByFile: [string, number][];
  commentedLines: [string, number[]][];
}

export function serializeLayout(layout: WorkspaceLayout): SerializedLayout {
  const base: SerializedLayout = {
    fileRects: Array.from(layout.fileRects.entries()),
    edgeRoutes: Array.from(layout.edgeRoutes.entries()),
    aggregates: serializeAggregates(layout.aggregates),
    totalBounds: layout.totalBounds,
  };
  if (layout.clusterRects) {
    base.clusterRects = Array.from(layout.clusterRects.entries());
  }
  if (layout.clusters) {
    base.clusters = layout.clusters;
  }
  if (layout.superclusterRects) {
    base.superclusterRects = Array.from(layout.superclusterRects.entries());
  }
  if (layout.superclusters) {
    base.superclusters = layout.superclusters;
  }
  return base;
}

export function deserializeLayout(s: SerializedLayout): WorkspaceLayout {
  return {
    fileRects: new Map(s.fileRects),
    edgeRoutes: new Map(s.edgeRoutes),
    aggregates: deserializeAggregates(s.aggregates),
    totalBounds: s.totalBounds,
    clusterRects: s.clusterRects ? new Map(s.clusterRects) : undefined,
    clusters: s.clusters,
    superclusterRects: s.superclusterRects ? new Map(s.superclusterRects) : undefined,
    superclusters: s.superclusters,
  };
}

export function serializeAggregates(a: LodAggregateCache): SerializedAggregates {
  const commentedLines: [string, number[]][] = Array.from(
    a.commentedLines.entries(),
    ([k, v]) => [k, Array.from(v)],
  );
  return {
    commentsByFunction: Array.from(a.commentsByFunction.entries()),
    commentsByFile: Array.from(a.commentsByFile.entries()),
    commentedLines,
  };
}

export function deserializeAggregates(s: SerializedAggregates): LodAggregateCache {
  const commentedLines = new Map<string, Set<number>>(
    s.commentedLines.map(([k, v]) => [k, new Set(v)]),
  );
  return {
    commentsByFunction: new Map(s.commentsByFunction),
    commentsByFile: new Map(s.commentsByFile),
    commentedLines,
  };
}
