import { useSyncExternalStore } from "react";
import type { EntityTree } from "@quanta/canvas-engine";

// Layout weight store
// --------------------------------------------------------------------
// Controls which metric drives squarified rect sizes at every tier.
// The engine's `buildHierarchicalLayout` already accepts an arbitrary
// `weight(id)` function; this store picks which one we pass.
//
// Modes:
//   loc        — lines of code (default, biggest files dominate)
//   risk       — riskScore at the entity (hotspots attract eyes)
//   fileCount  — number of files under an entity (package-level view)
//   equal      — every sibling equal size (pure topology, no metric)
//
// Switching modes re-sizes rects but does NOT rebuild the entity
// tree — that's a single pass over the layout memo's weight
// function. The viewport fit-to-content then animates onto the new
// proportions.

export type LayoutWeightMode = "loc" | "risk" | "fileCount" | "equal";

interface WeightState {
  mode: LayoutWeightMode;
}

let state: WeightState = { mode: "loc" };
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const layoutWeightStore = {
  getState(): WeightState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setMode(mode: LayoutWeightMode): void {
    if (state.mode === mode) return;
    state = { mode };
    emit();
  },
};

export function useLayoutWeight<T>(selector: (s: WeightState) => T): T {
  return useSyncExternalStore(
    layoutWeightStore.subscribe,
    () => selector(layoutWeightStore.getState()),
    () => selector(layoutWeightStore.getState()),
  );
}

/**
 * Build the weight function for the current mode. Falls back to
 * childCount + 1 at each node so zero-metric entities (e.g. tree
 * ancestors with no direct loc) still pack sanely.
 */
export function makeWeightFn(
  tree: EntityTree,
  mode: LayoutWeightMode,
): (id: string) => number {
  // Memoised rollup — a subtree's metric is the sum over its
  // descendants. One recursion per id; subsequent lookups are O(1).
  const cache = new Map<string, number>();
  const leafValue = (id: string): number => {
    const e = tree.byId.get(id);
    if (!e) return 1;
    switch (mode) {
      case "loc":
        return e.metrics?.loc ?? 0;
      case "risk":
        return e.metrics?.riskScore ?? 0;
      case "fileCount":
        return e.metrics?.fileCount ?? (e.kind === "building" ? 1 : 0);
      case "equal":
        return 1;
    }
  };
  const rollup = (id: string): number => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const e = tree.byId.get(id);
    if (!e) {
      cache.set(id, 1);
      return 1;
    }
    if (e.childIds.length === 0) {
      const v = Math.max(1, leafValue(id));
      cache.set(id, v);
      return v;
    }
    let sum = 0;
    for (const cid of e.childIds) sum += rollup(cid);
    // Mix in the entity's own leafValue so an intermediate with a
    // direct metric (e.g. rollup fileCount on a galaxy) doesn't lose
    // it when aggregating descendants.
    const own = leafValue(id);
    const v = Math.max(1, sum + own);
    cache.set(id, v);
    return v;
  };
  return rollup;
}
