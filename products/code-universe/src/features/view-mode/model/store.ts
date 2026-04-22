import { useRef, useSyncExternalStore } from "react";

// View-mode store — current-mode only.
// --------------------------------------------------------------------
// The active view mode lives here. Everything else (label, glyph,
// render component, cycle order, context eligibility, activation
// side-effects) is owned by the view registry at
// `./view-registry.tsx`. This file deliberately knows nothing about
// individual modes beyond the `ViewMode` union — consumers looking for
// metadata go through `getViewDescriptor()` / `VIEW_MODE_OPTIONS`.
//
// The `ViewMode` union is the runtime spelling of registry ids.
// Keeping it as a hand-written literal union (rather than inferring
// from the descriptor list) avoids a module-graph cycle between store
// and registry and gives every consumer the ids at type-check time
// without running any import side-effects.

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
  | "galaxy-3d"
  // ── 2026 expansion: metrics / refactor / time-machine / experimental ──
  | "hotspot" | "hub-score" | "bus-factor" | "coverage-holes" | "api-surface"
  | "layer-audit" | "dep-fossil"
  | "dead-code" | "move-hint" | "dupe-clusters" | "god-file"
  | "timelapse" | "new-since" | "strata" | "evolution-dna"
  | "smell-radar" | "blame-clock" | "heat-rainfall" | "mitosis"
  | "where-to" | "thought-trail" | "failure-flow"
  | "churn-sparkline" | "semantic-diff" | "refactor-weather" | "temporal-coupling"
  // ── industry/academia-validated additions ──
  | "cognitive-complexity" | "maintainability-index" | "ck-matrix" | "test-pyramid"
  | "call-graph" | "control-flow" | "program-slice" | "change-impact"
  | "bug-prediction" | "feature-envy" | "shotgun-surgery" | "comment-atlas"
  | "truck-factor" | "refactoring-miner" | "review-heat" | "dora-metrics"
  | "seesoft" | "code-city-3d" | "voronoi-treemap" | "stream-graph" | "ownership-sankey"
  | "mutation-score" | "vulnerabilities" | "debt-ratio"
  | "quality-gate" | "dit";

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
  /** Set the mode directly. Does NOT fire descriptor activate / deactivate
   *  hooks — use `switchMode(next, ctx)` from the registry for that.
   *  Exposed as a bare setter so URL-sync and tests can seed the store
   *  without wiring a fake context. */
  setMode(mode: ViewMode): void {
    if (state.mode === mode) return;
    state = { mode };
    emit();
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
