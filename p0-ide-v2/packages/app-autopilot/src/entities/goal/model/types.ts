export type GoalMode = "observe" | "suggest" | "enforce";

export type ComparisonOp = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";

export interface GoalScope {
  repo?: boolean;
  paths?: string[];
  packages?: string[];
  teams?: string[];
  services?: string[];
}

export interface GoalTarget {
  metric: string;
  operator: ComparisonOp;
  value: number | string | boolean;
  weight?: number;
  /** Optional qualitative intent — free-form supplement, not parseable.
   * Planner may use as additional context; evaluation is metric-driven. */
  narrativeIntent?: string;
}

export interface GoalGuardrail {
  metric: string;
  operator: ComparisonOp;
  value: number | string | boolean;
  severity: "warn" | "block";
}

export interface GoalOwner {
  kind: "team" | "person";
  id: string;
  displayName: string;
}

export interface ExecutionBudget {
  maxFilesPerPr: number;
  maxPrsPerRun: number;
  maxParallelTasks: number;
}

export interface EngineeringGoal {
  id: string;
  name: string;
  description?: string;
  scope: GoalScope;
  targets: GoalTarget[];
  guardrails: GoalGuardrail[];
  owner?: GoalOwner;
  mode: GoalMode;
  autonomyProfile: string;
  executionBudget: ExecutionBudget;
  baselineSnapshotId: string;
  metricVersionSet: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Per-target evaluation attached to a goal at read-time. */
export interface GoalTargetStatus {
  metric: string;
  current: number;
  target: number;
  operator: ComparisonOp;
  satisfied: boolean;
  /** Delta from baseline (what's been achieved vs. baseline). */
  deltaFromBaseline: number;
  history?: number[];
}

export interface GoalStatus {
  goalId: string;
  overallSatisfied: boolean;
  targets: GoalTargetStatus[];
  lastEvaluatedAt: string;
  activeWorkItemCount: number;
  completedRunsLast7d: number;
  abandonedRunsLast7d: number;
}
