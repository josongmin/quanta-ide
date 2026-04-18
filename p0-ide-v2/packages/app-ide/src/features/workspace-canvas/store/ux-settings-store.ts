import { useSyncExternalStore } from "react";

// UX settings store.
// -------------------------------------------------------------------
// Non-render surface toggles — stickies panel, background grid, the
// URL-sync opt-in. Kept off the render-settings store so flipping the
// grid bg cannot wake Pixi edge redraw logic.

export interface UxSettingsState {
  showStickies: boolean;
  showHeatmap: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  autoSyncUrl: boolean;
}

let state: UxSettingsState = {
  showStickies: true,
  showHeatmap: true,
  showGridBg: true,
  showHitLayers: false,
  autoSyncUrl: false,
};

const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }
function getState(): UxSettingsState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setShowStickies(v: boolean) {
    if (state.showStickies === v) return;
    state = { ...state, showStickies: v };
    emit();
  },
  setShowHeatmap(v: boolean) {
    if (state.showHeatmap === v) return;
    state = { ...state, showHeatmap: v };
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
  setAutoSyncUrl(v: boolean) {
    if (state.autoSyncUrl === v) return;
    state = { ...state, autoSyncUrl: v };
    emit();
  },
};

export const uxSettingsStore = { getState, subscribe, ...actions };

export function useUxSettings<T>(selector: (s: UxSettingsState) => T): T {
  return useSyncExternalStore(
    uxSettingsStore.subscribe,
    () => selector(uxSettingsStore.getState()),
    () => selector(uxSettingsStore.getState()),
  );
}
