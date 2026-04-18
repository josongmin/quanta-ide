import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout } from "../layout/types";
import type {
  WorkspaceView,
  WorkspaceScene,
  Viewport,
  LodLevel,
} from "../view/types";
import { buildVisibleQuery, buildSceneQuery } from "../spatial/visible-query";

export interface BuildViewInput {
  graph: WorkspaceGraph;
  layout: WorkspaceLayout;
  viewport: Viewport;
  lod: LodLevel;
}

/**
 * Back-compat entry point — always returns file-level view (ignores the
 * `lod` field). Existing callers (`MultiFileCanvas`, etc.) continue to
 * work unchanged. For LOD-aware output use `buildWorkspaceScene`.
 */
export function buildWorkspaceView(input: BuildViewInput): WorkspaceView {
  return buildVisibleQuery(input.graph, input.layout, input.viewport);
}

/**
 * LOD-aware scene builder. At the `supergalaxy` LOD, returns a cluster
 * view (one box per top-level directory); at other LODs returns the file
 * view. Use `isClusterView` (from ../view/types) to discriminate.
 */
export function buildWorkspaceScene(input: BuildViewInput): WorkspaceScene {
  return buildSceneQuery(input.graph, input.layout, input.viewport, input.lod);
}
