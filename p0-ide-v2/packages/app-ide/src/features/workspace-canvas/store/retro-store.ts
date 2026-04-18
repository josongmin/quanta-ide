import { useSyncExternalStore } from "react";

// Retrospective store (review.retrospective)
// ------------------------------------------------------------------
// Tiny store — owns ONLY the view-mode toggle + a "seeded" guard.
// The actual sticky → column binding lives on the existing
// `stickiesStore` via the new optional `retroColumn` field (see
// stickies-store.ts). This lets stickies retain all their existing
// behavior (drag, color, resolve) while gaining a secondary semantic
// when retro mode is active.

export type RetroColumn = "well" | "didnt" | "action";

export const RETRO_COLUMNS: readonly RetroColumn[] = ["well", "didnt", "action"] as const;

export const RETRO_COLUMN_LABEL: Record<RetroColumn, string> = {
  well: "Went well",
  didnt: "Didn't go well",
  action: "Action items",
};

export interface RetroState {
  /** Whether the retro column overlay is currently visible on canvas. */
  visible: boolean;
  /** Set once demo stickies have been proposed for this session. */
  seeded: boolean;
}

const STORAGE_KEY = "quanta.canvas.review.retro.v1";

function readPersisted(): RetroState | null {
  try {
    const raw = typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      visible: typeof parsed.visible === "boolean" ? parsed.visible : false,
      seeded: typeof parsed.seeded === "boolean" ? parsed.seeded : false,
    };
  } catch {
    return null;
  }
}

function writePersisted(s: RetroState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

let state: RetroState = readPersisted() ?? { visible: false, seeded: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
  writePersisted(state);
}

function getState(): RetroState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setVisible(v: boolean): void {
    if (state.visible === v) return;
    state = { ...state, visible: v };
    emit();
  },

  toggle(): void {
    state = { ...state, visible: !state.visible };
    emit();
  },

  markSeeded(): void {
    if (state.seeded) return;
    state = { ...state, seeded: true };
    emit();
  },

  reset(): void {
    state = { visible: false, seeded: false };
    emit();
  },
};

export const retroStore = { getState, subscribe, ...actions };

export function useRetroStore<T>(selector: (s: RetroState) => T): T {
  return useSyncExternalStore(
    retroStore.subscribe,
    () => selector(retroStore.getState()),
    () => selector(retroStore.getState()),
  );
}
