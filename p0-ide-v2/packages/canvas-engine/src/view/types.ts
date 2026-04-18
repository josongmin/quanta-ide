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

export interface ViewState {
  viewport: Viewport;
  lod: LodLevel;
  selectedFileId: string | null;
  hoveredFileId: string | null;
  selectedEdgeId: string | null;
  focusedNodeId: string | null;
}
