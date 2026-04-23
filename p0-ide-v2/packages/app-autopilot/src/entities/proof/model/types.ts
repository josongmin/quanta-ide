import type { RiskTier } from "@quanta/app-autopilot/entities/policy";

export type ValidationKind =
  | "typecheck"
  | "lint"
  | "tests"
  | "metric_delta"
  | "api_diff"
  | "rule_diff";

export interface ValidationResult {
  kind: ValidationKind;
  status: "pass" | "fail" | "skipped" | "unknown";
  summary: string;
}

export interface MetricDiff {
  metric: string;
  before: number;
  after: number;
  delta: number;
}

export interface ApiDiffSummary {
  changed: boolean;
  details: string[];
}

export interface RuleDiffSummary {
  newViolations: number;
  resolvedViolations: number;
  details: string[];
}

export interface RiskEstimate {
  tier: RiskTier;
  reasons: string[];
  confidence: number;
}

export type ReviewerRecommendationKind = "skip" | "skim" | "review" | "focus";

export interface ReviewerRecommendation {
  kind: ReviewerRecommendationKind;
  rationale: string;
  suggestedReviewerKinds: string[];
}

/**
 * Verifier-backed proof.
 * Per RFC D5 — who re-computed the numbers in this proof.
 * `metric_engine` is preferred; `operator_selfreport` downgrades reviewer recommendation by one tier.
 */
export type ProofComputedBy = "metric_engine" | "operator_selfreport";

export interface ProofArtifact {
  id: string;
  runId: string;
  workItemId: string;
  operatorId: string;
  goalLinks: string[];
  opportunityLinks: string[];
  changedFiles: string[];
  validations: ValidationResult[];
  metricDiffs: MetricDiff[];
  apiDiff?: ApiDiffSummary;
  ruleDiff?: RuleDiffSummary;
  risk: RiskEstimate;
  uncertainties: string[];
  reviewerRecommendation: ReviewerRecommendation;
  createdAt: string;
  // verifier-backed fields ------------------------------------------
  inputSnapshotId: string;
  outputSnapshotId: string;
  metricVersionSet: Record<string, string>;
  computedBy: ProofComputedBy;
  /** `(snapshotId, metricVersionSet, inputs)` hash for reproducibility. */
  reproducibilityHash: string;
}
