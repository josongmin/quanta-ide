import { useEffect } from "react";
import { useSceneStore } from "../store/scene-store";
import {
  enqueueGroundFetch,
  registerMount,
  unregisterMount,
} from "./use-ground-data-batch";

// Subscribes a ground-card to its slice of the scene store and enqueues
// a batched fetch on mount when no cached data exists. The batch
// coordinator dedupes concurrent same-id requests, so it's safe for
// several cards (or the same card across rerenders) to enqueue.
//
// Direct sub-store subscription (not the facade) — a viewport pan that
// wakes the facade must NOT re-run every mounted card's selector.
export function useGroundData(fileId: string) {
  const data    = useSceneStore(s => s.groundData[fileId]);
  const loading = useSceneStore(s => s.groundLoading[fileId] ?? false);

  useEffect(() => {
    // Always register the mount first, regardless of cache state. This
    // way, if another card later triggers a batch that happens to include
    // this id (e.g. a remount near an in-flight fetch), the filter in
    // `flush` sees us as mounted. `registerMount` is idempotent so the
    // StrictMode double-invoke (mount → cleanup → mount) doesn't leak.
    registerMount(fileId);
    if (!data) {
      // Note: don't short-circuit on `loading` — the batch coordinator
      // already dedupes in-flight fetches, and checking `loading` here
      // would race with the microtask that flips it true.
      void enqueueGroundFetch(fileId);
    }
    // On unmount (user zooms out, scrolls away), tell the coordinator
    // to drop this id's result when the in-flight batch resolves. The
    // fetch promise itself is NOT cancelled — it continues so the
    // underlying HTTP cache populates for a potential remount, but the
    // store write is filtered out to avoid wasted sceneStore emits.
    return () => {
      unregisterMount(fileId);
    };
  }, [fileId, data]);

  return { data: data ?? null, loading };
}
