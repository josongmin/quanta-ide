import { useSyncExternalStore } from "react";

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

export interface SettingsState {
  showEdges: boolean;
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: ForceLod;
  edgeKinds: Record<EdgeKind, boolean>;
  edgeWidthMul: number;
  freezeScene: boolean;
}

let state: SettingsState = {
  showEdges: true,
  debugHudOpen: true,
  showGridBg: true,
  showHitLayers: false,
  forceLod: "auto",
  edgeKinds: { import: true, "taint-propagation": true, blast: true },
  edgeWidthMul: 1,
  freezeScene: false,
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
};

export const settingsStore = { getState, subscribe, ...actions };

export function useSettingsStore<T>(selector: (s: SettingsState) => T): T {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.getState()),
    () => selector(settingsStore.getState()),
  );
}
