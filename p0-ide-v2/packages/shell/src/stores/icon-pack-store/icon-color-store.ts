import { useSyncExternalStore } from "react";

export interface IconColorOption {
  id: string;
  label: string;
  value: string | null;
}

export const ICON_COLOR_OPTIONS: IconColorOption[] = [
  { id: "default", label: "Accent", value: null },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "cyan", label: "Cyan", value: "#06b6d4" },
  { id: "green", label: "Green", value: "#10b981" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "slate", label: "Slate", value: "#64748b" },
];

const STORAGE_KEY = "p0-ide-v2:icon-color";
const DEFAULT_ID = "default";

// Safari private mode — see icon-pack-store for background. Every touch of
// `window.localStorage` is wrapped so a thrown `SecurityError` silently
// drops us into in-memory-only mode instead of crashing shell bootstrap.
function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Private-mode quota / SecurityError — keep running in memory.
  }
}

function loadInitial(): string {
  const saved = safeGet(STORAGE_KEY);
  if (saved && ICON_COLOR_OPTIONS.some((o) => o.id === saved)) return saved;
  return DEFAULT_ID;
}

let current: string = loadInitial();
const listeners = new Set<() => void>();

export const iconColorStore = {
  get: (): string => current,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  set: (id: string) => {
    if (id === current) return;
    if (!ICON_COLOR_OPTIONS.some((o) => o.id === id)) return;
    current = id;
    safeSet(STORAGE_KEY, id);
    for (const l of listeners) l();
  },
};

export function useIconColor(): string {
  return useSyncExternalStore(iconColorStore.subscribe, () => current, () => current);
}

export function resolveIconColor(id: string): string | null {
  return ICON_COLOR_OPTIONS.find((o) => o.id === id)?.value ?? null;
}
