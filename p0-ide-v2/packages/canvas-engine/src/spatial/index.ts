// Spatial-query public API.

export type { EdgePickIndex } from "./edge-pick-index";
export { createEdgePickIndex } from "./edge-pick-index";

export { buildSceneQuery } from "./visible-query";

// Exposed so the layout worker can pre-build indices during layout
// compute and hand them to the main thread via
// `WorkspaceLayout.packedSpatialIndex` (see layout/types.ts). Callers
// outside the worker should continue to go through `buildSceneQuery` —
// these classes are lower-level surface.
export { FileIndex } from "./file-index";
export { EdgeFilter } from "./edge-filter";
