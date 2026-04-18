import type { WorkerRequest, WorkerResponse } from "./messages";
import { gridLayout } from "@quanta/canvas-engine";
import {
  serializeLayout,
  deserializeLayout,
  serializeAggregates,
} from "./messages";
import { runGridLayout } from "./layout-task";
import { runAggregateTask } from "./aggregate-task";
import { runGeometryTask } from "./geometry-task";

// ELK is disabled: elkjs bundled build tries to spawn nested Workers from
// inside our worker, which fails (`_Worker is not a constructor`) and leaves
// the worker in a partially-broken state that blocks subsequent messages.
// Grid layout is sufficient for the stress test. Re-enable by moving ELK to
// the main thread or using elk-api.js with an explicit worker factory.

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  console.log("[worker] recv", req.type, "id=", (req as { id?: string }).id);
  try {
    switch (req.type) {
      case "BUILD_LAYOUT": {
        const t0 = Date.now();
        const { graph } = req.payload;

        const grid = runGridLayout(graph);
        self.postMessage({
          type: "LAYOUT_READY",
          id: req.id,
          payload: serializeLayout(grid),
          stage: "grid",
        } satisfies WorkerResponse);
        self.postMessage({
          type: "LAYOUT_PROGRESS",
          id: req.id,
          stage: "grid-ready",
          filesCount: graph.files.length,
          elapsedMs: Date.now() - t0,
        } satisfies WorkerResponse);
        self.postMessage({
          type: "LAYOUT_PROGRESS",
          id: req.id,
          stage: "elk-skipped",
          filesCount: graph.files.length,
          elapsedMs: Date.now() - t0,
        } satisfies WorkerResponse);
        console.log("[worker] BUILD_LAYOUT done", { files: graph.files.length, ms: Date.now() - t0 });
        break;
      }

      case "PARTIAL_RELAYOUT": {
        // Simple full re-grid for now; partial/incremental ELK relayout deferred to later phase.
        // The incoming layout is intentionally not read — we recompute from scratch.
        const layout = gridLayout(req.payload.graph);
        const resp: WorkerResponse = {
          type: "LAYOUT_READY",
          id: req.id,
          payload: serializeLayout(layout),
          stage: "grid",
        };
        self.postMessage(resp);
        break;
      }

      case "BUILD_AGGREGATES": {
        const aggregates = runAggregateTask(req.payload.graph);
        const resp: WorkerResponse = {
          type: "AGGREGATES_READY",
          id: req.id,
          payload: serializeAggregates(aggregates),
        };
        self.postMessage(resp);
        break;
      }

      case "BUILD_EDGE_GEOMETRY": {
        const layout = deserializeLayout(req.payload.layout);
        const batch = runGeometryTask(req.payload.graph, layout);
        const resp: WorkerResponse = {
          type: "GEOMETRY_READY",
          id: req.id,
          payload: batch,
        };
        // Transfer ownership of the underlying ArrayBuffer to avoid copying.
        self.postMessage(resp, { transfer: [batch.positions.buffer] });
        break;
      }

      case "CANCEL": {
        // No-op: cancellation deferred to a later phase
        break;
      }
    }
  } catch (err) {
    const resp: WorkerResponse = {
      type: "WORKER_ERROR",
      id: (req as { id: string }).id,
      message: String(err),
    };
    self.postMessage(resp);
  }
};
