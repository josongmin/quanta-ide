import { workspaceCanvasStore } from "../store/workspace-canvas-store";
import { loadGroundDataBatch } from "../data/loaders";

// Batch coordinator for ground-data fetches.
// -------------------------------------------------------------------
// Problem: when the user zooms into ground LOD, 10-20 GroundCards
// mount in the same render tick. A naive per-card fetch produces
// 10-20 parallel HTTP requests, 10-20 setGroundLoading emits, and
// 10-20 setGroundData emits — each of which re-invokes every
// useSyncExternalStore subscriber.
//
// Solution: during one microtask window, collect all requested ids,
// fire ONE /__repo/file/batch POST, and distribute the results via
// setGroundDataBatch (one emission). Same-id repeat requests share
// the in-flight promise so we never fetch a file twice concurrently.
//
// Latency from "card mount" to "batch send": <=1 microtask (~0ms;
// well under 1 RAF / 16ms).
//
// Consumers call `enqueueGroundFetch(fileId)`. If a fetch is already
// in flight for that id, they get the same promise — no dup network
// work. If the id is not in flight, the id is added to the pending
// set and a flush is scheduled (if not already). The returned
// promise resolves once this id's slice of the batch is applied to
// the store.

let pending: Set<string> | null = null;
let pendingResolvers: Map<string, Array<() => void>> | null = null;
const inFlight = new Map<string, Promise<void>>();
let flushScheduled = false;

// Tracks file ids whose GroundCard is currently mounted. When a card
// unmounts (user zooms out / scrolls away) we want to drop its pending
// result — writing data into the store for a non-visible card is pure
// waste and, worse, re-emits sceneStore listeners. `unregisterMount`
// removes from this set; before flushing, we filter entries to only
// those still in this set.
const mountedCards = new Set<string>();

function flush(): void {
  flushScheduled = false;
  const batch = pending;
  const resolvers = pendingResolvers;
  pending = null;
  pendingResolvers = null;
  if (!batch || batch.size === 0) return;

  const ids = [...batch];
  // Mark all as loading in one emission.
  workspaceCanvasStore.setGroundLoadingBatch(ids, true);

  const promise = (async () => {
    try {
      const results = await loadGroundDataBatch(ids);
      // Unmount guard: filter entries to only those whose GroundCard is
      // still mounted. A user who zooms in → out before fetch resolves
      // would otherwise see store writes for cards that are no longer on
      // screen (wasted ground data cache + sceneStore emits that wake
      // every subscriber). `ids` is still used as the loading-flag reset
      // set so stale `true` loading flags don't linger on unmounted cards.
      const liveEntries = ids
        .filter(id => mountedCards.has(id))
        .map(id => ({ id, data: results[id] ?? { source: "" } }));
      // One atomic store update: writes data only for mounted cards +
      // clears loading flags for ALL requested ids.
      workspaceCanvasStore.setGroundDataBatch(liveEntries, ids);
    } finally {
      // In case setGroundDataBatch was not reached (shouldn't happen, but
      // guard against a thrown store update), ensure loading is cleared.
      // Also purge in-flight entries so future fetches can re-queue.
      for (const id of ids) inFlight.delete(id);
      if (resolvers) {
        for (const id of ids) {
          const cbs = resolvers.get(id);
          if (cbs) for (const cb of cbs) cb();
        }
      }
    }
  })();
  for (const id of ids) inFlight.set(id, promise);
}

/**
 * Queue a fileId for batched ground-data fetch. Returns a promise that
 * resolves when the file's data has been written to the store (or an
 * in-flight fetch for that id completes — same promise is shared).
 *
 * Safe to call from a component effect — same-id calls are deduped.
 */
export function enqueueGroundFetch(fileId: string): Promise<void> {
  // Any enqueuer is by definition a mounted consumer — register here so
  // even if the caller forgets to call registerMount explicitly, the
  // mount tracking still works.
  mountedCards.add(fileId);

  const existing = inFlight.get(fileId);
  if (existing) return existing;

  if (!pending) {
    pending = new Set();
    pendingResolvers = new Map();
  }
  pending.add(fileId);

  // Each caller awaits its own deferred; the flush resolves them all.
  const deferred = new Promise<void>(resolve => {
    const list = pendingResolvers!.get(fileId) ?? [];
    list.push(resolve);
    pendingResolvers!.set(fileId, list);
  });

  if (!flushScheduled) {
    flushScheduled = true;
    // Microtask window: fastest possible coalesce. Any card that
    // mounts in this render tick ends up in the same batch.
    queueMicrotask(flush);
  }
  return deferred;
}

/**
 * Notify the batch coordinator that a GroundCard for this file has
 * unmounted. Removes from the mounted set so an in-flight fetch's result
 * is dropped rather than written to the store. Safe to call even if the
 * id was never enqueued — it's a pure set delete.
 */
export function unregisterMount(fileId: string): void {
  mountedCards.delete(fileId);
}

// Exported for tests: lets tests reset coordinator state between cases.
export function __resetGroundFetchCoordinator(): void {
  pending = null;
  pendingResolvers = null;
  inFlight.clear();
  mountedCards.clear();
  flushScheduled = false;
}
