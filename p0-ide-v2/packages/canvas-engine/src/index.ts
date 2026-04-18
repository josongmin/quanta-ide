// Graph types
export type {
  ArchLayer,
  Rect,
  SignalSummary,
  FunctionBlock,
  FileNode,
  FileEdge,
  EdgeKind,
  EdgeLayer,
  EdgeSeverity,
  WorkspaceComment,
  WorkspaceGraph,
} from "./graph/types";
export { deriveEdgeLayer } from "./graph/types";

// Evidence / proof bundles — `FileEdge.evidenceId` dereferences into
// `WorkspaceGraph.proofs[id]`. Analyzers attach witness traces here.
export type {
  WitnessRole,
  WitnessStep,
  ProofKind,
  ProofBundle,
} from "./graph/evidence";

// Commit-ordered graph history — temporal slider + snapshot diff.
export type { GraphSnapshot, GraphHistory, SnapshotDiff } from "./graph/history";
export { materializeEdgeSet, diffSnapshots } from "./graph/history";

// Neighborhood BFS — focus-mode k-hop subgraph extraction.
export type { Neighborhood } from "./graph/neighborhood";
export { computeNeighborhood } from "./graph/neighborhood";

// Graph centrality metrics — degree + optional Brandes betweenness.
export type {
  FileMetrics,
  WorkspaceMetrics,
  ComputeMetricsOptions,
} from "./graph/metrics";
export { computeWorkspaceMetrics } from "./graph/metrics";

// Tarjan SCC — strongly-connected components for import/call cycle detection.
export type { SCCResult } from "./graph/scc";
export { findStronglyConnectedComponents } from "./graph/scc";

// Pathfinding — Bloom-style (source, target) shortest / all-shortest / k-shortest.
export type { PathQuery, Path, PathResult } from "./graph/pathfinding";
export { findPaths } from "./graph/pathfinding";

// Start-here ranking — AI-assist "you should look here first" scoring.
export type { StartHereEntry } from "./graph/start-here";
export { rankStartHere } from "./graph/start-here";

// Line-anchored edge attachments — Sourcetrail/CodeSee style endpoint glue.
export type { EdgeAnchor, LineAnchorInput } from "./layout/edge-anchor";
export { lineAnchor, centreAnchor, sideAnchor } from "./layout/edge-anchor";

// Live filter DSL — Gephi/Neo4j-Bloom-style ad-hoc edge query box.
export type { FilterPredicate, FilterCompileOutput } from "./graph/edge-filter-dsl";
export { compileEdgeFilter } from "./graph/edge-filter-dsl";

// Filter DSL autocomplete — context-aware completions for the HUD box.
export type { Completion, CompletionKind } from "./graph/edge-filter-completions";
export { getCompletions } from "./graph/edge-filter-completions";

// Architecture dependency rule violations (Clean/Hexagonal layer policy).
export type { ArchViolationsResult } from "./graph/arch-violations";
export { detectArchViolations } from "./graph/arch-violations";

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
  LodTierConfig,
  LodRendererKind,
  Viewport,
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
  WorkspaceFileView,
  WorkspaceScene,
  ViewState,
} from "./view/types";
export { isClusterView, isSuperclusterView } from "./view/types";

// LOD manager + declarative tier config
export { LodManager, lodFromScale } from "./lod/lod-manager";
export {
  LOD_TIERS,
  getTierConfig,
  resolveEffectiveTier,
  resolveLayerPolicy,
} from "./lod/lod-config";
export type { SceneDataAvailability } from "./lod/lod-config";

// Grid layout
export { gridLayout } from "./layout/grid-layout";

// Treemap layout (directory-based)
export { treemapLayout } from "./layout/treemap-layout";
export type { TreemapResult, ClusterInfo } from "./layout/treemap-layout";

// Orthogonal edge routing (data-only; renderer integration deferred)
export { orthogonalRoute, buildOrthogonalRoutes } from "./layout/orthogonal-routing";

// Cluster-level edge bundling (data-only; renderer integration deferred)
export { buildBundledEdges, buildFileToClusterMap } from "./layout/edge-bundling";

// Cluster-edge aggregation — directional super-edges bucketed by (from, to, kind).
export type {
  ClusterEdge,
  ClusterEdgeAggregateInput,
} from "./layout/cluster-edge-aggregate";
export {
  aggregateClusterEdges,
  routeClusterEdges,
} from "./layout/cluster-edge-aggregate";

// Edge geometry cache
export type { BezierGeometry } from "./render/edge-geometry-cache";
export { EdgeGeometryCache } from "./render/edge-geometry-cache";

// Workspace view builder
export type { BuildViewInput } from "./view/build-view";
export { buildWorkspaceView, buildWorkspaceScene } from "./view/build-view";

// Spatial indexes
export { FileIndex } from "./spatial/file-index";
export { EdgeFilter } from "./spatial/edge-filter";
export type { EdgePickIndex } from "./spatial/edge-pick-index";
export { createEdgePickIndex } from "./spatial/edge-pick-index";

// Lower-level query helpers
export {
  buildVisibleQuery,
  buildClusterQuery,
  buildSuperclusterQuery,
  buildSceneQuery,
} from "./spatial/visible-query";
