// View registry — one flat list of ViewDescriptors that everything
// else reads.
// --------------------------------------------------------------------
// This is the single hinge of the view-mode architecture. Every place
// that used to hard-code a per-mode branch now asks the registry:
//
//   - CanvasShell   → which Component to mount, and in what wrapper
//   - ViewModePicker → label / glyph / hint / contexts / needs
//   - Cycle / switch → activation + deactivation side-effects
//   - URL sync       → valid view-mode ids
//
// Adding a new view mode = write one `features/<name>/view.tsx`
// descriptor file, re-export it from that feature's `index.ts`, and
// drop its name into the ALL list below. No other touch points.

import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ViewContextValue, ViewDescriptor } from "./view-descriptor";
import type { ViewMode } from "./store";
import { viewModeStore } from "./store";
import { recentModesStore } from "./recent-modes";

// Feature-side descriptors — each feature exposes a single exported
// ViewDescriptor from its public barrel. Listed in picker + cycle order
// (numeric `order` on each descriptor still authoritative — the import
// order here is cosmetic).

import { universeViewDescriptor }       from "../../universe-view";
import { mindMapViewDescriptor }        from "../../mind-map";
import { chordViewDescriptor }          from "../../chord-view";
import { matrixViewDescriptor }         from "../../matrix-view";
import { quadrantViewDescriptor }       from "../../quadrant-view";
import { arcViewDescriptor }            from "../../arc-view";
import { embeddingViewDescriptor }      from "../../embedding-map";
import { blastViewDescriptor }          from "../../blast-view";
import { archLayerViewDescriptor }      from "../../arch-layer-view";
import { debtChartViewDescriptor }      from "../../debt-chart";
import { refactorTerrainViewDescriptor } from "../../refactor-terrain";
import { cycleGenesisViewDescriptor }   from "../../cycle-genesis";
import { smellHistoryViewDescriptor }   from "../../smell-history";
import { archDriftViewDescriptor }      from "../../arch-drift";
import { coChangeViewDescriptor }       from "../../cochange";
import { refactorSimViewDescriptor }    from "../../refactor-sim";
import { startHereViewDescriptor }      from "../../start-here";
import { pathfinderViewDescriptor }     from "../../pathfinder";
import { neighborhoodViewDescriptor }   from "../../neighborhood";
import { authorTerritoryViewDescriptor } from "../../author-territory";
import { serviceTopoViewDescriptor }    from "../../service-topo";
import { galaxy3DViewDescriptor }       from "../../galaxy-3d";

// ── 2026 expansion — metrics / refactor / time-machine / experimental ──
import { hotspotViewDescriptor }        from "../../hotspot";
import { hubScoreViewDescriptor }       from "../../hub-score";
import { busFactorViewDescriptor }      from "../../bus-factor";
import { coverageHolesViewDescriptor }  from "../../coverage-holes";
import { layerAuditViewDescriptor }     from "../../layer-audit";
import { apiSurfaceViewDescriptor }     from "../../api-surface";
import { depFossilViewDescriptor }      from "../../dep-fossil";
import { deadCodeViewDescriptor }       from "../../dead-code";
import { moveHintViewDescriptor }       from "../../move-hint";
import { dupeClustersViewDescriptor }   from "../../dupe-clusters";
import { godFileViewDescriptor }        from "../../god-file";
import { timelapseViewDescriptor }      from "../../timelapse";
import { newSinceViewDescriptor }       from "../../new-since";
import { strataViewDescriptor }         from "../../strata";
import { evolutionDnaViewDescriptor }   from "../../evolution-dna";
import { smellRadarViewDescriptor }     from "../../smell-radar";
import { blameClockViewDescriptor }     from "../../blame-clock";
import { heatRainfallViewDescriptor }   from "../../heat-rainfall";
import { mitosisViewDescriptor }        from "../../mitosis";
import { whereToViewDescriptor }        from "../../where-to";
import { thoughtTrailViewDescriptor }   from "../../thought-trail";
import { failureFlowViewDescriptor }    from "../../failure-flow";
import { churnSparklineViewDescriptor } from "../../churn-sparkline";
import { semanticDiffViewDescriptor }   from "../../semantic-diff";
import { refactorWeatherViewDescriptor } from "../../refactor-weather";
import { temporalCouplingViewDescriptor } from "../../temporal-coupling";

// ── Industry / academia validated ──
import { cognitiveComplexityViewDescriptor } from "../../cognitive-complexity";
import { maintainabilityIndexViewDescriptor } from "../../maintainability-index";
import { ckMatrixViewDescriptor }        from "../../ck-matrix";
import { testPyramidViewDescriptor }     from "../../test-pyramid";
import { callGraphViewDescriptor }       from "../../call-graph";
import { controlFlowViewDescriptor }     from "../../control-flow";
import { programSliceViewDescriptor }    from "../../program-slice";
import { changeImpactViewDescriptor }    from "../../change-impact";
import { bugPredictionViewDescriptor }   from "../../bug-prediction";
import { featureEnvyViewDescriptor }     from "../../feature-envy";
import { shotgunSurgeryViewDescriptor }  from "../../shotgun-surgery";
import { commentAtlasViewDescriptor }    from "../../comment-atlas";
import { truckFactorViewDescriptor }     from "../../truck-factor";
import { refactoringMinerViewDescriptor } from "../../refactoring-miner";
import { reviewHeatViewDescriptor }      from "../../review-heat";
import { doraMetricsViewDescriptor }     from "../../dora-metrics";
import { seesoftViewDescriptor }         from "../../seesoft";
import { codeCity3DViewDescriptor }      from "../../code-city-3d";
import { voronoiTreemapViewDescriptor }  from "../../voronoi-treemap";
import { streamGraphViewDescriptor }     from "../../stream-graph";
import { ownershipSankeyViewDescriptor } from "../../ownership-sankey";
// ── Sonar-style quality dashboards ──
import { qualityGateViewDescriptor }    from "../../quality-gate";
import { mutationScoreViewDescriptor }  from "../../mutation-score";
import { vulnerabilitiesViewDescriptor } from "../../vulnerabilities";
import { debtRatioViewDescriptor }      from "../../debt-ratio";
import { ditViewDescriptor }            from "../../dit";

// ── Entity-scoped (file / folder / symbol) ──
import { innerCityViewDescriptor }      from "../../inner-city";
import { fileGaugeViewDescriptor }      from "../../file-gauge";
import { symbolInventoryViewDescriptor } from "../../symbol-inventory";
import { fileHistoryViewDescriptor }    from "../../file-history";
import { fileTwinsViewDescriptor }      from "../../file-twins";
import { packageSurfaceViewDescriptor } from "../../package-surface";
import { packageInstabilityViewDescriptor } from "../../package-instability";
import { packageEvolutionViewDescriptor } from "../../package-evolution";
import { symbolCardViewDescriptor }     from "../../symbol-card";
import { symbolFanViewDescriptor }      from "../../symbol-fan";
import { symbolUsageMapViewDescriptor } from "../../symbol-usage-map";

// ── Industry must-haves ──
import { problemsPanelViewDescriptor }  from "../../problems-panel";
import { structureOutlineViewDescriptor } from "../../structure-outline";
import { languageBreakdownViewDescriptor } from "../../language-breakdown";
import { dependencyHealthViewDescriptor } from "../../dependency-health";
import { sbomViewDescriptor }           from "../../sbom";
import { devExHealthViewDescriptor }    from "../../devex-health";
import { reviewRecommenderViewDescriptor } from "../../review-recommender";
import { xRayHotspotViewDescriptor }    from "../../xray-hotspot";

// ── AI token efficiency (2026 novel) ──
import { tokenEconomyViewDescriptor }   from "../../token-economy";
import { contextFootprintViewDescriptor } from "../../context-footprint";
import { aiFriendlinessViewDescriptor } from "../../ai-friendliness";
import { promptSimulatorViewDescriptor } from "../../prompt-simulator";

// ── AI-native second wave ──
import { contextWindowFitViewDescriptor } from "../../context-window-fit";
import { cacheROIViewDescriptor }       from "../../cache-roi";
import { aiAuthorshipViewDescriptor }   from "../../ai-authorship";
import { agentSuccessViewDescriptor }   from "../../agent-success";
import { semanticNeighborsViewDescriptor } from "../../semantic-neighbors";
import { hallucinationRiskViewDescriptor } from "../../hallucination-risk";
import { modelRouterViewDescriptor }    from "../../model-router";
import { verificationSurfaceViewDescriptor } from "../../verification-surface";

// ── AI agent observability (third wave) ──
import { agentTrajectoryViewDescriptor }    from "../../agent-trajectory";
import { toolProfileViewDescriptor }        from "../../tool-profile";
import { turnDepthViewDescriptor }          from "../../turn-depth";
import { blastRadiusAgentViewDescriptor }   from "../../blast-radius-agent";
import { readinessScoreViewDescriptor }     from "../../readiness-score";
import { contextRotViewDescriptor }         from "../../context-rot";
import { promptInjectionViewDescriptor }    from "../../prompt-injection";
import { agentROIViewDescriptor }           from "../../agent-roi";
import { replayTheaterViewDescriptor }      from "../../replay-theater";
import { convergenceScoreViewDescriptor }   from "../../convergence-score";

// ── AI-native product features (task management / governance) ──
import { taskQueueViewDescriptor }          from "../../task-queue";
import { taskKanbanViewDescriptor }         from "../../task-kanban";
import { taskComposerViewDescriptor }       from "../../task-composer";
import { taskGraphViewDescriptor }          from "../../task-graph";
import { decisionLogViewDescriptor }        from "../../decision-log";
import { contextCuratorViewDescriptor }     from "../../context-curator";
import { memoryVaultViewDescriptor }        from "../../memory-vault";
import { agentOrchestraViewDescriptor }     from "../../agent-orchestra";
import { budgetConsoleViewDescriptor }      from "../../budget-console";
import { auditTrailViewDescriptor }         from "../../audit-trail";

// Canonical list — sorted by `order` so picker / cycle / dropdown all
// agree on the sequence. The `order` field on each descriptor is the
// single source of truth; the import order above is irrelevant.
const ALL: readonly ViewDescriptor[] = [
  universeViewDescriptor,
  mindMapViewDescriptor,
  chordViewDescriptor,
  matrixViewDescriptor,
  quadrantViewDescriptor,
  arcViewDescriptor,
  embeddingViewDescriptor,
  blastViewDescriptor,
  archLayerViewDescriptor,
  debtChartViewDescriptor,
  refactorTerrainViewDescriptor,
  cycleGenesisViewDescriptor,
  smellHistoryViewDescriptor,
  archDriftViewDescriptor,
  coChangeViewDescriptor,
  refactorSimViewDescriptor,
  startHereViewDescriptor,
  pathfinderViewDescriptor,
  neighborhoodViewDescriptor,
  authorTerritoryViewDescriptor,
  serviceTopoViewDescriptor,
  galaxy3DViewDescriptor,
  // ── 2026 expansion ──
  hotspotViewDescriptor,
  hubScoreViewDescriptor,
  busFactorViewDescriptor,
  coverageHolesViewDescriptor,
  layerAuditViewDescriptor,
  apiSurfaceViewDescriptor,
  depFossilViewDescriptor,
  deadCodeViewDescriptor,
  moveHintViewDescriptor,
  dupeClustersViewDescriptor,
  godFileViewDescriptor,
  timelapseViewDescriptor,
  newSinceViewDescriptor,
  strataViewDescriptor,
  evolutionDnaViewDescriptor,
  smellRadarViewDescriptor,
  blameClockViewDescriptor,
  heatRainfallViewDescriptor,
  mitosisViewDescriptor,
  whereToViewDescriptor,
  thoughtTrailViewDescriptor,
  failureFlowViewDescriptor,
  churnSparklineViewDescriptor,
  semanticDiffViewDescriptor,
  refactorWeatherViewDescriptor,
  temporalCouplingViewDescriptor,
  // ── industry/academia validated ──
  cognitiveComplexityViewDescriptor,
  maintainabilityIndexViewDescriptor,
  ckMatrixViewDescriptor,
  testPyramidViewDescriptor,
  callGraphViewDescriptor,
  controlFlowViewDescriptor,
  programSliceViewDescriptor,
  changeImpactViewDescriptor,
  bugPredictionViewDescriptor,
  featureEnvyViewDescriptor,
  shotgunSurgeryViewDescriptor,
  commentAtlasViewDescriptor,
  truckFactorViewDescriptor,
  refactoringMinerViewDescriptor,
  reviewHeatViewDescriptor,
  doraMetricsViewDescriptor,
  seesoftViewDescriptor,
  codeCity3DViewDescriptor,
  voronoiTreemapViewDescriptor,
  streamGraphViewDescriptor,
  ownershipSankeyViewDescriptor,
  // ── Sonar-style quality dashboards ──
  qualityGateViewDescriptor,
  mutationScoreViewDescriptor,
  vulnerabilitiesViewDescriptor,
  debtRatioViewDescriptor,
  ditViewDescriptor,
  // ── entity-scoped ──
  innerCityViewDescriptor,
  fileGaugeViewDescriptor,
  symbolInventoryViewDescriptor,
  fileHistoryViewDescriptor,
  fileTwinsViewDescriptor,
  packageSurfaceViewDescriptor,
  packageInstabilityViewDescriptor,
  packageEvolutionViewDescriptor,
  symbolCardViewDescriptor,
  symbolFanViewDescriptor,
  symbolUsageMapViewDescriptor,
  // ── industry must-haves ──
  problemsPanelViewDescriptor,
  structureOutlineViewDescriptor,
  languageBreakdownViewDescriptor,
  dependencyHealthViewDescriptor,
  sbomViewDescriptor,
  devExHealthViewDescriptor,
  reviewRecommenderViewDescriptor,
  xRayHotspotViewDescriptor,
  // ── AI token efficiency ──
  tokenEconomyViewDescriptor,
  contextFootprintViewDescriptor,
  aiFriendlinessViewDescriptor,
  promptSimulatorViewDescriptor,
  // ── AI-native second wave ──
  contextWindowFitViewDescriptor,
  cacheROIViewDescriptor,
  aiAuthorshipViewDescriptor,
  agentSuccessViewDescriptor,
  semanticNeighborsViewDescriptor,
  hallucinationRiskViewDescriptor,
  modelRouterViewDescriptor,
  verificationSurfaceViewDescriptor,
  // ── AI agent observability (third wave) ──
  agentTrajectoryViewDescriptor,
  toolProfileViewDescriptor,
  turnDepthViewDescriptor,
  blastRadiusAgentViewDescriptor,
  readinessScoreViewDescriptor,
  contextRotViewDescriptor,
  promptInjectionViewDescriptor,
  agentROIViewDescriptor,
  replayTheaterViewDescriptor,
  convergenceScoreViewDescriptor,
  // ── AI-native product features ──
  taskQueueViewDescriptor,
  taskKanbanViewDescriptor,
  taskComposerViewDescriptor,
  taskGraphViewDescriptor,
  decisionLogViewDescriptor,
  contextCuratorViewDescriptor,
  memoryVaultViewDescriptor,
  agentOrchestraViewDescriptor,
  budgetConsoleViewDescriptor,
  auditTrailViewDescriptor,
];

export const VIEW_DESCRIPTORS: readonly ViewDescriptor[] = [...ALL].sort(
  (a, b) => a.order - b.order,
);

const byId = new Map<ViewMode, ViewDescriptor>(
  VIEW_DESCRIPTORS.map(d => [d.id, d]),
);

// Duplicate-id guard — catches copy-paste mistakes at module load
// instead of silently letting one descriptor shadow another.
if (byId.size !== VIEW_DESCRIPTORS.length) {
  const seen = new Set<ViewMode>();
  const dupes: ViewMode[] = [];
  for (const d of VIEW_DESCRIPTORS) {
    if (seen.has(d.id)) dupes.push(d.id);
    seen.add(d.id);
  }
  throw new Error(`Duplicate view descriptor ids: ${dupes.join(", ")}`);
}

// ── Lookup helpers ────────────────────────────────────────────────────

export function getViewDescriptor(id: ViewMode): ViewDescriptor {
  const d = byId.get(id);
  if (!d) throw new Error(`Unknown view mode: ${id}`);
  return d;
}

export function listViewDescriptors(): readonly ViewDescriptor[] {
  return VIEW_DESCRIPTORS;
}

export function isKnownViewMode(id: string): id is ViewMode {
  return byId.has(id as ViewMode);
}

// ── Transition helpers — symmetric activate / deactivate contract ─────

/** Switch the active view mode and run any side-effects the two
 *  descriptors declare. Caller owns the `ctx` it passes — typically the
 *  one derived by CanvasShell and exposed to the picker / hotkeys via
 *  a context provider. No-op if already on `next`. */
export function switchMode(next: ViewMode, ctx: ViewContextValue): void {
  const current = viewModeStore.getState().mode;
  if (current === next) return;
  // Deactivate first so the outgoing view's teardown runs against the
  // still-authoritative context. Then flip the store. Then activate —
  // so subscribers reading `viewModeStore.getState().mode` during
  // onActivate see the new mode.
  getViewDescriptor(current).onDeactivate?.(ctx);
  viewModeStore.setMode(next);
  getViewDescriptor(next).onActivate?.(ctx);
  // Record into MRU so the picker / command palette can surface "최근".
  recentModesStore.record(next);
}

/** Cycle to the next mode in descriptor order. Wraps around. */
export function cycleMode(ctx: ViewContextValue): void {
  const order = VIEW_DESCRIPTORS.map(d => d.id);
  const i = order.indexOf(viewModeStore.getState().mode);
  const next = order[(i + 1) % order.length];
  if (next !== undefined) switchMode(next, ctx);
}

// ── React glue — ctx provider for non-shell consumers (picker, hotkeys) ─
//
// CanvasShell owns the ViewContextValue construction (it has all the
// raw inputs — graph, tree, viewport size, dispatch). It publishes the
// current ctx via this Provider so the picker and any future hotkey
// surfaces can call `switchMode(next, ctx)` without re-threading every
// store dependency.

const ViewCtxReact = createContext<ViewContextValue | null>(null);

export function ViewContextProvider({
  value,
  children,
}: {
  value: ViewContextValue;
  children: ReactNode;
}): ReactElement {
  return <ViewCtxReact.Provider value={value}>{children}</ViewCtxReact.Provider>;
}

/** Read the live ViewContextValue inside any component mounted below
 *  CanvasShell. Throws if called outside the provider — that means the
 *  caller is running before the shell mounted, which is a bug. */
export function useViewContext(): ViewContextValue {
  const v = useContext(ViewCtxReact);
  if (!v) {
    throw new Error(
      "useViewContext() called outside ViewContextProvider. " +
        "Only components mounted under CanvasShell may read the ctx.",
    );
  }
  return v;
}
