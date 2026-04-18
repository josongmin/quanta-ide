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

// Thin coordination facade.
// -------------------------------------------------------------------
// Primary API is now the four focused stores (`viewportStore`,
// `sceneStore`, `interactionStore`, `settingsStore`) and their
// `useXxxStore` hooks — import from the sub-store file directly for
// frame-hot code.
//
// This facade only exists for:
//   1. `batch()` — microtask-coalesced multi-sub-store writes so
//      facade subscribers never observe intermediate state.
//   2. Cross-cutting actions that mutate more than one sub-store
//      (e.g. `setGraph` also resets selection).
//   3. Compat shims (`useWorkspaceCanvas`, single-sub-store action
//      delegates, merged `getState`) for cold-path callers we
//      haven't migrated. All three are `@deprecated` — frame-hot
//      code MUST NOT touch them.

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
  pixiError: string | null;

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

// Memoized by identity of each sub-store's snapshot. Sub-stores return
// referentially-stable state until they emit, so this cache is
// invalidated only when one of them actually changes — the same moment
// `useSyncExternalStore` re-reads. Required so React sees a stable
// object between renders (otherwise tearing) on the deprecated merged
// `getState` path.
let cached: {
  vp: ViewportState;
  sc: SceneState;
  it: InteractionState;
  st: SettingsState;
  combined: WorkspaceCanvasState;
} | null = null;

/**
 * @deprecated Allocates a merged snapshot across all four sub-stores.
 * Frame-hot code MUST read directly from the relevant sub-store
 * (`viewportStore.getState()`, `sceneStore.getState()`, etc.). Kept
 * only to back the deprecated `useWorkspaceCanvas` hook.
 */
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
    showEdges: st.showEdges,
    debugHudOpen: st.debugHudOpen,
    showGridBg: st.showGridBg,
    showHitLayers: st.showHitLayers,
    forceLod: st.forceLod,
  };
  cached = { vp, sc, it, st, combined };
  return combined;
}

// Microtask-batching for atomic multi-sub-store writes.
// ---------------------------------------------------------------
// Some cross-cutting actions (notably `setGraph`) mutate multiple
// sub-stores in one logical step. Each sub-store emits synchronously,
// so without coordination the facade listener would wake N times per
// batch — and briefly expose states where e.g. the graph has changed
// but selection has not yet cleared. This counter suspends facade
// emits during the batch; at depth 0 we flush ONE combined emit via a
// microtask so React's `useSyncExternalStore` sees exactly one coherent
// snapshot. Direct sub-store subscribers still see their own per-store
// emit — that's the isolation each sub-store is designed to provide.
let _batchDepth = 0;
const _facadeListeners = new Set<() => void>();
let _pendingFlush = false;

function _flushFacadeEmit() {
  _pendingFlush = false;
  // Snapshot to an array so a listener that mutates _facadeListeners
  // during its callback (e.g. React unmounting) doesn't disturb iteration.
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

/**
 * Run `fn` as an atomic batch: every sub-store mutation inside fn still
 * runs synchronously (and still wakes that sub-store's own direct
 * subscribers), but the FACADE's combined listener is only notified once
 * via a microtask after fn returns. Re-entrant via `_batchDepth`.
 */
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

// Fan-out subscribe. Each sub-store emission wakes `_notifyFacade`,
// which honors the batch depth. The module-level handler is registered
// ONCE per sub-store below, so each facade `subscribe` is O(1).
function subscribe(listener: () => void): () => void {
  _facadeListeners.add(listener);
  return () => {
    _facadeListeners.delete(listener);
  };
}

// Module-load singletons outlive every component, so these subscriptions
// are lifelong and intentionally un-released.
viewportStore.subscribe(_notifyFacade);
sceneStore.subscribe(_notifyFacade);
interactionStore.subscribe(_notifyFacade);
settingsStore.subscribe(_notifyFacade);

// Compat action shims.
// -------------------------------------------------------------------
// Delegates to the owning sub-store. Cross-cutting actions live here;
// the rest are pure forwarders kept only so pre-refactor callers
// (DebugHud, use-worker-bridge, WorkspaceApp, …) don't break.
// Frame-hot code should call the sub-store directly.
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
  setRepoRoot(root: string | null) {
    sceneStore.setRepoRoot(root);
  },
  setLayout(layout: WorkspaceLayout) {
    sceneStore.setLayout(layout);
  },
  setLayoutProgress(
    stage: LayoutStage,
    extras?: { filesCount?: number; elapsedMs?: number; error?: string },
  ) {
    sceneStore.setLayoutProgress(stage, extras);
  },
  setPixiError(err: string | null) {
    sceneStore.setPixiError(err);
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

  // --- Viewport delegates ---
  setViewport(viewport: Viewport) {
    viewportStore.setViewport(viewport);
  },
  setContainerSize(width: number, height: number) {
    viewportStore.setContainerSize(width, height);
  },

  // --- Interaction delegates ---
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

  // --- Settings delegates ---
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

export const workspaceCanvasStore = {
  getState,
  subscribe,
  batch,
  ...actions,
};

/**
 * @deprecated Subscribes to all four sub-stores and reads via the
 * merged snapshot, so any mutation in any store wakes this hook. For
 * frame-hot paths, use `useViewportStore`, `useSceneStore`,
 * `useInteractionStore`, or `useSettingsStore` directly.
 */
export function useWorkspaceCanvas<T>(selector: (s: WorkspaceCanvasState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState()),
  );
}
