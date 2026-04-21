import { useEffect, useSyncExternalStore } from "react";
import { subscribeRepoRoot } from "../../../shared/api/repo-root";
import { requestSource, type SourceResult } from "./loader";

// Source cache
// --------------------------------------------------------------------
// Tiny key-value store keyed by fileId, holding load status + text. A
// card mounts -> calls `useFileSource(id)` -> store fires a batched
// request -> result lands -> subscribers re-render. Repo-root flips
// invalidate the entire cache (different filesystem = stale paths).
//
// Kept intentionally external (not React state) so the Pixi-adjacent
// overlay can mount/unmount cards on zoom without losing in-flight
// requests, and so a second card asking for the same fileId piggy-
// backs on the first load.

export type SourceEntry =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; source: string }
  | { status: "empty" }
  | { status: "error"; message: string };

const cache = new Map<string, SourceEntry>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function toEntry(r: SourceResult): SourceEntry {
  if (r.ok) return { status: "ready", source: r.source };
  if (r.reason === "empty") return { status: "empty" };
  if (r.reason === "no-root") return { status: "error", message: "no repo root" };
  return { status: "error", message: r.error?.message ?? "fetch error" };
}

function kick(fileId: string): void {
  const existing = cache.get(fileId);
  if (existing && existing.status !== "idle") return;
  cache.set(fileId, { status: "loading" });
  emit();
  void requestSource(fileId).then(result => {
    cache.set(fileId, toEntry(result));
    emit();
  });
}

// Reset the whole cache on repo swap. The ids encode paths relative
// to a specific root, so re-using them across roots would either miss
// or (worse) serve content from the previous workspace.
subscribeRepoRoot(() => {
  if (cache.size === 0) return;
  cache.clear();
  emit();
});

function getEntry(fileId: string): SourceEntry {
  return cache.get(fileId) ?? { status: "idle" };
}

export function useFileSource(fileId: string): SourceEntry {
  // Snapshot has to be stable between renders when content hasn't
  // changed, so `getEntry` returns the same Map-stored reference as
  // long as the store hasn't emitted. The default fallback object is
  // a module constant for the same reason.
  const entry = useSyncExternalStore(
    subscribe,
    () => getEntry(fileId),
    () => getEntry(fileId),
  );

  useEffect(() => {
    if (entry.status === "idle") kick(fileId);
  }, [fileId, entry.status]);

  return entry;
}

/** Test / host hook — drop a specific id's cached state without
 *  trashing sibling entries. */
export function invalidateFileSource(fileId: string): void {
  if (!cache.has(fileId)) return;
  cache.delete(fileId);
  emit();
}
