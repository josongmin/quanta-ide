import type { GoalScope } from "@quanta/app-autopilot/entities/goal";
import type { OperationKind, RiskTier } from "@quanta/app-autopilot/entities/policy";
import type { OperatorId } from "@quanta/app-autopilot/entities/operator";

export type TaskClass =
  | "deterministic_production"
  | "bounded_structural_refactor"
  | "design_sensitive_refactor"
  | "review_governance";

export type WorkItemSource =
  | { kind: "goal_reconciliation"; goalId: string }
  | { kind: "opportunity_engine"; opportunityId: string }
  | { kind: "human_guided_plan"; planId: string };

export type WorkItemStatus =
  | "queued"
  | "planned"
  | "running"
  | "blocked"
  | "awaiting_review"
  | "completed"
  | "abandoned";

export interface WorkConstraints {
  doNotTouchPaths?: string[];
  preservePublicApi?: boolean;
  preserveRuntimeSemantics?: boolean;
  maxFiles?: number;
  maxChangedLines?: number;
  requiredTests?: string[];
}

export type ProofRequirement =
  | "typecheck"
  | "lint"
  | "tests"
  | "metric_delta"
  | "api_diff"
  | "rule_diff"
  | "uncertainty_summary";

export interface ExpectedMetricDelta {
  metric: string;
  before?: number;
  after?: number;
  delta?: number;
}

export interface ExpectedOutcome {
  expectedMetricDeltas?: ExpectedMetricDelta[];
  expectedFilesTouched?: number;
  expectedPrCount?: number;
}

export interface WorkItem {
  id: string;
  source: WorkItemSource;
  title: string;
  description: string;
  scope: GoalScope;
  operatorId: OperatorId;
  taskClass: TaskClass;
  riskTier: RiskTier;
  relatedGoals: string[];
  relatedOpportunities: string[];
  selectedActions: OperationKind[];
  constraints: WorkConstraints;
  proofRequirements: ProofRequirement[];
  expectedOutcome: ExpectedOutcome;
  status: WorkItemStatus;
  createdAt: string;
  updatedAt: string;
}
