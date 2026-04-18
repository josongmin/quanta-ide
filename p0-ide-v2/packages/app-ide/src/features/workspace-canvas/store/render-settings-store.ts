import { useSyncExternalStore } from "react";
import type { EdgeKind, EdgeLayer, EdgeSeverity } from "@quanta/canvas-engine";

// Render settings store.
// -------------------------------------------------------------------
// Visual-render parameters for edges + node overlays. Hot subscribers
// are the Pixi renderer dispatch (`PixiStage`) and its fan-out props.
// Changing a render knob should NOT wake UX / debug subscribers; the
// three-file split keeps each fat subscriber set narrow.

export type { EdgeKind, EdgeLayer, EdgeSeverity };

// Listed in layer order (structural → flow → safety → impact). The
// assertion below forces a TS error if the canonical EdgeKind union grows
// (or shrinks) without this array being updated — so HUD toggles can't
// silently drop a kind the analyzer starts emitting.
export const ALL_EDGE_KINDS = [
  "import", "call", "reference", "cfg", "inheritance", "test-covers", "clone",
  "dataflow", "effect", "pdg", "alias", "feature-flag",
  "taint-propagation", "sanitizer", "race", "cycle", "finding",
  "contract", "dead-edge", "runtime-divergence",
  "blast", "impact", "diff", "dependency", "witness",
  "cochange", "rename-pair", "supply-chain",
] as const satisfies readonly EdgeKind[];

// Compile-time exhaustiveness: every EdgeKind must appear above.
type _ExhaustiveKindCheck =
  Exclude<EdgeKind, (typeof ALL_EDGE_KINDS)[number]> extends never ? true : never;
const _check: _ExhaustiveKindCheck = true;
void _check;

function allKindsOn(): Record<EdgeKind, boolean> {
  const out = {} as Record<EdgeKind, boolean>;
  for (const k of ALL_EDGE_KINDS) out[k] = true;
  return out;
}

export interface RenderSettingsState {
  showEdges: boolean;
  edgeKinds: Record<EdgeKind, boolean>;
  edgeLayers: Record<EdgeLayer, boolean>;
  edgeMinSeverity: EdgeSeverity;
  edgeWidthMul: number;

  showClusterEdges: boolean;
  showSccBubbles: boolean;
  showStartHereBadges: boolean;
  startHereTopN: 3 | 5 | 10;

  showCrossGraphEdges: boolean;
  highlightCrossGraph: boolean;

  elevationMode: boolean;
  showBlameGutter: boolean;
  highlightArchViolations: boolean;

  showEffectBadges: boolean;
  showLatencyOverlay: boolean;

  edgeFilterQuery: string;

  showAgentPresence: boolean;
}

let state: RenderSettingsState = {
  showEdges: true,
  edgeKinds: allKindsOn(),
  edgeLayers: { structural: true, flow: true, safety: true, impact: true },
  edgeMinSeverity: "low",
  edgeWidthMul: 1,
  showClusterEdges: true,
  showSccBubbles: true,
  showStartHereBadges: true,
  startHereTopN: 5,
  showCrossGraphEdges: true,
  highlightCrossGraph: true,
  elevationMode: false,
  showBlameGutter: true,
  highlightArchViolations: true,
  showEffectBadges: true,
  showLatencyOverlay: false,
  edgeFilterQuery: "",
  showAgentPresence: true,
};

const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }
function getState(): RenderSettingsState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setShowEdges(show: boolean) {
    if (state.showEdges === show) return;
    state = { ...state, showEdges: show };
    emit();
  },
  setEdgeKind(kind: EdgeKind, v: boolean) {
    if (state.edgeKinds[kind] === v) return;
    state = { ...state, edgeKinds: { ...state.edgeKinds, [kind]: v } };
    emit();
  },
  setEdgeLayer(layer: EdgeLayer, v: boolean) {
    if (state.edgeLayers[layer] === v) return;
    state = { ...state, edgeLayers: { ...state.edgeLayers, [layer]: v } };
    emit();
  },
  setEdgeMinSeverity(sev: EdgeSeverity) {
    if (state.edgeMinSeverity === sev) return;
    state = { ...state, edgeMinSeverity: sev };
    emit();
  },
  setEdgeWidthMul(v: number) {
    const clamped = Math.max(0.25, Math.min(3, v));
    if (state.edgeWidthMul === clamped) return;
    state = { ...state, edgeWidthMul: clamped };
    emit();
  },
  setShowClusterEdges(v: boolean) {
    if (state.showClusterEdges === v) return;
    state = { ...state, showClusterEdges: v };
    emit();
  },
  setShowSccBubbles(v: boolean) {
    if (state.showSccBubbles === v) return;
    state = { ...state, showSccBubbles: v };
    emit();
  },
  setShowStartHereBadges(v: boolean) {
    if (state.showStartHereBadges === v) return;
    state = { ...state, showStartHereBadges: v };
    emit();
  },
  setStartHereTopN(v: 3 | 5 | 10) {
    if (state.startHereTopN === v) return;
    state = { ...state, startHereTopN: v };
    emit();
  },
  setShowCrossGraphEdges(v: boolean) {
    if (state.showCrossGraphEdges === v) return;
    state = { ...state, showCrossGraphEdges: v };
    emit();
  },
  setHighlightCrossGraph(v: boolean) {
    if (state.highlightCrossGraph === v) return;
    state = { ...state, highlightCrossGraph: v };
    emit();
  },
  setElevationMode(v: boolean) {
    if (state.elevationMode === v) return;
    state = { ...state, elevationMode: v };
    emit();
  },
  setShowBlameGutter(v: boolean) {
    if (state.showBlameGutter === v) return;
    state = { ...state, showBlameGutter: v };
    emit();
  },
  setHighlightArchViolations(v: boolean) {
    if (state.highlightArchViolations === v) return;
    state = { ...state, highlightArchViolations: v };
    emit();
  },
  setShowEffectBadges(v: boolean) {
    if (state.showEffectBadges === v) return;
    state = { ...state, showEffectBadges: v };
    emit();
  },
  setShowLatencyOverlay(v: boolean) {
    if (state.showLatencyOverlay === v) return;
    state = { ...state, showLatencyOverlay: v };
    emit();
  },
  setEdgeFilterQuery(v: string) {
    if (state.edgeFilterQuery === v) return;
    state = { ...state, edgeFilterQuery: v };
    emit();
  },
  setShowAgentPresence(v: boolean) {
    if (state.showAgentPresence === v) return;
    state = { ...state, showAgentPresence: v };
    emit();
  },
};

export const renderSettingsStore = { getState, subscribe, ...actions };

export function useRenderSettings<T>(selector: (s: RenderSettingsState) => T): T {
  return useSyncExternalStore(
    renderSettingsStore.subscribe,
    () => selector(renderSettingsStore.getState()),
    () => selector(renderSettingsStore.getState()),
  );
}
