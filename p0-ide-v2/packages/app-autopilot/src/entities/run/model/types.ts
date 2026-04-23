export type RunMode = "interactive" | "guided" | "autonomous" | "continuous";

export type RunStatus =
  | "created"
  | "running"
  | "awaiting_review"
  | "completed"
  | "abandoned"
  | "failed";

export type RunStepKind =
  | "plan"
  | "patch"
  | "validation"
  | "metric"
  | "review"
  | "abort";

export type RunStepStatus = "pending" | "in-progress" | "passed" | "failed" | "skipped";

export interface RunStep {
  id: string;
  at: string;
  kind: RunStepKind;
  title: string;
  detail?: string;
  status: RunStepStatus;
  /** Tokens consumed in this step (for display). */
  tokens?: number;
  /** If this step emitted a metric delta. */
  metricDelta?: { metric: string; before: number; after: number };
}

export interface AbandonSignal {
  reason: string;
  blockingSignals: string[];
  partialEvidence?: string[];
  occurredAt: string;
}

export interface ExecutionRun {
  id: string;
  workItemId: string;
  goalId?: string;
  operatorId: string;
  branchName?: string;
  prNumber?: number;
  mode: RunMode;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  proofArtifactId?: string;
  steps: RunStep[];
  abandon?: AbandonSignal;
}
