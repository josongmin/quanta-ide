import type {
  GraphHistory,
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
} from "@quanta/canvas-engine";
import type { Sticky } from "../store/stickies-store";

// AiService — contract for AI-assisted helpers surfaced in the workspace
// canvas (Batch 6). Everything here is data-in / data-out; no store writes
// and no DOM side-effects. That keeps the mock and any future real LLM
// implementation drop-in compatible — swap the factory in the wiring
// layer and every call site keeps working.
//
// All methods are async so the UI can render a loading state without
// special-casing "instant" answers. The mock implementation below
// deliberately `await`s a small delay so spinners / disabled buttons
// exercise the same code path they will at production swap.

export interface NlToDslContext {
  edgeKinds: string[];
  edgeLayers: string[];
  files: string[];
}

export interface NlToDslResult {
  dsl: string;
  confidence: number;
  explanation: string;
}

export interface StickyCluster {
  label: string;
  stickyIds: string[];
  reasoning: string;
}

export interface ClusterStickiesResult {
  clusters: StickyCluster[];
}

export interface TourStep {
  fileId: string;
  narration: string;
  focusHops: number;
}

export interface GenerateTourResult {
  steps: TourStep[];
}

export type AnomalyKind =
  | "coupling-spike"
  | "cycle-gone-hot"
  | "unreachable"
  | "owner-drift";

export type AnomalySeverity = "low" | "med" | "high";

export interface Anomaly {
  kind: AnomalyKind;
  fileId: string;
  severity: AnomalySeverity;
  explanation: string;
}

export interface DetectAnomaliesResult {
  anomalies: Anomaly[];
}

// ── Temporal / advanced AI (T4) ──────────────────────────────────────
//
// These surfaces reason over the commit history attached to a
// WorkspaceGraph. All three methods are deterministic-by-input for
// the mock implementation — tests pin the contract by feeding small
// hand-rolled histories and asserting specific commit attribution
// or prediction numbers.

export interface RegressionCandidate {
  /** Full commit sha returned by the history source. */
  sha: string;
  /** 0..1 — relative confidence across the candidate set. */
  confidence: number;
  /** Human-readable "why this commit" sentence. */
  reason: string;
}

export interface AttributeRegressionInput {
  /** Free-form test name (e.g. `"AuthService › rejects expired token"`). */
  testName: string;
  /** Raw failure log — used for heuristic keyword matches. */
  failureLog: string;
  graph: WorkspaceGraph;
  history: GraphHistory;
}

export interface AttributeRegressionResult {
  candidateCommits: readonly RegressionCandidate[];
  /** File ids the top-ranked candidates touched — drives the UI highlight. */
  affectedFileIds: readonly string[];
  /** 2-3 sentence narrative that chains the top candidates. */
  narration: string;
}

export interface PredictFutureInput {
  graph: WorkspaceGraph;
  history: GraphHistory;
  /** Forecast horizon, in days. */
  horizonDays: number;
}

export interface PredictFutureResult {
  /** Predicted file-count delta over the horizon (non-negative integer). */
  expectedNewFiles: number;
  /** Predicted edge-count delta over the horizon. */
  expectedNewEdges: number;
  /** File ids likely to form new cycles — sorted descending by strength. */
  expectedNewCycles: readonly string[];
  /** File ids predicted to become hotspots (high-coupling / high-risk). */
  hottestFilesForecast: readonly string[];
  narration: string;
}

export interface NarrateCommitInput {
  sha: string;
  graph: WorkspaceGraph;
  history: GraphHistory;
}

export interface NarrateCommitResult {
  summary: string;
  /** Bullet-list highlights (top-3 changed files, delta counts, ...). */
  highlights: readonly string[];
}

export interface AiService {
  naturalLanguageToDsl(query: string, context: NlToDslContext): Promise<NlToDslResult>;
  clusterStickies(stickies: readonly Sticky[]): Promise<ClusterStickiesResult>;
  generateTour(graph: WorkspaceGraph, layout: WorkspaceLayout): Promise<GenerateTourResult>;
  detectAnomalies(graph: WorkspaceGraph, metrics: WorkspaceMetrics): Promise<DetectAnomaliesResult>;

  // Temporal-aware helpers — all additive, never rename / reorder above.
  attributeRegression(input: AttributeRegressionInput): Promise<AttributeRegressionResult>;
  predictFuture(input: PredictFutureInput): Promise<PredictFutureResult>;
  narrateCommit(input: NarrateCommitInput): Promise<NarrateCommitResult>;
}
