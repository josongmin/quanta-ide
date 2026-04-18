import { useSyncExternalStore } from "react";

// Debug settings store.
// -------------------------------------------------------------------
// Developer-only knobs — tied to DebugHud. Isolating them means opening
// or toggling the HUD never re-renders the canvas render pipeline.

export type ForceLod =
  | "auto"
  | "universe"
  | "supergalaxy"
  | "galaxy"
  | "city"
  | "street"
  | "ground";

export interface DebugSettingsState {
  debugHudOpen: boolean;
  forceLod: ForceLod;
  freezeScene: boolean;
}

let state: DebugSettingsState = {
  debugHudOpen: true,
  forceLod: "auto",
  freezeScene: false,
};

const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }
function getState(): DebugSettingsState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  toggleDebugHud() {
    state = { ...state, debugHudOpen: !state.debugHudOpen };
    emit();
  },
  setDebugHudOpen(v: boolean) {
    if (state.debugHudOpen === v) return;
    state = { ...state, debugHudOpen: v };
    emit();
  },
  setForceLod(v: ForceLod) {
    if (state.forceLod === v) return;
    state = { ...state, forceLod: v };
    emit();
  },
  setFreezeScene(v: boolean) {
    if (state.freezeScene === v) return;
    state = { ...state, freezeScene: v };
    emit();
  },
};

export const debugSettingsStore = { getState, subscribe, ...actions };

export function useDebugSettings<T>(selector: (s: DebugSettingsState) => T): T {
  return useSyncExternalStore(
    debugSettingsStore.subscribe,
    () => selector(debugSettingsStore.getState()),
    () => selector(debugSettingsStore.getState()),
  );
}
