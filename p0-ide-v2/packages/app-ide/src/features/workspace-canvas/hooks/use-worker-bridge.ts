import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import type { SerializedLayout, SerializedAggregates } from "@quanta/canvas-worker";
import { deserializeLayout, deserializeAggregates, serializeLayout } from "@quanta/canvas-worker";
import { sceneStore } from "../store/scene-store";

let worker: Worker | null = null;

// Tracks the id of the MOST-RECENTLY-REQUESTED layout/aggregates/geometry
// job. When the user swaps graphs quickly (or we request a re-layout while
// a previous one is still running), late messages from the superseded job
// arrive with an older id. Applying them would stomp the current layout
// with stale results and potentially crash downstream consumers that just
// read fresh file ids. Guard: any LAYOUT_READY / AGGREGATES_READY /
// GEOMETRY_READY whose id does not match the current request is dropped
// with a debug log.
let currentLayoutRequestId: string | null = null;
let currentAggregatesRequestId: string | null = null;
let currentGeometryRequestId: string | null = null;

function spawnWorker(): Worker {
  const w = new Worker(
    new URL("../../../../../canvas-worker/src/worker.ts", import.meta.url),
    { type: "module" },
  );
  w.onmessage = handleMessage;
  w.onerror = (e) => {
    // Hard crash (module load / uncaught throw) — the worker is now dead
    // silicon. Flip busy flags so the LoadingOverlay stops spinning and
    // surface a worker-error state; the next request() will respawn.
    console.error("[canvas-worker] hard error:", e.message ?? e);
    sceneStore.setLayoutProgress("worker-error", { error: e.message ?? "worker crashed" });
    sceneStore.setWorkerState("workerLayout", false);
    sceneStore.setWorkerState("workerAggregates", false);
    sceneStore.setWorkerState("workerGeometry", false);
    try { w.terminate(); } catch { /* already dead */ }
    if (worker === w) worker = null;
  };
  return w;
}

function getWorker(): Worker {
  if (!worker) worker = spawnWorker();
  return worker;
}

function handleMessage(event: MessageEvent) {
  const msg = event.data as {
    type: string;
    id?: string;
    payload?: unknown;
    message?: string;
    stage?: string;
    filesCount?: number;
    elapsedMs?: number;
  };
  switch (msg.type) {
    case "LAYOUT_READY": {
      // Stale-request guard: if the user swapped the graph while the worker
      // was mid-layout, the superseded response still arrives. Drop it —
      // currentLayoutRequestId was overwritten when the fresh request went
      // out, so applying this payload would stomp the in-flight newer layout
      // (or crash downstream consumers if file ids no longer exist).
      if (msg.id && msg.id !== currentLayoutRequestId) {
        // stale: drop silently — diagnostic only, not a user-facing error
        return;
      }
      const layout = deserializeLayout(msg.payload as SerializedLayout);
      const wasElk = msg.stage === "elk";
      sceneStore.setLayout(layout);
      sceneStore.setWorkerState("workerLayout", false);
      if (wasElk) sceneStore.setLayoutProgress("elk-done");
      // Auto-fit is a UI concern and lives in MultiFileCanvas's effect chain
      // (see the `autoFitOnInitialLayout` useEffect). The worker bridge used
      // to fit here with its own inline math, which diverged from the shared
      // fitToGraph path (different maxScale cap) and caused ground-tier blow-ups
      // on small graphs. Single-writer rule: only the UI layer touches the
      // camera. This hook just publishes layout data.
      break;
    }
    case "LAYOUT_PROGRESS": {
      const stage = msg.stage as "grid-ready" | "elk-start" | "elk-skipped" | "elk-failed";
      const storeStage = stage === "elk-start" ? "elk-running" : stage;
      sceneStore.setLayoutProgress(storeStage, {
        filesCount: msg.filesCount,
        elapsedMs: msg.elapsedMs,
      });
      break;
    }
    case "AGGREGATES_READY": {
      // Same stale-request guard as LAYOUT_READY — the aggregates pass runs
      // async alongside layout; a prior graph's aggregates can land after
      // a new graph was loaded.
      if (msg.id && msg.id !== currentAggregatesRequestId) {
        return;
      }
      const aggregates = deserializeAggregates(msg.payload as SerializedAggregates);
      const currentLayout = sceneStore.getState().layout;
      if (currentLayout) {
        sceneStore.setLayout({ ...currentLayout, aggregates });
      }
      sceneStore.setWorkerState("workerAggregates", false);
      break;
    }
    case "GEOMETRY_READY": {
      if (msg.id && msg.id !== currentGeometryRequestId) {
        return;
      }
      sceneStore.setWorkerState("workerGeometry", false);
      break;
    }
    case "WORKER_ERROR": {
      // Promote worker errors into the store so the LoadingOverlay can
      // render a red error state with a reload CTA. Also flip busy flags
      // off so the UI doesn't sit on a spinner forever.
      const message = msg.message ?? "Unknown worker error";
      console.error("[canvas-worker] error:", message);
      sceneStore.setLayoutProgress("worker-error", { error: message });
      sceneStore.setWorkerState("workerLayout", false);
      sceneStore.setWorkerState("workerAggregates", false);
      sceneStore.setWorkerState("workerGeometry", false);
      break;
    }
  }
}

export function requestLayout(graph: WorkspaceGraph, strategy: "grid" | "grid-then-elk" = "grid-then-elk") {
  const id = `layout-${Date.now()}`;
  currentLayoutRequestId = id;
  sceneStore.setWorkerState("workerLayout", true);
  getWorker().postMessage({ type: "BUILD_LAYOUT", id, payload: { graph, strategy } });
}

export function requestAggregates(graph: WorkspaceGraph) {
  const id = `agg-${Date.now()}`;
  currentAggregatesRequestId = id;
  sceneStore.setWorkerState("workerAggregates", true);
  getWorker().postMessage({ type: "BUILD_AGGREGATES", id, payload: { graph } });
}

export function requestEdgeGeometry(graph: WorkspaceGraph, layout: WorkspaceLayout) {
  const id = `geom-${Date.now()}`;
  currentGeometryRequestId = id;
  sceneStore.setWorkerState("workerGeometry", true);
  getWorker().postMessage({
    type: "BUILD_EDGE_GEOMETRY",
    id,
    payload: { graph, layout: serializeLayout(layout) },
  });
}

export function useWorkerBridge() {
  // just returns the request functions — worker lifecycle managed globally
  return { requestLayout, requestAggregates, requestEdgeGeometry };
}
