import { useSyncExternalStore } from "react";

export type AgentActivity = "reading" | "editing" | "analyzing" | "idle";

export interface AgentPresence {
  agentId: string;
  label: string;
  color: number;
  focusFileId: string | null;
  activity: AgentActivity;
  trailFileIds?: readonly string[];
  cursorWorld?: { x: number; y: number };
  updatedAt: number;
}

export interface PresenceState {
  agents: readonly AgentPresence[];
}

let state: PresenceState = {
  agents: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): PresenceState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setAgents(list: readonly AgentPresence[]) {
    if (list === state.agents) return;
    state = { ...state, agents: list };
    emit();
  },

  updateAgent(id: string, patch: Partial<Omit<AgentPresence, "agentId">>) {
    let changed = false;
    const next = state.agents.map(a => {
      if (a.agentId !== id) return a;
      changed = true;
      return { ...a, ...patch, agentId: a.agentId };
    });
    if (!changed) return;
    state = { ...state, agents: next };
    emit();
  },

  removeAgent(id: string) {
    const next = state.agents.filter(a => a.agentId !== id);
    if (next.length === state.agents.length) return;
    state = { ...state, agents: next };
    emit();
  },
};

export const presenceStore = { getState, subscribe, ...actions };

export function usePresenceStore<T>(selector: (s: PresenceState) => T): T {
  return useSyncExternalStore(
    presenceStore.subscribe,
    () => selector(presenceStore.getState()),
    () => selector(presenceStore.getState()),
  );
}
