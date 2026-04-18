import { useSyncExternalStore } from "react";

// Session timer store (review.timer)
// ------------------------------------------------------------------
// Simple countdown in seconds. Not persisted — a refresh resets the
// timer intentionally (reviews are live events; stale countdowns from
// yesterday are noise). The SessionTimer component owns the setInterval
// loop and calls `tick()` once per second. The store only stores state
// + emits listeners.
//
// `running: true` + `remainingSec === 0` is the terminal "ding" state;
// the component listens for that transition to play the Web Audio chime.

export interface TimerState {
  /** Seconds currently on the clock. */
  remainingSec: number;
  /** Seconds the timer was last started with (for reset). */
  initialSec: number;
  /** true while the interval is advancing; false when paused/reset. */
  running: boolean;
  /** Incremented each time the countdown hits zero (so UI can flash). */
  finishedCount: number;
}

const DEFAULT_SEC = 15 * 60;

let state: TimerState = {
  remainingSec: DEFAULT_SEC,
  initialSec: DEFAULT_SEC,
  running: false,
  finishedCount: 0,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): TimerState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setDuration(seconds: number): void {
    const clamped = Math.max(1, Math.min(60 * 60 * 6, Math.floor(seconds)));
    state = {
      ...state,
      initialSec: clamped,
      remainingSec: clamped,
      running: false,
    };
    emit();
  },

  start(): void {
    if (state.running) return;
    // If at zero, auto-reset to initialSec on start.
    const rem = state.remainingSec > 0 ? state.remainingSec : state.initialSec;
    state = { ...state, remainingSec: rem, running: true };
    emit();
  },

  pause(): void {
    if (!state.running) return;
    state = { ...state, running: false };
    emit();
  },

  reset(): void {
    state = {
      ...state,
      remainingSec: state.initialSec,
      running: false,
    };
    emit();
  },

  /** Advances by `secs` (typically 1). Called by the timer component. */
  tick(secs = 1): void {
    if (!state.running) return;
    const next = state.remainingSec - secs;
    if (next <= 0) {
      state = {
        ...state,
        remainingSec: 0,
        running: false,
        finishedCount: state.finishedCount + 1,
      };
      emit();
      return;
    }
    state = { ...state, remainingSec: next };
    emit();
  },
};

export const timerStore = { getState, subscribe, ...actions };

export function useTimerStore<T>(selector: (s: TimerState) => T): T {
  return useSyncExternalStore(
    timerStore.subscribe,
    () => selector(timerStore.getState()),
    () => selector(timerStore.getState()),
  );
}

export function formatMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
