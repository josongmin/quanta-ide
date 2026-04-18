import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout } from "../layout/types";
import type { WorkspaceView, Viewport, LodLevel } from "../view/types";
import { buildVisibleQuery } from "../spatial/visible-query";

export interface BuildViewInput {
  graph: WorkspaceGraph;
  layout: WorkspaceLayout;
  viewport: Viewport;
  lod: LodLevel;
}

export function buildWorkspaceView(input: BuildViewInput): WorkspaceView {
  return buildVisibleQuery(input.graph, input.layout, input.viewport);
}
