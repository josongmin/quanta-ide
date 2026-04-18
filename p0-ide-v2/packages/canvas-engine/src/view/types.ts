import type { FileNode, FileEdge, WorkspaceComment } from "../graph/types";

export type LodLevel = "galaxy" | "city" | "street" | "ground";

export interface Viewport {
  x: number;
  y: number;
  scale: number;
  width: number;   // container px
  height: number;  // container px
}

export interface WorkspaceView {
  files: FileNode[];
  edges: FileEdge[];
  comments: WorkspaceComment[];
}

// ViewState holds interaction state only (selection/hover/focus). Viewport
// (pan/zoom) is kept in a *separate* store field so that fast-moving viewport
// updates don't churn subscribers who only care about selection.
export interface ViewState {
  lod: LodLevel;
  selectedFileId: string | null;
  hoveredFileId: string | null;
  selectedEdgeId: string | null;
  focusedNodeId: string | null;
}
