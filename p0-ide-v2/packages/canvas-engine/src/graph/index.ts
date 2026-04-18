// Graph-domain public API. Each group maps 1:1 to a module in this folder.

export type {
  ArchLayer,
  Rect,
  FunctionBlock,
  FileNode,
  FileEdge,
  EdgeKind,
  EdgeLayer,
  EdgeSeverity,
  WorkspaceGraph,
} from "./types";
export { deriveEdgeLayer } from "./types";

export type { NamedGraph, JoinEdge } from "./multi-graph";
export { joinGraphs } from "./multi-graph";

export type { WitnessRole, WitnessStep, ProofBundle } from "./evidence";

export type { GraphSnapshot, GraphHistory } from "./history";
export { materializeEdgeSet, diffSnapshots } from "./history";

export type { BlameEntry, FileBlame, BlameStripe } from "./blame";
export { stripesFromBlame } from "./blame";

export type { EffectKind, FileEffects } from "./effects";
export { EFFECT_STYLE } from "./effects";

export type { FileLatency } from "./latency";
export { latencyColor } from "./latency";

export type { TraceSpan, TraceEdge, Trace, TracePack } from "./traces";

export { computeNeighborhood } from "./neighborhood";

export type { FileMetrics, WorkspaceMetrics } from "./metrics";
export { computeWorkspaceMetrics } from "./metrics";

export { findStronglyConnectedComponents } from "./scc";

export type { PathQuery, PathResult } from "./pathfinding";
export { findPaths } from "./pathfinding";

export type { StartHereEntry } from "./start-here";

export { elevationFromRisk } from "./elevation";

export { compileEdgeFilter } from "./edge-filter-dsl";

export type { Completion } from "./edge-filter-completions";
export { getCompletions } from "./edge-filter-completions";

export { detectArchViolations } from "./arch-violations";
