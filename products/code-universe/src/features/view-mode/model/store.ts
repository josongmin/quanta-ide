import { useRef, useSyncExternalStore } from "react";

// View-mode store
// --------------------------------------------------------------------
// Picks the active top-level visualisation of the Code Universe
// canvas. Orthogonal to the tier ladder and to the mind-map overlay —
// this is about "what SHAPE is the data", not "at what zoom" or "from
// whose perspective".
//
// Three modes today; more will land as new aggregation views ship
// (matrix, Sankey, force-directed, etc.). Treemap stays the default
// because it's the containment-first view the rest of the product
// references ("click a folder", "drill in", ancestor breadcrumbs).
//
// Mind-map mode works slightly differently from the others — it's an
// OVERLAY driven by its own enable flag + centre entity (see
// `features/mind-map/model/store.ts`). The view-mode enum still
// includes "mindmap" so the segmented control can offer it as a
// first-class option; switching to it just opens the overlay on the
// current selection.

export type ViewMode =
  | "treemap" | "mindmap"
  | "chord" | "matrix"
  | "quadrant" | "arc-cycles" | "embedding"
  | "blast" | "arch-layers" | "debt-history" | "refactor-terrain"
  | "cycle-genesis" | "smell-history"
  | "arch-drift" | "cochange"
  | "refactor-sim" | "start-here"
  | "pathfinder" | "neighborhood"
  | "author-territory" | "service-topo"
  | "galaxy-3d";

export interface ViewModeState {
  mode: ViewMode;
}

const initial: ViewModeState = { mode: "treemap" };
let state: ViewModeState = initial;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export const viewModeStore = {
  getState(): ViewModeState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setMode(mode: ViewMode): void {
    if (state.mode === mode) return;
    state = { mode };
    emit();
  },
  /** Cycle to the next mode — bound to a single keyboard shortcut for
   *  rapid side-by-side comparison ("V" key). Order follows the
   *  toolbar's left-to-right layout so keyboard + visual order match. */
  cycle(): void {
    const order: ViewMode[] = [
      "treemap", "mindmap", "chord", "matrix",
      "quadrant", "arc-cycles", "embedding",
      "blast", "arch-layers", "debt-history", "refactor-terrain",
      "cycle-genesis", "smell-history",
      "arch-drift", "cochange",
      "refactor-sim", "start-here",
      "pathfinder", "neighborhood",
      "author-territory", "service-topo",
      "galaxy-3d",
    ];
    const i = order.indexOf(state.mode);
    const next = order[(i + 1) % order.length];
    if (next) {
      state = { mode: next };
      emit();
    }
  },
  reset(): void {
    state = initial;
    emit();
  },
};

export function useViewMode<T>(selector: (s: ViewModeState) => T): T {
  const cache = useRef<{ state: ViewModeState; value: T } | null>(null);
  return useSyncExternalStore(viewModeStore.subscribe, () => {
    const s = viewModeStore.getState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  });
}
