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
 * LOD-aware scene builder. Dispatch is driven by each tier's `sceneKind`
 * (declared in `lod/lod-config.ts`) — `"superclusters"` → supercluster view
 * (universe), `"clusters"` → cluster view (supergalaxy), `"files"` → file
 * view (galaxy / city / street / ground). Fallback chains are also honored
 * so a tier with no data gracefully degrades to the next available one.
 * Use `isClusterView` / `isSuperclusterView` (from ../view/types) to
 * discriminate the return type at call sites.
 */
export function buildWorkspaceScene(input: BuildViewInput): WorkspaceScene {
  return buildSceneQuery(input.graph, input.layout, input.viewport, input.lod);
}
