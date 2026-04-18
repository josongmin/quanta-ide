// Graph-domain public API. Each group maps 1:1 to a module in this folder.
//
// Categories:
//   - Data model        — core node/edge/graph shapes
//   - Multi-graph       — joining / cross-graph edges
//   - History & diff    — snapshots, replay, materialization
//   - Evidence          — proof bundles, witness chains
//   - Signals           — per-file overlays (blame, effects, latency, traces)
//   - Analysis          — neighborhood, metrics, SCC, pathfinding, start-here
//   - Filtering & rules — edge-filter DSL, arch violations, risk elevation

// ── Data model ──────────────────────────────────────────────────────
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

// ── Multi-graph ─────────────────────────────────────────────────────
export type { NamedGraph, JoinEdge } from "./multi-graph";
export { joinGraphs } from "./multi-graph";

// ── History & diff ──────────────────────────────────────────────────
export type { GraphSnapshot, GraphHistory } from "./history";
export { materializeEdgeSet, diffSnapshots } from "./history";

// ── Evidence ────────────────────────────────────────────────────────
export type { WitnessRole, WitnessStep, ProofBundle } from "./evidence";

// ── Signals ─────────────────────────────────────────────────────────
export type { BlameEntry, FileBlame, BlameStripe } from "./blame";
export { stripesFromBlame } from "./blame";

export type { EffectKind, FileEffects } from "./effects";
export { EFFECT_STYLE } from "./effects";

export type { FileLatency } from "./latency";
export { latencyColor } from "./latency";

export type { TraceSpan, TraceEdge, Trace, TracePack } from "./traces";

// ── Analysis ────────────────────────────────────────────────────────
export { computeNeighborhood } from "./neighborhood";

export type { FileMetrics, WorkspaceMetrics } from "./metrics";
export { computeWorkspaceMetrics } from "./metrics";

export { findStronglyConnectedComponents } from "./scc";

export type { PathQuery, PathResult } from "./pathfinding";
export { findPaths } from "./pathfinding";

export type { StartHereEntry } from "./start-here";

// ── Filtering & rules ───────────────────────────────────────────────
export { elevationFromRisk } from "./elevation";

export { compileEdgeFilter } from "./edge-filter-dsl";

export type { Completion } from "./edge-filter-completions";
export { getCompletions } from "./edge-filter-completions";

export { detectArchViolations } from "./arch-violations";
