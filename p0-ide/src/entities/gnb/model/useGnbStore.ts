import { create } from "zustand";

/** App types that can live inside a tab container. */
export type AppType = "home" | "ide" | "review" | "agent" | "quality" | "security" | "policy";

/** A single tab instance. */
export interface AppTab {
  id: string;
  app: AppType;
  label: string;
}

/** Legacy alias — maps old GnbTab values to new AppType. */
export type GnbTab = AppType;

let nextId = 1;
function genId(): string { return `tab-${nextId++}`; }

const APP_DEFAULTS: Record<AppType, string> = {
  home: "Home",
  ide: "IDE",
  review: "Review",
  agent: "Agent",
  quality: "Quality",
  security: "Security",
  policy: "Policy",
};

interface GnbState {
  tabs: AppTab[];
  activeTabId: string;

  /** Add a new tab with the given app type. */
  addTab: (app: AppType, label?: string) => void;
  /** Close a tab by id. If it's active, switch to neighbor. */
  closeTab: (id: string) => void;
  /** Switch to a tab. */
  setActiveTab: (id: string) => void;
  /** Rename a tab. */
  renameTab: (id: string, label: string) => void;

  /* ── Legacy compat ── */
  /** @deprecated use tabs + activeTabId */
  activeTab: GnbTab;
  /** @deprecated use addTab / setActiveTab */
  setTab: (tab: GnbTab) => void;
}

const homeTab: AppTab = { id: "tab-home", app: "home", label: "Home" };
const initialTab: AppTab = { id: genId(), app: "ide", label: "IDE" };

export const useGnbStore = create<GnbState>()((set, get) => ({
  tabs: [homeTab, initialTab],
  activeTabId: initialTab.id,

  addTab: (app, label) => {
    const tab: AppTab = { id: genId(), app, label: label ?? APP_DEFAULTS[app] };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    if (id === "tab-home") return; // home tab is permanent
    const idx = tabs.findIndex(t => t.id === id);
    const next = tabs.filter(t => t.id !== id);
    const newActive = id === activeTabId
      ? next[Math.min(idx, next.length - 1)].id
      : activeTabId;
    set({ tabs: next, activeTabId: newActive });
  },

  setActiveTab: (id) => { set({ activeTabId: id }); },

  renameTab: (id, label) => {
    set((s) => ({
      tabs: s.tabs.map(t => t.id === id ? { ...t, label } : t),
    }));
  },

  /* Legacy compat — computed on read via selector, placeholder here */
  activeTab: "ide" as GnbTab,
  setTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find(t => t.app === tab);
    if (existing) {
      set({ activeTabId: existing.id });
    } else {
      const newTab: AppTab = { id: genId(), app: tab, label: APP_DEFAULTS[tab] };
      set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTab.id }));
    }
  },
}));

/** Selector: derive activeTab (app type) from current tab id. */
export const selectActiveTab = (s: GnbState): GnbTab => {
  const active = s.tabs.find(t => t.id === s.activeTabId);
  return active?.app ?? "ide";
};
