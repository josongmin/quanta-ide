import type {
  CommitMeta,
  FileEdge,
  GraphHistory,
  GraphSnapshot,
} from "@quanta/canvas-engine";
import { deltaFromFileChanges } from "@quanta/canvas-engine";
import { sceneStore } from "../store/scene-store";
import { historyStore } from "../store/history-store";

// Temporal history bridge
// -------------------------------------------------------------------
// Connects the dead-code historyStore (which owns the real mock↔git
// source swap) to the live-code graph.history field that every
// temporal UI reads. Without this bridge the `temporal.gitSource`
// feature flag silently has no effect because no consumer actually
// subscribes to historyStore.
//
// Strategy:
//   * When a graph is installed, remember its baked-in `history` as the
//     "mock default" so we can restore it when the user flips gitSource
//     off.
//   * Subscribe to historyStore. When kind === "git" and commits have
//     loaded, project CommitMeta[] back into a GraphHistory and patch
//     it into sceneStore (via setGraphHistory, which leaves layout and
//     scenes untouched).
//   * When kind === "mock", restore the baked-in history.
//
// Edge-delta approximation: git commits only carry `filesChanged`, not
// per-edge diffs. We reuse the `deltaFromFileChanges` heuristic that
// GitHistorySource already uses — every edge incident on a touched
// file is deterministically split 50/50 into added/removed. Good
// enough for the film strip to show motion; production will replace
// this with AST-aware structural diff.

interface BridgeState {
  /** Graph we last saw from sceneStore. Identity check catches swaps. */
  lastGraph: { fileEdges: readonly FileEdge[] } | null;
  /** Original baked-in history for `lastGraph`, stashed on install. */
  originalHistory: GraphHistory | undefined;
  /** True once we've started loading git commits; prevents spam. */
  gitLoadFired: boolean;
  /** Unsubscribes if the bridge ever gets disposed. */
  disposers: Array<() => void>;
}

const bridge: BridgeState = {
  lastGraph: null,
  originalHistory: undefined,
  gitLoadFired: false,
  disposers: [],
};

/**
 * Project CommitMeta[] (newest-first) into a GraphHistory that the
 * temporal UI can consume. Snapshots are ordered oldest-first; the
 * root snapshot seeds from the full edge set so the dual-split
 * materializer has something to walk off of.
 */
export function projectCommitsToGraphHistory(
  commits: readonly CommitMeta[],
  edges: readonly FileEdge[],
): GraphHistory {
  if (commits.length === 0) return { snapshots: [], baseIndex: 0 };
  const chrono = [...commits].reverse();
  const snapshots: GraphSnapshot[] = chrono.map((c, i) => {
    const delta = deltaFromFileChanges(c.sha, c.filesChanged, edges);
    // First line only; strip CR and cap to keep the film strip tidy.
    const subject = c.message.split(/\r?\n/, 1)[0].slice(0, 96);
    const base: GraphSnapshot = {
      timestamp: c.timestamp,
      label: subject,
      commitSha: c.sha,
      author: c.author,
      authorEmail: c.authorEmail,
      message: subject,
      additions: c.additions,
      deletions: c.deletions,
    };
    if (i === 0) {
      // Seed the baseline with the full edge set so materializeEdgeSet
      // has a valid anchor — otherwise it returns an empty set and
      // DualSplit shows zero edges.
      return { ...base, edgeIds: edges.map(e => e.id) };
    }
    return { ...base, added: delta.added, removed: delta.removed };
  });
  return { snapshots, baseIndex: 0 };
}

function applyCurrentHistory(): void {
  const scene = sceneStore.getState();
  const graph = scene.graph;
  if (!graph) return;

  // Detect graph identity change → refresh cached original history.
  if (graph !== bridge.lastGraph) {
    bridge.lastGraph = graph;
    // Only stash history that we didn't write ourselves. If the current
    // graph.history was already patched by a previous bridge cycle, the
    // original would be whatever the bridge last stashed. In practice
    // setGraph always feeds fresh untouched graphs, so the identity
    // check is enough to distinguish external swaps from our own
    // setGraphHistory calls.
    bridge.originalHistory = graph.history;
    bridge.gitLoadFired = false;
  }

  const hist = historyStore.getState();
  if (hist.kind === "git") {
    if (!bridge.gitLoadFired && !hist.loading && hist.commits.length === 0) {
      // First time we see git mode — kick the load. This fires exactly
      // once per graph×kind combination; later commit arrivals come in
      // through the historyStore subscription below.
      bridge.gitLoadFired = true;
      void historyStore.loadCommits();
    }
    if (hist.commits.length > 0) {
      const projected = projectCommitsToGraphHistory(hist.commits, graph.fileEdges);
      sceneStore.setGraphHistory(projected);
    } else {
      // Still loading (or git endpoint returned nothing). Fall back to
      // the baked-in history so the temporal UI keeps working.
      sceneStore.setGraphHistory(bridge.originalHistory);
    }
  } else {
    // Mock mode — restore the graph's original baked-in history.
    sceneStore.setGraphHistory(bridge.originalHistory);
  }
}

/**
 * Install the bridge. Safe to call multiple times; subsequent calls
 * are no-ops (the bridge is process-wide, not per-component).
 *
 * Returns a disposer so tests can tear it down; production callers
 * can ignore the return value.
 */
export function installTemporalHistoryBridge(): () => void {
  if (bridge.disposers.length > 0) {
    return () => { /* already installed, dispose owned by first caller */ };
  }

  const offScene = sceneStore.subscribe(applyCurrentHistory);
  const offHistory = historyStore.subscribe(applyCurrentHistory);
  bridge.disposers.push(offScene, offHistory);

  // Run once so the bridge picks up an already-installed graph without
  // waiting for the next store emit.
  applyCurrentHistory();

  return () => {
    for (const d of bridge.disposers) d();
    bridge.disposers = [];
    bridge.lastGraph = null;
    bridge.originalHistory = undefined;
    bridge.gitLoadFired = false;
  };
}
