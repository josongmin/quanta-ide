export type OpportunityKind =
  | "layer_violation"
  | "import_boundary"
  | "dead_code"
  | "flaky_test"
  | "deprecated_api"
  | "missing_test"
  | "mechanical_migration"
  | "dependency_cycle"
  | "god_class";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  summary: string;
  paths: string[];
  /** 0–100. Higher = more impactful. */
  score: number;
  /** Metrics the planner expects this opportunity to move. */
  contributingMetrics: string[];
  /** Recommended operator. */
  suggestedOperator: string;
  createdAt: string;
  ageDays: number;
}
