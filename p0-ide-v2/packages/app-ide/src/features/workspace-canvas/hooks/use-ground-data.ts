import { useEffect } from "react";
import { useWorkspaceCanvas } from "../store/workspace-canvas-store";
import { enqueueGroundFetch } from "./use-ground-data-batch";

// Subscribes a ground-card to its slice of the store and enqueues
// a batched fetch on mount when no cached data exists. The batch
// coordinator dedupes concurrent same-id requests, so it's safe for
// several cards (or the same card across rerenders) to enqueue.
export function useGroundData(fileId: string) {
  const data    = useWorkspaceCanvas(s => s.groundData[fileId]);
  const loading = useWorkspaceCanvas(s => s.groundLoading[fileId] ?? false);

  useEffect(() => {
    if (data) return;
    // Note: don't short-circuit on `loading` — the batch coordinator
    // already dedupes in-flight fetches, and checking `loading` here
    // would race with the microtask that flips it true.
    void enqueueGroundFetch(fileId);
  }, [fileId, data]);

  return { data: data ?? null, loading };
}
