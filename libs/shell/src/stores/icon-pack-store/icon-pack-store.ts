import { useSyncExternalStore } from "react";
import type { IconPackId } from "@quanta/shell-contract";

export type { IconPackId };

const VALID_PACKS: IconPackId[] = [
  "custom",
  "material",
  "seti",
  "lucide",
  "tabler",
  "phosphor",
  "phosphor-duotone",
  "phosphor-bold",
  "phosphor-fill",
  "heroicons-outline",
  "heroicons-solid",
  "remix-line",
  "remix-fill",
  "carbon",
  "mono",
  "feather",
  "iconoir",
  "radix",
];

const STORAGE_KEY = "p0-ide-v2:icon-pack";
const DEFAULT_PACK: IconPackId = "custom";

// Safari private mode throws `SecurityError` the moment we touch
// `window.localStorage` — including at module-evaluation time, which used to
// nuke the whole shell import chain. These helpers centralize the guard so
// every read/write degrades to in-memory-only behavior silently.
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

function loadInitial(): IconPackId {
  const saved = safeGet(STORAGE_KEY);
  if (saved && (VALID_PACKS as string[]).includes(saved)) {
    return saved as IconPackId;
  }
  return DEFAULT_PACK;
}

let current: IconPackId = loadInitial();
const listeners = new Set<() => void>();

export const iconPackStore = {
  get: (): IconPackId => current,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  set: (pack: IconPackId) => {
    if (pack === current) return;
    current = pack;
    safeSet(STORAGE_KEY, pack);
    for (const l of listeners) l();
  },
};

export function useIconPack(): IconPackId {
  return useSyncExternalStore(iconPackStore.subscribe, () => current, () => current);
}
