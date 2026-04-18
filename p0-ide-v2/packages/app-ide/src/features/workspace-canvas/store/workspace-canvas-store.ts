import { useSyncExternalStore } from "react";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
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
  // Populated only at supergalaxy LOD; mutually exclusive with a meaningful
  // visibleScene. Renderers branch on this to draw cluster boxes instead of
  // per-file cards when the user is zoomed all the way out.
  clusterScene: WorkspaceClusterView | null;
  // Populated only at universe LOD (one tier above supergalaxy); mutually
  // exclusive with both visibleScene and clusterScene. Renderers draw one
  // box per top-level service/crate-group so large MSA monorepos collapse
  // into a handful of boxes at the most zoomed-out tier.
  superclusterScene: WorkspaceSuperclusterView | null;

  // Absolute path of the repo currently loaded (null when the built-in
  // sample graph is active). Loaders use this to know whether to fetch
  // source over the network or use SAMPLE_SOURCES.
  repoRoot: string | null;

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

  // Debug HUD — surfaces LOD / viewport / counts in a corner overlay, and
  // exposes a small set of render toggles useful during perf work.
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: "auto" | "universe" | "supergalaxy" | "galaxy" | "city" | "street" | "ground";
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
  clusterScene: null,
  superclusterScene: null,

  repoRoot: null,

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
  debugHudOpen: true,
  showGridBg: true,
  showHitLayers: false,
  forceLod: "auto",
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
      clusterScene: null,
      superclusterScene: null,
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

  setRepoRoot(root: string | null) {
    if (state.repoRoot === root) return;
    // Changing repo roots invalidates cached source — wipe groundData.
    state = { ...state, repoRoot: root, groundData: {}, groundLoading: {} };
    emit();
  },

  setShowEdges(show: boolean) {
    if (state.showEdges === show) return;
    state = { ...state, showEdges: show };
    emit();
  },

  toggleDebugHud() {
    state = { ...state, debugHudOpen: !state.debugHudOpen };
    emit();
  },

  setShowGridBg(v: boolean) {
    if (state.showGridBg === v) return;
    state = { ...state, showGridBg: v };
    emit();
  },

  setShowHitLayers(v: boolean) {
    if (state.showHitLayers === v) return;
    state = { ...state, showHitLayers: v };
    emit();
  },

  setForceLod(v: WorkspaceCanvasState["forceLod"]) {
    if (state.forceLod === v) return;
    state = { ...state, forceLod: v };
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
    // Mutual exclusivity: clear both coarser-tier scenes so PixiStage never
    // sees two scene types at once.
    state = { ...state, visibleScene: scene, clusterScene: null, superclusterScene: null };
    emit();
  },

  setClusterScene(scene: WorkspaceClusterView) {
    // Mutual exclusivity: clearing visibleScene prevents stale file geometry
    // from being passed to PixiStage when we're at supergalaxy.
    state = { ...state, clusterScene: scene, visibleScene: null, superclusterScene: null };
    emit();
  },

  setSuperclusterScene(scene: WorkspaceSuperclusterView) {
    // Mutual exclusivity: at universe LOD we draw only supercluster boxes,
    // so both finer-grain scenes are cleared to keep PixiStage branching
    // trivially on `lod === "universe"`.
    state = { ...state, superclusterScene: scene, visibleScene: null, clusterScene: null };
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

  // Batch version — applies N (id, data) pairs + optionally clears
  // loading flags in one atomic update → single store emission instead
  // of 2N. Called by the batched ground fetcher when several cards
  // resolve together.
  setGroundDataBatch(
    entries: Array<{ id: string; data: GroundFileData }>,
    setLoadingFalseFor?: readonly string[],
  ) {
    if (entries.length === 0 && (!setLoadingFalseFor || setLoadingFalseFor.length === 0)) return;
    const nextData = { ...state.groundData };
    for (const e of entries) nextData[e.id] = e.data;
    let nextLoading = state.groundLoading;
    if (setLoadingFalseFor && setLoadingFalseFor.length > 0) {
      nextLoading = { ...nextLoading };
      for (const id of setLoadingFalseFor) nextLoading[id] = false;
    }
    state = { ...state, groundData: nextData, groundLoading: nextLoading };
    emit();
  },

  setGroundLoading(fileId: string, loading: boolean) {
    state = {
      ...state,
      groundLoading: { ...state.groundLoading, [fileId]: loading },
    };
    emit();
  },

  // Batch version of setGroundLoading — flips many flags to the same
  // value in one emit. Used by the batched fetcher to mark cards
  // "loading" the moment they're queued.
  setGroundLoadingBatch(fileIds: readonly string[], loading: boolean) {
    if (fileIds.length === 0) return;
    const next = { ...state.groundLoading };
    for (const id of fileIds) next[id] = loading;
    state = { ...state, groundLoading: next };
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
