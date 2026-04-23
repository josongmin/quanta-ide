// Metric registry — prerequisite for Goal targets.
// Goal targets reference metrics by id only. The registry owns the
// definition, version, computation cost, and unit.

export type MetricUnit = "count" | "percent" | "ratio" | "ms" | "loc" | "score";

export type MetricDirection = "lower-better" | "higher-better" | "neutral";

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  unit: MetricUnit;
  direction: MetricDirection;
  version: string;
  /** Which analyzer computes this metric. Informational. */
  source: string;
  /** Informational hint for planner/UI: "cheap" | "moderate" | "expensive". */
  computeCost: "cheap" | "moderate" | "expensive";
}

export interface MetricSnapshotEntry {
  metric: string;
  value: number;
  computedAt: string;
}
