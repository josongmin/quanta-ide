import { useSyncExternalStore } from "react";

// Stickies store
// --------------------------------------------------------------------
// Map<entityId, { text, updatedAt, color }> with localStorage
// persistence. A "sticky" is a short free-text note pinned to an
// entity — for a hotspot, the user might write "refactor before
// Q3 ship", for a package "legacy, read-only". Unlike a comment
// thread, stickies are single-author and always visible when that
// entity is on screen.
//
// Persistence is global (not per-tabId) so opening the same
// workspace across multiple tabs shows the same notes. Capped at
// `MAX_STICKIES` so a runaway bug can't balloon localStorage.
//
// Editing state lives in the same store (`editingId`) rather than a
// separate slice — the overlay component reads one selector, and the
// two pieces of state always flip together (a sticky that just
// appeared via `N` should start in edit mode on the same render).

const STORAGE_KEY = "cu:stickies:v1";
const MAX_STICKIES = 500;
const DEFAULT_COLOR = "#fef08a"; // amber — classic post-it

export interface Sticky {
  text: string;
  color: string;
  updatedAt: number;
}

interface StickiesState {
  byEntityId: ReadonlyMap<string, Sticky>;
  /** id of the sticky being edited, or null when no editor is open. */
  editingId: string | null;
}

function safeStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    localStorage.setItem("__cu_stickies_probe__", "1");
    localStorage.removeItem("__cu_stickies_probe__");
    return localStorage;
  } catch {
    return null;
  }
}

function loadInitial(): StickiesState {
  const s = safeStorage();
  if (!s) return { byEntityId: new Map(), editingId: null };
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return { byEntityId: new Map(), editingId: null };
    const parsed = JSON.parse(raw) as Record<string, Sticky> | null;
    if (!parsed || typeof parsed !== "object") {
      return { byEntityId: new Map(), editingId: null };
    }
    const m = new Map<string, Sticky>();
    for (const [k, v] of Object.entries(parsed)) {
      if (
        v &&
        typeof v === "object" &&
        typeof (v as Sticky).text === "string" &&
        typeof (v as Sticky).color === "string"
      ) {
        m.set(k, {
          text: (v as Sticky).text,
          color: (v as Sticky).color,
          updatedAt: Number((v as Sticky).updatedAt ?? 0),
        });
      }
      if (m.size >= MAX_STICKIES) break;
    }
    return { byEntityId: m, editingId: null };
  } catch {
    return { byEntityId: new Map(), editingId: null };
  }
}

let state: StickiesState = loadInitial();
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}
function persist(): void {
  const s = safeStorage();
  if (!s) return;
  const obj: Record<string, Sticky> = {};
  for (const [k, v] of state.byEntityId) obj[k] = v;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota / private mode — drop silently */
  }
}

export const stickyStore = {
  getState(): StickiesState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Set or update the sticky on `entityId`. Empty `text` calls
   *  `remove` so the UI can't accumulate zero-text orphan notes. */
  set(entityId: string, text: string, color?: string): void {
    const trimmed = text;
    if (trimmed.trim() === "") {
      this.remove(entityId);
      return;
    }
    const prev = state.byEntityId.get(entityId);
    if (prev && prev.text === trimmed && (color === undefined || prev.color === color)) {
      return;
    }
    const next = new Map(state.byEntityId);
    next.set(entityId, {
      text: trimmed,
      color: color ?? prev?.color ?? DEFAULT_COLOR,
      updatedAt: Date.now(),
    });
    // Cap — drop the oldest when over the limit.
    if (next.size > MAX_STICKIES) {
      const oldestKey = [...next.entries()].sort(
        (a, b) => a[1].updatedAt - b[1].updatedAt,
      )[0]?.[0];
      if (oldestKey) next.delete(oldestKey);
    }
    state = { ...state, byEntityId: next };
    persist();
    emit();
  },
  remove(entityId: string): void {
    if (!state.byEntityId.has(entityId)) {
      // Even if we didn't have a persisted sticky, clear the
      // editing flag so the editor doesn't leave a ghost bubble.
      if (state.editingId === entityId) {
        state = { ...state, editingId: null };
        emit();
      }
      return;
    }
    const next = new Map(state.byEntityId);
    next.delete(entityId);
    const nextEditing = state.editingId === entityId ? null : state.editingId;
    state = { byEntityId: next, editingId: nextEditing };
    persist();
    emit();
  },
  get(entityId: string): Sticky | null {
    return state.byEntityId.get(entityId) ?? null;
  },
  startEditing(entityId: string): void {
    if (state.editingId === entityId) return;
    state = { ...state, editingId: entityId };
    emit();
  },
  stopEditing(): void {
    if (state.editingId === null) return;
    state = { ...state, editingId: null };
    emit();
  },
};

export function useStickies<T>(selector: (s: StickiesState) => T): T {
  return useSyncExternalStore(
    stickyStore.subscribe,
    () => selector(stickyStore.getState()),
    () => selector(stickyStore.getState()),
  );
}

export const DEFAULT_STICKY_COLOR = DEFAULT_COLOR;
