import type { FileNode, FileEdge, WorkspaceComment, Rect } from "../graph/types";
import type { ClusterMeta } from "../layout/types";

export type LodLevel = "supergalaxy" | "galaxy" | "city" | "street" | "ground";

export interface Viewport {
  x: number;
  y: number;
  scale: number;
  width: number;   // container px
  height: number;  // container px
}

/**
 * Per-cluster visible payload for the supergalaxy LOD. Renderers draw one
 * box per entry — no individual file cards, no edges.
 */
export interface WorkspaceClusterView {
  clusters: ClusterMeta[];
  // Intentionally keep the same top-level shape as WorkspaceView so
  // downstream code can branch on `view.kind` rather than duck-typing.
  kind: "supergalaxy";
}

export interface WorkspaceFileView {
  files: FileNode[];
  edges: FileEdge[];
  comments: WorkspaceComment[];
  kind?: "files";
}

// Back-compat alias — callers that don't care about the supergalaxy tier
// continue to receive the file-level view via `buildWorkspaceView`.
export type WorkspaceView = WorkspaceFileView;

// Union used by scene-consumers that DO care about supergalaxy.
export type WorkspaceScene = WorkspaceFileView | WorkspaceClusterView;

export function isClusterView(
  scene: WorkspaceScene,
): scene is WorkspaceClusterView {
  return (scene as WorkspaceClusterView).kind === "supergalaxy";
}

// Re-export for downstream convenience (PixiStage imports from here).
export type { Rect };

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
