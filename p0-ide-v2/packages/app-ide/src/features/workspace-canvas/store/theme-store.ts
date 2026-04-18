import { useSyncExternalStore } from "react";

// Theme store (Batch 7 — power.themeSwitcher).
// -------------------------------------------------------------------
// Owns the active visual theme for the workspace canvas. The actual
// colour overrides are declared in CSS under `[data-ws-theme="..."]`
// scopes; this store only tracks which variant is active so the
// canvas container can render the attribute and consumers can read it.
//
// Persisted to localStorage so reloads keep the user's choice. Gated
// through `useFeature("power.themeSwitcher")` at the mount site — when
// the feature is disabled, callers should fall back to the "dark"
// baseline regardless of what the store says.

export type Theme = "dark" | "light" | "high-contrast";

const STORAGE_KEY = "quanta.canvas.theme.v1";
const ORDER: readonly Theme[] = ["dark", "light", "high-contrast"];
const DEFAULT_THEME: Theme = "dark";

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light" || v === "high-contrast";
}

function readPersisted(): Theme {
  try {
    const raw = typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed: unknown = JSON.parse(raw);
    if (isTheme(parsed)) return parsed;
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function writePersisted(theme: Theme): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // best-effort
  }
}

export interface ThemeState {
  theme: Theme;
}

let state: ThemeState = { theme: readPersisted() };
const listeners = new Set<() => void>();
function emit() { for (const l of [...listeners]) l(); }
function getState(): ThemeState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setTheme(t: Theme): void {
    if (state.theme === t) return;
    state = { theme: t };
    writePersisted(t);
    emit();
  },
  cycle(): void {
    const idx = ORDER.indexOf(state.theme);
    const next = ORDER[(idx + 1) % ORDER.length] ?? DEFAULT_THEME;
    if (state.theme === next) return;
    state = { theme: next };
    writePersisted(next);
    emit();
  },
};

export const themeStore = { getState, subscribe, ...actions };
export const THEMES: readonly Theme[] = ORDER;

export function useThemeStore<T>(selector: (s: ThemeState) => T): T {
  return useSyncExternalStore(
    themeStore.subscribe,
    () => selector(themeStore.getState()),
    () => selector(themeStore.getState()),
  );
}
