import { useSyncExternalStore } from "react";
import type {
  ViewState,
  LodLevel,
  PathQuery,
  PathResult,
} from "@quanta/canvas-engine";
import { findPaths } from "@quanta/canvas-engine";
import { sceneStore } from "./scene-store";

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

export type FocusMode = "off" | "on";
export type FocusHops = 1 | 2;

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
  /** World-space anchor of the user's click when an edge was selected, so
   *  the EdgeInfoPopover can surface next to the click point rather than
   *  at the edge midpoint. Null when no edge is selected via click. */
  selectedEdgePoint: { worldX: number; worldY: number } | null;
  focusMode: FocusMode;
  focusHops: FocusHops;
  focusDimOpacity: number;
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
  hoveredClusterId: null,
  hoveredSuperclusterId: null,
  selectedSymbolId: null,
  hoveredSymbolId: null,
};

// Path-query solves against the active graph's edges. The graph is read
// on demand from the scene store at query time (see `setPathQuery`); the
// interaction store does NOT cache or own a reference to it, so a graph
// swap can never leave path queries running against stale data.

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
  selectedEdgePoint: null,
  focusMode: "on",
  focusHops: 1,
  focusDimOpacity: 0.3,
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

  // Symbol-tier selection. Sets the symbol id and co-selects its parent
  // file — callers always want both (the canvas focuses the file; the
  // layout narrows to the symbol's edges). `fileId` is stored separately
  // so clearing just the symbol (`selectSymbol(null, fileId)` is not a
  // valid call) leaves the file selection intact via `selectFile`.
  selectSymbol(symbolId: string | null, fileId: string | null = null) {
    const vs = state.viewState;
    const nextFileId = fileId ?? vs.selectedFileId;
    if (vs.selectedSymbolId === symbolId && vs.selectedFileId === nextFileId) return;
    state = {
      ...state,
      viewState: {
        ...vs,
        selectedSymbolId: symbolId,
        selectedFileId: nextFileId,
      },
    };
    emit();
  },

  hoverSymbol(symbolId: string | null) {
    if (state.viewState.hoveredSymbolId === symbolId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredSymbolId: symbolId },
    };
    emit();
  },

  selectEdge(edgeId: string | null) {
    if (state.viewState.selectedEdgeId === edgeId && state.selectedEdgePoint === null) return;
    state = {
      ...state,
      viewState: { ...state.viewState, selectedEdgeId: edgeId },
      selectedEdgePoint: null,
    };
    emit();
  },

  // Variant used by the edge-pick click handler: records the world-space
  // click anchor alongside the selection so EdgeInfoPopover can surface
  // next to the click instead of the edge midpoint.
  selectEdgeAt(edgeId: string, worldX: number, worldY: number) {
    state = {
      ...state,
      viewState: { ...state.viewState, selectedEdgeId: edgeId },
      selectedEdgePoint: { worldX, worldY },
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

  // Parity with hoverFile/hoverEdge at the supergalaxy tier. ClusterNodeRenderer
  // already fires pointerover/pointerout via its onHover option — before this
  // store action the callback was dropped on the floor (registerRenderer only
  // plumbed onClusterClick), so any hover-driven popover at cluster-tier was
  // silently dead. Same behavior at every LOD = this slot in the store.
  hoverCluster(clusterId: string | null) {
    if (state.viewState.hoveredClusterId === clusterId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredClusterId: clusterId },
    };
    emit();
  },

  hoverSupercluster(superclusterId: string | null) {
    if (state.viewState.hoveredSuperclusterId === superclusterId) return;
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredSuperclusterId: superclusterId },
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
      vs.focusedNodeId === null &&
      vs.hoveredClusterId === null &&
      vs.hoveredSuperclusterId === null &&
      vs.selectedSymbolId === null &&
      vs.hoveredSymbolId === null &&
      state.selectedEdgePoint === null
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
        hoveredClusterId: null,
        hoveredSuperclusterId: null,
        selectedSymbolId: null,
        hoveredSymbolId: null,
      },
      selectedEdgePoint: null,
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
  // sizes and avoids a reactive indirection). The graph is read from
  // sceneStore at call time so path results always reflect the active
  // graph without a separate injection ceremony.
  setPathQuery(q: PathQuery) {
    const graph = sceneStore.getState().graph;
    const pathResult = graph ? findPaths(graph, q) : null;
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

  setFocusMode(v: FocusMode) {
    if (state.focusMode === v) return;
    state = { ...state, focusMode: v };
    emit();
  },

  setFocusHops(v: FocusHops) {
    if (state.focusHops === v) return;
    state = { ...state, focusHops: v };
    emit();
  },

  setFocusDimOpacity(v: number) {
    const clamped = Math.max(0, Math.min(0.5, v));
    if (state.focusDimOpacity === clamped) return;
    state = { ...state, focusDimOpacity: clamped };
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
