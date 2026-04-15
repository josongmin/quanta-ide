export type PatchTier = "mechanical" | "logic-preserved" | "new-behavior" | "risky";

export type PRStatus =
  | "auto-merge-ready"
  | "focus-risky"
  | "full-review"
  | "needs-proof";

export type HunkCheckStatus = "pass" | "fail" | "unknown";

export interface HunkCheck {
  verifier: string;
  status: HunkCheckStatus;
  detail?: string;
}

export interface HunkAttestation {
  id: string;
  file: string;
  hunkHeader: string;
  lineRange: [number, number];
  tier: PatchTier;
  verified: boolean;
  checks: HunkCheck[];
  riskBefore: number;
  riskAfter: number;
  note?: string;
}

export interface PRAgent {
  id: string;
  runtime: string;
  label: string;
}

export interface PRCounterfactual {
  applyEngDays: number;
  dismissEngDays: number;
}

export interface PRComplianceSummary {
  pass: number;
  fail: number;
  unknown: number;
  lies: number;
}

export interface ProofCarryingPR {
  id: string;
  number: number;
  title: string;
  branch: string;
  openedAt: string;
  agent: PRAgent;
  status: PRStatus;
  totalHunks: number;
  verifiedHunks: number;
  riskyHunks: number;
  hunks: HunkAttestation[];
  compliance: PRComplianceSummary;
  counterfactual: PRCounterfactual;
  riskBefore: number;
  riskAfter: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  proofSignature?: string;
}

export const TIER_LABEL: Record<PatchTier, string> = {
  mechanical:      "mechanical",
  "logic-preserved": "logic-preserved",
  "new-behavior":  "new-behavior",
  risky:           "risky",
};

export const TIER_DESC: Record<PatchTier, string> = {
  mechanical:      "rename · formatting · lint fix — behavior-identical",
  "logic-preserved": "structural change with semantic equivalence verified",
  "new-behavior":  "intended behavior change — review required",
  risky:           "verifier flagged uncertain or potentially risky",
};

export const TIER_REVIEW_HINT: Record<PatchTier, string> = {
  mechanical:      "skip",
  "logic-preserved": "skim",
  "new-behavior":  "review",
  risky:           "focus",
};

export const STATUS_LABEL: Record<PRStatus, string> = {
  "auto-merge-ready": "auto-merge ready",
  "focus-risky":      "focus risky",
  "full-review":      "full review",
  "needs-proof":      "needs proof",
};
