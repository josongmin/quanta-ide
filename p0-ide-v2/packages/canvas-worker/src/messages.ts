import type { WorkspaceGraph, WorkspaceLayout, LodAggregateCache, BezierRoute } from "@quanta/canvas-engine";

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

export type WorkerResponse =
  | { type: "LAYOUT_READY";     id: string; payload: SerializedLayout }
  | { type: "AGGREGATES_READY"; id: string; payload: SerializedAggregates }
  | { type: "GEOMETRY_READY";   id: string; payload: EdgeGeometryBatch }
  | { type: "WORKER_ERROR";     id: string; message: string };

// ── Serialization helpers (Maps are not structured-clone-safe) ────

export interface SerializedLayout {
  fileRects: [string, { x: number; y: number; w: number; h: number }][];
  edgeRoutes: [string, BezierRoute][];
  aggregates: SerializedAggregates;
  totalBounds: { x: number; y: number; w: number; h: number };
}

export interface SerializedAggregates {
  commentsByFunction: [string, number][];
  commentsByFile: [string, number][];
  commentedLines: [string, number[]][];
}

export function serializeLayout(layout: WorkspaceLayout): SerializedLayout {
  return {
    fileRects: Array.from(layout.fileRects.entries()),
    edgeRoutes: Array.from(layout.edgeRoutes.entries()),
    aggregates: serializeAggregates(layout.aggregates),
    totalBounds: layout.totalBounds,
  };
}

export function deserializeLayout(s: SerializedLayout): WorkspaceLayout {
  return {
    fileRects: new Map(s.fileRects),
    edgeRoutes: new Map(s.edgeRoutes),
    aggregates: deserializeAggregates(s.aggregates),
    totalBounds: s.totalBounds,
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
