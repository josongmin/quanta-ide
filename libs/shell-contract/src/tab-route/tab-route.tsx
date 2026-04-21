import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  parseHash,
  subscribeHash,
  writeHash,
  type WriteMode,
} from "../url-router";

// TabRoute context
// --------------------------------------------------------------------
// Scoped URL routing for a single tab app. The shell owns the `slug`
// portion; this context hands each tab app read/write access to its
// own path segments + query params without letting it clobber the
// slug or another tab's state.
//
// Writes go through writeHash (which bubbles a synthetic event), and
// our own subscribeHash listener sees both external hashchange AND
// our writes, keeping this context the single source of truth.

export interface TabRoute {
  /** Path segments after the slug. */
  path: string[];
  /** Query params as key → value. */
  query: Record<string, string>;
}

export interface TabRouteAPI extends TabRoute {
  /** Replace the path segments. `push` default — path changes are usually
   *  meaningful navigation (file open, page switch) and should show up
   *  in back/forward. */
  setPath(path: string[], mode?: WriteMode): void;
  /** Replace the full query map. `replace` default — callers that want
   *  a new history entry must opt in explicitly. */
  setQuery(query: Record<string, string>, mode?: WriteMode): void;
  /** Patch specific query keys; `undefined` / `""` removes them. */
  patchQuery(patch: Record<string, string | undefined>, mode?: WriteMode): void;
}

const TabRouteCtx = createContext<TabRouteAPI | null>(null);

const EMPTY: TabRoute = { path: [], query: {} };

function sliceForSlug(slug: string): TabRoute {
  const r = parseHash();
  if (r.slug !== slug) return EMPTY;
  return { path: r.path, query: r.query };
}

function samePath(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function sameQuery(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export interface TabRouteProviderProps {
  /** Slug of the ACTIVE tab. The provider only surfaces the hash slice
   *  when the current hash's slug matches — prevents one tab's state
   *  from leaking into another during a tab switch. */
  slug: string;
  children: ReactNode;
}

export function TabRouteProvider({ slug, children }: TabRouteProviderProps) {
  const [snap, setSnap] = useState<TabRoute>(() => sliceForSlug(slug));
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const slugRef = useRef(slug);
  slugRef.current = slug;

  // Re-slice on slug change (tab switched) and on any hash event.
  useEffect(() => {
    const resync = () => {
      const next = sliceForSlug(slugRef.current);
      const cur = snapRef.current;
      if (samePath(cur.path, next.path) && sameQuery(cur.query, next.query)) {
        return;
      }
      setSnap(next);
    };
    resync();
    return subscribeHash(resync);
  }, [slug]);

  const setPath = useCallback((path: string[], mode: WriteMode = "push") => {
    const cur = parseHash();
    if (cur.slug !== slugRef.current) return;
    writeHash({ slug: cur.slug, path, query: cur.query }, mode);
  }, []);

  const setQuery = useCallback(
    (query: Record<string, string>, mode: WriteMode = "replace") => {
      const cur = parseHash();
      if (cur.slug !== slugRef.current) return;
      writeHash({ slug: cur.slug, path: cur.path, query }, mode);
    },
    [],
  );

  const patchQuery = useCallback(
    (patch: Record<string, string | undefined>, mode: WriteMode = "replace") => {
      const cur = parseHash();
      if (cur.slug !== slugRef.current) return;
      const nextQuery: Record<string, string> = { ...cur.query };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") delete nextQuery[k];
        else nextQuery[k] = v;
      }
      writeHash({ slug: cur.slug, path: cur.path, query: nextQuery }, mode);
    },
    [],
  );

  const api = useMemo<TabRouteAPI>(
    () => ({
      path: snap.path,
      query: snap.query,
      setPath,
      setQuery,
      patchQuery,
    }),
    [snap, setPath, setQuery, patchQuery],
  );

  return <TabRouteCtx.Provider value={api}>{children}</TabRouteCtx.Provider>;
}

/**
 * Access the current tab's route — path segments + query. Returns a
 * no-op stub when used outside a provider so bare-rendered apps
 * (Storybook, tests) don't crash.
 */
export function useTabRoute(): TabRouteAPI {
  const ctx = useContext(TabRouteCtx);
  if (ctx) return ctx;
  return FALLBACK;
}

const FALLBACK: TabRouteAPI = {
  path: [],
  query: {},
  setPath: () => {},
  setQuery: () => {},
  patchQuery: () => {},
};
