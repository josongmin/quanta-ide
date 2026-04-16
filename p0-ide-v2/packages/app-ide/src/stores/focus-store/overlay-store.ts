export interface OverlayState {
  simulateOpen: boolean;
  contextInjectOpen: boolean;
  firewallOpen: boolean;
}

export interface OverlayStore {
  get(): OverlayState;
  subscribe(l: () => void): () => void;
  toggleSimulate(open?: boolean): void;
  toggleContextInject(open?: boolean): void;
  toggleFirewall(open?: boolean): void;
}

export function createOverlayStore(notify: () => void): OverlayStore {
  let state: OverlayState = {
    simulateOpen: false,
    contextInjectOpen: false,
    firewallOpen: false,
  };
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const l of listeners) l();
    notify();
  };

  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    toggleSimulate(open) {
      state = { ...state, simulateOpen: open ?? !state.simulateOpen };
      emit();
    },
    toggleContextInject(open) {
      state = { ...state, contextInjectOpen: open ?? !state.contextInjectOpen };
      emit();
    },
    toggleFirewall(open) {
      state = { ...state, firewallOpen: open ?? !state.firewallOpen };
      emit();
    },
  };
}
