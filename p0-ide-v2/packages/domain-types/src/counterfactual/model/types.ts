export type HorizonDays = 7 | 14 | 30 | 90;
export type MetricId = "risk" | "blast" | "cpx" | "coverage" | "incident";
export type ScenarioId = "apply" | "dismiss";

export interface TrajectoryPoint {
  day: number;
  median: number;
  low: number;
  high: number;
}

export interface Trajectory {
  metric: MetricId;
  scenario: ScenarioId;
  points: TrajectoryPoint[];
  model: string;
}

export interface PredictedIncident {
  id: string;
  shapeMatchId: string;
  similarity: number;
  likelyWithinDays: number;
  reason: string;
  engineSource: string;
}

export interface CostEstimate {
  scenario: ScenarioId;
  low: number;
  median: number;
  high: number;
}

export interface CascadeNode {
  symbol: string;
  layer: string;
  weight: number;
  critical: boolean;
  reason: string;
}

export interface HistoricalAnalog {
  id: string;
  when: string;
  where: string;
  similar: string;
  outcome: string;
  costDays: number;
}

export interface ProjectionInput {
  changeSetId: string;
  targetSymbol: string;
  currentRisk: number;
  currentBlast: number;
  currentCpx: number;
  currentCoverage: number;
  horizonDays: HorizonDays;
  metric: MetricId;
}

export interface Projection {
  input: ProjectionInput;
  trajectoriesByMetric: Record<MetricId, { apply: Trajectory; dismiss: Trajectory }>;
  predictedIncidents: PredictedIncident[];
  predictedCascade: CascadeNode[];
  costs: { apply: CostEstimate; dismiss: CostEstimate };
  historicalAnalog?: HistoricalAnalog;
}

export const METRIC_LABEL: Record<MetricId, string> = {
  risk:      "Risk score",
  blast:     "Blast radius",
  cpx:       "Complexity",
  coverage:  "Coverage %",
  incident:  "Incident probability",
};

export const METRIC_UNIT: Record<MetricId, string> = {
  risk:      "/100",
  blast:     "symbols",
  cpx:       "cpx",
  coverage:  "%",
  incident:  "p",
};

export const METRIC_INVERTED: Record<MetricId, boolean> = {
  risk:      false,
  blast:     false,
  cpx:       false,
  coverage:  true,
  incident:  false,
};
