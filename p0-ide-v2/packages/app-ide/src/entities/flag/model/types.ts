export interface FeatureFlag {
  id: string;
  label: string;
  owner: string;
  default: boolean;
  stage: "dev" | "canary" | "prod" | "deprecated";
  ageDays: number;
}

export interface FlagComboCell {
  combo: Record<string, boolean>;
  reachable: boolean;
  covered: "covered" | "partial" | "uncovered";
  riskScore: number;
  activeLines: number[];
  note?: string;
}

export interface FlagMap {
  flags: FeatureFlag[];
  cells: FlagComboCell[];
}
