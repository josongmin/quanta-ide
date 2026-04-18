import { useSyncExternalStore } from "react";

// Storyboard store (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Lightweight playback state — which step we're on, whether we're
// playing, speed, loop. Separate from bookmarks-store because
// playback frequently flips boolean state (play / pause) that must
// not wake bookmark-grid subscribers.

export type StoryboardSpeed = 1 | 2 | 4;

export interface StoryboardState {
  playing: boolean;
  pageId: string | null;
  stepIndex: number;
  speed: StoryboardSpeed;
  loop: boolean;
  /** Dwell time at each bookmark in ms (unscaled; speed divides). */
  dwellMs: number;
}

const DEFAULT_DWELL_MS = 3000;

let state: StoryboardState = {
  playing: false,
  pageId: null,
  stepIndex: 0,
  speed: 1,
  loop: false,
  dwellMs: DEFAULT_DWELL_MS,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): StoryboardState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  start(pageId: string, stepIndex = 0): void {
    state = { ...state, playing: true, pageId, stepIndex: Math.max(0, stepIndex) };
    emit();
  },

  pause(): void {
    if (!state.playing) return;
    state = { ...state, playing: false };
    emit();
  },

  resume(): void {
    if (state.playing || state.pageId === null) return;
    state = { ...state, playing: true };
    emit();
  },

  stop(): void {
    if (!state.playing && state.pageId === null) return;
    state = { ...state, playing: false, pageId: null, stepIndex: 0 };
    emit();
  },

  setStep(index: number): void {
    if (state.stepIndex === index) return;
    state = { ...state, stepIndex: Math.max(0, index) };
    emit();
  },

  next(total: number): void {
    if (total <= 0) return;
    const n = state.stepIndex + 1;
    if (n >= total) {
      if (state.loop) {
        state = { ...state, stepIndex: 0 };
      } else {
        state = { ...state, playing: false, stepIndex: total - 1 };
      }
      emit();
      return;
    }
    state = { ...state, stepIndex: n };
    emit();
  },

  prev(): void {
    if (state.stepIndex === 0) return;
    state = { ...state, stepIndex: state.stepIndex - 1 };
    emit();
  },

  setSpeed(speed: StoryboardSpeed): void {
    if (state.speed === speed) return;
    state = { ...state, speed };
    emit();
  },

  setLoop(loop: boolean): void {
    if (state.loop === loop) return;
    state = { ...state, loop };
    emit();
  },

  setDwell(ms: number): void {
    const clamped = Math.max(500, Math.min(15000, ms));
    if (state.dwellMs === clamped) return;
    state = { ...state, dwellMs: clamped };
    emit();
  },
};

export const storyboardStore = {
  getState,
  subscribe,
  ...actions,
};

export function useStoryboardStore<T>(selector: (s: StoryboardState) => T): T {
  return useSyncExternalStore(
    storyboardStore.subscribe,
    () => selector(storyboardStore.getState()),
    () => selector(storyboardStore.getState()),
  );
}
