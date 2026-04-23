import type { ViewMode } from "./store";
import type { ViewDescriptorNeeds, ViewCtx } from "./view-descriptor";

export const INSIGHT_DOMAINS = [
  "explore",
  "productivity",
  "ai-agent",
  "ai-context-model",
  "ai-trust-governance",
  "se-architecture",
  "se-quality",
  "se-testing",
  "se-refactor-change",
  "se-security-supply-chain",
  "se-evolution",
  "se-ownership-team",
] as const;
export type InsightDomain = typeof INSIGHT_DOMAINS[number];

export const INSIGHT_SCOPES = [
  "org",
  "team",
  "workspace",
  "repo",
  "project",
  "package",
  "folder",
  "module",
  "file",
  "symbol",
  "diff",
  "task",
  "agent-run",
  "model",
  "budget",
  "policy",
] as const;
export type InsightScope = typeof INSIGHT_SCOPES[number];

export const INSIGHT_INTENTS = [
  "explore",
  "explain",
  "diagnose",
  "decide",
  "verify",
  "optimize",
  "govern",
] as const;
export type InsightIntent = typeof INSIGHT_INTENTS[number];

export interface PrimaryFacet {
  domain: InsightDomain;
  scope: InsightScope;
  intent: InsightIntent;
}

export type InsightPersona =
  | "developer"
  | "reviewer"
  | "tech-lead"
  | "security"
  | "manager"
  | "platform"
  | "ai-operator";

export type InsightSurface =
  | "view"
  | "tab"
  | "hover"
  | "gutter"
  | "diff-inline"
  | "dashboard-card"
  | "command";

export type InsightMaturity = "core" | "advanced" | "experimental" | "deprecated";

export type InsightCapabilityKind =
  | "view"
  | "decision-input"
  | "workflow-step"
  | "gate-check"
  | "policy-control"
  | "external";

export type InsightDecisionGrade =
  | "informational"
  | "triage"
  | "advisory"
  | "gating"
  | "blocking";

export type DecisionTarget =
  | "merge"
  | "delegate"
  | "refactor"
  | "route-model"
  | "approve-agent-run"
  | "escalate-review"
  | "policy-audit";

export type EvidenceClass = "none" | "weak" | "strong" | "auditable";

export type InsightActionHook =
  | "open-view"
  | "open-tab"
  | "run-analysis"
  | "attach-to-pr-review"
  | "attach-to-agent-plan"
  | "attach-to-task-routing"
  | "attach-to-admission-gate"
  | "attach-to-policy-check"
  | "pin-dashboard"
  | "compare-related";

export interface InsightSignalProfile {
  dataFreshness: "live" | "snapshot" | "synthetic";
  confidence: "measured" | "estimated" | "heuristic";
  actionability: "direct-action" | "triage" | "explain";
  cost: "low" | "medium" | "high";
  latency: "instant" | "interactive" | "batch";
  determinism: "deterministic" | "bounded" | "heuristic";
  evidenceLevel: EvidenceClass;
  /** Optional mirror for descriptor authors; canonical value lives in decision.grade. */
  decisionGrade?: InsightDecisionGrade;
}

export interface InsightDecisionBinding {
  grade: InsightDecisionGrade;
  supports: readonly DecisionTarget[];
  evidenceClass?: EvidenceClass;
  failClosedEligible?: boolean;
  humanReviewRequired?: boolean;
}

export interface InsightWorkflowBinding {
  usableInStacks?: readonly WorkflowStackId[];
  canBeAutoSuggested?: boolean;
  canBeAutoAttached?: boolean;
  requiresOrderedExecution?: boolean;
}

export interface InsightQualityBinding {
  maturity: InsightMaturity;
  owner?: string;
  docs?: string;
  lastReviewed?: string;
  deprecatedBy?: ViewMode;
}

export interface ViewTaxonomy {
  primary: PrimaryFacet;
  domains?: readonly InsightDomain[];
  scopes: readonly InsightScope[];
  intents: readonly InsightIntent[];
  subdomain?: string;
  personas: readonly InsightPersona[];
  surfaces: readonly InsightSurface[];
  maturity: InsightMaturity;
  signal: InsightSignalProfile;
  related?: readonly ViewMode[];
  replaces?: readonly ViewMode[];
  keywords?: readonly string[];
}

export type WorkflowStackId =
  | "ai-review-stack"
  | "agent-delegation-stack"
  | "context-engineering-stack"
  | "agent-failure-stack";

export interface InsightWorkflowStep {
  insightId: ViewMode;
  role: "screening" | "risk-check" | "verification" | "decision-support" | "policy-check";
  required: boolean;
  blockingOnFail?: boolean;
}

export interface InsightWorkflowStack {
  id: WorkflowStackId;
  title: string;
  goal: string;
  targetDecision?: DecisionTarget;
  primaryScopes: readonly InsightScope[];
  steps: readonly InsightWorkflowStep[];
}

export interface AdmissionVerdictInput {
  insightId: ViewMode;
  score?: number;
  confidence?: number;
  decisionGrade: InsightDecisionGrade;
  status: "pass" | "warn" | "fail" | "unknown";
  rationale?: string;
  evidenceRef?: string;
}

export interface AdmissionVerdict {
  target: "diff" | "pr" | "task";
  status: "allow" | "hold" | "reject";
  inputs: readonly AdmissionVerdictInput[];
  blockingReasons: readonly string[];
  requiredHumanChecks: readonly string[];
  evidenceBundleRef?: string;
}

export interface AnalysisLaunchBinding {
  mode?: ViewMode;
  commandId?: string;
  tabTitle?: string;
  defaultSurface: InsightSurface;
}

export interface AnalysisAvailabilityBinding {
  contexts: readonly ViewCtx[];
  needs?: ViewDescriptorNeeds;
  requiresSelection: boolean;
}

export interface AnalysisCatalogRecord {
  id: ViewMode;
  kind: "view" | "workflow" | "external";
  capabilityKinds: readonly InsightCapabilityKind[];
  title: string;
  shortLabel: string;
  glyph: string;
  summary: string;
  tech: string;
  usecase: string;
  taxonomy: ViewTaxonomy;
  launch: AnalysisLaunchBinding;
  availability: AnalysisAvailabilityBinding;
  decision: InsightDecisionBinding;
  actions: readonly InsightActionHook[];
  workflow: InsightWorkflowBinding;
  quality: InsightQualityBinding;
  hygieneDebt: boolean;
}
