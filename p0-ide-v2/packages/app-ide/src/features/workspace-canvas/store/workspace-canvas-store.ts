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
import { viewportStore, type ViewportState } from "./viewport-store";
import {
  sceneStore,
  type SceneState,
  type GroundFileData,
  type LayoutStage,
  type LayoutProgress,
} from "./scene-store";
import {
  interactionStore,
  type InteractionState,
} from "./interaction-store";
import {
  settingsStore,
  type SettingsState,
  type ForceLod,
} from "./settings-store";

// Backward-compatible facade
// -------------------------------------------------------------------
// @deprecated Prefer the four focused stores — `viewportStore`,
// `sceneStore`, `interactionStore`, `settingsStore` — and their
// matching `useXxxStore(selector)` hooks. This facade fans reads and
// writes out to the right sub-store so the ~20 existing callsites do
// not need to migrate in one PR.
//
// Perf caveat: `useWorkspaceCanvas(selector)` here subscribes to ALL
// FOUR sub-stores, so any mutation in any store wakes this hook. That
// is fine for non-hot callsites (LoadingOverlay, CanvasControls, cards)
// but hot paths (MultiFileCanvas, DebugHud, Minimap) should migrate to
// the specific stores to get the isolation benefit.

export type {
  GroundFileData,
  LayoutStage,
  LayoutProgress,
};

export interface WorkspaceCanvasState {
  // Scene
  graph: WorkspaceGraph | null;
  layout: WorkspaceLayout | null;
  visibleScene: WorkspaceView | null;
  clusterScene: WorkspaceClusterView | null;
  superclusterScene: WorkspaceSuperclusterView | null;
  repoRoot: string | null;
  groundData: Record<string, GroundFileData | undefined>;
  groundLoading: Record<string, boolean>;
  workerLayout: boolean;
  workerAggregates: boolean;
  workerGeometry: boolean;
  layoutProgress: LayoutProgress;

  // Viewport
  viewport: Viewport;

  // Interaction
  lod: LodLevel;
  viewState: ViewState;

  // Settings
  showEdges: boolean;
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: ForceLod;
}

// Combined snapshot is memoized by identity of each sub-store's state
// object. Because sub-stores return referentially-stable snapshots until
// they emit, this cache is invalidated only when any of them emits —
// which is exactly when useSyncExternalStore re-reads. Required for
// `useSyncExternalStore` to see a stable object between renders when
// nothing has changed (otherwise React will tear).
let cached: {
  vp: ViewportState;
  sc: SceneState;
  it: InteractionState;
  st: SettingsState;
  combined: WorkspaceCanvasState;
} | null = null;

function getState(): WorkspaceCanvasState {
  const vp = viewportStore.getState();
  const sc = sceneStore.getState();
  const it = interactionStore.getState();
  const st = settingsStore.getState();
  if (
    cached &&
    cached.vp === vp &&
    cached.sc === sc &&
    cached.it === it &&
    cached.st === st
  ) {
    return cached.combined;
  }
  const combined: WorkspaceCanvasState = {
    // Scene
    graph: sc.graph,
    layout: sc.layout,
    visibleScene: sc.visibleScene,
    clusterScene: sc.clusterScene,
    superclusterScene: sc.superclusterScene,
    repoRoot: sc.repoRoot,
    groundData: sc.groundData,
    groundLoading: sc.groundLoading,
    workerLayout: sc.workerLayout,
    workerAggregates: sc.workerAggregates,
    workerGeometry: sc.workerGeometry,
    layoutProgress: sc.layoutProgress,
    // Viewport
    viewport: vp.viewport,
    // Interaction
    lod: it.lod,
    viewState: it.viewState,
    // Settings
    showEdges: st.showEdges,
    debugHudOpen: st.debugHudOpen,
    showGridBg: st.showGridBg,
    showHitLayers: st.showHitLayers,
    forceLod: st.forceLod,
  };
  cached = { vp, sc, it, st, combined };
  return combined;
}

// Fan-out subscribe. Any sub-store emission wakes the facade listener.
// Returns a composite cleanup so unmount in StrictMode symmetrically
// removes itself from all four sub-stores.
function subscribe(listener: () => void): () => void {
  const un1 = viewportStore.subscribe(listener);
  const un2 = sceneStore.subscribe(listener);
  const un3 = interactionStore.subscribe(listener);
  const un4 = settingsStore.subscribe(listener);
  return () => {
    un1();
    un2();
    un3();
    un4();
  };
}

// Action facade — each one dispatches to its owning sub-store. Names
// and signatures preserved from the original monolithic store so
// existing callers need no change.
const actions = {
  // --- Scene ---
  setGraph(graph: WorkspaceGraph) {
    // Scene swap must also reset interaction (selection/hover would
    // reference stale ids). Two emits (scene + interaction) but this
    // path fires on repo change only, not a hot path.
    sceneStore.setGraph(graph);
    interactionStore.resetSelection();
  },

  setRepoRoot(root: string | null) {
    sceneStore.setRepoRoot(root);
  },

  setLayout(layout: WorkspaceLayout) {
    sceneStore.setLayout(layout);
  },

  setLayoutProgress(stage: LayoutStage, extras?: { filesCount?: number; elapsedMs?: number }) {
    sceneStore.setLayoutProgress(stage, extras);
  },

  setVisibleScene(scene: WorkspaceView) {
    sceneStore.setVisibleScene(scene);
  },

  setClusterScene(scene: WorkspaceClusterView) {
    sceneStore.setClusterScene(scene);
  },

  setSuperclusterScene(scene: WorkspaceSuperclusterView) {
    sceneStore.setSuperclusterScene(scene);
  },

  setGroundData(fileId: string, data: GroundFileData) {
    sceneStore.setGroundData(fileId, data);
  },

  setGroundDataBatch(
    entries: Array<{ id: string; data: GroundFileData }>,
    setLoadingFalseFor?: readonly string[],
  ) {
    sceneStore.setGroundDataBatch(entries, setLoadingFalseFor);
  },

  setGroundLoading(fileId: string, loading: boolean) {
    sceneStore.setGroundLoading(fileId, loading);
  },

  setGroundLoadingBatch(fileIds: readonly string[], loading: boolean) {
    sceneStore.setGroundLoadingBatch(fileIds, loading);
  },

  setWorkerState(key: "workerLayout" | "workerAggregates" | "workerGeometry", val: boolean) {
    sceneStore.setWorkerState(key, val);
  },

  // --- Viewport ---
  setViewport(viewport: Viewport) {
    viewportStore.setViewport(viewport);
  },

  setContainerSize(width: number, height: number) {
    viewportStore.setContainerSize(width, height);
  },

  // --- Interaction ---
  setLod(lod: LodLevel) {
    interactionStore.setLod(lod);
  },

  selectFile(fileId: string | null) {
    interactionStore.selectFile(fileId);
  },

  hoverFile(fileId: string | null) {
    interactionStore.hoverFile(fileId);
  },

  selectEdge(edgeId: string | null) {
    interactionStore.selectEdge(edgeId);
  },

  // --- Settings ---
  setShowEdges(show: boolean) {
    settingsStore.setShowEdges(show);
  },

  toggleDebugHud() {
    settingsStore.toggleDebugHud();
  },

  setShowGridBg(v: boolean) {
    settingsStore.setShowGridBg(v);
  },

  setShowHitLayers(v: boolean) {
    settingsStore.setShowHitLayers(v);
  },

  setForceLod(v: ForceLod) {
    settingsStore.setForceLod(v);
  },
};

export const workspaceCanvasStore = { getState, subscribe, ...actions };

/**
 * @deprecated Subscribes to all four sub-stores. For hot paths, prefer
 * `useViewportStore`, `useSceneStore`, `useInteractionStore`, or
 * `useSettingsStore` directly.
 */
export function useWorkspaceCanvas<T>(selector: (s: WorkspaceCanvasState) => T): T {
  return useSyncExternalStore(
    workspaceCanvasStore.subscribe,
    () => selector(workspaceCanvasStore.getState()),
    () => selector(workspaceCanvasStore.getState()),
  );
}
