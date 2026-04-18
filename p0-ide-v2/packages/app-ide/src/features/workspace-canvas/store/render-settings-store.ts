import { useSyncExternalStore } from "react";
import type { EdgeLayer, EdgeSeverity } from "@quanta/canvas-engine";

// Render settings store.
// -------------------------------------------------------------------
// Visual-render parameters for edges + node overlays. Hot subscribers
// are the Pixi renderer dispatch (`PixiStage`) and its fan-out props.
// Changing a render knob should NOT wake UX / debug subscribers; the
// three-file split keeps each fat subscriber set narrow.

export type EdgeKind = "import" | "taint-propagation" | "blast";
export type { EdgeLayer, EdgeSeverity };

export type FocusMode = "off" | "on";
export type FocusHops = 1 | 2;

export interface RenderSettingsState {
  showEdges: boolean;
  edgeKinds: Record<EdgeKind, boolean>;
  edgeLayers: Record<EdgeLayer, boolean>;
  edgeMinSeverity: EdgeSeverity;
  edgeWidthMul: number;

  focusMode: FocusMode;
  focusHops: FocusHops;
  focusDimOpacity: number;

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
  edgeKinds: { import: true, "taint-propagation": true, blast: true },
  edgeLayers: { structural: true, flow: true, safety: true, impact: true },
  edgeMinSeverity: "low",
  edgeWidthMul: 1,
  focusMode: "on",
  focusHops: 1,
  focusDimOpacity: 0.08,
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
  setFocusMode(v: FocusMode) {
    if (state.focusMode === v) return;
    state = { ...state, focusMode: v };
    emit();
  },
  setFocusHops(v: FocusHops) {
    if (state.focusHops === v) return;
    state = { ...state, focusHops: v };
    emit();
  },
  setFocusDimOpacity(v: number) {
    const clamped = Math.max(0, Math.min(0.5, v));
    if (state.focusDimOpacity === clamped) return;
    state = { ...state, focusDimOpacity: clamped };
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
