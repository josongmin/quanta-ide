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
  LodAggregateCache,
  WorkspaceLayout,
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
  ViewState,
} from "./view/types";

// LOD manager
export { LodManager, lodFromScale } from "./lod/lod-manager";

// Grid layout
export { gridLayout } from "./layout/grid-layout";

// Edge geometry cache
export type { BezierGeometry } from "./render/edge-geometry-cache";
export { EdgeGeometryCache } from "./render/edge-geometry-cache";

// Workspace view builder
export type { BuildViewInput } from "./view/build-view";
export { buildWorkspaceView } from "./view/build-view";

// Spatial indexes
export { FileIndex } from "./spatial/file-index";
export { EdgeFilter } from "./spatial/edge-filter";
