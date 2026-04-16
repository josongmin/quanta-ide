export type VerifierId =
  | "arch.no-import-from"
  | "taint.no-sink-without-sanitizer"
  | "behavior.no-api-break"
  | "type.no-new-errors"
  | "coverage.branch";

export type VerifyStatus = "pass" | "fail" | "unknown";

export type AgentClaim = "tests-pass" | "no-api-break" | "validator-added" | "complexity-reduced" | string;

export interface ChangeSet {
  id: string;
  label: string;
  files: string[];
  author: "human" | "agent";
  agentId?: string;
  agentClaim?: AgentClaim;
  sessionId: string;
}

export interface EvidenceRef {
  kind: "signal" | "sample" | "doc";
  signal?: string;
  detail: string;
}

export interface Violation {
  file: string;
  line?: number;
  message: string;
}

export interface VerifyResult {
  verifierId: VerifierId;
  status: VerifyStatus;
  engineSource: string;
  confidence: number;
  evidence: EvidenceRef[];
  violations?: Violation[];
  reason?: string;
}

export interface RuleBinding {
  ruleId: string;
  ruleLabel: string;
  source: string;
  verifierId: VerifierId;
}

export interface ComplianceEvent {
  id: string;
  ts: number;
  changeSetId: string;
  changeSetLabel: string;
  ruleId?: string;
  ruleLabel?: string;
  verifierId: VerifierId;
  engineSource: string;
  status: VerifyStatus;
  agentClaim?: AgentClaim;
  agentClaimVerified: boolean;
  isLie: boolean;
  violations?: Violation[];
  evidenceTokenId?: string;
}

export interface EvidenceToken {
  id: string;
  changeSetId: string;
  verifierId: VerifierId;
  status: "pass";
  signedAt: number;
  verifierVersion: string;
  revoked?: boolean;
  revokedReason?: string;
}

export interface SessionStats {
  total: number;
  pass: number;
  fail: number;
  unknown: number;
  liesDetected: number;
  tokensIssued: number;
  tokensRevoked: number;
}
