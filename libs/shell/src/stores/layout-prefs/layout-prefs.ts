import { useSyncExternalStore } from "react";

export type TabStyle = "chrome" | "linear";

export interface LayoutPrefs {
  tabStyle: TabStyle;
}

const STORAGE_KEY = "shell.layout-prefs";
const DEFAULT: LayoutPrefs = { tabStyle: "chrome" };

function load(): LayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<LayoutPrefs>;
    return {
      tabStyle: parsed.tabStyle === "linear" ? "linear" : "chrome",
    };
  } catch {
    return DEFAULT;
  }
}

function save(state: LayoutPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / access errors
  }
}

let state: LayoutPrefs = load();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

// Reflect current tab-style onto <html> so any widget can key off it without subscribing.
function applyAttr(s: LayoutPrefs) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-tab-style", s.tabStyle);
}
applyAttr(state);

export const layoutPrefs = {
  get: (): LayoutPrefs => state,

  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },

  setTabStyle: (style: TabStyle): void => {
    if (state.tabStyle === style) return;
    state = { ...state, tabStyle: style };
    applyAttr(state);
    save(state);
    emit();
  },
};

export function useLayoutPrefs<T>(selector: (s: LayoutPrefs) => T): T {
  return useSyncExternalStore(layoutPrefs.subscribe, () => selector(state), () => selector(state));
}
