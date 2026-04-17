// ── Policy domain types ─────────────────────────────────────────
// Shared contracts for Policy Studio (IA Section D + E unified).
// Security rules + Engineering policy in one catalog.

/** Unified categories: Security (IA-E) + Engineering (IA-D) */
export type PolicyCategory =
  | "security"
  | "architecture"
  | "reliability"
  | "data-privacy"
  | "team-rules";

export type PolicySeverity = "critical" | "high" | "medium" | "low";

export type PolicyRuleStatus = "active" | "inactive" | "draft";

export type PolicyRuleSource = "natural-language" | "template" | "dsl";

export type FlowConstraint = "allow" | "deny";

/** Rule ID prefix — first segment of the display ID (e.g. SEC-021) */
export type RuleIdPrefix = "SEC" | "ARC" | "REL" | "DAT" | "TEAM";

/** Engine that backs the rule */
export type EngineType = "codeql" | "taint-engine" | "semgrep" | "custom" | "hybrid";

/** Template IDs for rule builder (IA D-2) */
export type PolicyTemplateId =
  | "forbidden-dependency"
  | "allowed-only-path"
  | "must-go-through-abstraction"
  | "no-direct-call"
  | "only-team-can-modify"
  | "retry-required"
  | "no-write-without-idempotency"
  | "no-logging-sensitive"
  | "source-to-sink-forbidden"
  | "requires-sanitizer"
  | "requires-auth-guard"
  | "no-secret-in-source";

/** Violation triage status */
export type ViolationStatus =
  | "open"
  | "accepted-risk"
  | "exception-requested"
  | "fixed"
  | "waived";

/** Sidebar navigation items */
export type SidebarItem =
  | "overview"
  | "rule-catalog"
  | "rule-sets"
  | "authoring"
  | "validation"
  | "engines"
  | "pr-enforcement"
  | "alerts-triage"
  | "exceptions"
  | "governance";

// ── Compound types ──────────────────────────────────────────────

export interface PolicyScope {
  repos?: string[];
  services?: string[];
  paths?: string[];
  teams?: string[];
}

/** CodeQL-style query match — a code location matched by this rule */
export interface QueryMatch {
  id: string;
  file: string;
  line: number;
  col?: number;
  symbol?: string;
  snippet?: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  isNew?: boolean;
}

/** PR enforcement config */
export interface PrEnforcement {
  action: "block" | "warn" | "comment";
  branches: string[];
  approvalRequired?: boolean;
  canaryPercent?: number;
}

export interface PolicyRule {
  id: string;
  ruleIdPrefix: RuleIdPrefix;
  ruleNumber: number;
  name: string;
  description: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  status: PolicyRuleStatus;
  source: PolicyRuleSource;
  templateId?: PolicyTemplateId;

  sourceScope: PolicyScope;
  targetScope: PolicyScope;
  constraint: FlowConstraint;
  owner: string;
  prGateEnabled: boolean;

  engine: EngineType;
  tags: string[];
  method?: string;
  queryMatches: QueryMatch[];
  prEnforcement?: PrEnforcement;
  relatedPRs?: string[];

  violationCount: number;
  lastTriggeredAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PolicyViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: PolicySeverity;
  status: ViolationStatus;

  file: string;
  line?: number;
  symbol?: string;
  repo: string;
  service?: string;

  message: string;
  snippet?: string;
  suggestedFix?: string;
  detectedAt: number;
  assignee?: string;
  linkedPR?: string;
}

// ── Label constants ─────────────────────────────────────────────

export const CATEGORY_LABEL: Record<PolicyCategory, string> = {
  security: "Security",
  architecture: "Architecture",
  reliability: "Reliability",
  "data-privacy": "Data / Privacy",
  "team-rules": "Team Rules",
};

export const CATEGORY_DESC: Record<PolicyCategory, string> = {
  security: "보안 흐름, source-sink, 인증/인가, 비밀 관리",
  architecture: "레이어링, 의존성, 경계, 추상화 강제",
  reliability: "재시도, 멱등성, 성능 가드레일",
  "data-privacy": "PII 보호, 로깅 제한, 암호화 요구",
  "team-rules": "팀별 소유권, 변경 프로세스, 커스텀 규칙",
};

export const SEVERITY_LABEL: Record<PolicySeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const VIOLATION_STATUS_LABEL: Record<ViolationStatus, string> = {
  open: "Open",
  "accepted-risk": "Accepted risk",
  "exception-requested": "Exception requested",
  fixed: "Fixed",
  waived: "Waived",
};

export const TEMPLATE_LABEL: Record<PolicyTemplateId, string> = {
  "forbidden-dependency": "Forbidden dependency",
  "allowed-only-path": "Allowed-only path",
  "must-go-through-abstraction": "Must go through abstraction",
  "no-direct-call": "No direct call to X from Y",
  "only-team-can-modify": "Only team A can modify Z",
  "retry-required": "Retry required before external call",
  "no-write-without-idempotency": "No write without idempotency",
  "no-logging-sensitive": "No logging of sensitive payload",
  "source-to-sink-forbidden": "Source to sink forbidden",
  "requires-sanitizer": "Requires sanitizer on path",
  "requires-auth-guard": "Requires auth guard",
  "no-secret-in-source": "No secret in source code",
};

export const ENGINE_LABEL: Record<EngineType, string> = {
  codeql: "CodeQL-backed",
  "taint-engine": "Taint Engine",
  semgrep: "Semgrep",
  custom: "Custom Rule",
  hybrid: "Hybrid Rule",
};

export const PREFIX_FOR_CATEGORY: Record<PolicyCategory, RuleIdPrefix> = {
  security: "SEC",
  architecture: "ARC",
  reliability: "REL",
  "data-privacy": "DAT",
  "team-rules": "TEAM",
};

/** Format display ID: "SEC-021" */
export function formatRuleId(prefix: RuleIdPrefix, num: number): string {
  return `${prefix}-${String(num).padStart(3, "0")}`;
}
