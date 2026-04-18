import { useSyncExternalStore } from "react";
import type {
  ViewState,
  LodLevel,
  PathQuery,
  PathResult,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import { findPaths } from "@quanta/canvas-engine";

// Interaction store
// -------------------------------------------------------------------
// Owns LOD + ViewState (selection / hover / focus / edge). Kept separate
// from the viewport store: hover events fire often and must not wake
// scene subscribers; pan events fire very often and must not wake
// selection subscribers.
//
// Cross-store coordination: LOD lives here because it is logically part
// of ViewState (`viewState.lod`), and the scene store consumes it via
// buildSceneQuery. The orchestrator reads from this store; the scene
// store does not. Document the dependency at the callsite.

export type TemporalMode = "off" | "live" | "diff";

export interface TemporalState {
  mode: TemporalMode;
  /** Active index in live mode; also seeds diffTo on first flip to diff. */
  snapshotIndex: number;
  /** A index in diff mode (earlier snapshot). */
  diffFrom: number;
  /** B index in diff mode (later snapshot). */
  diffTo: number;
  /** Auto-advance flag for live mode. */
  playing: boolean;
}

export interface InteractionState {
  lod: LodLevel;
  viewState: ViewState;
  pathQuery: PathQuery | null;
  pathResult: PathResult | null;
  inspectedEvidenceId: string | null;
  temporal: TemporalState;
  /** Multi-graph "flash" — files/edges tied to a single source graph are
   *  briefly emphasised (2s) when the user clicks a "graph sources" row in
   *  the HUD. Null ⇒ no flash active. */
  graphFlash: { graphId: string; until: number } | null;
  /** Active runtime trace overlay. Null ⇒ no trace; the canvas renders its
   *  usual static-edge vocabulary. When non-null, the canvas dims static
   *  edges and paints the trace's edges with the TraceEdgeRenderer. */
  activeTraceId: string | null;
}

const initialLod: LodLevel = "galaxy";
const initialViewState: ViewState = {
  lod: "galaxy",
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  hoveredEdgeId: null,
  focusedNodeId: null,
};

// Path-query solves against the active graph's edges. Injected by the orchestrator
// on graph swap so the store does not own a reference to the full graph.
let pathGraph: Pick<WorkspaceGraph, "fileEdges"> | null = null;

const initialTemporal: TemporalState = {
  mode: "off",
  snapshotIndex: 0,
  diffFrom: 0,
  diffTo: 0,
  playing: false,
};

let state: InteractionState = {
  lod: initialLod,
  viewState: initialViewState,
  pathQuery: null,
  pathResult: null,
  inspectedEvidenceId: null,
  temporal: initialTemporal,
  graphFlash: null,
  activeTraceId: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): InteractionState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setLod(lod: LodLevel) {
    if (state.lod === lod) return;
    state = {
      ...state,
      lod,
      viewState: { ...state.viewState, lod },
    };
    emit();
  },

  selectFile(fileId: string | null) {
    if (state.viewState.selectedFileId === fileId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, selectedFileId: fileId },
    };
    emit();
  },

  hoverFile(fileId: string | null) {
    if (state.viewState.hoveredFileId === fileId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredFileId: fileId },
    };
    emit();
  },

  selectEdge(edgeId: string | null) {
    if (state.viewState.selectedEdgeId === edgeId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, selectedEdgeId: edgeId },
    };
    emit();
  },

  hoverEdge(edgeId: string | null) {
    if (state.viewState.hoveredEdgeId === edgeId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredEdgeId: edgeId },
    };
    emit();
  },

  resetSelection() {
    const vs = state.viewState;
    if (
      vs.selectedFileId === null &&
      vs.hoveredFileId === null &&
      vs.selectedEdgeId === null &&
      vs.hoveredEdgeId === null &&
      vs.focusedNodeId === null
    ) return;
    state = {
      ...state,
      viewState: {
        ...state.viewState,
        selectedFileId: null,
        hoveredFileId: null,
        selectedEdgeId: null,
        hoveredEdgeId: null,
        focusedNodeId: null,
      },
    };
    emit();
  },

  // Reset LOD back to initial — used on graph swap to match LodManager
  // reset. Only fires when the value actually changes.
  resetLod(lod: LodLevel = initialLod) {
    if (state.lod === lod) return;
    state = {
      ...state,
      lod,
      viewState: { ...state.viewState, lod },
    };
    emit();
  },

  // Path query — set/clear a Bloom-style source→target query and compute
  // the result synchronously (BFS is O(V+E) which is cheap at our graph
  // sizes and avoids a reactive indirection).
  setPathGraph(g: Pick<WorkspaceGraph, "fileEdges"> | null) {
    pathGraph = g;
    // Re-solve if a query is live and the graph changed under us.
    if (state.pathQuery && g) {
      const pathResult = findPaths(g, state.pathQuery);
      state = { ...state, pathResult };
      emit();
    } else if (!g && state.pathResult) {
      state = { ...state, pathResult: null };
      emit();
    }
  },

  setPathQuery(q: PathQuery) {
    const pathResult = pathGraph ? findPaths(pathGraph, q) : null;
    state = { ...state, pathQuery: q, pathResult };
    emit();
  },

  clearPathQuery() {
    if (state.pathQuery === null && state.pathResult === null) return;
    state = { ...state, pathQuery: null, pathResult: null };
    emit();
  },

  setInspectedEvidence(evidenceId: string | null) {
    if (state.inspectedEvidenceId === evidenceId) return;
    state = { ...state, inspectedEvidenceId: evidenceId };
    emit();
  },

  // ── Temporal slider / diff mode ────────────────────────────────────
  // Writes flow through small focused setters so the HUD can bind each
  // control independently without over-eager re-emits.
  setTemporalMode(mode: TemporalMode) {
    const t = state.temporal;
    if (t.mode === mode) return;
    // Flipping into diff mode seeds the range to (0, current index) so
    // the user sees a meaningful diff immediately instead of an empty one.
    const next: TemporalState =
      mode === "diff" && t.mode !== "diff"
        ? { ...t, mode, diffFrom: 0, diffTo: t.snapshotIndex, playing: false }
        : { ...t, mode, playing: mode === "live" ? t.playing : false };
    state = { ...state, temporal: next };
    emit();
  },

  setSnapshotIndex(index: number) {
    const t = state.temporal;
    if (t.snapshotIndex === index) return;
    state = { ...state, temporal: { ...t, snapshotIndex: index } };
    emit();
  },

  setDiffRange(from: number, to: number) {
    const t = state.temporal;
    if (t.diffFrom === from && t.diffTo === to) return;
    state = { ...state, temporal: { ...t, diffFrom: from, diffTo: to } };
    emit();
  },

  setTemporalPlaying(playing: boolean) {
    const t = state.temporal;
    if (t.playing === playing) return;
    state = { ...state, temporal: { ...t, playing } };
    emit();
  },

  setActiveTrace(id: string | null) {
    if (state.activeTraceId === id) return;
    state = { ...state, activeTraceId: id };
    emit();
  },

  flashGraph(graphId: string, durationMs = 2000) {
    state = { ...state, graphFlash: { graphId, until: Date.now() + durationMs } };
    emit();
    window.setTimeout(() => {
      const cur = state.graphFlash;
      if (cur && cur.graphId === graphId && Date.now() >= cur.until - 1) {
        state = { ...state, graphFlash: null };
        emit();
      }
    }, durationMs);
  },
};

export const interactionStore = { getState, subscribe, ...actions };

// Focus is NOT a stored field — selection and hover already carry that intent.
// The focus target is the selection (sticky) if present, otherwise hover
// (ephemeral). Deriving here keeps focus always consistent with the truth
// state and avoids a third source of "which file is the user looking at".
export function getFocusFileId(s: InteractionState): string | null {
  return s.viewState.selectedFileId ?? s.viewState.hoveredFileId ?? null;
}

export function useInteractionStore<T>(selector: (s: InteractionState) => T): T {
  return useSyncExternalStore(
    interactionStore.subscribe,
    () => selector(interactionStore.getState()),
    () => selector(interactionStore.getState()),
  );
}
