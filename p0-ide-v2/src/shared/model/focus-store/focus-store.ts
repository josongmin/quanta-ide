import { useSyncExternalStore } from "react";

export type InspectorMode = "overview" | "flow" | "blast" | "incidents" | "behavior" | "ownership";

export interface FocusState {
  mode: InspectorMode;
  flowPathId?: string;
  scrollToLine?: number;
  simulateOpen: boolean;
  contextInjectOpen: boolean;
  firewallOpen: boolean;
}

let state: FocusState = {
  mode: "overview",
  simulateOpen: false,
  contextInjectOpen: false,
  firewallOpen: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const focusStore = {
  get: (): FocusState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setMode: (mode: InspectorMode, extra?: Partial<FocusState>) => {
    state = { ...state, mode, ...extra };
    emit();
  },
  openFlow: (pathId: string) => {
    state = { ...state, mode: "flow", flowPathId: pathId };
    emit();
  },
  jumpTo: (line: number) => {
    state = { ...state, scrollToLine: line };
    emit();
    queueMicrotask(() => {
      state = { ...state, scrollToLine: undefined };
      emit();
    });
  },
  toggleSimulate: (open?: boolean) => {
    state = { ...state, simulateOpen: open ?? !state.simulateOpen };
    emit();
  },
  toggleContextInject: (open?: boolean) => {
    state = { ...state, contextInjectOpen: open ?? !state.contextInjectOpen };
    emit();
  },
  toggleFirewall: (open?: boolean) => {
    state = { ...state, firewallOpen: open ?? !state.firewallOpen };
    emit();
  },
};

export function useFocusStore<T>(selector: (s: FocusState) => T): T {
  return useSyncExternalStore(focusStore.subscribe, () => selector(state), () => selector(state));
}
