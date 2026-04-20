import { useSyncExternalStore } from "react";

// Keyboard-hints modal store — just an open flag. Global so the `?`
// shortcut installed once at orchestrator level can toggle it from
// anywhere regardless of focus.

interface State {
  open: boolean;
}

let state: State = { open: false };
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const keyboardHintsStore = {
  getState(): State {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  open(): void {
    if (state.open) return;
    state = { open: true };
    emit();
  },
  close(): void {
    if (!state.open) return;
    state = { open: false };
    emit();
  },
  toggle(): void {
    state = { open: !state.open };
    emit();
  },
};

export function useKeyboardHints<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    keyboardHintsStore.subscribe,
    () => selector(keyboardHintsStore.getState()),
    () => selector(keyboardHintsStore.getState()),
  );
}
