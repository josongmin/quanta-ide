import type { WorkerRequest, WorkerResponse } from "./messages";
import { gridLayout } from "@quanta/canvas-engine";
import {
  serializeLayout,
  deserializeLayout,
  serializeAggregates,
} from "./messages";
import { runLayoutTask } from "./layout-task";
import { runAggregateTask } from "./aggregate-task";
import { runGeometryTask } from "./geometry-task";

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case "BUILD_LAYOUT": {
        const layout = await runLayoutTask(
          req.payload.graph,
          req.payload.strategy,
          req.payload.pinnedNodes,
        );
        const resp: WorkerResponse = {
          type: "LAYOUT_READY",
          id: req.id,
          payload: serializeLayout(layout),
        };
        self.postMessage(resp);
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
