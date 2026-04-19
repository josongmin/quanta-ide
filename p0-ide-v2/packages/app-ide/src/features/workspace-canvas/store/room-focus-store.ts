import { useSyncExternalStore } from "react";

// Room-focus store (R3)
// -------------------------------------------------------------------
// Tracks which function inside the currently-selected file the user
// is zoomed in on. Lives in its own tiny store rather than on
// interactionStore to keep it a purely visual thing — clearing the
// focus must not ripple into path-query / selection resets that the
// other store owns.

export interface RoomFocusState {
  /** File whose function is in focus. */
  fileId: string | null;
  /** Name of the focused function. */
  symbol: string | null;
}

let state: RoomFocusState = { fileId: null, symbol: null };
const listeners = new Set<() => void>();

function emit(): void { for (const l of [...listeners]) l(); }
function getState(): RoomFocusState { return state; }
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function focus(fileId: string, symbol: string): void {
  if (state.fileId === fileId && state.symbol === symbol) return;
  state = { fileId, symbol };
  emit();
}

function clear(): void {
  if (state.fileId === null && state.symbol === null) return;
  state = { fileId: null, symbol: null };
  emit();
}

export const roomFocusStore = { getState, subscribe, focus, clear };

export function useRoomFocus<T>(selector: (s: RoomFocusState) => T): T {
  return useSyncExternalStore(
    roomFocusStore.subscribe,
    () => selector(roomFocusStore.getState()),
    () => selector(roomFocusStore.getState()),
  );
}
