import type { FileNode, FileEdge, WorkspaceComment, Rect } from "../graph/types";
import type { ClusterMeta } from "../layout/types";

export type LodLevel = "universe" | "supergalaxy" | "galaxy" | "city" | "street" | "ground";

// Re-export the tier-config types so public consumers can import them from
// `view/types` alongside `LodLevel` — keeps the "one import" DX while the
// canonical declaration lives next to `LOD_TIERS` in `../lod/lod-config`.
export type { LodTierConfig, LodRendererKind } from "../lod/lod-config";

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

/**
 * Supercluster visible payload for the `universe` LOD — one tier above
 * supergalaxy. Each entry is a top-level directory (e.g. `crates/`,
 * `tests/`, or each service in an MSA monorepo) that collapses many
 * underlying clusters into a single box. Used so a multi-service monorepo
 * with thousands of crates renders as a handful of service boxes at the
 * most zoomed-out LOD.
 */
export interface WorkspaceSuperclusterView {
  superclusters: ClusterMeta[];
  kind: "universe";
}

export interface WorkspaceFileView {
  files: FileNode[];
  edges: FileEdge[];
  comments: WorkspaceComment[];
  // Mandatory discriminator. Prior `kind?: "files"` made `WorkspaceFileView`
  // indistinguishable from the partial-fallback literals scattered through
  // callers (`{ files: [], edges: [], comments: [] }`) — TS couldn't narrow
  // a `WorkspaceScene` union against them. Requiring `kind` restores the
  // exhaustive guard in consumers and prevents accidental coercion.
  kind: "files";
}

// Back-compat alias — callers that don't care about the supergalaxy tier
// continue to receive the file-level view via `buildWorkspaceView`.
export type WorkspaceView = WorkspaceFileView;

// Union used by scene-consumers that DO care about supergalaxy / universe.
export type WorkspaceScene =
  | WorkspaceFileView
  | WorkspaceClusterView
  | WorkspaceSuperclusterView;

export function isClusterView(
  scene: WorkspaceScene,
): scene is WorkspaceClusterView {
  return (scene as WorkspaceClusterView).kind === "supergalaxy";
}

export function isSuperclusterView(
  scene: WorkspaceScene,
): scene is WorkspaceSuperclusterView {
  return (scene as WorkspaceSuperclusterView).kind === "universe";
}

export function isFileView(
  scene: WorkspaceScene,
): scene is WorkspaceFileView {
  return (scene as WorkspaceFileView).kind === "files";
}

/**
 * Exhaustiveness guard for `switch (scene.kind)` and similar constructs.
 * Trips the TS compiler at build time when a new `LodLevel` or
 * `WorkspaceScene` variant is added without updating every switch.
 * At runtime this throws — callers should never actually reach it.
 */
export function assertNever(x: never): never {
  throw new Error(`assertNever: unhandled variant ${JSON.stringify(x)}`);
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
