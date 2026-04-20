import { useSyncExternalStore } from "react";

// Command palette store
// --------------------------------------------------------------------
// Tiny open/close + query state. Module-level so global shortcuts
// (⌘K / Ctrl+K) from anywhere in the product can toggle visibility
// without prop drilling through every intermediate widget.

interface PaletteState {
  open: boolean;
  query: string;
}

let state: PaletteState = { open: false, query: "" };
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const commandPaletteStore = {
  getState(): PaletteState {
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
    state = { open: true, query: "" };
    emit();
  },
  close(): void {
    if (!state.open && state.query === "") return;
    state = { open: false, query: "" };
    emit();
  },
  toggle(): void {
    if (state.open) this.close();
    else this.open();
  },
  setQuery(q: string): void {
    if (state.query === q) return;
    state = { ...state, query: q };
    emit();
  },
};

export function useCommandPalette<T>(selector: (s: PaletteState) => T): T {
  return useSyncExternalStore(
    commandPaletteStore.subscribe,
    () => selector(commandPaletteStore.getState()),
    () => selector(commandPaletteStore.getState()),
  );
}
