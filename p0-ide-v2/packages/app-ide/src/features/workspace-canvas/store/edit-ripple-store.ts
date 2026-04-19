import { useSyncExternalStore } from "react";

// Edit-ripple store
// -------------------------------------------------------------------
// When an AI inline edit is accepted, briefly pulse every card that
// shares a graph edge with the edited file. Purely visual — drives a
// CSS class on affected GroundCards for ~1.6s, then auto-clears.
//
// Isolated from scene / viewport / interaction stores so ripple cycles
// (which fire on a timer) never wake render pipelines that don't care.

export interface EditRippleState {
  sourceFileId: string | null;
  /** Immutable set of file ids currently rippling. Empty ⇒ no ripple. */
  affectedFileIds: ReadonlySet<string>;
  /** Epoch ms when the current ripple was initiated. Drives CSS keyframes. */
  startedAt: number;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

let state: EditRippleState = {
  sourceFileId: null,
  affectedFileIds: EMPTY_SET,
  startedAt: 0,
};

const listeners = new Set<() => void>();
let clearTimer: number | null = null;

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): EditRippleState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const DEFAULT_DURATION_MS = 1600;

const actions = {
  /** Fire a ripple from `sourceFileId` outward to `affectedFileIds`.
   *  Auto-clears after `durationMs` so callers don't have to chase teardown.
   *  Calling again before the previous clear cancels and re-stages. */
  fire(
    sourceFileId: string,
    affectedFileIds: ReadonlySet<string> | readonly string[],
    durationMs: number = DEFAULT_DURATION_MS,
  ): void {
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }
    const set = affectedFileIds instanceof Set
      ? affectedFileIds
      : new Set(affectedFileIds);
    state = {
      sourceFileId,
      affectedFileIds: set,
      startedAt: Date.now(),
    };
    emit();
    clearTimer = window.setTimeout(() => {
      state = { sourceFileId: null, affectedFileIds: EMPTY_SET, startedAt: 0 };
      clearTimer = null;
      emit();
    }, durationMs);
  },

  clear(): void {
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (state.sourceFileId === null) return;
    state = { sourceFileId: null, affectedFileIds: EMPTY_SET, startedAt: 0 };
    emit();
  },
};

export const editRippleStore = { getState, subscribe, ...actions };

export function useEditRippleStore<T>(selector: (s: EditRippleState) => T): T {
  return useSyncExternalStore(
    editRippleStore.subscribe,
    () => selector(editRippleStore.getState()),
    () => selector(editRippleStore.getState()),
  );
}
