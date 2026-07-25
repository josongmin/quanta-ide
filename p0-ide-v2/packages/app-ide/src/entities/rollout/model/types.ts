/* ══════════════════════════════════════════════════════════════
   rollout/model/types.ts
   Domain types for the Rollout & Release Planner inspector.

   A rollout is a sequence of canary stages, each ramping a fraction
   of traffic over a region/segment, with gate metrics and a bake
   time. Each stage projects a blast (users/regions/services), and
   the plan as a whole carries a reversibility score plus an
   explicit rollback path.
   ══════════════════════════════════════════════════════════════ */

/** Predicted gate outcome at the moment the stage would bake. */
export type GateStatus = "predicted-pass" | "predicted-warn" | "predicted-fail";

/**
 * A single SLO/error/perf gate guarding a stage.
 * The gate is not evaluated live here — these values are the
 * planner's projection based on offline signals.
 */
export interface RolloutGate {
  id: string;
  /** Human-readable metric expression, e.g. `"error_rate < 0.5%"`. */
  metric: string;
  /** Threshold the gate would pass, as a string for unit-agnostic display. */
  threshold: string;
  /** Predicted measured value at the end of bake. */
  predictedValue: string;
  status: GateStatus;
}

/** One stage of a staged canary rollout. */
export interface RolloutStage {
  id: string;
  /** Zero-based ordering index. */
  index: number;
  /** UI label, e.g. `"Canary 1% – us-east-1a"`. */
  label: string;
  /** Traffic percentage routed to the new code at this stage. */
  trafficPct: number;
  /** Regions/availability zones receiving the stage. */
  regions: string[];
  /** Audience segments, e.g. `["beta_users"]` or `["all"]`. */
  segments: string[];
  /** Bake time in minutes after rollout, before promotion. */
  bakeMinutes: number;
  gates: RolloutGate[];
  /** Projected affected users for this stage. */
  projectedAffectedUsers: number;
  /** Projected requests per minute touching the new code. */
  projectedRequestsPerMin: number;
  /** Optional id of the stage that gates this stage's start. */
  blockedBy?: string;
}

/**
 * Source of (ir)reversibility for a planned change.
 *  - `code-only` → swap binary, no state changes
 *  - `flag-gated` → toggle a feature flag back to off
 *  - `schema-additive` → adds nullable columns / new tables (safe)
 *  - `schema-destructive` → drops/renames columns (irreversible)
 *  - `data-write` → mutates rows under the new code path
 *  - `external-side-effect` → calls third-party APIs, sends emails, etc.
 */
export type ReversibilityKind =
  | "code-only"
  | "flag-gated"
  | "schema-additive"
  | "schema-destructive"
  | "data-write"
  | "external-side-effect";

/**
 * A single weighted contributor to the plan's reversibility score.
 * Final score is a weighted sum of `reversible` flags clamped to 0-100.
 */
export interface ReversibilityFactor {
  id: string;
  kind: ReversibilityKind;
  detail: string;
  reversible: boolean;
  /** Contribution weight in `[0, 1]`. */
  weight: number;
}

/** A discrete step in the rollback plan, executed in reverse stage order. */
export interface RollbackStep {
  id: string;
  /** Imperative description, e.g. `"Disable enable_deep_v2 flag"`. */
  label: string;
  /** Estimated execution time in seconds. */
  estSeconds: number;
  /** Users impacted by performing this rollback step. */
  blast: number;
  /** True if the step requires human action (no automation). */
  manual: boolean;
}

/** Full rollout plan for one candidate change. */
export interface RolloutPlan {
  candidateTitle: string;
  stages: RolloutStage[];
  /** 0-100; higher is safer to undo. */
  reversibilityScore: number;
  reversibilityFactors: ReversibilityFactor[];
  rollbackSteps: RollbackStep[];
  /** Sum of bake minutes across all stages. */
  estimatedTotalMinutes: number;
  /** Worst stage's projected affected users. */
  worstCaseBlast: number;
}
