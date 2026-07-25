/**
 * Continuous Evaluation Bench — entity model.
 *
 * The platform's own outputs (taint flow, blast, behavior diff, refactor sim,
 * etc.) are continuously evaluated against a golden task set. Each engine
 * release produces a BenchRun that contains pass/fail per task, latency
 * percentiles, scores per capability dimension, and regression deltas vs the
 * last green run.
 */

export type Capability =
  | "taint"
  | "blast"
  | "behavior"
  | "refactor"
  | "flow"
  | "incident-replay"
  | "test-intel"
  | "race"
  | "intent-gap";

export type TaskOutcome = "pass" | "fail" | "flaky" | "skipped";

export interface GoldenTask {
  id: string;
  capability: Capability;
  /** human-readable description, e.g. "blast radius for orchestrator.dispatch" */
  description: string;
  /** which file the task references */
  fileName: string;
  /** human summary of expectation */
  expectedSummary: string;
}

export interface TaskResult {
  taskId: string;
  outcome: TaskOutcome;
  latencyMs: number;
  /** pass note / fail diff / flaky reason */
  detail: string;
  /** 0..1 — fraction of last-30 runs that passed (only meaningful for flaky/fail) */
  stability30d: number;
}

export interface CapabilityScore {
  capability: Capability;
  passCount: number;
  total: number;
  /** 0..100 — passCount / total * 100 (rounded) */
  scorePct: number;
  p50Ms: number;
  p95Ms: number;
  /** last 10 run scores (each 0..100) */
  trend: number[];
  /** delta in passCount vs the last green run (positive = improved) */
  deltaFromLastGreen: number;
}

export interface BenchRun {
  runId: string;
  /** ISO timestamp */
  startedAt: string;
  durationMs: number;
  tasks: GoldenTask[];
  results: TaskResult[];
  capabilityScores: CapabilityScore[];
  /** task ids that newly fail vs the last green run */
  regressedTaskIds: string[];
  /** task ids marked flaky in this run */
  flakyTaskIds: string[];
  /** 0..100 — overall pass percentage across non-skipped tasks */
  overallScorePct: number;
  /** ISO timestamp of the last fully-green run, if any */
  lastGreenAt?: string;
}
