import { useMemo } from "react";
import {
  computeNeighborhood,
  compileEdgeFilter,
  compileEdgeFilterWithContext,
} from "@quanta/canvas-engine";
import type { FileEdge, WorkspaceGraph, WorkspaceLayout, ViewState } from "@quanta/canvas-engine";
import { useInteractionStore } from "../store/interaction-store";
import { useRenderSettings } from "../store/render-settings-store";
import { featureFlagsStore } from "../store/feature-flags-store";

export interface EdgeFocusLogic {
  edgeFocus: { edgeIds: ReadonlySet<string>; dimAlpha: number } | undefined;
  edgePredicate: (edge: FileEdge) => boolean | undefined;
  edgeViolations: ReadonlySet<string> | undefined;
}

// Derives the three "which edges are spotlighted / dimmed / flagged" inputs
// that PixiStage consumes for edge rendering. Combines:
//   1. Focus-mode neighborhood (N-hop BFS around selection/hover).
//   2. Path-query shortest-path result (takes precedence).
//   3. Arch-violation set from the layout.
//   4. Live filter DSL predicate.
//
// Keeping this derivation out of MultiFileCanvas lets the canvas focus on
// DOM wiring; the audit flagged the inline nested ternary here as a major
// readability smell.
export function useEdgeFocusLogic(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout | null,
  viewState: ViewState,
): {
  edgeFocus: { edgeIds: ReadonlySet<string>; dimAlpha: number } | undefined;
  edgePredicate: ((edge: FileEdge) => boolean) | undefined;
  edgeViolations: ReadonlySet<string> | undefined;
} {
  const focusMode = useInteractionStore(s => s.focusMode);
  const focusHops = useInteractionStore(s => s.focusHops);
  const focusDimOpacity = useInteractionStore(s => s.focusDimOpacity);
  const edgeFilterQuery = useRenderSettings(s => s.edgeFilterQuery);
  const highlightArchViolations = useRenderSettings(s => s.highlightArchViolations);
  const pathQuery = useInteractionStore(s => s.pathQuery);
  const pathResult = useInteractionStore(s => s.pathResult);

  const focusId = viewState.selectedFileId ?? viewState.hoveredFileId ?? null;

  const focusEdgeIds = useMemo<ReadonlySet<string> | null>(() => {
    if (focusMode !== "on" || !focusId || !graph.fileEdges) return null;
    return computeNeighborhood({ fileEdges: graph.fileEdges }, focusId, focusHops).edges;
  }, [graph.fileEdges, focusId, focusHops, focusMode]);

  const pathEdgeIds = useMemo<ReadonlySet<string> | null>(() => {
    if (!pathQuery || !pathResult || pathResult.paths.length === 0) return null;
    const out = new Set<string>();
    for (const p of pathResult.paths) for (const id of p.edgeIds) out.add(id);
    return out;
  }, [pathQuery, pathResult]);

  // Path-query wins over selection focus. Explicit if/else replaces the
  // original nested ternary — readers don't need to unwind three levels to
  // see which branch fires.
  let edgeFocus: { edgeIds: ReadonlySet<string>; dimAlpha: number } | undefined;
  if (pathEdgeIds) {
    edgeFocus = { edgeIds: pathEdgeIds, dimAlpha: focusDimOpacity };
  } else if (focusEdgeIds) {
    edgeFocus = { edgeIds: focusEdgeIds, dimAlpha: focusDimOpacity };
  } else {
    edgeFocus = undefined;
  }

  // Compile the live DSL query each time it changes. Typing re-compiles at
  // 60fps is still cheap (single-digit microseconds on a ~40-char query).
  //
  // When `temporal.dslExtensions` is enabled and history is present we use
  // the context-aware compile so temporal keys (added_since, churn, etc.)
  // have a history + current-snapshot timestamp to evaluate against.
  const temporalSnapshotIndex = useInteractionStore(s => s.temporal.snapshotIndex);
  const edgePredicate = useMemo(() => {
    const useTemporalDsl =
      featureFlagsStore.isEnabled("temporal.dslExtensions") && !!graph.history;
    if (useTemporalDsl && graph.history) {
      const snap = graph.history.snapshots[temporalSnapshotIndex];
      const commitTimestamp = snap?.timestamp;
      const res = compileEdgeFilterWithContext(edgeFilterQuery, {
        history: graph.history,
        commitTimestamp,
      });
      return res.predicate;
    }
    const res = compileEdgeFilter(edgeFilterQuery);
    return res.predicate;
  }, [edgeFilterQuery, graph.history, temporalSnapshotIndex]);

  const edgeViolations = useMemo<ReadonlySet<string> | undefined>(() => {
    if (!highlightArchViolations) return undefined;
    const v = layout?.archViolations?.edgeIds;
    return v && v.length > 0 ? new Set(v) : undefined;
  }, [highlightArchViolations, layout?.archViolations]);

  return { edgeFocus, edgePredicate, edgeViolations };
}
