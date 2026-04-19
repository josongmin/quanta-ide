import { useSyncExternalStore } from "react";

// Debug settings store.
// -------------------------------------------------------------------
// Developer-only knobs — tied to DebugHud. Isolating them means opening
// or toggling the HUD never re-renders the canvas render pipeline.
//
// Field taxonomy (matters for lifecycle resets):
//   - UI-preference (survives tab re-entry): `debugHudOpen`.
//   - kill-switch (reset on every tab re-entry via resetDebugKnobs):
//     `forceLod`, `freezeScene`.
//
// The kill-switches actively disable feedback loops (zoom→LOD, layout
// worker ticks). If they silently survive a tab switch the canvas can
// appear frozen — see the root-cause audit in `useCanvasInitialize`.
// `resetDebugKnobs()` wipes exactly those fields and is the sole hook
// point for lifecycle-driven resets (`useTabFocus` in WorkspaceApp).

export type ForceLod =
  | "auto"
  | "universe"
  | "supergalaxy"
  | "galaxy"
  | "city"
  | "street"
  | "ground";

export interface DebugSettingsState {
  /** UI-preference: HUD visibility. User-controlled, survives tab switches. */
  debugHudOpen: boolean;
  /** Kill-switch: pins canvas LOD, disables zoom→LOD feedback. Reset on tab focus. */
  forceLod: ForceLod;
  /** Kill-switch: pauses the layout worker. Reset on tab focus. */
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
  /**
   * Clear every kill-switch atomically. The `debugHudOpen` preference is
   * intentionally preserved — closing/opening the HUD is a user choice,
   * not a "state accidentally survived a tab switch" bug.
   *
   * Called from the Code Universe's `useTabFocus` on every (re-)entry so
   * no kill-switch can silently outlive its debug session. Also invoked
   * by the banner's "해제" button for in-canvas rescue.
   *
   * Idempotent: no-op (no emit) when nothing was pinned.
   */
  resetDebugKnobs() {
    if (state.forceLod === "auto" && !state.freezeScene) return;
    state = { ...state, forceLod: "auto", freezeScene: false };
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
