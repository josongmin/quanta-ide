import { useSyncExternalStore } from "react";
import type { EntityKind } from "@quanta/canvas-engine";

// Kind-filter store
// --------------------------------------------------------------------
// Per-entity-kind visibility toggle. Independent of the active tier —
// e.g. the user can hide `floor` entities even when parked at the
// floor tier, leaving just rooms visible as a clean function-level
// view. The opposite case (show every kind regardless of tier) is
// also useful when drilling up/down to keep visual context.
//
// Default: every kind visible. Store is module-level singleton so
// the filter survives tier changes, tab switches, and is shared
// across MiniMap, CanvasViewport, and the filter UI itself without
// prop drilling.

export type KindVisibility = Record<EntityKind, boolean>;

const DEFAULT_VISIBILITY: KindVisibility = {
  universe: true,
  galaxy: true,
  street: true,
  building: true,
  floor: true,
  room: true,
};

interface FilterState {
  visibility: KindVisibility;
}

let state: FilterState = { visibility: { ...DEFAULT_VISIBILITY } };
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const kindFilterStore = {
  getState(): FilterState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setVisible(kind: EntityKind, visible: boolean): void {
    if (state.visibility[kind] === visible) return;
    state = { visibility: { ...state.visibility, [kind]: visible } };
    emit();
  },
  toggle(kind: EntityKind): void {
    this.setVisible(kind, !state.visibility[kind]);
  },
  /** Reset to "all visible" — useful for an explicit "show all" button
   *  so the user never has to untangle a dense filter state. */
  reset(): void {
    state = { visibility: { ...DEFAULT_VISIBILITY } };
    emit();
  },
  isVisible(kind: EntityKind): boolean {
    return state.visibility[kind];
  },
};

export function useKindFilter<T>(selector: (s: FilterState) => T): T {
  return useSyncExternalStore(
    kindFilterStore.subscribe,
    () => selector(kindFilterStore.getState()),
    () => selector(kindFilterStore.getState()),
  );
}
