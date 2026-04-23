import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppKind, TabDescriptor } from "@quanta/shell-contract";
import { parseHash, subscribeHash, writeHash } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

export interface TabState {
  tabs: TabDescriptor[];
  activeId: string;
  homeOpen: boolean;
}

/**
 * Pick a stable slug for a descriptor. Callers can set `slug` explicitly
 * for the five hardcoded initial tabs; dynamically opened tabs fall back
 * to `<app>` suffixed with `-2`, `-3`, … to stay unique across siblings.
 */
function ensureSlug(descriptor: TabDescriptor, existing: TabDescriptor[]): string {
  if (descriptor.slug) return descriptor.slug;
  const base = descriptor.app;
  const used = new Set(existing.map((t) => t.slug).filter((s): s is string => !!s));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Normalise initial tabs — fill in any missing slugs so URL routing
 *  works without callers having to remember every slot. */
function hydrateSlugs(tabs: TabDescriptor[]): TabDescriptor[] {
  const out: TabDescriptor[] = [];
  for (const t of tabs) out.push({ ...t, slug: ensureSlug(t, out) });
  return out;
}

export function useTabManager(initialTabs: TabDescriptor[]) {
  const [tabs, setTabs] = useState<TabDescriptor[]>(() => hydrateSlugs(initialTabs));
  const [homeOpen, setHomeOpen] = useState(false);

  // Seed activeId from the URL when the first parse matches a known tab.
  const [activeId, setActiveId] = useState<string>(() => {
    const hydrated = hydrateSlugs(initialTabs);
    const route = parseHash();
    if (route.slug) {
      const match = hydrated.find((t) => t.slug === route.slug);
      if (match) return match.id;
    }
    return hydrated[0]?.id ?? "";
  });

  // Keep a ref to tabs so hashchange listener can read the latest list
  // without re-subscribing on every tab mutation.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const selectTab = useCallback((id: string) => {
    setHomeOpen(false);
    setActiveId(id);
  }, []);

  const openTab = useCallback((app: AppKind, label: string) => {
    setHomeOpen(false);
    const id = `t${Date.now()}`;
    setTabs((prev) => {
      const partial: TabDescriptor = { id, app, label };
      const slug = ensureSlug(partial, prev);
      return [...prev, { ...partial, slug }];
    });
    setActiveId(id);
  }, []);

  const addTab = useCallback(() => {
    openTab("new-tab", "New Tab");
  }, [openTab]);

  const toggleHome = useCallback(() => {
    setHomeOpen((o) => !o);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) =>
        id === cur && next.length > 0 ? next[next.length - 1].id : cur,
      );
      return next;
    });
  }, []);

  // tab-bus open requests (e.g. feature-registry commands).
  useEffect(() => {
    return tabBus.subscribe(() => {
      const req = tabBus.consume();
      if (!req) return;
      const id = `t${Date.now()}-${req.id}`;
      setTabs((prev) => {
        const partial: TabDescriptor = { id, app: req.app, label: req.label };
        const slug = ensureSlug(partial, prev);
        writeHash({ slug, path: req.route?.path ?? [], query: req.route?.query ?? {} }, "push");
        return [...prev, { ...partial, slug }];
      });
      setActiveId(id);
    });
  }, []);

  // URL → activeId (external changes: back/forward, manual paste).
  useEffect(() => {
    return subscribeHash(() => {
      const route = parseHash();
      if (!route.slug) return;
      const match = tabsRef.current.find((t) => t.slug === route.slug);
      if (match && match.id !== activeIdRef.current) {
        setHomeOpen(false);
        setActiveId(match.id);
      }
    });
  }, []);

  // activeId → URL (internal changes from selectTab/openTab).
  // Only touch the slug portion; leave path/query alone so the tab app's
  // own useTabRoute writes survive a slug-only sync.
  // First write is `replace` (initial sync), subsequent are `push` so
  // back/forward works across user-initiated tab switches.
  const didFirstSync = useRef(false);
  useEffect(() => {
    const tab = tabs.find((t) => t.id === activeId);
    if (!tab?.slug) return;
    const cur = parseHash();
    // If the hash already matches the active tab's slug, don't write.
    // This handles the initial mount where we seeded activeId FROM the
    // hash and would otherwise replace identical state.
    if (cur.slug === tab.slug) {
      didFirstSync.current = true;
      return;
    }
    // Tab switch → reset path/query; keeping them would carry another
    // tab's view state into this one (wrong mode, stale selection).
    const nextRoute = { slug: tab.slug, path: [], query: {} };
    writeHash(nextRoute, didFirstSync.current ? "push" : "replace");
    didFirstSync.current = true;
  }, [activeId, tabs]);

  const state: TabState = useMemo(
    () => ({ tabs, activeId, homeOpen }),
    [tabs, activeId, homeOpen],
  );

  return { state, openTab, addTab, closeTab, selectTab, toggleHome };
}
