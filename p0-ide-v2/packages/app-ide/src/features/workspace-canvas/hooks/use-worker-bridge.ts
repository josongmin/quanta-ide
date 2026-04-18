import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { SerializedLayout, SerializedAggregates } from "@quanta/canvas-worker";
import { deserializeLayout, deserializeAggregates } from "@quanta/canvas-worker";
import { workspaceCanvasStore } from "../store/workspace-canvas-store";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../../../../canvas-worker/src/worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = handleMessage;
    worker.onerror = (e) => console.error("[canvas-worker]", e);
  }
  return worker;
}

function handleMessage(event: MessageEvent) {
  const msg = event.data as { type: string; payload?: unknown; message?: string };
  switch (msg.type) {
    case "LAYOUT_READY":
      workspaceCanvasStore.setLayout(deserializeLayout(msg.payload as SerializedLayout));
      workspaceCanvasStore.setWorkerState("workerLayout", false);
      break;
    case "AGGREGATES_READY":
      // store aggregates — attach to layout
      deserializeAggregates(msg.payload as SerializedAggregates);
      workspaceCanvasStore.setWorkerState("workerAggregates", false);
      break;
    case "GEOMETRY_READY":
      workspaceCanvasStore.setWorkerState("workerGeometry", false);
      break;
    case "WORKER_ERROR":
      console.error("[canvas-worker] error:", msg.message);
      break;
  }
}

export function requestLayout(graph: WorkspaceGraph, strategy: "grid" | "grid-then-elk" = "grid-then-elk") {
  const id = `layout-${Date.now()}`;
  workspaceCanvasStore.setWorkerState("workerLayout", true);
  getWorker().postMessage({ type: "BUILD_LAYOUT", id, payload: { graph, strategy } });
}

export function requestAggregates(graph: WorkspaceGraph) {
  const id = `agg-${Date.now()}`;
  workspaceCanvasStore.setWorkerState("workerAggregates", true);
  getWorker().postMessage({ type: "BUILD_AGGREGATES", id, payload: { graph } });
}

export function useWorkerBridge() {
  // just returns the request functions — worker lifecycle managed globally
  return { requestLayout, requestAggregates };
}
