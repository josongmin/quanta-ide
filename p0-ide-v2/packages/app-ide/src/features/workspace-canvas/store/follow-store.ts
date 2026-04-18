import { useSyncExternalStore } from "react";

// Follow-mode store: the id of the user currently being followed, or null.
// Kept tiny and separate from presence/cursors so they can tick freely
// without waking follow-subscribers.

export interface FollowState {
  targetUserId: string | null;
}

let state: FollowState = { targetUserId: null };

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): FollowState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  start(userId: string) {
    if (state.targetUserId === userId) return;
    state = { targetUserId: userId };
    emit();
  },
  stop() {
    if (state.targetUserId === null) return;
    state = { targetUserId: null };
    emit();
  },
  toggle(userId: string) {
    if (state.targetUserId === userId) {
      actions.stop();
    } else {
      actions.start(userId);
    }
  },
};

export const followStore = { getState, subscribe, ...actions };

export function useFollowStore<T>(selector: (s: FollowState) => T): T {
  return useSyncExternalStore(
    followStore.subscribe,
    () => selector(followStore.getState()),
    () => selector(followStore.getState()),
  );
}
