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

export interface WorkspaceLayout {
  fileRects: Map<string, Rect>;
  edgeRoutes: Map<string, BezierRoute>;
  aggregates: LodAggregateCache;
  totalBounds: Rect;
}

export const FILE_CARD_W = 320;
export const FILE_CARD_H = 200;
export const GRID_GAP_X  = 80;
export const GRID_GAP_H  = 60;
export const GRID_COLS   = 8;
