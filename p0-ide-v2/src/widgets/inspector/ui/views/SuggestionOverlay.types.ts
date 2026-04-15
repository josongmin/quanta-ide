export type VerifyState = "pass" | "warn" | "info";
export interface VerifyItem {
  state: VerifyState;
  label: string;
  engine: string;
  value?: string;
}

export type CounterfactualState = "danger" | "warn";
export interface CounterfactualItem {
  state: CounterfactualState;
  label: string;
  engine: string;
  detail?: string;
}
export interface CounterfactualData {
  riskWithout: number;
  costDays: number;
  items: CounterfactualItem[];
}

export interface ProofReplayCheck {
  label: string;
  pass: boolean;
  engine: string;
  sample?: string;
}
export interface ProofReplayData {
  status: "pending" | "verified" | "failed";
  verifiedAt?: string;
  checks: ProofReplayCheck[];
}

export type PatchAction = "applied" | "dismissed" | "rolled-back";
export interface PatchTrailEntry {
  id: string;
  when: string;
  action: PatchAction;
  title: string;
  riskBefore: number;
  riskAfter: number;
  author?: string;
  reason?: string;
}

export interface SuggestionData {
  title: string;
  rationale: string;
  diff: string;
  riskBefore: number;
  riskAfter: number;
  verification: VerifyItem[];
  confidence: number;
  counterfactual: CounterfactualData;
  proofReplay: ProofReplayData;
  patchTrail: PatchTrailEntry[];
}
