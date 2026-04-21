import { useSyncExternalStore } from "react";

/** Global ephemeral-UI state shared across widgets (palette, console, etc.). */
export interface UiBusState {
  paletteOpen: boolean;
  devConsoleOpen: boolean;
  hubOpen: boolean;
  rulesOpen: boolean;
  settingsOpen: boolean;
  dashboardOpen: boolean;
  selectedFeatureId?: string;
}

type UiBusListener = () => void;

let state: UiBusState = {
  paletteOpen: false,
  devConsoleOpen: false,
  hubOpen: false,
  rulesOpen: false,
  settingsOpen: false,
  dashboardOpen: false,
};

const listeners = new Set<UiBusListener>();
const emit = () => {
  for (const l of listeners) l();
};

export const uiBus = {
  /** Return current snapshot (non-reactive — prefer `useUiBus` in components). */
  get: (): UiBusState => state,

  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe: (l: UiBusListener): (() => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },

  /** Toggle the command palette. Pass explicit `open` to force a state. */
  togglePalette: (open?: boolean): void => {
    state = { ...state, paletteOpen: open ?? !state.paletteOpen };
    emit();
  },

  /** Toggle the dev console. Pass explicit `open` to force a state. */
  toggleDevConsole: (open?: boolean): void => {
    state = { ...state, devConsoleOpen: open ?? !state.devConsoleOpen };
    emit();
  },

  /** Toggle the feature hub panel. Pass explicit `open` to force a state. */
  toggleHub: (open?: boolean): void => {
    state = { ...state, hubOpen: open ?? !state.hubOpen };
    emit();
  },

  /** Toggle the agent rules modal. Pass explicit `open` to force a state. */
  toggleRules: (open?: boolean): void => {
    state = { ...state, rulesOpen: open ?? !state.rulesOpen };
    emit();
  },

  /** Toggle the settings page. Pass explicit `open` to force a state. */
  toggleSettings: (open?: boolean): void => {
    state = { ...state, settingsOpen: open ?? !state.settingsOpen };
    emit();
  },

  /** Toggle the dashboard overlay. Peer to settings — surfaces the
   *  aggregated 5-layer metrics view without opening a tab. */
  toggleDashboard: (open?: boolean): void => {
    state = { ...state, dashboardOpen: open ?? !state.dashboardOpen };
    emit();
  },

  /** Set the currently-inspected feature (used by Settings page deep-link). */
  selectFeature: (id?: string): void => {
    state = { ...state, selectedFeatureId: id };
    emit();
  },

  /** Close every panel / overlay tracked by the bus. */
  closeAll: (): void => {
    state = { ...state, paletteOpen: false, devConsoleOpen: false, hubOpen: false, rulesOpen: false, settingsOpen: false, dashboardOpen: false };
    emit();
  },
};

/** React hook — re-renders only when the selected slice changes. */
export function useUiBus<T>(selector: (s: UiBusState) => T): T {
  return useSyncExternalStore(uiBus.subscribe, () => selector(state), () => selector(state));
}
