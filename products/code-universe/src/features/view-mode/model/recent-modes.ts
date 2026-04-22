import { useSyncExternalStore } from "react";
import type { ViewMode } from "./store";
import { isKnownViewMode } from "./view-registry";

// View-mode MRU store
// --------------------------------------------------------------------
// Tracks the user's most-recently-switched-to view modes so the picker
// can surface a "최근" row at the top. Mirrors the shape of the palette
// recents store: opaque ids + localStorage persistence + copy-on-write.
//
// Unknown / renamed mode ids are filtered at load time — safer than
// writing a migration when registry ids shift.

const STORAGE_KEY = "cu:view-mode:recents:v1";
const MAX = 6;

interface State {
  ids: readonly ViewMode[];
}

function safe(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    localStorage.setItem("__cu_vm_probe__", "1");
    localStorage.removeItem("__cu_vm_probe__");
    return localStorage;
  } catch {
    return null;
  }
}

function loadInitial(): State {
  const s = safe();
  if (!s) return { ids: [] };
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return { ids: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ids: [] };
    const ids = parsed
      .filter((x): x is string => typeof x === "string")
      .filter(isKnownViewMode)
      .slice(0, MAX);
    return { ids };
  } catch {
    return { ids: [] };
  }
}

let state: State = loadInitial();
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}
function persist(): void {
  const s = safe();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state.ids));
  } catch {
    /* drop silently */
  }
}

export const recentModesStore = {
  getState(): State {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  record(id: ViewMode): void {
    const without = state.ids.filter(x => x !== id);
    const next: readonly ViewMode[] = [id, ...without].slice(0, MAX);
    if (next.length === state.ids.length && next.every((v, i) => v === state.ids[i])) return;
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

export function useRecentModes<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    recentModesStore.subscribe,
    () => selector(recentModesStore.getState()),
    () => selector(recentModesStore.getState()),
  );
}
