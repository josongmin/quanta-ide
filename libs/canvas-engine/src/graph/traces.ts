// Runtime traces — the dynamic counterpart to the static call graph.
//
// Static analysis shows *what can happen*; a trace shows *what did happen*
// for one concrete request/session. This matches the mental model of
// OpenTelemetry service graphs, Honeycomb distributed traces, and Datadog
// APM flame-maps — except scoped to intra-repo file/symbol granularity.
//
// The canvas overlays a `Trace` by rendering its `edges` with a distinct
// visual vocabulary (gradient, animated flow, call-count badge). Static
// edges dim while a trace is active so the reader's attention converges
// on the dynamic path.
//
// Data is intentionally shallow/flat: two parallel arrays (spans, edges).
// We don't reconstruct a tree at this layer — the renderer and HUD only
// need per-edge aggregates and per-span line anchors. A consumer that
// wants a tree can assemble one from `depth` + arrival order.
//
// All durations are in ms, relative to the trace's capture. No timestamps
// beyond `capturedAt` — the canvas doesn't replay real time, it just shows
// the relative shape of a captured call path.

/**
 * A single observed invocation inside a trace. Multiple spans may refer to
 * the same `(fileId, symbol)` when a function is called more than once
 * within the trace; each entry is its own span so a reader can see the
 * loop/recursion structure.
 */
export interface TraceSpan {
  /** The file where this span executed. */
  fileId: string;
  /** Function / method name. Optional because some traces only know the file. */
  symbol?: string;
  /** Offset from trace start, ms. */
  startMs: number;
  /** Wall-clock duration including children, ms. */
  durationMs: number;
  /** Self time (durationMs minus children). When omitted, consumers may
   *  approximate via `durationMs`. */
  selfMs?: number;
  /** Call-stack depth. 0 = root span. */
  depth: number;
}

/**
 * An edge in the *dynamic* call graph. Direction is caller → callee.
 * `callCount` and `totalDurationMs` are pre-aggregated across all spans
 * that traverse this edge — the renderer uses them to size the stroke
 * and print a `×N` badge near the midpoint.
 */
export interface TraceEdge {
  /** Caller fileId. */
  from: string;
  /** Callee fileId. */
  to: string;
  /** Optional caller-side symbol. */
  fromSymbol?: string;
  /** Optional callee-side symbol. */
  toSymbol?: string;
  /** Number of invocations across the trace. */
  callCount: number;
  /** Total time spent traversing this edge (sum of per-call durations). */
  totalDurationMs: number;
}

/**
 * A single captured trace — e.g. "login flow" or "checkout /api/orders".
 * Identity is `id`; the label is free-form for the HUD row.
 */
export interface Trace {
  id: string;
  /** Human-readable label for the HUD chip. */
  label: string;
  /** Epoch ms when the trace was captured. Display only. */
  capturedAt: number;
  /** Wall-clock duration of the trace, ms. */
  totalMs: number;
  /** All spans observed in the trace. */
  spans: readonly TraceSpan[];
  /** Pre-aggregated dynamic edges. */
  edges: readonly TraceEdge[];
}

/**
 * A bundle of traces attached to a WorkspaceGraph. The UI lets the user
 * pick one at a time (the trace overlay is an interaction state, not a
 * composable filter) so a single flat list is the right shape.
 */
export interface TracePack {
  traces: readonly Trace[];
}

/**
 * Compute a stable per-edge key matching the convention used by callers
 * in the HUD/renderer — `from→to` with the raw file ids.
 */
export function traceEdgeKey(edge: Pick<TraceEdge, "from" | "to">): string {
  return `${edge.from}→${edge.to}`;
}

/**
 * Collect all edge keys for a trace into a ReadonlySet — used by the
 * renderer to dim static edges in one O(1)-lookup pass.
 */
export function traceEdgeKeySet(trace: Trace): ReadonlySet<string> {
  const out = new Set<string>();
  for (const e of trace.edges) out.add(traceEdgeKey(e));
  return out;
}
