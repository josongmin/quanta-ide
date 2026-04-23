import type { ViewCategory } from "./view-descriptor";
import { listViewDescriptors } from "./view-registry";
import type { ViewMode } from "./store";
import type {
  AnalysisCatalogRecord,
  DecisionTarget,
  EvidenceClass,
  InsightActionHook,
  InsightCapabilityKind,
  InsightDecisionBinding,
  InsightDecisionGrade,
  InsightDomain,
  InsightIntent,
  InsightMaturity,
  InsightScope,
  InsightSignalProfile,
  InsightSurface,
  PrimaryFacet,
  ViewTaxonomy,
} from "./taxonomy";

const CATEGORY_DOMAIN: Record<ViewCategory, InsightDomain> = {
  explore: "explore",
  deps: "se-architecture",
  history: "se-evolution",
  plan: "se-refactor-change",
  arch: "se-architecture",
  metrics: "productivity",
  refactor: "se-refactor-change",
  quality: "se-quality",
  security: "se-security-supply-chain",
  team: "se-ownership-team",
  ai: "ai-agent",
};

function inferPrimaryScope(contexts: readonly string[]): InsightScope {
  if (contexts.includes("file")) return "file";
  if (contexts.includes("folder")) return "folder";
  return "repo";
}

function inferIntent(category: ViewCategory): InsightIntent {
  switch (category) {
    case "explore": return "explore";
    case "metrics": return "optimize";
    case "quality":
    case "security": return "verify";
    case "team": return "govern";
    case "arch":
    case "deps":
    case "history": return "diagnose";
    case "plan":
    case "refactor": return "decide";
    case "ai": return "diagnose";
  }
}

function fallbackSignal(): InsightSignalProfile {
  return {
    dataFreshness: "synthetic",
    confidence: "heuristic",
    actionability: "explain",
    cost: "low",
    latency: "instant",
    determinism: "heuristic",
    evidenceLevel: "none",
  };
}

function fallbackActions(): readonly InsightActionHook[] {
  return ["open-view", "open-tab"];
}

function fallbackCapabilityKinds(): readonly InsightCapabilityKind[] {
  return ["view"];
}

function fallbackTaxonomy(d: ReturnType<typeof listViewDescriptors>[number]): ViewTaxonomy {
  const primary: PrimaryFacet = {
    domain: CATEGORY_DOMAIN[d.category],
    scope: inferPrimaryScope(d.contexts),
    intent: inferIntent(d.category),
  };
  return {
    primary,
    domains: [primary.domain],
    scopes: [primary.scope],
    intents: [primary.intent],
    personas: ["developer"],
    surfaces: ["view", "tab"],
    maturity: "experimental",
    signal: fallbackSignal(),
    keywords: [d.id, d.label, d.category],
  };
}

function normalizeTaxonomy(d: ReturnType<typeof listViewDescriptors>[number]): ViewTaxonomy {
  const taxonomy = d.taxonomy ?? fallbackTaxonomy(d);
  const domainSet = new Set<InsightDomain>([taxonomy.primary.domain, ...(taxonomy.domains ?? [])]);
  const scopeSet = new Set<InsightScope>([taxonomy.primary.scope, ...taxonomy.scopes]);
  const intentSet = new Set<InsightIntent>([taxonomy.primary.intent, ...taxonomy.intents]);
  return {
    ...taxonomy,
    domains: [...domainSet],
    scopes: [...scopeSet],
    intents: [...intentSet],
  };
}

function normalizeDecision(d: ReturnType<typeof listViewDescriptors>[number], taxonomy: ViewTaxonomy): InsightDecisionBinding {
  return d.decision ?? {
    grade: "informational" satisfies InsightDecisionGrade,
    supports: [] satisfies readonly DecisionTarget[],
    evidenceClass: taxonomy.signal.evidenceLevel satisfies EvidenceClass,
    failClosedEligible: false,
    humanReviewRequired: taxonomy.signal.evidenceLevel !== "auditable",
  };
}

function normalizeQuality(d: ReturnType<typeof listViewDescriptors>[number], taxonomy: ViewTaxonomy): { maturity: InsightMaturity; deprecatedBy?: ViewMode } {
  return d.quality ?? {
    maturity: taxonomy.maturity,
  };
}

function defaultSurface(taxonomy: ViewTaxonomy): InsightSurface {
  if (taxonomy.surfaces.includes("tab")) return "tab";
  return taxonomy.surfaces[0] ?? "view";
}

function titleFromDescriptor(d: ReturnType<typeof listViewDescriptors>[number]): string {
  return d.label.length > 5 ? d.label : d.id.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export function descriptorToAnalysisRecord(d: ReturnType<typeof listViewDescriptors>[number]): AnalysisCatalogRecord {
  const taxonomy = normalizeTaxonomy(d);
  const decision = normalizeDecision(d, taxonomy);
  const actions = d.actions ?? fallbackActions();
  const capabilityKinds = d.capabilityKinds ?? fallbackCapabilityKinds();
  const quality = normalizeQuality(d, taxonomy);
  return {
    id: d.id,
    kind: "view",
    capabilityKinds,
    title: titleFromDescriptor(d),
    shortLabel: d.label,
    glyph: d.glyph,
    summary: d.hint,
    tech: d.tech,
    usecase: d.usecase,
    taxonomy,
    launch: {
      mode: d.id,
      commandId: `universe.${d.id}`,
      tabTitle: `${taxonomy.primary.domain.replace(/^ai-/, "AI ").replace(/^se-/, "SE ")} · ${d.label}`,
      defaultSurface: defaultSurface(taxonomy),
    },
    availability: {
      contexts: d.contexts,
      needs: d.needs,
      requiresSelection: Boolean(d.needs?.selection),
    },
    decision,
    actions,
    workflow: d.workflow ?? { canBeAutoSuggested: decision.supports.length > 0 },
    quality,
    hygieneDebt: !d.taxonomy,
  };
}

export function listAnalysisCatalogRecords(): AnalysisCatalogRecord[] {
  return listViewDescriptors().map(descriptorToAnalysisRecord);
}

export function getAnalysisCatalogRecord(id: ViewMode): AnalysisCatalogRecord | undefined {
  return listAnalysisCatalogRecords().find((record) => record.id === id);
}

export function listLaunchableAnalysisRecords(): AnalysisCatalogRecord[] {
  return listAnalysisCatalogRecords().filter((record) => record.actions.includes("open-tab") || record.actions.includes("open-view"));
}

export interface AnalysisCatalogQuery {
  domain?: InsightDomain;
  scope?: InsightScope;
  intent?: InsightIntent;
  targetDecision?: DecisionTarget;
  capabilityKind?: InsightCapabilityKind;
  includeHygieneDebt?: boolean;
}

export function queryAnalysisCatalog(query: AnalysisCatalogQuery): AnalysisCatalogRecord[] {
  return listAnalysisCatalogRecords().filter((record) => {
    if (!query.includeHygieneDebt && record.hygieneDebt) return false;
    if (query.domain && !record.taxonomy.domains?.includes(query.domain)) return false;
    if (query.scope && !record.taxonomy.scopes.includes(query.scope)) return false;
    if (query.intent && !record.taxonomy.intents.includes(query.intent)) return false;
    if (query.targetDecision && !record.decision.supports.includes(query.targetDecision)) return false;
    if (query.capabilityKind && !record.capabilityKinds.includes(query.capabilityKind)) return false;
    return true;
  });
}
