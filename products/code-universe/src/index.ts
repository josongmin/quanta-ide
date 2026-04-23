// Public API of @quanta/code-universe.
//
// Only the `app` layer's default export + the explicit graph-source
// setter are published. Everything else — widgets, features, entities,
// internal shared — stays private. Consumers cannot reach past this
// file; the FSD layer rules enforced by ESLint `boundaries` + Semgrep
// guarantee the package does not leak its internals.
export { CodeUniverse, type CodeUniverseProps } from "./app/CodeUniverse";
export { CodeCityTabApp, type CodeCityTabAppProps } from "./app/CodeCityTabApp";
export { primeUniverseLaunch, type UniverseLaunchIntent } from "./app/universe-launch";
export { DashboardView, type DashboardViewProps } from "./features/dashboard";
export {
  setWorkspaceGraph,
  getWorkspaceGraph,
  useWorkspaceGraph,
  subscribeWorkspaceGraph,
} from "./shared/api/graph-source";
export { setRepoRoot, getRepoRoot } from "./shared/api/repo-root";
export {
  setSelectedSymbol,
  getSelectedSymbol,
  useSelectedSymbol,
} from "./shared/api/selected-symbol";

export {
  listAnalysisCatalogRecords,
  getAnalysisCatalogRecord,
  listLaunchableAnalysisRecords,
  queryAnalysisCatalog,
  type AnalysisCatalogQuery,
} from "./features/view-mode";
export type {
  AnalysisCatalogRecord,
  AdmissionVerdict,
  AdmissionVerdictInput,
  DecisionTarget,
  EvidenceClass,
  InsightActionHook,
  InsightCapabilityKind,
  InsightDecisionBinding,
  InsightDecisionGrade,
  InsightDomain,
  InsightIntent,
  InsightMaturity,
  InsightPersona,
  InsightScope,
  InsightSignalProfile,
  InsightSurface,
  InsightWorkflowBinding,
  InsightWorkflowStack,
  InsightWorkflowStep,
  PrimaryFacet,
  ViewTaxonomy,
  WorkflowStackId,
} from "./features/view-mode";

export {
  getWorkflowStack,
  getWorkflowStacks,
  suggestStacksForIntent,
  buildAdmissionVerdict,
  selectAgentPlanningInsights,
  selectGateEligibleInsights,
} from "./features/view-mode";
export type { WorkflowStackQuery, AgentPlanningInsightQuery } from "./features/view-mode";
