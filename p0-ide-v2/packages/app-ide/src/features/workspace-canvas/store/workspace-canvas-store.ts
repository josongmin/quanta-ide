import { useSyncExternalStore } from "react";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceView,
  ViewState,
  LodLevel,
  Viewport,
} from "@quanta/canvas-engine";

export interface GroundFileData {
  // populated by DataTier loaders
  source?: string;        // Tier 2
  tokenized?: string[][];  // Tier 3
}

export type LayoutStage = "idle" | "requested" | "grid-ready" | "elk-running" | "elk-skipped" | "elk-done" | "elk-failed";

export interface LayoutProgress {
  stage: LayoutStage;
  filesCount: number;
  startedAt: number; // performance.now() when request was made
  lastUpdateMs: number; // elapsed ms at last stage transition
}

export interface WorkspaceCanvasState {
  graph: WorkspaceGraph | null;
  layout: WorkspaceLayout | null;
  visibleScene: WorkspaceView | null;

  viewport: Viewport;
  lod: LodLevel;
  viewState: ViewState;

  groundData: Record<string, GroundFileData | undefined>;
  groundLoading: Record<string, boolean>;

  workerLayout: boolean;
  workerAggregates: boolean;
  workerGeometry: boolean;

  layoutProgress: LayoutProgress;

  // Render toggles — kept in the store so CanvasControls and PixiStage can
  // subscribe independently without prop-drilling through MultiFileCanvas.
  showEdges: boolean;
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

const initialViewport: Viewport = { x: 0, y: 0, scale: 0.1, width: 0, height: 0 };
const initialLod: LodLevel = "galaxy";
const initialViewState: ViewState = {
  lod: "galaxy",
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  focusedNodeId: null,
};

const initialLayoutProgress: LayoutProgress = {
  stage: "idle",
  filesCount: 0,
  startedAt: 0,
  lastUpdateMs: 0,
};

let state: WorkspaceCanvasState = {
  graph: null,
  layout: null,
  visibleScene: null,

  viewport: initialViewport,
  lod: initialLod,
  viewState: initialViewState,

  groundData: {},
  groundLoading: {},

  workerLayout: false,
  workerAggregates: false,
  workerGeometry: false,

  layoutProgress: initialLayoutProgress,

  showEdges: true,
};

function getState(): WorkspaceCanvasState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setGraph(graph: WorkspaceGraph) {
    // Reset derived state when the graph changes — the old layout/visibleScene
    // reference the previous graph's file IDs and would render incorrectly
    // (or crash spatial queries) against the new graph. MultiFileCanvas shows
    // the loading div until the worker posts a fresh layout for this graph.
    state = {
      ...state,
      graph,
      layout: null,
      visibleScene: null,
      viewState: { ...state.viewState, selectedFileId: null, hoveredFileId: null, selectedEdgeId: null, focusedNodeId: null },
      groundData: {},
      groundLoading: {},
      layoutProgress: {
        stage: "requested",
        filesCount: graph.files.length,
        startedAt: performance.now(),
        lastUpdateMs: 0,
      },
    };
    emit();
  },

  setShowEdges(show: boolean) {
    if (state.showEdges === show) return;
    state = { ...state, showEdges: show };
    emit();
  },

  setLayoutProgress(stage: LayoutStage, extras?: { filesCount?: number; elapsedMs?: number }) {
    state = {
      ...state,
      layoutProgress: {
        ...state.layoutProgress,
        stage,
        filesCount: extras?.filesCount ?? state.layoutProgress.filesCount,
        lastUpdateMs: extras?.elapsedMs ?? (performance.now() - state.layoutProgress.startedAt),
      },
    };
    emit();
  },

  setLayout(layout: WorkspaceLayout) {
    state = { ...state, layout };
    emit();
  },

  setVisibleScene(scene: WorkspaceView) {
    state = { ...state, visibleScene: scene };
    emit();
  },

  setViewport(viewport: Viewport) {
    // Do NOT spread viewState here. viewState carries only interaction fields
    // (selection/hover/lod). Recreating it on every pan tick causes every
    // `useWorkspaceCanvas(s => s.viewState)` subscriber to re-render — which
    // at 60 Hz pan × 5000+ visible items dominates the frame budget.
    state = { ...state, viewport };
    emit();
  },

  setLod(lod: LodLevel) {
    state = {
      ...state,
      lod,
      viewState: { ...state.viewState, lod },
    };
    emit();
  },

  selectFile(fileId: string | null) {
    state = {
      ...state,
      viewState: { ...state.viewState, selectedFileId: fileId },
    };
    emit();
  },

  hoverFile(fileId: string | null) {
    state = {
      ...state,
      viewState: { ...state.viewState, hoveredFileId: fileId },
    };
    emit();
  },

  selectEdge(edgeId: string | null) {
    state = {
      ...state,
      viewState: { ...state.viewState, selectedEdgeId: edgeId },
    };
    emit();
  },

  setGroundData(fileId: string, data: GroundFileData) {
    state = {
      ...state,
      groundData: { ...state.groundData, [fileId]: data },
    };
    emit();
  },

  setGroundLoading(fileId: string, loading: boolean) {
    state = {
      ...state,
      groundLoading: { ...state.groundLoading, [fileId]: loading },
    };
    emit();
  },

  setWorkerState(key: "workerLayout" | "workerAggregates" | "workerGeometry", val: boolean) {
    state = { ...state, [key]: val };
    emit();
  },
};

export const workspaceCanvasStore = { getState, subscribe, ...actions };

export function useWorkspaceCanvas<T>(selector: (s: WorkspaceCanvasState) => T): T {
  return useSyncExternalStore(
    workspaceCanvasStore.subscribe,
    () => selector(workspaceCanvasStore.getState()),
    () => selector(workspaceCanvasStore.getState()),
  );
}
