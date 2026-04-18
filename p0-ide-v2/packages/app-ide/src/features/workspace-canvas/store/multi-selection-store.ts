import { useSyncExternalStore } from "react";

// Multi-selection store (Batch 7 — power.lasso).
// -------------------------------------------------------------------
// Holds the working set of file ids selected via the lasso. The "mode"
// is only meaningful while a lasso drag is active — on release the
// resolved set is committed to `selectedFileIds`. Single-file selection
// continues to live on the interaction store (ViewState.selectedFileId)
// so existing consumers don't have to change.

export type MultiSelectionMode = "replace" | "add" | "subtract";

export interface MultiSelectionState {
  selectedFileIds: readonly string[];
  mode: MultiSelectionMode;
}

const initial: MultiSelectionState = {
  selectedFileIds: [],
  mode: "replace",
};

let state: MultiSelectionState = initial;
const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }
function getState(): MultiSelectionState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  for (const id of b) if (!setA.has(id)) return false;
  return true;
}

const actions = {
  setSelection(ids: readonly string[]): void {
    if (sameSet(state.selectedFileIds, ids)) return;
    state = { ...state, selectedFileIds: [...ids] };
    emit();
  },
  addToSelection(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const next = new Set(state.selectedFileIds);
    let changed = false;
    for (const id of ids) {
      if (!next.has(id)) { next.add(id); changed = true; }
    }
    if (!changed) return;
    state = { ...state, selectedFileIds: [...next] };
    emit();
  },
  removeFromSelection(ids: readonly string[]): void {
    if (ids.length === 0 || state.selectedFileIds.length === 0) return;
    const remove = new Set(ids);
    const next = state.selectedFileIds.filter(id => !remove.has(id));
    if (next.length === state.selectedFileIds.length) return;
    state = { ...state, selectedFileIds: next };
    emit();
  },
  clear(): void {
    if (state.selectedFileIds.length === 0) return;
    state = { ...state, selectedFileIds: [] };
    emit();
  },
  setMode(mode: MultiSelectionMode): void {
    if (state.mode === mode) return;
    state = { ...state, mode };
    emit();
  },
};

export const multiSelectionStore = { getState, subscribe, ...actions };

export function useMultiSelectionStore<T>(selector: (s: MultiSelectionState) => T): T {
  return useSyncExternalStore(
    multiSelectionStore.subscribe,
    () => selector(multiSelectionStore.getState()),
    () => selector(multiSelectionStore.getState()),
  );
}
