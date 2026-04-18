import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ─────────────────────────────────────────────────────────────────────
// GraphSource — adapter contract between the canvas UI and whatever is
// producing the WorkspaceGraph on the other side.
//
// Today the only implementation is `MockGraphSource`, which calls a
// regex-based dev-server scanner. Tomorrow a real code-graph engine
// (gRPC / WebSocket / IPC) will implement this same interface, and the
// UI will not need to change.
//
// Design goals:
//   1. Minimal surface — loadGraph() is the only required method.
//   2. Future-proof — optional hooks for per-file source fetch, live
//      streaming updates, and source metadata. Implementations may
//      omit any of these; callers must feature-detect.
//   3. No leakage of transport concerns (HTTP paths, gRPC stubs) into
//      the UI layer. Each implementation encapsulates its transport.
//
// Multi-source future (documentation only, not implemented here):
//   A `CompositeGraphSource` will later merge multiple sources into one
//   graph, namespacing file IDs with a repo prefix (e.g. `repoA:src/a.ts`).
//   That merging happens inside the engine; this client just consumes
//   the already-merged WorkspaceGraph, so this interface stays flat.
// ─────────────────────────────────────────────────────────────────────

export interface GraphSourceDescription {
  /** Each logical source contributing to the graph (one per repo / crate). */
  sources: Array<{
    /** Human-readable name, e.g. the repo or crate name. */
    name: string;
    /** Absolute root path if filesystem-backed. */
    root?: string;
    /** VCS commit SHA if known. */
    commit?: string;
  }>;
}

export interface GraphSource {
  /**
   * Stable identifier for logging / telemetry.
   * e.g. "mock-scanner", "engine-grpc", "composite".
   */
  readonly id: string;

  /** Human-readable label shown in diagnostic UI. */
  readonly label: string;

  /**
   * Stable identity of the graph this source currently represents (repo
   * root, composite fingerprint, etc.). Consumers use this as a cache /
   * state key that must invalidate when the underlying graph changes —
   * e.g. the LOD manager resets its hysteretic tier on graph swap.
   * Omit for sources with a single implicit graph; callers fall back to
   * `"default"`.
   */
  readonly graphKey?: string;

  /**
   * Load a full WorkspaceGraph.
   *
   * Contract:
   *   - Must resolve with a valid WorkspaceGraph or reject with an Error.
   *   - `params` is implementation-specific (path, extensions, commit, …);
   *     callers that don't know the shape should pass nothing and rely on
   *     the source's configured defaults.
   *   - Calling loadGraph twice MAY return different graphs (e.g. after
   *     a commit). Implementations should not cache unless idempotent.
   */
  loadGraph(params?: Record<string, unknown>): Promise<WorkspaceGraph>;

  /**
   * Optional per-file source fetcher.
   *
   * Contract:
   *   - Resolve with the raw file contents as a UTF-8 string.
   *   - Reject on transport error. Callers are expected to fall back to
   *     a built-in sample (see `SAMPLE_SOURCES`) when this rejects or is
   *     absent entirely.
   *   - `fileId` is whatever id the graph uses (scanner: repo-relative
   *     path; engine: opaque handle). The source round-trips its own ids.
   */
  loadFileSource?(fileId: string): Promise<string>;

  /**
   * Optional subscription to live graph updates for streaming engines.
   *
   * Contract:
   *   - `onUpdate` receives a PARTIAL graph containing only changed
   *     nodes / edges. Implementations MAY instead emit the full graph;
   *     consumers must handle both.
   *   - Returns an unsubscribe function. Idempotent — calling twice is
   *     safe and a no-op after the first call.
   *   - Absent on pull-only sources (e.g. the current mock scanner).
   */
  subscribe?(onUpdate: (partial: Partial<WorkspaceGraph>) => void): () => void;

  /**
   * Optional metadata describing which logical sources compose the graph.
   * Used by multi-repo UIs (breadcrumbs, repo pickers). Omit on single-repo
   * or sample-data sources.
   */
  describe?(): Promise<GraphSourceDescription>;
}
