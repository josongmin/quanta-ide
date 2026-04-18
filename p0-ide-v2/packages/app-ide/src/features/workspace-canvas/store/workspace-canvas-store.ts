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
}

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

const initialViewport: Viewport = { x: 0, y: 0, scale: 0.1, width: 0, height: 0 };
const initialLod: LodLevel = "galaxy";
const initialViewState: ViewState = {
  viewport: initialViewport,
  lod: "galaxy",
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  focusedNodeId: null,
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
    state = { ...state, graph };
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
    state = {
      ...state,
      viewport,
      viewState: { ...state.viewState, viewport },
    };
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
