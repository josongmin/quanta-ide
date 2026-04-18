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
import { renderSettingsStore, type RenderSettingsState } from "./render-settings-store";
import { uxSettingsStore, type UxSettingsState } from "./ux-settings-store";
import { debugSettingsStore, type DebugSettingsState, type ForceLod } from "./debug-settings-store";

// Thin coordination facade.
// -------------------------------------------------------------------
// Primary API is the focused stores (`viewportStore`, `sceneStore`,
// `interactionStore`, `renderSettingsStore`, `uxSettingsStore`,
// `debugSettingsStore`). Import them directly for frame-hot code.
//
// This facade only exists for:
//   1. `batch()` — microtask-coalesced multi-sub-store writes so
//      facade subscribers never observe intermediate state.
//   2. Cross-cutting actions that mutate more than one sub-store
//      (e.g. `setGraph` also resets selection).
//   3. A merged snapshot used by the `@deprecated` `useWorkspaceCanvas`
//      hook, which is retained only for cold-path callers.

export type {
  GroundFileData,
  LayoutStage,
  LayoutProgress,
  ForceLod,
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
  pixiError: string | null;

  // Viewport
  viewport: Viewport;

  // Interaction
  lod: LodLevel;
  viewState: ViewState;

  // Settings (flattened across render / ux / debug slices for the legacy
  // facade surface).
  showEdges: boolean;
  debugHudOpen: boolean;
  showGridBg: boolean;
  showHitLayers: boolean;
  forceLod: ForceLod;
}

let cached: {
  vp: ViewportState;
  sc: SceneState;
  it: InteractionState;
  rs: RenderSettingsState;
  ux: UxSettingsState;
  db: DebugSettingsState;
  combined: WorkspaceCanvasState;
} | null = null;

/**
 * @deprecated Allocates a merged snapshot across every sub-store. Frame-hot
 * code MUST read directly from the relevant sub-store.
 */
function getState(): WorkspaceCanvasState {
  const vp = viewportStore.getState();
  const sc = sceneStore.getState();
  const it = interactionStore.getState();
  const rs = renderSettingsStore.getState();
  const ux = uxSettingsStore.getState();
  const db = debugSettingsStore.getState();
  if (
    cached &&
    cached.vp === vp &&
    cached.sc === sc &&
    cached.it === it &&
    cached.rs === rs &&
    cached.ux === ux &&
    cached.db === db
  ) {
    return cached.combined;
  }
  const combined: WorkspaceCanvasState = {
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
    pixiError: sc.pixiError,
    viewport: vp.viewport,
    lod: it.lod,
    viewState: it.viewState,
    showEdges: rs.showEdges,
    debugHudOpen: db.debugHudOpen,
    showGridBg: ux.showGridBg,
    showHitLayers: ux.showHitLayers,
    forceLod: db.forceLod,
  };
  cached = { vp, sc, it, rs, ux, db, combined };
  return combined;
}

let _batchDepth = 0;
const _facadeListeners = new Set<() => void>();
let _pendingFlush = false;

function _flushFacadeEmit() {
  _pendingFlush = false;
  for (const l of [..._facadeListeners]) l();
}

function _notifyFacade() {
  if (_batchDepth > 0) {
    if (!_pendingFlush) {
      _pendingFlush = true;
      queueMicrotask(_flushFacadeEmit);
    }
    return;
  }
  for (const l of [..._facadeListeners]) l();
}

function batch<T>(fn: () => T): T {
  _batchDepth++;
  try {
    return fn();
  } finally {
    _batchDepth--;
    if (_batchDepth === 0 && !_pendingFlush) {
      _pendingFlush = true;
      queueMicrotask(_flushFacadeEmit);
    }
  }
}

function subscribe(listener: () => void): () => void {
  _facadeListeners.add(listener);
  return () => { _facadeListeners.delete(listener); };
}

viewportStore.subscribe(_notifyFacade);
sceneStore.subscribe(_notifyFacade);
interactionStore.subscribe(_notifyFacade);
renderSettingsStore.subscribe(_notifyFacade);
uxSettingsStore.subscribe(_notifyFacade);
debugSettingsStore.subscribe(_notifyFacade);

const actions = {
  // Cross-cutting: graph swap must also reset stale selection/hover/edge
  // ids so UI never dereferences a node that no longer exists.
  setGraph(graph: WorkspaceGraph) {
    batch(() => {
      sceneStore.setGraph(graph);
      interactionStore.resetSelection();
    });
  },

  // --- Scene delegates ---
  setRepoRoot(root: string | null) { sceneStore.setRepoRoot(root); },
  setLayout(layout: WorkspaceLayout) { sceneStore.setLayout(layout); },
  setLayoutProgress(
    stage: LayoutStage,
    extras?: { filesCount?: number; elapsedMs?: number; error?: string },
  ) {
    sceneStore.setLayoutProgress(stage, extras);
  },
  setPixiError(err: string | null) { sceneStore.setPixiError(err); },
  setVisibleScene(scene: WorkspaceView) { sceneStore.setVisibleScene(scene); },
  setClusterScene(scene: WorkspaceClusterView) { sceneStore.setClusterScene(scene); },
  setSuperclusterScene(scene: WorkspaceSuperclusterView) { sceneStore.setSuperclusterScene(scene); },
  setGroundData(fileId: string, data: GroundFileData) { sceneStore.setGroundData(fileId, data); },
  setGroundDataBatch(
    entries: Array<{ id: string; data: GroundFileData }>,
    setLoadingFalseFor?: readonly string[],
  ) {
    sceneStore.setGroundDataBatch(entries, setLoadingFalseFor);
  },
  setGroundLoading(fileId: string, loading: boolean) { sceneStore.setGroundLoading(fileId, loading); },
  setGroundLoadingBatch(fileIds: readonly string[], loading: boolean) {
    sceneStore.setGroundLoadingBatch(fileIds, loading);
  },
  setWorkerState(key: "workerLayout" | "workerAggregates" | "workerGeometry", val: boolean) {
    sceneStore.setWorkerState(key, val);
  },

  // --- Viewport delegates ---
  setViewport(viewport: Viewport) { viewportStore.setViewport(viewport); },
  setContainerSize(width: number, height: number) { viewportStore.setContainerSize(width, height); },

  // --- Interaction delegates ---
  setLod(lod: LodLevel) { interactionStore.setLod(lod); },
  selectFile(fileId: string | null) { interactionStore.selectFile(fileId); },
  hoverFile(fileId: string | null) { interactionStore.hoverFile(fileId); },
  selectEdge(edgeId: string | null) { interactionStore.selectEdge(edgeId); },

  // --- Settings delegates (dispatched to the correct slice) ---
  setShowEdges(show: boolean) { renderSettingsStore.setShowEdges(show); },
  toggleDebugHud() { debugSettingsStore.toggleDebugHud(); },
  setShowGridBg(v: boolean) { uxSettingsStore.setShowGridBg(v); },
  setShowHitLayers(v: boolean) { uxSettingsStore.setShowHitLayers(v); },
  setForceLod(v: ForceLod) { debugSettingsStore.setForceLod(v); },
};

export const workspaceCanvasStore = {
  getState,
  subscribe,
  batch,
  ...actions,
};

/**
 * @deprecated Subscribes to every sub-store and reads via the merged
 * snapshot, so any mutation anywhere wakes this hook. For frame-hot paths,
 * use `useViewportStore`, `useSceneStore`, `useInteractionStore`,
 * `useRenderSettings`, `useUxSettings`, or `useDebugSettings` directly.
 */
export function useWorkspaceCanvas<T>(selector: (s: WorkspaceCanvasState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
