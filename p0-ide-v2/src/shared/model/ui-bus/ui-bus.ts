import { useSyncExternalStore } from "react";

export interface UiBusState {
  paletteOpen: boolean;
  devConsoleOpen: boolean;
  hubOpen: boolean;
  rulesOpen: boolean;
  settingsOpen: boolean;
  selectedFeatureId?: string;
}

let state: UiBusState = {
  paletteOpen: false,
  devConsoleOpen: false,
  hubOpen: false,
  rulesOpen: false,
  settingsOpen: false,
};

const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const uiBus = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  togglePalette: (open?: boolean) => {
    state = { ...state, paletteOpen: open ?? !state.paletteOpen };
    emit();
  },
  toggleDevConsole: (open?: boolean) => {
    state = { ...state, devConsoleOpen: open ?? !state.devConsoleOpen };
    emit();
  },
  toggleHub: (open?: boolean) => {
    state = { ...state, hubOpen: open ?? !state.hubOpen };
    emit();
  },
  toggleRules: (open?: boolean) => {
    state = { ...state, rulesOpen: open ?? !state.rulesOpen };
    emit();
  },
  toggleSettings: (open?: boolean) => {
    state = { ...state, settingsOpen: open ?? !state.settingsOpen };
    emit();
  },
  selectFeature: (id?: string) => {
    state = { ...state, selectedFeatureId: id };
    emit();
  },
  closeAll: () => {
    state = { ...state, paletteOpen: false, devConsoleOpen: false, hubOpen: false, rulesOpen: false, settingsOpen: false };
    emit();
  },
};

export function useUiBus<T>(selector: (s: UiBusState) => T): T {
  return useSyncExternalStore(uiBus.subscribe, () => selector(state), () => selector(state));
}
