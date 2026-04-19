import type { WorkerRequest, WorkerResponse, HebBatch } from "./messages";
import {
  serializeLayout,
  deserializeLayout,
  serializeAggregates,
} from "./messages";
import { runLayoutTask } from "./layout-task";
import { runAggregateTask } from "./aggregate-task";
import { runGeometryTask } from "./geometry-task";
import {
  buildFolderTree,
  fillFolderCenters,
  computeHEBPathsAsync,
  isHebAbort,
} from "@quanta/canvas-engine";

// ELK is disabled: elkjs bundled build tries to spawn nested Workers from
// inside our worker, which fails (`_Worker is not a constructor`) and leaves
// the worker in a partially-broken state that blocks subsequent messages.
// Grid layout is sufficient for the stress test. Re-enable by moving ELK to
// the main thread or using elk-api.js with an explicit worker factory.

// ── Supersession + mid-compute abort ───────────────────────────────
// The worker runs one message at a time (`onmessage` is serialized).
// Two-layer strategy:
//
// 1. Post-compute supersession: each task-type tracks its OWN latest
//    request id; results from superseded compute are dropped at the
//    source, saving structured-clone + postMessage cost (~5-15ms per
//    HEB batch). The main-thread side has parallel guards.
//
// 2. Mid-compute abort for HEB: computeHEBPathsAsync yields every N
//    edges via setTimeout(0), which lets the worker's message queue
//    drain. On each yield it checks its AbortSignal — if set, it
//    throws HebAbortError. We wire `hebAbortController` so a newer
//    BUILD_HEB (or a CANCEL) aborts the running compute ~immediately
//    at the next chunk boundary (sub-20ms on realistic graphs).
//    LAYOUT / AGGREGATES / GEOMETRY remain sync for now; the
//    post-compute guard is enough since those tasks are cheaper.
let latestLayoutRequestId: string | null = null;
let latestAggregatesRequestId: string | null = null;
let latestGeometryRequestId: string | null = null;
let latestHebRequestId: string | null = null;

let hebAbortController: AbortController | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case "BUILD_LAYOUT": {
        latestLayoutRequestId = req.id;
        const t0 = Date.now();
        const { graph } = req.payload;

        // runLayoutTask with "grid" strategy picks treemap vs grid based on
        // TREEMAP_THRESHOLD (file count). ELK is still gated off (see note
        // below), so this resolves synchronously-ish with no ELK attempt.
        const layout = await runLayoutTask(graph, "grid");
        if (latestLayoutRequestId !== req.id) break; // superseded
        self.postMessage({
          type: "LAYOUT_READY",
          id: req.id,
          payload: serializeLayout(layout),
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
        break;
      }

      case "PARTIAL_RELAYOUT": {
        latestLayoutRequestId = req.id;
        // Simple full relayout for now; partial/incremental ELK relayout
        // deferred to later phase. The incoming layout is intentionally
        // not read — we recompute from scratch.
        const layout = await runLayoutTask(req.payload.graph, "grid");
        if (latestLayoutRequestId !== req.id) break; // superseded
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
        latestAggregatesRequestId = req.id;
        const aggregates = runAggregateTask(req.payload.graph);
        if (latestAggregatesRequestId !== req.id) break; // superseded
        const resp: WorkerResponse = {
          type: "AGGREGATES_READY",
          id: req.id,
          payload: serializeAggregates(aggregates),
        };
        self.postMessage(resp);
        break;
      }

      case "BUILD_EDGE_GEOMETRY": {
        latestGeometryRequestId = req.id;
        const layout = deserializeLayout(req.payload.layout);
        const batch = runGeometryTask(req.payload.graph, layout);
        if (latestGeometryRequestId !== req.id) break; // superseded
        const resp: WorkerResponse = {
          type: "GEOMETRY_READY",
          id: req.id,
          payload: batch,
        };
        // Transfer ownership of the underlying ArrayBuffer to avoid copying.
        self.postMessage(resp, { transfer: [batch.positions.buffer] });
        break;
      }

      case "BUILD_HEB": {
        // Abort any in-flight HEB compute — the chunked async variant
        // will throw HebAbortError at the next yield point (within one
        // chunkSize window, typically <20ms on a 6k-edge graph).
        hebAbortController?.abort();
        const controller = new AbortController();
        hebAbortController = controller;

        latestHebRequestId = req.id;
        const t0 = Date.now();
        const { graph, tension, samples } = req.payload;
        const layout = deserializeLayout(req.payload.layout);
        // Folder tree is cheap to rebuild; we don't cache it across requests
        // because graph swaps invalidate it anyway. If this ever shows up in
        // a profiler (unlikely — 2k files rebuild in <1ms), memoize by
        // graph-identity in a weak ref.
        const tree = buildFolderTree(graph.files);
        fillFolderCenters(tree, layout.fileRects);

        let paths;
        try {
          paths = await computeHEBPathsAsync(
            graph.fileEdges,
            layout.fileRects,
            tree,
            { tension, samples, signal: controller.signal },
          );
        } catch (err) {
          if (isHebAbort(err)) {
            // Newer request (or CANCEL) superseded this compute. Drop
            // silently — the follow-up request will post its own result.
            break;
          }
          throw err;
        }

        // Clear our controller slot if it's still us (a newer BUILD_HEB
        // would have already replaced it and aborted us above).
        if (hebAbortController === controller) hebAbortController = null;

        // Concatenate all sampled polylines into a single Float32Array so
        // we post one Transferable instead of N-thousand. `offsets` and
        // `lengths` act as a per-edge index into that flat buffer.
        let totalFloats = 0;
        for (const p of paths) totalFloats += p.sampled.length;
        const samplesOut = new Float32Array(totalFloats);
        const offsets = new Uint32Array(paths.length);
        const lengths = new Uint32Array(paths.length);
        const edgeIds: string[] = new Array(paths.length);
        let cursor = 0;
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i]!;
          samplesOut.set(p.sampled, cursor);
          offsets[i] = cursor;
          lengths[i] = p.sampled.length / 2; // pairs, not floats
          edgeIds[i] = p.edgeId;
          cursor += p.sampled.length;
        }

        const batch: HebBatch = {
          edgeIds,
          samples: samplesOut,
          offsets,
          lengths,
          computeMs: Date.now() - t0,
        };
        if (latestHebRequestId !== req.id) break; // superseded
        const resp: WorkerResponse = {
          type: "HEB_READY",
          id: req.id,
          payload: batch,
        };
        self.postMessage(resp, {
          transfer: [batch.samples.buffer, batch.offsets.buffer, batch.lengths.buffer],
        });
        break;
      }

      case "CANCEL": {
        // Reset every task's "latest id" so any in-flight compute whose
        // result is still pending postMessage is treated as superseded,
        // and abort the HEB compute mid-flight (the other tasks run to
        // completion; their results are dropped at the post-compute guard).
        latestLayoutRequestId = null;
        latestAggregatesRequestId = null;
        latestGeometryRequestId = null;
        latestHebRequestId = null;
        hebAbortController?.abort();
        hebAbortController = null;
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
