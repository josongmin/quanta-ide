import { useSyncExternalStore } from "react";
import { coerce, DEFAULT_PREFERENCES, type Preferences, type TabStyle } from "./schema";
import { importLegacyLayoutPrefs, migrate } from "./migrations";

const STORAGE_KEY = "shell.preferences";

type WriteSource = "local" | "external";
type ExternalListener = (next: Preferences) => void;

function loadFromStorage(): Preferences {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;

  const legacy = importLegacyLayoutPrefs(localStorage);
  if (legacy) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    return legacy;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return migrate(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writeToStorage(next: Preferences) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / access errors
  }
}

function applyAttrs(next: Preferences) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-tab-style", next.layout.tabStyle);
}

let state: Preferences = loadFromStorage();
applyAttrs(state);

const listeners = new Set<() => void>();
const externalListeners = new Set<ExternalListener>();

function emit(source: WriteSource) {
  applyAttrs(state);
  writeToStorage(state);
  for (const l of listeners) l();
  if (source === "local") {
    for (const l of externalListeners) l(state);
  }
}

export const preferences = {
  get: (): Preferences => state,

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  /**
   * Sync-adapter hook. Fires only for `local` writes (user actions),
   * never for `external` writes (replay from disk) — avoids write-back loops.
   */
  subscribeExternal: (listener: ExternalListener): (() => void) => {
    externalListeners.add(listener);
    return () => { externalListeners.delete(listener); };
  },

  // ── layout (shell UI) ───────────────────────────────────────────────

  setTabStyle: (tabStyle: TabStyle): void => {
    if (state.layout.tabStyle === tabStyle) return;
    state = { ...state, layout: { ...state.layout, tabStyle } };
    emit("local");
  },

  // ── feature enable/disable ──────────────────────────────────────────

  setFeatureEnabled: (featureId: string, enabled: boolean): void => {
    const current = state.features.enabled[featureId];
    if (current === enabled) return;
    state = {
      ...state,
      features: {
        ...state.features,
        enabled: { ...state.features.enabled, [featureId]: enabled },
      },
    };
    emit("local");
  },

  // ── feature setting values ──────────────────────────────────────────

  setFeatureValue: (key: string, value: unknown): void => {
    if (state.features.values[key] === value) return;
    state = {
      ...state,
      features: {
        ...state.features,
        values: { ...state.features.values, [key]: value },
      },
    };
    emit("local");
  },

  resetFeatureValues: (): void => {
    state = {
      ...state,
      features: { ...state.features, values: {} },
    };
    emit("local");
  },

  resetFeatures: (): void => {
    state = {
      ...state,
      features: { enabled: {}, values: {} },
    };
    emit("local");
  },

  /**
   * Replace entire state from an external source (e.g. file watcher).
   * Does NOT fire `subscribeExternal` — that channel is for user writes only.
   */
  hydrate: (raw: unknown): void => {
    state = coerce(raw);
    emit("external");
  },
};

export function usePreferences<T>(selector: (s: Preferences) => T): T {
  return useSyncExternalStore(
    preferences.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
