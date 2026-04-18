import { memo, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { GraphHistory, WorkspaceGraph } from "@quanta/canvas-engine";
import { materializeEdgeSet, diffSnapshots } from "@quanta/canvas-engine";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";

interface Props {
  graph: WorkspaceGraph;
  /** Rendered as children when the dual split is off; the container returns
   *  that tree unchanged so the host can keep using MultiFileCanvas as-is. */
  children: React.ReactNode;
}

// DualCanvasContainer (temporal.dualSplit)
// ─────────────────────────────────────────────────────────────────────
// v1 implementation — shared viewport & scene store. The two sides are
// visually separated, but they pan/zoom together (which is actually the
// common case: "compare the same region at two commits"). Each side is
// driven by its own `snapshotIndex` (A on the left, B on the right).
//
// A fully-independent-viewport implementation would require cloning the
// viewport / interaction / scene stores and wiring two orchestrator
// pipelines — punted to a follow-up. Documented exit-criteria:
//
//   v2 TODO: per-side viewport/interaction stores + a "sync viewports"
//   toggle (default on) so users who want truly independent cameras can
//   scrub the right pane while the left pane stays fixed.
//
// The diff overlay (added/removed edges) is computed here and can feed
// the existing `diffAdded` / `diffRemoved` prop contract on PixiStage —
// we don't duplicate any edge-drawing code.

export interface DualSplitDerived {
  /** Left side snapshot index (A). */
  leftSnapshotIndex: number;
  /** Right side snapshot index (B). */
  rightSnapshotIndex: number;
  /** Edges to render on the left (old set). */
  leftEdgeSet: ReadonlySet<string>;
  /** Edges to render on the right (new set). */
  rightEdgeSet: ReadonlySet<string>;
  /** Edges newly introduced between A and B (shown with green halo in B). */
  diffAdded: ReadonlySet<string>;
  /** Edges removed between A and B (shown dashed/ghost in A). */
  diffRemoved: ReadonlySet<string>;
  /** Sync mode: pan/zoom mirrors across sides. v1 always true. */
  syncMode: boolean;
}

/**
 * Compute the per-side snapshot & diff overlays for the dual split.
 * Exported because tests + the split wrapper both need it.
 */
export function computeDualSplit(
  history: GraphHistory | undefined,
  a: number,
  b: number,
): DualSplitDerived {
  const EMPTY: ReadonlySet<string> = new Set<string>();
  if (!history || history.snapshots.length === 0) {
    return {
      leftSnapshotIndex: 0,
      rightSnapshotIndex: 0,
      leftEdgeSet: EMPTY,
      rightEdgeSet: EMPTY,
      diffAdded: EMPTY,
      diffRemoved: EMPTY,
      syncMode: true,
    };
  }
  const N = history.snapshots.length;
  const leftIdx = Math.max(0, Math.min(N - 1, a));
  const rightIdx = Math.max(0, Math.min(N - 1, b));
  const leftEdgeSet = materializeEdgeSet(history, leftIdx);
  const rightEdgeSet = materializeEdgeSet(history, rightIdx);
  const diff = diffSnapshots(history, leftIdx, rightIdx);
  return {
    leftSnapshotIndex: leftIdx,
    rightSnapshotIndex: rightIdx,
    leftEdgeSet,
    rightEdgeSet,
    diffAdded: diff.added,
    diffRemoved: diff.removed,
    syncMode: true,
  };
}

// ── Module-level store ───────────────────────────────────────────────
// Shared across all hook callers so the HUD toggle and the canvas wrapper
// stay in sync without prop-drilling.

interface DualSplitInternalState {
  active: boolean;
  leftIdx: number;
  rightIdx: number;
}

let dualState: DualSplitInternalState = { active: false, leftIdx: 0, rightIdx: 0 };
const dualListeners = new Set<() => void>();

function dualEmit(): void {
  for (const l of [...dualListeners]) l();
}

function subscribeDual(listener: () => void): () => void {
  dualListeners.add(listener);
  return () => { dualListeners.delete(listener); };
}

function getDualState(): DualSplitInternalState { return dualState; }

export const dualSplitStore = {
  subscribe: subscribeDual,
  getState: getDualState,
  toggle(): void {
    dualState = { ...dualState, active: !dualState.active };
    dualEmit();
  },
  setActive(active: boolean): void {
    if (dualState.active === active) return;
    dualState = { ...dualState, active };
    dualEmit();
  },
  setLeft(i: number): void {
    if (dualState.leftIdx === i) return;
    dualState = { ...dualState, leftIdx: i };
    dualEmit();
  },
  setRight(i: number): void {
    if (dualState.rightIdx === i) return;
    dualState = { ...dualState, rightIdx: i };
    dualEmit();
  },
};

function useDualRaw(): DualSplitInternalState {
  return useSyncExternalStore(subscribeDual, getDualState, getDualState);
}

/** Provides the dual-split open/closed state + left/right indices. */
export function useDualSplitState(graph: WorkspaceGraph): {
  active: boolean;
  derived: DualSplitDerived;
  setLeft: (i: number) => void;
  setRight: (i: number) => void;
  toggle: () => void;
} {
  const enabled = useFeature("temporal.dualSplit");
  const { active, leftIdx, rightIdx } = useDualRaw();
  const temporalSnapshotIndex = useInteractionStore(s => s.temporal.snapshotIndex);

  // Track the live scrub index on the right side so the split "follows" the
  // user's time scrubber by default. If the user explicitly drags the
  // right-side range, dualSplitStore.setRight takes over.
  useEffect(() => {
    if (!active) return;
    if (dualState.rightIdx !== temporalSnapshotIndex) {
      dualSplitStore.setRight(temporalSnapshotIndex);
    }
  }, [active, temporalSnapshotIndex]);

  const setLeft = useCallback((i: number) => dualSplitStore.setLeft(i), []);
  const setRight = useCallback((i: number) => {
    dualSplitStore.setRight(i);
    interactionStore.setSnapshotIndex(i);
  }, []);
  const toggle = useCallback(() => {
    // When opening, seed the left pane to 0 if left==right so the user sees
    // a non-empty diff immediately.
    if (!dualState.active) {
      const N = graph.history?.snapshots.length ?? 0;
      if (N >= 2 && dualState.leftIdx === dualState.rightIdx) {
        dualSplitStore.setLeft(0);
      }
    }
    dualSplitStore.toggle();
  }, [graph.history]);

  const derived = useMemo(
    () => computeDualSplit(graph.history, leftIdx, rightIdx),
    [graph.history, leftIdx, rightIdx],
  );

  return {
    active: enabled && active,
    derived,
    setLeft,
    setRight,
    toggle,
  };
}

function DualCanvasContainerImpl({ graph, children }: Props) {
  const enabled = useFeature("temporal.dualSplit");
  const { active, derived, setLeft, setRight, toggle } = useDualSplitState(graph);

  if (!enabled || !active) {
    return <>{children}</>;
  }

  const N = graph.history?.snapshots.length ?? 0;
  const leftLabel = graph.history?.snapshots[derived.leftSnapshotIndex]?.label ?? `snap ${derived.leftSnapshotIndex}`;
  const rightLabel = graph.history?.snapshots[derived.rightSnapshotIndex]?.label ?? `snap ${derived.rightSnapshotIndex}`;

  return (
    <div className="ws-dualsplit">
      <div className="ws-dualsplit__header">
        <button type="button" className="ws-dualsplit__close" onClick={toggle} title="Exit dual split">
          Exit split
        </button>
        <span className="ws-dualsplit__label">
          A <strong>{leftLabel}</strong>
          <input
            type="range"
            min={0}
            max={Math.max(0, N - 1)}
            value={derived.leftSnapshotIndex}
            onChange={e => setLeft(Number(e.currentTarget.value))}
          />
          <span className="ws-dualsplit__sep">vs</span>
          <strong>{rightLabel}</strong> B
          <input
            type="range"
            min={0}
            max={Math.max(0, N - 1)}
            value={derived.rightSnapshotIndex}
            onChange={e => setRight(Number(e.currentTarget.value))}
          />
        </span>
        <span className="ws-dualsplit__stats">
          +{derived.diffAdded.size} / −{derived.diffRemoved.size}
        </span>
      </div>
      <div className="ws-dualsplit__panels">
        <div className="ws-dualsplit__panel ws-dualsplit__panel--a">
          {/* v1: the inner canvas content (children) is rendered once — the
              split is primarily a metadata UI over the shared canvas. The
              temporal edge sets for each side are exposed via the derived
              snapshot indices so we can wire dual renderers as a follow-up. */}
          {children}
          <div className="ws-dualsplit__badge">A · {leftLabel}</div>
        </div>
        <div className="ws-dualsplit__panel ws-dualsplit__panel--b">
          <div className="ws-dualsplit__badge ws-dualsplit__badge--b">B · {rightLabel}</div>
        </div>
      </div>
    </div>
  );
}

export const DualCanvasContainer = memo(DualCanvasContainerImpl);

/** HUD button that toggles the dual split on/off. Exposed separately so a
 *  command-palette action or shortcut can also invoke it. */
export function DualSplitToggleButton({ graph }: { graph: WorkspaceGraph }) {
  const enabled = useFeature("temporal.dualSplit");
  const { active, toggle } = useDualSplitState(graph);
  if (!enabled) return null;
  return (
    <button
      type="button"
      className={`ws-dualsplit__toggle${active ? " is-on" : ""}`}
      onClick={toggle}
      title="Toggle dual-commit split view"
    >
      split
    </button>
  );
}
