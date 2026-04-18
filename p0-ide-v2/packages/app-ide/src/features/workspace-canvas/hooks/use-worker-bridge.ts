import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import type { SerializedLayout, SerializedAggregates } from "@quanta/canvas-worker";
import { deserializeLayout, deserializeAggregates, serializeLayout } from "@quanta/canvas-worker";
import { workspaceCanvasStore } from "../store/workspace-canvas-store";

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

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../../../../canvas-worker/src/worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = handleMessage;
    worker.onerror = (e) => console.error("[canvas-worker]", e);
  }
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
  console.log("[worker-bridge] recv", msg.type, "stage=", msg.stage);
  switch (msg.type) {
    case "LAYOUT_READY": {
      // Stale-request guard: if the user swapped the graph while the worker
      // was mid-layout, the superseded response still arrives. Drop it —
      // currentLayoutRequestId was overwritten when the fresh request went
      // out, so applying this payload would stomp the in-flight newer layout
      // (or crash downstream consumers if file ids no longer exist).
      if (msg.id && msg.id !== currentLayoutRequestId) {
        console.log("[worker-bridge] stale LAYOUT_READY dropped", msg.id, "!=", currentLayoutRequestId);
        return;
      }
      const layout = deserializeLayout(msg.payload as SerializedLayout);
      const wasElk = msg.stage === "elk";
      workspaceCanvasStore.setLayout(layout);
      workspaceCanvasStore.setWorkerState("workerLayout", false);
      if (wasElk) workspaceCanvasStore.setLayoutProgress("elk-done");
      // Auto-fit viewport — only on the FIRST layout to avoid stomping user
      // pan/zoom when ELK follows grid. The `layoutProgress` stage tells us
      // which payload this is.
      const progress = workspaceCanvasStore.getState().layoutProgress;
      const isFirstLayout = !wasElk && progress.stage !== "grid-ready" && progress.stage !== "elk-running";
      if (isFirstLayout || msg.stage === "grid") {
        const vp = workspaceCanvasStore.getState().viewport;
        const { w: graphW, h: graphH } = layout.totalBounds;
        if (graphW > 0 && graphH > 0 && vp.width > 0 && vp.height > 0) {
          // Bounds matched to useCanvasViewport MIN/MAX_SCALE so auto-fit can
          // land on universe LOD for huge treemap layouts (quanta-v2 ≈ 140k×98k).
          const scale = Math.min(2.5, Math.max(0.001, Math.min(vp.width / graphW, vp.height / graphH) * 0.9));
          const x = (vp.width - graphW * scale) / 2;
          const y = (vp.height - graphH * scale) / 2;
          workspaceCanvasStore.setViewport({ ...vp, x, y, scale });
        }
      }
      break;
    }
    case "LAYOUT_PROGRESS": {
      const stage = msg.stage as "grid-ready" | "elk-start" | "elk-skipped" | "elk-failed";
      const storeStage = stage === "elk-start" ? "elk-running" : stage;
      workspaceCanvasStore.setLayoutProgress(storeStage, {
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
        console.log("[worker-bridge] stale AGGREGATES_READY dropped", msg.id, "!=", currentAggregatesRequestId);
        return;
      }
      const aggregates = deserializeAggregates(msg.payload as SerializedAggregates);
      const currentLayout = workspaceCanvasStore.getState().layout;
      if (currentLayout) {
        workspaceCanvasStore.setLayout({ ...currentLayout, aggregates });
      }
      workspaceCanvasStore.setWorkerState("workerAggregates", false);
      break;
    }
    case "GEOMETRY_READY": {
      if (msg.id && msg.id !== currentGeometryRequestId) {
        console.log("[worker-bridge] stale GEOMETRY_READY dropped", msg.id, "!=", currentGeometryRequestId);
        return;
      }
      workspaceCanvasStore.setWorkerState("workerGeometry", false);
      break;
    }
    case "WORKER_ERROR": {
      // Promote worker errors into the store so the LoadingOverlay can
      // render a red error state with a reload CTA. Also flip busy flags
      // off so the UI doesn't sit on a spinner forever.
      const message = msg.message ?? "Unknown worker error";
      console.error("[canvas-worker] error:", message);
      workspaceCanvasStore.setLayoutProgress("worker-error", { error: message });
      workspaceCanvasStore.setWorkerState("workerLayout", false);
      workspaceCanvasStore.setWorkerState("workerAggregates", false);
      workspaceCanvasStore.setWorkerState("workerGeometry", false);
      break;
    }
  }
}

export function requestLayout(graph: WorkspaceGraph, strategy: "grid" | "grid-then-elk" = "grid-then-elk") {
  const id = `layout-${Date.now()}`;
  currentLayoutRequestId = id;
  workspaceCanvasStore.setWorkerState("workerLayout", true);
  getWorker().postMessage({ type: "BUILD_LAYOUT", id, payload: { graph, strategy } });
}

export function requestAggregates(graph: WorkspaceGraph) {
  const id = `agg-${Date.now()}`;
  currentAggregatesRequestId = id;
  workspaceCanvasStore.setWorkerState("workerAggregates", true);
  getWorker().postMessage({ type: "BUILD_AGGREGATES", id, payload: { graph } });
}

export function requestEdgeGeometry(graph: WorkspaceGraph, layout: WorkspaceLayout) {
  const id = `geom-${Date.now()}`;
  currentGeometryRequestId = id;
  workspaceCanvasStore.setWorkerState("workerGeometry", true);
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
