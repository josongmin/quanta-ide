import { useEffect, useMemo } from "react";
import { materializeEdgeSet, diffSnapshots } from "@quanta/canvas-engine";
import type { WorkspaceGraph, Trace } from "@quanta/canvas-engine";
import { interactionStore, useInteractionStore } from "../store/interaction-store";

// Derived scene inputs that are pure functions of graph + interaction
// state. Separated from MultiFileCanvas so the canvas body shrinks to
// DOM wiring + rendering.

export function useTemporalEdgeSets(graph: WorkspaceGraph): {
  temporalEdgeSet: ReadonlySet<string> | undefined;
  diffAdded: ReadonlySet<string> | undefined;
  diffRemoved: ReadonlySet<string> | undefined;
} {
  const temporal = useInteractionStore(s => s.temporal);

  // Live mode: materialise the edge set for the selected snapshot once per
  // scrub — not per viewport tick.
  const temporalEdgeSet = useMemo<ReadonlySet<string> | undefined>(() => {
    if (temporal.mode !== "live") return undefined;
    const h = graph.history;
    if (!h || h.snapshots.length === 0) return undefined;
    return materializeEdgeSet(h, temporal.snapshotIndex);
  }, [graph.history, temporal.mode, temporal.snapshotIndex]);

  const diffSets = useMemo<{ added?: ReadonlySet<string>; removed?: ReadonlySet<string> }>(() => {
    if (temporal.mode !== "diff") return {};
    const h = graph.history;
    if (!h || h.snapshots.length === 0) return {};
    const d = diffSnapshots(h, temporal.diffFrom, temporal.diffTo);
    return { added: d.added, removed: d.removed };
  }, [graph.history, temporal.mode, temporal.diffFrom, temporal.diffTo]);

  // Live-mode auto-advance — 1200ms per snapshot; wraps at the end.
  useEffect(() => {
    if (temporal.mode !== "live" || !temporal.playing) return;
    const count = graph.history?.snapshots.length ?? 0;
    if (count < 2) return;
    const id = window.setInterval(() => {
      const cur = interactionStore.getState().temporal.snapshotIndex;
      interactionStore.setSnapshotIndex((cur + 1) % count);
    }, 1200);
    return () => window.clearInterval(id);
  }, [temporal.mode, temporal.playing, graph.history]);

  return {
    temporalEdgeSet,
    diffAdded: diffSets.added,
    diffRemoved: diffSets.removed,
  };
}

export function useActiveTrace(graph: WorkspaceGraph): {
  activeTrace: Trace | null;
  traceEdgeSet: ReadonlySet<string> | undefined;
} {
  const activeTraceId = useInteractionStore(s => s.activeTraceId);
  const activeTrace = useMemo(() => {
    if (!activeTraceId) return null;
    const pack = graph.traces;
    if (!pack) return null;
    return pack.traces.find(t => t.id === activeTraceId) ?? null;
  }, [activeTraceId, graph.traces]);
  const traceEdgeSet = useMemo<ReadonlySet<string> | undefined>(() => {
    if (!activeTrace) return undefined;
    const s = new Set<string>();
    for (const e of activeTrace.edges) s.add(`${e.from}→${e.to}`);
    return s;
  }, [activeTrace]);
  return { activeTrace, traceEdgeSet };
}

export function useCrossGraphFlash(graph: WorkspaceGraph): ReadonlySet<string> | undefined {
  const graphFlash = useInteractionStore(s => s.graphFlash);
  return useMemo<ReadonlySet<string> | undefined>(() => {
    if (!graphFlash) return undefined;
    const out = new Set<string>();
    for (const e of graph.fileEdges) {
      if (!e.crossGraph) continue;
      if (e.graphId === graphFlash.graphId) { out.add(e.id); continue; }
      const fromFile = graph.files.find(f => f.id === e.from);
      const toFile = graph.files.find(f => f.id === e.to);
      if (fromFile?.graphId === graphFlash.graphId || toFile?.graphId === graphFlash.graphId) {
        out.add(e.id);
      }
    }
    return out;
  }, [graphFlash, graph.fileEdges, graph.files]);
}
