import { useSyncExternalStore } from "react";
import type { ViewState, LodLevel } from "@quanta/canvas-engine";

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

export interface InteractionState {
  lod: LodLevel;
  viewState: ViewState;
}

const initialLod: LodLevel = "galaxy";
const initialViewState: ViewState = {
  lod: "galaxy",
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  focusedNodeId: null,
};

let state: InteractionState = {
  lod: initialLod,
  viewState: initialViewState,
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

  // Bulk reset — fired by the facade when the graph changes so stale ids
  // don't linger. Kept here rather than on each sub-store action so the
  // single emit covers all four ViewState fields.
  resetSelection() {
    const vs = state.viewState;
    if (
      vs.selectedFileId === null &&
      vs.hoveredFileId === null &&
      vs.selectedEdgeId === null &&
      vs.focusedNodeId === null
    ) return;
    state = {
      ...state,
      viewState: {
        ...state.viewState,
        selectedFileId: null,
        hoveredFileId: null,
        selectedEdgeId: null,
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
};

export const interactionStore = { getState, subscribe, ...actions };

export function useInteractionStore<T>(selector: (s: InteractionState) => T): T {
  return useSyncExternalStore(
    interactionStore.subscribe,
    () => selector(interactionStore.getState()),
    () => selector(interactionStore.getState()),
  );
}
