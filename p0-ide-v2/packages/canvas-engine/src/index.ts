// Graph types
export type {
  ArchLayer,
  Rect,
  SignalSummary,
  FunctionBlock,
  FileNode,
  FileEdge,
  WorkspaceComment,
  WorkspaceGraph,
} from "./graph/types";

// Layout types + constants
export type {
  BezierRoute,
  OrthogonalRoute,
  BundledEdge,
  LodAggregateCache,
  WorkspaceLayout,
  ClusterMeta,
} from "./layout/types";
export {
  FILE_CARD_W,
  FILE_CARD_H,
  GRID_GAP_X,
  GRID_GAP_H,
  GRID_COLS,
} from "./layout/types";

// View types
export type {
  LodLevel,
  Viewport,
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceFileView,
  WorkspaceScene,
  ViewState,
} from "./view/types";
export { isClusterView } from "./view/types";

// LOD manager
export { LodManager, lodFromScale } from "./lod/lod-manager";

// Grid layout
export { gridLayout } from "./layout/grid-layout";

// Treemap layout (directory-based)
export { treemapLayout } from "./layout/treemap-layout";
export type { TreemapResult, ClusterInfo } from "./layout/treemap-layout";

// Orthogonal edge routing (data-only; renderer integration deferred)
export { orthogonalRoute, buildOrthogonalRoutes } from "./layout/orthogonal-routing";

// Cluster-level edge bundling (data-only; renderer integration deferred)
export { buildBundledEdges, buildFileToClusterMap } from "./layout/edge-bundling";

// Edge geometry cache
export type { BezierGeometry } from "./render/edge-geometry-cache";
export { EdgeGeometryCache } from "./render/edge-geometry-cache";

// Workspace view builder
export type { BuildViewInput } from "./view/build-view";
export { buildWorkspaceView, buildWorkspaceScene } from "./view/build-view";

// Spatial indexes
export { FileIndex } from "./spatial/file-index";
export { EdgeFilter } from "./spatial/edge-filter";

// Lower-level query helpers
export {
  buildVisibleQuery,
  buildClusterQuery,
  buildSceneQuery,
} from "./spatial/visible-query";
