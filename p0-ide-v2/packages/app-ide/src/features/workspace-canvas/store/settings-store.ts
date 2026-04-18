import { useSyncExternalStore } from "react";
import type { EdgeLayer, EdgeSeverity } from "@quanta/canvas-engine";

// Settings store
// -------------------------------------------------------------------
// User-visible render/debug toggles. These change rarely (user click)
// and are isolated so a viewport pan tick does not wake this store,
// and — critically — flipping `forceLod` or `showEdges` does not wake
// viewport / interaction subscribers. CanvasControls, DebugHud, and
// PixiStage are the primary consumers.

export type ForceLod =
  | "auto"
  | "universe"
  | "supergalaxy"
  | "galaxy"
  | "city"
  | "street"
  | "ground";

export type EdgeKind = "import" | "taint-propagation" | "blast";

// Re-export from canvas-engine so HUD/consumers can import from a single
// settings entry point.
export type { EdgeLayer, EdgeSeverity };

export type FocusMode = "off" | "on";
export type FocusHops = 1 | 2;

export interface SettingsState {
  showEdges: boolean;
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: ForceLod;
  edgeKinds: Record<EdgeKind, boolean>;
  edgeLayers: Record<EdgeLayer, boolean>;
  edgeMinSeverity: EdgeSeverity;
  edgeWidthMul: number;
  freezeScene: boolean;
  focusMode: FocusMode;
  focusHops: FocusHops;
  focusDimOpacity: number;
  showHeatmap: boolean;
  /** Supergalaxy-tier aggregated cluster super-edges. Independent of per-layer filters. */
  showClusterEdges: boolean;
  /** SCC (import cycle) bubble enclosures. Galaxy+ only. */
  showSccBubbles: boolean;
  /** "You should look here first" numbered badges on top files. */
  showStartHereBadges: boolean;
  /** Badge cutoff — only render top-N ranks. */
  startHereTopN: 3 | 5 | 10;
  /** Live filter DSL string — consumed by compileEdgeFilter. */
  edgeFilterQuery: string;
  /** Highlight arch-violating edges (domain→infra, etc.) with a red halo. */
  highlightArchViolations: boolean;
}

let state: SettingsState = {
  showEdges: true,
  debugHudOpen: true,
  showGridBg: true,
  showHitLayers: false,
  forceLod: "auto",
  edgeKinds: { import: true, "taint-propagation": true, blast: true },
  edgeLayers: { structural: true, flow: true, safety: true, impact: true },
  edgeMinSeverity: "low",
  edgeWidthMul: 1,
  freezeScene: false,
  focusMode: "on",
  focusHops: 1,
  focusDimOpacity: 0.08,
  showHeatmap: true,
  showClusterEdges: true,
  showSccBubbles: true,
  showStartHereBadges: true,
  startHereTopN: 5,
  edgeFilterQuery: "",
  highlightArchViolations: true,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): SettingsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setShowEdges(show: boolean) {
    if (state.showEdges === show) return;
    state = { ...state, showEdges: show };
    emit();
  },

  toggleDebugHud() {
    state = { ...state, debugHudOpen: !state.debugHudOpen };
    emit();
  },

  setShowGridBg(v: boolean) {
    if (state.showGridBg === v) return;
    state = { ...state, showGridBg: v };
    emit();
  },

  setShowHitLayers(v: boolean) {
    if (state.showHitLayers === v) return;
    state = { ...state, showHitLayers: v };
    emit();
  },

  setForceLod(v: ForceLod) {
    if (state.forceLod === v) return;
    state = { ...state, forceLod: v };
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

  setFreezeScene(v: boolean) {
    if (state.freezeScene === v) return;
    state = { ...state, freezeScene: v };
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

  setShowHeatmap(v: boolean) {
    if (state.showHeatmap === v) return;
    state = { ...state, showHeatmap: v };
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

  setEdgeFilterQuery(v: string) {
    if (state.edgeFilterQuery === v) return;
    state = { ...state, edgeFilterQuery: v };
    emit();
  },

  setHighlightArchViolations(v: boolean) {
    if (state.highlightArchViolations === v) return;
    state = { ...state, highlightArchViolations: v };
    emit();
  },
};

export const settingsStore = { getState, subscribe, ...actions };

export function useSettingsStore<T>(selector: (s: SettingsState) => T): T {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.getState()),
    () => selector(settingsStore.getState()),
  );
}
