// Layout-domain public API.

export type {
  BezierRoute,
  LodAggregateCache,
  WorkspaceLayout,
  ClusterMeta,
  FolderFrameMeta,
} from "./types";
export {
  FILE_CARD_W,
  FILE_CARD_H,
  FILE_CARD_HEADER_H,
  FILE_CARD_LINE_H,
  FILE_CARD_PAD_H,
  FILE_CARD_MIN_H,
  computeFileHeight,
} from "./types";

export { lineAnchor, sideAnchor } from "./edge-anchor";

export type { TreemapResult, ClusterInfo } from "./treemap-layout";
export { treemapLayout } from "./treemap-layout";

export { gridLayout } from "./grid-layout";

export type { ClusterEdge } from "./cluster-edge-aggregate";

export { enrichLayout } from "./enrich-layout";
export type { EnrichOptions, EnrichResult } from "./enrich-layout";
