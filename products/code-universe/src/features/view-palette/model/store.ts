import { useSyncExternalStore } from "react";

// View palette store
// --------------------------------------------------------------------
// Tiny open/close + query + keyboard-cursor state for the view-mode
// command palette. Module-level so the global ⌘⇧P / Ctrl+⇧P shortcut can
// toggle the modal from anywhere in the product without prop drilling.
//
// Separate from `features/command-palette/` — that one targets entities
// (files / symbols). This one targets VIEW MODES (all 74 visualisers).

interface ViewPaletteState {
  open: boolean;
  query: string;
  /** Keyboard cursor into the currently-filtered flat result list.
   *  -1 means "no explicit selection — Enter commits first match". */
  cursor: number;
}

const initial: ViewPaletteState = { open: false, query: "", cursor: -1 };
let state: ViewPaletteState = initial;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const viewPaletteStore = {
  getState(): ViewPaletteState {
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
    state = { open: true, query: "", cursor: -1 };
    emit();
  },
  close(): void {
    if (!state.open && state.query === "" && state.cursor === -1) return;
    state = { open: false, query: "", cursor: -1 };
    emit();
  },
  toggle(): void {
    if (state.open) this.close();
    else this.open();
  },
  setQuery(q: string): void {
    if (state.query === q) return;
    // Typing resets the cursor to the first match (0) or -1 when empty.
    state = { ...state, query: q, cursor: q ? 0 : -1 };
    emit();
  },
  setCursor(i: number): void {
    if (state.cursor === i) return;
    state = { ...state, cursor: i };
    emit();
  },
};

export function useViewPalette<T>(selector: (s: ViewPaletteState) => T): T {
  return useSyncExternalStore(
    viewPaletteStore.subscribe,
    () => selector(viewPaletteStore.getState()),
    () => selector(viewPaletteStore.getState()),
  );
}
