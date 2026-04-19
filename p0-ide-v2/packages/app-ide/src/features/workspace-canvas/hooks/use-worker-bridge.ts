import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import type {
  SerializedLayout,
  SerializedAggregates,
  HebBatch,
  EdgeGeometryBatch,
} from "@quanta/canvas-worker";
import { deserializeLayout, deserializeAggregates, serializeLayout } from "@quanta/canvas-worker";
import { sceneStore } from "../store/scene-store";

// Geometry batch subscribers. The worker-side `BUILD_EDGE_GEOMETRY` handler
// returns a flat Float32Array of bezier control points (8 floats/edge) keyed
// by a parallel edgeIds array. MultiFileCanvas subscribes to stash the result
// into its edge cache ref so future GPU-buffer consumers can skim the batch
// without walking layout.edgeRoutes on the main thread. The per-request id
// is forwarded so subscribers can drop payloads that predate their own
// latest request (the bridge's `currentGeometryRequestId` guard already drops
// stale messages, but subscribers may issue overlapping requests and need
// local race checks). Subscribers returning void — no chaining.
type GeometryListener = (batch: EdgeGeometryBatch, requestId: string) => void;
const geometryListeners = new Set<GeometryListener>();

export function onEdgeGeometryReady(listener: GeometryListener): () => void {
  geometryListeners.add(listener);
  return () => { geometryListeners.delete(listener); };
}

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
let currentHebRequestId: string | null = null;

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
        // In-place mutation of `aggregates`. Previously this did
        // `setLayout({ ...currentLayout, aggregates })`, which replaced
        // the entire layout reference. That single line was the root of
        // the Code Universe entry hang on large graphs:
        //
        //   - `spatialCache` (WeakMap keyed by layout) invalidated →
        //     FileIndex + EdgeFilter rbush trees rebuilt from scratch
        //     (~20-50ms on a 6k-file repo).
        //   - Every React effect with `layout` in deps re-fired —
        //     including `edgeCacheRef.current.build(edges, layout)` and
        //     `edgePickIndexRef.current.build(edges, layout)` in
        //     MultiFileCanvas, each O(edges × samples) on the main
        //     thread.
        //
        // `aggregates` is a leaf sub-field (3 Maps of comment counts)
        // that is consumed only by `estimate-memory.ts`, which reads
        // `s.layout.aggregates.*` non-reactively (polled by the perf
        // recorder every ~6 frames). No React subscriber depends on
        // its identity — so mutating in place is safe, and preserving
        // the outer layout reference is the whole point.
        //
        // If a future consumer needs to *react* to aggregates updates,
        // lift `aggregates` out of `WorkspaceLayout` into its own
        // sceneStore field with its own setter. Don't restore the
        // spread pattern.
        currentLayout.aggregates = aggregates;
      }
      sceneStore.setWorkerState("workerAggregates", false);
      break;
    }
    case "GEOMETRY_READY": {
      if (msg.id && msg.id !== currentGeometryRequestId) {
        return;
      }
      sceneStore.setWorkerState("workerGeometry", false);
      // Fan out the batch to any subscribers. Wrapped in try/catch per
      // listener so one buggy consumer doesn't block the others — the
      // worker bridge is a shared resource and a throw here would leak
      // into the next postMessage tick.
      const batch = msg.payload as EdgeGeometryBatch | undefined;
      if (batch && msg.id) {
        for (const listener of geometryListeners) {
          try { listener(batch, msg.id); } catch (err) {
            console.error("[canvas-worker] geometry listener threw:", err);
          }
        }
      }
      break;
    }
    case "HEB_READY": {
      // Stale-request guard. HEB is only rebuilt on LOD transitions; a
      // late payload for an earlier graph/layout would paint edges at
      // coordinates that no longer exist.
      if (msg.id && msg.id !== currentHebRequestId) {
        return;
      }
      const payload = msg.payload as HebBatch;
      sceneStore.setHebPaths(payload);
      sceneStore.setWorkerState("workerHeb", false);
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
      sceneStore.setWorkerState("workerHeb", false);
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

// Monotonic counter appended to Date.now() so two requests fired in the same
// millisecond (common during rapid layout churn on graph swap) get distinct
// ids. Without this, a subscriber using id-equality to drop stale responses
// would treat the second request's LATER response as "stale" and drop it.
let geometryRequestSeq = 0;

export function requestEdgeGeometry(graph: WorkspaceGraph, layout: WorkspaceLayout): string {
  geometryRequestSeq = (geometryRequestSeq + 1) | 0;
  const id = `geom-${Date.now()}-${geometryRequestSeq}`;
  currentGeometryRequestId = id;
  sceneStore.setWorkerState("workerGeometry", true);
  getWorker().postMessage({
    type: "BUILD_EDGE_GEOMETRY",
    id,
    payload: { graph, layout: serializeLayout(layout) },
  });
  return id;
}

/**
 * Kick off a Hierarchical Edge Bundling rebuild. The worker builds the
 * folder tree, resolves LCAs, samples a cubic B-spline per edge, and
 * returns a single HebBatch via Transferable (zero-copy).
 *
 * Intended caller: a single galaxy-LOD entry hook (see
 * `use-heb-paths.ts`) — calling this on every frame would be wasteful.
 * Default tension of 0.85 matches Holten 2006.
 */
export function requestHebPaths(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  options: { tension?: number; samples?: number } = {},
) {
  const id = `heb-${Date.now()}`;
  currentHebRequestId = id;
  sceneStore.setWorkerState("workerHeb", true);
  getWorker().postMessage({
    type: "BUILD_HEB",
    id,
    payload: {
      graph,
      layout: serializeLayout(layout),
      tension: options.tension,
      samples: options.samples,
    },
  });
}

export function useWorkerBridge() {
  // just returns the request functions — worker lifecycle managed globally
  return { requestLayout, requestAggregates, requestEdgeGeometry, requestHebPaths };
}
