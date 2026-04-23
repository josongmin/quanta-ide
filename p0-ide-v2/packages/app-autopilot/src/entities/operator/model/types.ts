import type { OperationKind, RiskTier } from "@quanta/app-autopilot/entities/policy";

export type OperatorId =
  | "rule_repair"
  | "refactor"
  | "test_generation"
  | "dependency_hygiene"
  | "review_prep";

export type OperatorStatus = "ready" | "disabled" | "experimental" | "phase-2";

export interface OperatorSummary {
  id: OperatorId;
  displayName: string;
  tagline: string;
  status: OperatorStatus;
  supportedOperations: OperationKind[];
  supportedRiskTiers: RiskTier[];
  /** Historical acceptance rate (0–1). Used to compute reviewer recommendation. */
  acceptanceRate?: number;
  /** Recent candidate count. */
  recentCandidateCount?: number;
  /** Recent abandon count. */
  recentAbandonCount?: number;
}

export type OperatorCandidateSource =
  | "goal_reconciliation"
  | "opportunity_engine"
  | "human_guided_plan";

export interface OperatorCandidate {
  id: string;
  operatorId: OperatorId;
  source: OperatorCandidateSource;
  title: string;
  description: string;
  scopePaths: string[];
  contributingMetrics: string[];
  estimatedValue: number;
}
