import { useEffect, useState } from "react";
import type { AppKind, TabDescriptor } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

export interface TabState {
  tabs: TabDescriptor[];
  activeId: string;
  homeOpen: boolean;
}

export function useTabManager(initialTabs: TabDescriptor[]) {
  const [tabs, setTabs] = useState<TabDescriptor[]>(initialTabs);
  const [activeId, setActiveId] = useState<string>(initialTabs[0]?.id ?? "");
  const [homeOpen, setHomeOpen] = useState(false);

  const selectTab = (id: string) => {
    setHomeOpen(false);
    setActiveId(id);
  };

  /** Open a specific app kind in a new tab. */
  const openTab = (app: AppKind, label: string) => {
    setHomeOpen(false);
    const id = `t${Date.now()}`;
    setTabs((prev) => [...prev, { id, app, label }]);
    setActiveId(id);
  };

  /** Add a blank "new-tab" tab (used by the [+] button in the topbar). */
  const addTab = () => {
    openTab("new-tab", "New Tab");
  };

  const toggleHome = () => {
    setHomeOpen((o) => !o);
  };

  const closeTab = (id: string) => {
    let next: TabDescriptor[] = [];
    setTabs((prev) => {
      next = prev.filter((t) => t.id !== id);
      return next;
    });
    setActiveId((cur) =>
      id === cur && next.length > 0 ? next[next.length - 1].id : cur,
    );
  };

  // Listen for tab-bus open requests (from feature-registry commands etc.)
  useEffect(() => {
    return tabBus.subscribe(() => {
      const req = tabBus.consume();
      if (!req) return;
      const id = `t${Date.now()}-${req.id}`;
      setTabs((prev) => [...prev, { id, app: req.app, label: req.label }]);
      setActiveId(id);
    });
  }, []);

  const state: TabState = { tabs, activeId, homeOpen };

  return { state, openTab, addTab, closeTab, selectTab, toggleHome };
}
