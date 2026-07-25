// view-mode — public barrel
// --------------------------------------------------------------------
// Everything a consumer might need lives here. The registry (below) is
// the single source of truth for descriptor metadata; `VIEW_MODE_OPTIONS`
// / `VIEW_GLYPH` are thin projections kept for consumers that only want
// flat tables and don't care about the full descriptor surface.

export { ViewModePicker } from "./ui/ViewModePicker";
export {
  viewModeStore,
  useViewMode,
  type ViewMode,
  type ViewModeState,
} from "./model/store";
export {
  VIEW_DESCRIPTORS,
  ALL_VIEW_DESCRIPTORS,
  RUNTIME_VIEW_DESCRIPTORS,
  getViewDescriptor,
  listViewDescriptors,
  listAllViewDescriptors,
  listRuntimeViewDescriptors,
  isKnownViewMode,
  switchMode,
  cycleMode,
  ViewContextProvider,
  useViewContext,
} from "./model/view-registry";
export {
  VIEW_MODE_OPTIONS,
  VIEW_GLYPH,
} from "./model/view-catalogue";
export type {
  ViewDescriptor,
  ViewContextValue,
  ViewDispatch,
  ViewCategory,
  ViewCtx,
  ViewDescriptorNeeds,
} from "./model/view-descriptor";

export {
  listAnalysisCatalogRecords,
  getAnalysisCatalogRecord,
  listLaunchableAnalysisRecords,
  queryAnalysisCatalog,
  descriptorToAnalysisRecord,
  type AnalysisCatalogQuery,
} from "./model/analysis-catalog";
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
} from "./model/taxonomy";
export {
  getWorkflowStack,
  getWorkflowStacks,
  suggestStacksForIntent,
  buildAdmissionVerdict,
  selectAgentPlanningInsights,
  selectGateEligibleInsights,
} from "./model";
export type {
  WorkflowStackQuery,
  AgentPlanningInsightQuery,
} from "./model";
