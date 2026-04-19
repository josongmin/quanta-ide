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
  computeHEBPaths,
} from "@quanta/canvas-engine";

// ELK is disabled: elkjs bundled build tries to spawn nested Workers from
// inside our worker, which fails (`_Worker is not a constructor`) and leaves
// the worker in a partially-broken state that blocks subsequent messages.
// Grid layout is sufficient for the stress test. Re-enable by moving ELK to
// the main thread or using elk-api.js with an explicit worker factory.

// ── Post-compute supersession guard ────────────────────────────────
// The worker runs one message at a time (`onmessage` is serialized).
// A heavy compute (BUILD_HEB on a 6k-edge graph ≈ 200ms) blocks the
// next incoming request until the current one finishes, so we can't
// TRULY abort a running job mid-compute without chunked yielding —
// that's a future refactor for computeHEBPaths et al.
//
// What we CAN do cheaply: drop the result on the floor when a newer
// request of the same task-type has already landed. That saves the
// structured-clone + postMessage + main-thread handler cost (roughly
// 5-15ms per superseded HEB batch on a 6k-edge graph). The
// `currentLayoutRequestId` / `currentAggregatesRequestId` guards on
// the main-thread side already drop stale messages; this puts the
// check at the source so we never pay the clone cost either.
//
// Each task-type tracks its OWN latest id so that e.g. a new HEB
// request doesn't supersede an in-flight LAYOUT result. CANCEL sets
// every id to a sentinel so any in-flight result is treated as stale.
let latestLayoutRequestId: string | null = null;
let latestAggregatesRequestId: string | null = null;
let latestGeometryRequestId: string | null = null;
let latestHebRequestId: string | null = null;

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
        const paths = computeHEBPaths(
          graph.fileEdges,
          layout.fileRects,
          tree,
          { tension, samples },
        );

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
        // result is still pending postMessage is treated as superseded.
        // Does NOT interrupt the running compute (see the module-level
        // comment) — just short-circuits the result dispatch so the main
        // thread doesn't waste structured-clone cycles on data it was
        // about to drop anyway.
        latestLayoutRequestId = null;
        latestAggregatesRequestId = null;
        latestGeometryRequestId = null;
        latestHebRequestId = null;
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
