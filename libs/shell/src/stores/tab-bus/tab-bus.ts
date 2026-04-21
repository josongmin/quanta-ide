import { useSyncExternalStore } from "react";
import type { TabApp } from "@quanta/shell-contract";

export type { TabApp };

export interface OpenTabRequest {
  id: number;
  app: TabApp;
  label: string;
}

interface TabBusState {
  pending: OpenTabRequest | null;
}

let state: TabBusState = { pending: null };
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

let counter = 0;

export const tabBus = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  open(app: TabApp, label: string) {
    counter += 1;
    state = { pending: { id: counter, app, label } };
    emit();
  },
  consume() {
    if (!state.pending) return null;
    const req = state.pending;
    state = { pending: null };
    emit();
    return req;
  },
};

export function useTabBus<T>(selector: (s: TabBusState) => T): T {
  return useSyncExternalStore(tabBus.subscribe, () => selector(state), () => selector(state));
}
