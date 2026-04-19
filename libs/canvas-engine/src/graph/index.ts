// Graph-domain public API. Each group maps 1:1 to a module in this folder.
//
// Categories:
//   - Data model        — core node/edge/graph shapes
//   - Multi-graph       — joining / cross-graph edges
//   - History & diff    — snapshots, replay, materialization
//   - Evidence          — proof bundles, witness chains
//   - Signals           — per-file overlays (blame, effects, latency, traces)
//   - Analysis          — neighborhood, metrics, SCC, pathfinding, start-here
//   - Filtering & rules — edge-filter DSL, arch violations

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
  WorkspaceComment,
} from "./types";
export { deriveEdgeLayer } from "./types";

// ── Multi-graph ─────────────────────────────────────────────────────
export type { NamedGraph, JoinEdge } from "./multi-graph";
export { joinGraphs } from "./multi-graph";

// ── Folder tree (used by HEB bundling) ──────────────────────────────
export type { FolderNode, FolderTree } from "./folder-tree";
export {
  buildFolderTree,
  fillFolderCenters,
  ancestorsFromRoot,
  lcaOf,
} from "./folder-tree";

// ── History & diff ──────────────────────────────────────────────────
export type { GraphSnapshot, GraphHistory } from "./history";
export { materializeEdgeSet, diffSnapshots } from "./history";

export type {
  CommitMeta,
  CommitDelta,
  HistorySource,
  HistorySourceListOpts,
} from "./history-source";
export { emptyDelta } from "./history-source";

// WHY: only the factories escape the package barrel — the concrete
// MockHistorySource / GitHistorySource classes stay internal so we can
// change their shape without breaking any external caller. Options
// interfaces are re-exported because the factories accept them.
export { createMockHistorySource } from "./mock-history-source";
export type { MockHistorySourceOptions } from "./mock-history-source";

export { createGitHistorySource, deltaFromFileChanges } from "./git-history-source";
export type { GitHistorySourceOptions } from "./git-history-source";

// ── Archaeology (temporal analysis) ─────────────────────────────────
export type { DriftFinding, DriftSnapshot } from "./detect-drift";
export { detectDrift } from "./detect-drift";

export type { CycleGenesis } from "./cycle-archaeology";
export { findCycleGenesis } from "./cycle-archaeology";

export type { SmellKind, SmellGenesis, SmellDetectionOpts } from "./smell-genesis";
export { findSmellGenesis } from "./smell-genesis";

export type { SymbolMatch, SymbolSearchOpts } from "./symbol-first-appearance";
export { findSymbolFirstAppearance } from "./symbol-first-appearance";

export type { DebtSnapshot } from "./debt-trajectory";
export { computeDebtTrajectory } from "./debt-trajectory";

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
export { rankStartHere } from "./start-here";

// ── Filtering & rules ───────────────────────────────────────────────
export { compileEdgeFilter, compileEdgeFilterWithContext, parseTimeExpression, isTemporalKey } from "./edge-filter-dsl";
export type { FilterContext } from "./edge-filter-dsl";

export type { Completion } from "./edge-filter-completions";
export { getCompletions } from "./edge-filter-completions";

export { detectArchViolations } from "./arch-violations";

// ── Refactor intelligence (Action Terrain) ──────────────────────────
export type {
  RefactorRoiComponents,
  RefactorRoiWeights,
  RefactorRoiScore,
  RefactorRoiResult,
  ComputeRefactorRoiOptions,
} from "./refactor-roi";
export { computeRefactorROI, DEFAULT_ROI_WEIGHTS } from "./refactor-roi";

export type { ImpactConeRing, ImpactCone } from "./blast-fix-cone";
export { computeBlastCone, computeFixCone } from "./blast-fix-cone";

export type { RefactorPlanKind, RefactorPlan, BuildSuggestionsOptions } from "./refactor-suggestions";
export { buildRefactorSuggestions } from "./refactor-suggestions";

export type { RefactorSimulationResult } from "./refactor-simulation";
export { simulateRefactor } from "./refactor-simulation";
