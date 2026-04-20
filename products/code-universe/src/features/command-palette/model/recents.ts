import { useSyncExternalStore } from "react";

// Command palette recent-entity log
// --------------------------------------------------------------------
// MRU list of entity ids the user has committed to via the palette.
// Shown when the input is empty so the palette opens as a quick
// "jump back" menu rather than a blank state.
//
// Persistence: localStorage under `cu:palette:recents:v1`. Capped at
// `MAX_RECENTS` so the store stays constant-size across a long
// session. Stored as raw ids — we resolve against the current entity
// tree at render time, so a tree rebuild that prunes ids simply
// drops them from the display without needing a migration.

const STORAGE_KEY = "cu:palette:recents:v1";
const MAX_RECENTS = 12;

interface RecentsState {
  ids: readonly string[];
}

function safeStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    localStorage.setItem("__cu_recents_probe__", "1");
    localStorage.removeItem("__cu_recents_probe__");
    return localStorage;
  } catch {
    return null;
  }
}

function loadInitial(): RecentsState {
  const s = safeStorage();
  if (!s) return { ids: [] };
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return { ids: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ids: [] };
    const ids = parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS);
    return { ids };
  } catch {
    return { ids: [] };
  }
}

let state: RecentsState = loadInitial();
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}
function persist(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state.ids));
  } catch {
    /* quota / private mode — drop silently */
  }
}

export const paletteRecentsStore = {
  getState(): RecentsState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  record(id: string): void {
    // Move-to-front: drop any prior occurrence, prepend, cap to MAX.
    // Copy-on-write so subscribers see a fresh ids reference.
    const without = state.ids.filter(x => x !== id);
    const next = [id, ...without].slice(0, MAX_RECENTS);
    if (
      next.length === state.ids.length &&
      next.every((v, i) => v === state.ids[i])
    ) {
      return;
    }
    state = { ids: next };
    persist();
    emit();
  },
  clear(): void {
    if (state.ids.length === 0) return;
    state = { ids: [] };
    persist();
    emit();
  },
};

export function usePaletteRecents<T>(selector: (s: RecentsState) => T): T {
  return useSyncExternalStore(
    paletteRecentsStore.subscribe,
    () => selector(paletteRecentsStore.getState()),
    () => selector(paletteRecentsStore.getState()),
  );
}
