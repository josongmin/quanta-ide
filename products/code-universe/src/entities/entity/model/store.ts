import { useRef, useSyncExternalStore } from "react";
import type { EntityTree } from "./types";

// Entity store
// --------------------------------------------------------------------
// Tiny hand-rolled external store for the entity tree + interaction
// state (selected, hovered). Mirrors the shape of the legacy
// `interactionStore` — same `subscribe` / `getState` contract so we
// can later unify the two without a consumer rewrite.
//
// Why not Zustand/Jotai/etc.: the product-wide rule from the memory
// layer is "one external-store pattern, minimal deps". The engine
// already works without a state library; adding one for a placeholder
// would violate the SOTA++ "no unearned dependency" rule.

export interface EntityInteraction {
  selectedId: string | null;
  hoveredId: string | null;
  /** Canvas focus mode — 'neighborhood' filters rendering down to the
   *  selected entity and its 1-hop counterparts (the Block-level "ego
   *  graph" from the spec). Auto-exits when selection clears; no
   *  separate anchor id is stored, so "show neighborhood of X" and
   *  "show neighborhood of Y" stay tied to the current selection. */
  focusMode: "none" | "neighborhood";
}

export interface EntityState {
  tree: EntityTree | null;
  interaction: EntityInteraction;
}

const initial: EntityState = {
  tree: null,
  interaction: { selectedId: null, hoveredId: null, focusMode: "none" },
};

let state: EntityState = initial;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export const entityStore = {
  getState(): EntityState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setTree(tree: EntityTree | null): void {
    if (state.tree === tree) return;
    state = { ...state, tree };
    emit();
  },
  selectEntity(id: string | null): void {
    if (state.interaction.selectedId === id) return;
    // Clearing selection exits neighborhood-focus automatically — the
    // canvas would otherwise show an "empty ego" and look broken.
    const nextFocus = id === null ? "none" : state.interaction.focusMode;
    state = {
      ...state,
      interaction: { ...state.interaction, selectedId: id, focusMode: nextFocus },
    };
    emit();
  },
  hoverEntity(id: string | null): void {
    if (state.interaction.hoveredId === id) return;
    state = { ...state, interaction: { ...state.interaction, hoveredId: id } };
    emit();
  },
  setFocusMode(mode: "none" | "neighborhood"): void {
    if (state.interaction.focusMode === mode) return;
    state = { ...state, interaction: { ...state.interaction, focusMode: mode } };
    emit();
  },
  reset(): void {
    state = initial;
    emit();
  },
};

export function useEntityState<T>(selector: (s: EntityState) => T): T {
  // See the matching comment in tier/model/store.ts. Cache the selector
  // output per state identity so object-returning selectors cannot
  // trigger the useSyncExternalStore "getSnapshot should be cached"
  // infinite-loop trap.
  const cache = useRef<{ state: EntityState; value: T } | null>(null);
  return useSyncExternalStore(entityStore.subscribe, () => {
    const s = entityStore.getState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  });
}
