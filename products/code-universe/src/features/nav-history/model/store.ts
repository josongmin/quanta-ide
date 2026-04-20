import { useSyncExternalStore } from "react";
import type { LodLevel } from "@quanta/canvas-engine";

// Navigation history store
// --------------------------------------------------------------------
// Browser-style back/forward stack over (tier, selectedId) pairs.
// Every user-driven navigation (drill, palette commit, breadcrumb
// click, minimap jump) pushes a new entry. Alt+← pops to the
// previous entry, Alt+→ re-advances.
//
// "User-driven" vs "programmatic":
//   - push() is called by actions that should record in history.
//   - When back()/forward() restores a state, it dispatches the
//     restoration via a one-shot `suppressNextPush` flag so the
//     listener that would otherwise push again NO-OPs. Without this
//     guard, back() would push the restored state as a new entry
//     and the user could never actually step back — they'd loop
//     between two alternating versions.
//
// The store is UI-agnostic: it holds the data + cursor + suppress
// flag. A thin hook (`useNavHistoryBindings`) wires the store to
// `tierStore` + `entityStore` on one side and the keyboard on the
// other.

export interface NavEntry {
  tier: LodLevel;
  selectedId: string | null;
}

interface NavState {
  entries: readonly NavEntry[];
  /** Index of the currently-active entry. -1 when no entries. */
  cursor: number;
}

const MAX_ENTRIES = 100;

let state: NavState = { entries: [], cursor: -1 };
let suppressNextPush = false;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

function sameEntry(a: NavEntry | undefined, b: NavEntry): boolean {
  return !!a && a.tier === b.tier && a.selectedId === b.selectedId;
}

export const navHistoryStore = {
  getState(): NavState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  push(entry: NavEntry): void {
    // Back/forward restoration path — consume the suppress flag and
    // return without mutating history.
    if (suppressNextPush) {
      suppressNextPush = false;
      return;
    }
    const cur = state.entries[state.cursor];
    // De-dupe consecutive identical pushes (e.g. a tier change that
    // keeps the same selection fires multiple subscriber events).
    if (sameEntry(cur, entry)) return;
    // Any pending "forward" entries are dropped when the user takes
    // a fresh branch — matches browser history semantics exactly.
    const truncated = state.entries.slice(0, state.cursor + 1);
    const appended = [...truncated, entry];
    const trimmed =
      appended.length > MAX_ENTRIES
        ? appended.slice(appended.length - MAX_ENTRIES)
        : appended;
    state = { entries: trimmed, cursor: trimmed.length - 1 };
    emit();
  },
  /** Step back. Returns the entry to restore, or null if unavailable. */
  back(): NavEntry | null {
    if (state.cursor <= 0) return null;
    const nextCursor = state.cursor - 1;
    const target = state.entries[nextCursor];
    if (!target) return null;
    state = { ...state, cursor: nextCursor };
    suppressNextPush = true;
    emit();
    return target;
  },
  /** Step forward. Returns the entry to restore, or null if at HEAD. */
  forward(): NavEntry | null {
    if (state.cursor >= state.entries.length - 1) return null;
    const nextCursor = state.cursor + 1;
    const target = state.entries[nextCursor];
    if (!target) return null;
    state = { ...state, cursor: nextCursor };
    suppressNextPush = true;
    emit();
    return target;
  },
  canGoBack(): boolean {
    return state.cursor > 0;
  },
  canGoForward(): boolean {
    return state.cursor >= 0 && state.cursor < state.entries.length - 1;
  },
  clear(): void {
    if (state.entries.length === 0) return;
    state = { entries: [], cursor: -1 };
    emit();
  },
};

export function useNavHistory<T>(selector: (s: NavState) => T): T {
  return useSyncExternalStore(
    navHistoryStore.subscribe,
    () => selector(navHistoryStore.getState()),
    () => selector(navHistoryStore.getState()),
  );
}
