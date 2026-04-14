import { useSyncExternalStore } from "react";

export type IconPackId =
  | "custom"
  | "lucide"
  | "tabler"
  | "phosphor"
  | "phosphor-duotone"
  | "heroicons-outline"
  | "heroicons-solid"
  | "remix-line"
  | "remix-fill"
  | "carbon"
  | "mono"
  | "feather"
  | "iconoir"
  | "radix";

const VALID_PACKS: IconPackId[] = [
  "custom",
  "lucide",
  "tabler",
  "phosphor",
  "phosphor-duotone",
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

function loadInitial(): IconPackId {
  if (typeof window === "undefined") return DEFAULT_PACK;
  const saved = window.localStorage.getItem(STORAGE_KEY);
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, pack);
    }
    for (const l of listeners) l();
  },
};

export function useIconPack(): IconPackId {
  return useSyncExternalStore(iconPackStore.subscribe, () => current, () => current);
}
