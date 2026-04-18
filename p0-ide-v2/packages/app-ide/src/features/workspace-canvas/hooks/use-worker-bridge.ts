import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { SerializedLayout, SerializedAggregates } from "@quanta/canvas-worker";
import { deserializeLayout, deserializeAggregates } from "@quanta/canvas-worker";
import { workspaceCanvasStore } from "../store/workspace-canvas-store";

let worker: Worker | null = null;

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
    payload?: unknown;
    message?: string;
    stage?: string;
    filesCount?: number;
    elapsedMs?: number;
  };
  console.log("[worker-bridge] recv", msg.type, "stage=", msg.stage);
  switch (msg.type) {
    case "LAYOUT_READY": {
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
          const scale = Math.min(2.5, Math.max(0.05, Math.min(vp.width / graphW, vp.height / graphH) * 0.9));
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
      const aggregates = deserializeAggregates(msg.payload as SerializedAggregates);
      const currentLayout = workspaceCanvasStore.getState().layout;
      if (currentLayout) {
        workspaceCanvasStore.setLayout({ ...currentLayout, aggregates });
      }
      workspaceCanvasStore.setWorkerState("workerAggregates", false);
      break;
    }
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
