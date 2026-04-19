import { useSyncExternalStore } from "react";
import type {
  GraphHistory,
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
} from "@quanta/canvas-engine";
import type { HebBatch } from "@quanta/canvas-worker";

// Scene store
// -------------------------------------------------------------------
// Owns the graph, layout, per-tier scene views, repo root, layout
// progress, worker-busy flags, and per-file ground data. Changes here
// do not wake viewport / interaction / settings subscribers.
//
// Coordination: scene rebuilds read from both this store and the
// interaction store's `lod` field; the orchestrator (use-workspace-canvas)
// is responsible for plumbing that cross-store read. scene mutations
// also occasionally need to reset interaction (e.g. selection must
// clear when the graph swaps) — those resets are wired in the
// orchestrator / facade, not here, so each store stays single-purpose.

export interface GroundFileData {
  // populated by DataTier loaders
  source?: string;        // Tier 2
  tokenized?: string[][];  // Tier 3
}

export type LayoutStage =
  | "idle"
  | "requested"
  | "grid-ready"
  | "elk-running"
  | "elk-skipped"
  | "elk-done"
  | "elk-failed"
  // Terminal failure stage emitted by the worker bridge when the worker
  // posts WORKER_ERROR. The LoadingOverlay renders a distinct red error
  // state for this stage with a reload button.
  | "worker-error";

export interface LayoutProgress {
  stage: LayoutStage;
  filesCount: number;
  startedAt: number; // performance.now() when request was made
  lastUpdateMs: number; // elapsed ms at last stage transition
  // Human-readable error message — only set when stage === "worker-error".
  error?: string;
}

export interface SceneState {
  graph: WorkspaceGraph | null;
  layout: WorkspaceLayout | null;
  visibleScene: WorkspaceView | null;
  // Populated only at supergalaxy LOD; mutually exclusive with a meaningful
  // visibleScene.
  clusterScene: WorkspaceClusterView | null;
  // Populated only at universe LOD; mutually exclusive with both
  // visibleScene and clusterScene.
  superclusterScene: WorkspaceSuperclusterView | null;

  // Absolute path of the repo currently loaded (null when the built-in
  // sample graph is active).
  repoRoot: string | null;

  groundData: Record<string, GroundFileData | undefined>;
  groundLoading: Record<string, boolean>;

  workerLayout: boolean;
  workerAggregates: boolean;
  workerGeometry: boolean;
  workerHeb: boolean;

  // Hierarchical Edge Bundling output, rebuilt on galaxy-LOD entry by the
  // `use-heb-paths` hook. Consumers (future EdgeStaticRenderer integration)
  // can iterate `edgeIds` + slice `samples` by `offsets`/`lengths`. Null
  // until the first rebuild completes.
  hebPaths: HebBatch | null;

  layoutProgress: LayoutProgress;

  // Pixi/WebGL init failure — set by MultiFileCanvas when PixiStage surfaces
  // onPixiError. Non-null value triggers a WebGL-unavailable fallback UI.
  pixiError: string | null;
}

const initialLayoutProgress: LayoutProgress = {
  stage: "idle",
  filesCount: 0,
  startedAt: 0,
  lastUpdateMs: 0,
};

let state: SceneState = {
  graph: null,
  layout: null,
  visibleScene: null,
  clusterScene: null,
  superclusterScene: null,

  repoRoot: null,

  groundData: {},
  groundLoading: {},

  workerLayout: false,
  workerAggregates: false,
  workerGeometry: false,
  workerHeb: false,

  hebPaths: null,

  layoutProgress: initialLayoutProgress,

  pixiError: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): SceneState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  // Replace the graph. Also wipes layout + per-tier scenes + ground caches,
  // because those referenced the old graph's file ids. NOTE: callers must
  // separately reset interaction state (selection / hover) — the facade
  // handles that; direct scene-store users should call
  // `interactionStore.resetSelection()` themselves.
  setGraph(graph: WorkspaceGraph) {
    state = {
      ...state,
      graph,
      layout: null,
      visibleScene: null,
      clusterScene: null,
      superclusterScene: null,
      groundData: {},
      groundLoading: {},
      // HEB cache references file/edge ids that are about to disappear.
      // Drop it so consumers don't render stale splines against the new
      // layout; the hook will re-request once the new layout arrives.
      hebPaths: null,
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
    state = { ...state, repoRoot: root, groundData: {}, groundLoading: {} };
    emit();
  },

  setLayout(layout: WorkspaceLayout) {
    if (state.layout === layout) return;
    state = { ...state, layout };
    emit();
  },

  setLayoutProgress(
    stage: LayoutStage,
    extras?: { filesCount?: number; elapsedMs?: number; error?: string },
  ) {
    state = {
      ...state,
      layoutProgress: {
        ...state.layoutProgress,
        stage,
        filesCount: extras?.filesCount ?? state.layoutProgress.filesCount,
        lastUpdateMs: extras?.elapsedMs ?? (performance.now() - state.layoutProgress.startedAt),
        // Only attach error message on the terminal failure stage; clear it
        // otherwise so stale text doesn't leak into the next run.
        error: stage === "worker-error" ? extras?.error : undefined,
      },
    };
    emit();
  },

  setPixiError(err: string | null) {
    if (state.pixiError === err) return;
    state = { ...state, pixiError: err };
    emit();
  },

  setVisibleScene(scene: WorkspaceView) {
    if (state.visibleScene === scene && state.clusterScene === null && state.superclusterScene === null) return;
    state = { ...state, visibleScene: scene, clusterScene: null, superclusterScene: null };
    emit();
  },

  setClusterScene(scene: WorkspaceClusterView) {
    if (state.clusterScene === scene && state.visibleScene === null && state.superclusterScene === null) return;
    state = { ...state, clusterScene: scene, visibleScene: null, superclusterScene: null };
    emit();
  },

  setSuperclusterScene(scene: WorkspaceSuperclusterView) {
    if (state.superclusterScene === scene && state.visibleScene === null && state.clusterScene === null) return;
    state = { ...state, superclusterScene: scene, visibleScene: null, clusterScene: null };
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
  // loading flags in one atomic update → single emission instead of 2N.
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

  setGroundLoadingBatch(fileIds: readonly string[], loading: boolean) {
    if (fileIds.length === 0) return;
    const next = { ...state.groundLoading };
    for (const id of fileIds) next[id] = loading;
    state = { ...state, groundLoading: next };
    emit();
  },

  setWorkerState(
    key: "workerLayout" | "workerAggregates" | "workerGeometry" | "workerHeb",
    val: boolean,
  ) {
    if (state[key] === val) return;
    state = { ...state, [key]: val };
    emit();
  },

  setHebPaths(paths: HebBatch | null) {
    if (state.hebPaths === paths) return;
    state = { ...state, hebPaths: paths };
    emit();
  },

  // Patch only the graph.history field in place. Used by the temporal
  // history bridge so swapping between mock and git commit sources doesn't
  // tear down layout/scenes/ground caches the way `setGraph` does. The
  // graph must already be installed; no-op otherwise. Pass `undefined` to
  // clear the history (temporal UI falls back to "no commits").
  setGraphHistory(history: GraphHistory | undefined) {
    const g = state.graph;
    if (!g) return;
    if (g.history === history) return;
    state = { ...state, graph: { ...g, history } };
    emit();
  },
};

export const sceneStore = { getState, subscribe, ...actions };

export function useSceneStore<T>(selector: (s: SceneState) => T): T {
  return useSyncExternalStore(
    sceneStore.subscribe,
    () => selector(sceneStore.getState()),
    () => selector(sceneStore.getState()),
  );
}
