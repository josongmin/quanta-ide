import { useSyncExternalStore } from "react";

// Realtime cursors store — sibling to presence-store.
// Kept separate so a 20Hz cursor tick never wakes agent-presence subscribers.
// Not persisted: cursors are ephemeral by definition.

export interface CursorSnapshot {
  userId: string;
  color: string;
  label: string;
  worldX: number;
  worldY: number;
  updatedAt: number;
}

export interface CursorsState {
  cursors: readonly CursorSnapshot[];
}

let state: CursorsState = { cursors: [] };

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): CursorsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setCursor(userId: string, patch: Partial<Omit<CursorSnapshot, "userId">>) {
    const idx = state.cursors.findIndex(c => c.userId === userId);
    const now = Date.now();
    if (idx < 0) {
      const next: CursorSnapshot = {
        userId,
        color: patch.color ?? "#7dd3fc",
        label: patch.label ?? userId,
        worldX: patch.worldX ?? 0,
        worldY: patch.worldY ?? 0,
        updatedAt: patch.updatedAt ?? now,
      };
      state = { cursors: [...state.cursors, next] };
    } else {
      const curr = state.cursors[idx]!;
      const merged: CursorSnapshot = {
        ...curr,
        ...patch,
        userId: curr.userId,
        updatedAt: patch.updatedAt ?? now,
      };
      // Short-circuit no-op ticks — cursor transport emits at 20 Hz even
      // when the cursor hasn't moved; waking every subscriber per tick is
      // pure cost.
      if (
        merged.color === curr.color &&
        merged.label === curr.label &&
        merged.worldX === curr.worldX &&
        merged.worldY === curr.worldY
      ) return;
      const arr = state.cursors.slice();
      arr[idx] = merged;
      state = { cursors: arr };
    }
    emit();
  },

  removeCursor(userId: string) {
    const next = state.cursors.filter(c => c.userId !== userId);
    if (next.length === state.cursors.length) return;
    state = { cursors: next };
    emit();
  },

  reset() {
    if (state.cursors.length === 0) return;
    state = { cursors: [] };
    emit();
  },
};

export const cursorsStore = { getState, subscribe, ...actions };

export function useCursorsStore<T>(selector: (s: CursorsState) => T): T {
  return useSyncExternalStore(
    cursorsStore.subscribe,
    () => selector(cursorsStore.getState()),
    () => selector(cursorsStore.getState()),
  );
}
