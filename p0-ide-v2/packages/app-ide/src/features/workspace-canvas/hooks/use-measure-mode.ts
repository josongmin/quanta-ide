import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileEdge, WorkspaceGraph } from "@quanta/canvas-engine";
import { findPaths } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";

// Measure mode state machine:
//   none -> first-picked (one file chosen while M held)
//   first-picked -> second-picked -> showing-results
//   any -> none (Esc, or feature disabled)
//
// The hook wires window-level keydown/keyup to track whether "M" is held and
// hooks into selection changes to promote a file to measure A or B. Results
// (shortest path, shared deps, direct edges, layer/arch distance) are
// recomputed lazily from the current graph whenever A or B changes.

export type MeasurePhase =
  | "none"
  | "first-picked"
  | "second-picked"
  | "showing-results";

export interface MeasureResult {
  hopCount: number | null;             // null when unreachable
  sharedDeps: number;
  directEdges: number;
  layerDistance: number;               // simple ordering over ArchLayer values
  pathNodeIds: readonly string[];      // empty if unreachable
  pathEdgeIds: readonly string[];
}

const LAYER_ORDER: Record<string, number> = {
  domain: 0,
  adapter: 1,
  infra: 2,
  ui: 3,
  util: 4,
  unknown: 5,
};

function computeMeasure(
  graph: WorkspaceGraph | null,
  aId: string,
  bId: string,
): MeasureResult {
  const empty: MeasureResult = {
    hopCount: null,
    sharedDeps: 0,
    directEdges: 0,
    layerDistance: 0,
    pathNodeIds: [],
    pathEdgeIds: [],
  };
  if (!graph) return empty;

  // Shared dependencies — count files that BOTH A and B import (or call).
  const aDeps = new Set<string>();
  const bDeps = new Set<string>();
  let directEdges = 0;
  for (const e of graph.fileEdges) {
    if (e.from === aId) aDeps.add(e.to);
    if (e.from === bId) bDeps.add(e.to);
    // Direct A-B edge (either direction) — useful signal when hop count is 1.
    if ((e.from === aId && e.to === bId) || (e.from === bId && e.to === aId)) {
      directEdges += 1;
    }
  }
  let sharedDeps = 0;
  for (const d of aDeps) if (bDeps.has(d)) sharedDeps += 1;

  const res = findPaths(graph, {
    sourceFileId: aId,
    targetFileId: bId,
    mode: "shortest",
  });
  const path = res.paths[0];
  const hopCount = path ? path.cost : null;

  const a = graph.files.find(f => f.id === aId);
  const b = graph.files.find(f => f.id === bId);
  const layerDistance =
    a && b ? Math.abs((LAYER_ORDER[a.layer] ?? 0) - (LAYER_ORDER[b.layer] ?? 0)) : 0;

  return {
    hopCount,
    sharedDeps,
    directEdges,
    layerDistance,
    pathNodeIds: path?.nodeIds ?? [],
    pathEdgeIds: path?.edgeIds ?? [],
  };
}

export interface UseMeasureModeOutput {
  phase: MeasurePhase;
  measureA: string | null;
  measureB: string | null;
  result: MeasureResult | null;
  highlightedEdgeIds: ReadonlySet<string>;
  reset: () => void;
  /**
   * Pass-through selection handler: wrap `selectFile` with this to capture
   * measure picks when the M key is held.
   * Returns true when the event was consumed by measure mode (and upstream
   * selection should be suppressed).
   */
  tryCaptureSelection: (fileId: string | null) => boolean;
}

export function useMeasureMode(graph: WorkspaceGraph | null): UseMeasureModeOutput {
  const enabled = useFeature("devmode.measure");

  const [phase, setPhase] = useState<MeasurePhase>("none");
  const [measureA, setA] = useState<string | null>(null);
  const [measureB, setB] = useState<string | null>(null);
  const mHeldRef = useRef(false);

  // Observe selection changes so a user holding M + clicking a file promotes
  // it to the next measure slot. Using the interaction store keeps the
  // capture path compatible with Pixi onFileClick and DOM card clicks.
  const selectedFileId = useInteractionStore(s => s.viewState.selectedFileId);
  const prevSelectedRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setPhase("none");
    setA(null);
    setB(null);
  }, []);

  // Track M key + global Esc (reset). We keep this independent of
  // `useModifierKeyTracking` because the modifier hook only tracks shift/meta.
  useEffect(() => {
    if (!enabled) {
      if (phase !== "none") reset();
      return;
    }
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") mHeldRef.current = true;
      if (e.key === "Escape" && phase !== "none") reset();
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") mHeldRef.current = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [enabled, phase, reset]);

  // tryCaptureSelection is called by MultiFileCanvas before dispatching
  // selectFile. When M is held AND the user picks an actual file, we route
  // the pick to the measure state machine and suppress the normal selection.
  const tryCaptureSelection = useCallback(
    (fileId: string | null): boolean => {
      if (!enabled || !fileId) return false;
      if (!mHeldRef.current) return false;

      if (phase === "none" || phase === "showing-results") {
        setA(fileId);
        setB(null);
        setPhase("first-picked");
        return true;
      }
      if (phase === "first-picked") {
        if (fileId === measureA) {
          // Clicking the same file a second time is a no-op but still consumed
          // so the card doesn't flip into plain-selected mode.
          return true;
        }
        setB(fileId);
        setPhase("showing-results");
        return true;
      }
      return false;
    },
    [enabled, phase, measureA],
  );

  // When the inspector selects a file programmatically (URL apply, list click)
  // we shouldn't keep the prev measure results tied to the old ViewState.
  useEffect(() => {
    prevSelectedRef.current = selectedFileId;
  }, [selectedFileId]);

  const result = useMemo<MeasureResult | null>(() => {
    if (phase !== "showing-results" || !measureA || !measureB) return null;
    return computeMeasure(graph, measureA, measureB);
  }, [phase, measureA, measureB, graph]);

  const highlightedEdgeIds = useMemo<ReadonlySet<string>>(() => {
    if (!result) return new Set<string>();
    return new Set(result.pathEdgeIds);
  }, [result]);

  // Turning the feature off mid-session should clear the overlay.
  useEffect(() => {
    if (!enabled && phase !== "none") reset();
  }, [enabled, phase, reset]);

  // Never leave measure state alive after graph swap.
  useEffect(() => {
    reset();
    // Intentionally: reset on graph identity change.
  }, [graph, reset]);

  // Read-only: let the inspector surface the picks. interactionStore is the
  // single source of truth for *selection*, but measure mode is orthogonal —
  // so we don't mutate interactionStore here, we just re-derive locally.
  // This guarantees a measure pick doesn't clobber normal selection state.
  void interactionStore; // referenced for future linkage; see store imports.

  return {
    phase,
    measureA,
    measureB,
    result,
    highlightedEdgeIds,
    reset,
    tryCaptureSelection,
  };
}

export type { FileEdge };
