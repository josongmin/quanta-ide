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

export interface SettingsState {
  showEdges: boolean;
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: ForceLod;
}

let state: SettingsState = {
  showEdges: true,
  debugHudOpen: true,
  showGridBg: true,
  showHitLayers: false,
  forceLod: "auto",
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
};

export const settingsStore = { getState, subscribe, ...actions };

export function useSettingsStore<T>(selector: (s: SettingsState) => T): T {
  return useSyncExternalStore(
    settingsStore.subscribe,
    () => selector(settingsStore.getState()),
    () => selector(settingsStore.getState()),
  );
}
