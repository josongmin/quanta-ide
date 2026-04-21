// URL router
// --------------------------------------------------------------------
// One hash-based router for the whole shell. Structure:
//
//   #/<slug>[/<path>][?<query>]
//
// where <slug> is the active tab's stable slug, <path> is tab-internal,
// and <query> is tab-internal view state. The shell owns <slug>; tab
// apps own <path> and <query> inside a scoped TabRoute context so
// they can't clobber the slug.
//
// Tauri-friendly: everything lives in `location.hash`, so no server
// rewrites and no pushState path juggling. Back/forward buttons map
// 1:1 to history entries via `pushState` / `replaceState`.

export interface ParsedRoute {
  slug: string;
  /** Path segments after the slug, e.g. `#/demo/a/b` → ["a", "b"]. */
  path: string[];
  /** Query portion of the hash. */
  query: Record<string, string>;
}

/** The route we synthesise when the hash is empty or unparseable. */
export const EMPTY_ROUTE: ParsedRoute = { slug: "", path: [], query: {} };

/** Parse `location.hash` (or an arbitrary string) into a ParsedRoute. */
export function parseHash(raw: string = typeof window === "undefined" ? "" : window.location.hash): ParsedRoute {
  // Strip leading "#" and any leading "/" — accept `#/a`, `#a`, `#/a/b`.
  let h = raw.startsWith("#") ? raw.slice(1) : raw;
  if (h.startsWith("/")) h = h.slice(1);
  if (!h) return EMPTY_ROUTE;

  const qIdx = h.indexOf("?");
  const pathPart = qIdx >= 0 ? h.slice(0, qIdx) : h;
  const queryPart = qIdx >= 0 ? h.slice(qIdx + 1) : "";

  const segs = pathPart.split("/").filter(Boolean).map(decodeURIComponent);
  const slug = segs[0] ?? "";
  const path = segs.slice(1);

  const query: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      if (!pair) continue;
      const eq = pair.indexOf("=");
      const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      const v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : "";
      if (k) query[k] = v;
    }
  }
  return { slug, path, query };
}

/** Serialise a ParsedRoute back to a hash string (with leading "#"). */
export function formatHash(route: ParsedRoute): string {
  if (!route.slug) return "";
  const segs = [route.slug, ...route.path].map(encodeURIComponent).join("/");
  const qs = formatQuery(route.query);
  return qs ? `#/${segs}?${qs}` : `#/${segs}`;
}

export function formatQuery(query: Record<string, string>): string {
  const entries = Object.entries(query).filter(([, v]) => v !== "" && v != null);
  if (entries.length === 0) return "";
  // Stable key order — keeps URLs diff-friendly and avoids ping-ponging
  // in the browser history when only the key order shifts.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

export type WriteMode = "push" | "replace";

/** Internal event name bubbled on same-document `writeHash` calls —
 *  `history.pushState`/`replaceState` do NOT fire `hashchange`, so we
 *  dispatch this so `subscribeHash` listeners still see our own writes. */
const INTERNAL_EVT = "quanta:hashchange";

/**
 * Write a route to `location.hash` via history API.
 *
 * `push` creates a new history entry (use for user-initiated navigation:
 *   tab switch, file selection, mode change).
 * `replace` overwrites the current entry (use for transient / frequent
 *   state: camera pose, hover, debounced drafts).
 *
 * Safe no-op when the target hash already equals the current — avoids
 * re-dispatching in sync loops.
 */
export function writeHash(route: ParsedRoute, mode: WriteMode = "replace"): void {
  if (typeof window === "undefined") return;
  const next = formatHash(route);
  const cur = window.location.hash;
  if (cur === next) return;
  const url = `${window.location.pathname}${window.location.search}${next || "#"}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  // Manually notify same-document listeners. `hashchange` only fires
  // when the browser itself changes the hash (user typing, back/forward,
  // `location.hash = ...`), never for history API writes.
  window.dispatchEvent(new Event(INTERNAL_EVT));
}

/**
 * Subscribe to hash changes from any source: back/forward, manual edit,
 * or our own `writeHash` calls. Return value unsubscribes.
 */
export function subscribeHash(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => fn();
  window.addEventListener("hashchange", handler);
  window.addEventListener("popstate", handler);
  window.addEventListener(INTERNAL_EVT, handler);
  return () => {
    window.removeEventListener("hashchange", handler);
    window.removeEventListener("popstate", handler);
    window.removeEventListener(INTERNAL_EVT, handler);
  };
}
