import { useSyncExternalStore } from "react";
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
}

export interface EntityState {
  tree: EntityTree | null;
  interaction: EntityInteraction;
}

const initial: EntityState = {
  tree: null,
  interaction: { selectedId: null, hoveredId: null },
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
    state = { ...state, interaction: { ...state.interaction, selectedId: id } };
    emit();
  },
  hoverEntity(id: string | null): void {
    if (state.interaction.hoveredId === id) return;
    state = { ...state, interaction: { ...state.interaction, hoveredId: id } };
    emit();
  },
  reset(): void {
    state = initial;
    emit();
  },
};

export function useEntityState<T>(selector: (s: EntityState) => T): T {
  return useSyncExternalStore(
    entityStore.subscribe,
    () => selector(entityStore.getState()),
    () => selector(entityStore.getState()),
  );
}
