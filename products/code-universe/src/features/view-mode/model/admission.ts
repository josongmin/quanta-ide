import type {
  AdmissionVerdict,
  AdmissionVerdictInput,
  AnalysisCatalogRecord,
  DecisionTarget,
  EvidenceClass,
  InsightDecisionGrade,
  InsightScope,
} from "./taxonomy";

export interface AgentPlanningInsightQuery {
  targetDecision?: Extract<DecisionTarget, "delegate" | "route-model" | "approve-agent-run" | "escalate-review">;
  scope?: InsightScope;
  max?: number;
}

const GRADE_WEIGHT: Record<InsightDecisionGrade, number> = {
  blocking: 500,
  gating: 420,
  advisory: 280,
  triage: 180,
  informational: 0,
};

const EVIDENCE_WEIGHT: Record<EvidenceClass, number> = {
  auditable: 240,
  strong: 180,
  weak: 60,
  none: -120,
};

function evidenceOf(record: AnalysisCatalogRecord): EvidenceClass {
  return record.decision.evidenceClass ?? record.taxonomy.signal.evidenceLevel;
}

function isStrongEnoughForBlocking(record: AnalysisCatalogRecord): boolean {
  const evidence = evidenceOf(record);
  return evidence === "strong" || evidence === "auditable";
}

function maturityWeight(record: AnalysisCatalogRecord): number {
  switch (record.quality.maturity) {
    case "core": return 120;
    case "advanced": return 80;
    case "experimental": return 20;
    case "deprecated": return -200;
  }
}

function actionabilityWeight(record: AnalysisCatalogRecord): number {
  switch (record.taxonomy.signal.actionability) {
    case "direct-action": return 80;
    case "triage": return 40;
    case "explain": return 10;
  }
}

function rankRecord(record: AnalysisCatalogRecord): number {
  return (
    GRADE_WEIGHT[record.decision.grade] +
    EVIDENCE_WEIGHT[evidenceOf(record)] +
    maturityWeight(record) +
    actionabilityWeight(record) +
    (record.workflow.canBeAutoSuggested ? 30 : 0) +
    (record.workflow.canBeAutoAttached ? 20 : 0) -
    (record.hygieneDebt ? 1000 : 0)
  );
}

export function selectGateEligibleInsights(
  records: readonly AnalysisCatalogRecord[],
  targetDecision: DecisionTarget,
): AnalysisCatalogRecord[] {
  return records
    .filter((record) => {
      if (record.hygieneDebt) return false;
      if (!record.decision.supports.includes(targetDecision)) return false;
      if (record.decision.grade === "informational" || record.decision.grade === "triage") return false;
      if (!record.capabilityKinds.includes("gate-check") && record.decision.grade !== "gating" && record.decision.grade !== "blocking") return false;
      if (record.decision.grade === "blocking" && !isStrongEnoughForBlocking(record)) return false;
      return evidenceOf(record) === "strong" || evidenceOf(record) === "auditable";
    })
    .sort((a, b) => rankRecord(b) - rankRecord(a) || a.id.localeCompare(b.id));
}

export function buildAdmissionVerdict(
  target: AdmissionVerdict["target"],
  records: readonly AnalysisCatalogRecord[],
  inputs: readonly AdmissionVerdictInput[] = [],
): AdmissionVerdict {
  const decisionTarget: DecisionTarget = target === "task" ? "delegate" : "merge";
  const eligible = selectGateEligibleInsights(records, decisionTarget);
  const materialInputs = inputs.length > 0
    ? inputs
    : eligible.map((record): AdmissionVerdictInput => ({
      insightId: record.id,
      decisionGrade: record.decision.grade,
      status: "unknown",
      rationale: `${record.title} has not produced a runtime verdict yet.`,
    }));

  const blockingReasons = materialInputs
    .filter((input) => input.status === "fail" && (input.decisionGrade === "blocking" || input.decisionGrade === "gating"))
    .map((input) => input.rationale ?? `${input.insightId} failed`);
  const requiredHumanChecks = materialInputs
    .filter((input) => input.status === "warn" || input.status === "unknown")
    .map((input) => input.rationale ?? `${input.insightId} needs review`);

  const status: AdmissionVerdict["status"] = blockingReasons.length > 0
    ? "reject"
    : requiredHumanChecks.length > 0
      ? "hold"
      : "allow";

  return {
    target,
    status,
    inputs: materialInputs,
    blockingReasons,
    requiredHumanChecks,
    evidenceBundleRef: eligible.length > 0 ? `catalog://${target}/${eligible.map((record) => record.id).join("+")}` : undefined,
  };
}

export function selectAgentPlanningInsights(
  records: readonly AnalysisCatalogRecord[],
  query: AgentPlanningInsightQuery = {},
): AnalysisCatalogRecord[] {
  const targets: readonly DecisionTarget[] = query.targetDecision
    ? [query.targetDecision]
    : ["delegate", "route-model", "approve-agent-run", "escalate-review"];
  const max = query.max ?? 8;
  return records
    .filter((record) => {
      if (record.hygieneDebt) return false;
      if (!record.workflow.canBeAutoSuggested && !record.workflow.canBeAutoAttached) return false;
      if (!targets.some((target) => record.decision.supports.includes(target))) return false;
      if (query.scope && !record.taxonomy.scopes.includes(query.scope) && record.taxonomy.primary.scope !== query.scope) return false;
      return record.decision.grade !== "informational";
    })
    .sort((a, b) => rankRecord(b) - rankRecord(a) || a.id.localeCompare(b.id))
    .slice(0, max);
}
