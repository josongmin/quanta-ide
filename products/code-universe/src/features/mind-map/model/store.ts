import { useRef, useSyncExternalStore } from "react";

// Mind-map mode store
// --------------------------------------------------------------------
// Tracks whether the radial / mind-map view is active and, if so, which
// entity is at the centre. Kept separate from the entity store because:
//   - The mind-map is orthogonal to tier / selection / expansion — it
//     takes OVER the canvas view, so hanging its flag off the entity
//     store would mean consumers have to defensively null-check another
//     interaction field even when they don't care about mind-map.
//   - Future mind-map settings (show empty aggregators, layout preset,
//     angular priority) naturally nest here without bloating the
//     entity-store shape.
//
// Contract: `enabled === true` AND `centerId !== null` → render the
// mind-map. Any other combination → treemap view. The store keeps
// `centerId` even when disabled so toggling back mid-session restores
// the previous focus.

export interface MindMapState {
  enabled: boolean;
  centerId: string | null;
}

const initial: MindMapState = { enabled: false, centerId: null };
let state: MindMapState = initial;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export const mindMapStore = {
  getState(): MindMapState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Open the mind-map on a given entity. If the view is already open
   *  on a different entity, this re-centres (the renderer animates the
   *  transition via node keys). */
  openOn(entityId: string): void {
    if (state.enabled && state.centerId === entityId) return;
    state = { enabled: true, centerId: entityId };
    emit();
  },
  /** Close — keeps the last centre for quick re-open. */
  close(): void {
    if (!state.enabled) return;
    state = { ...state, enabled: false };
    emit();
  },
  /** Toggle: open on `entityId` if closed, close if already open on the
   *  same entity, otherwise re-centre. Maps cleanly to a single hotkey. */
  toggle(entityId: string | null): void {
    if (state.enabled) {
      if (entityId === null || state.centerId === entityId) {
        state = { ...state, enabled: false };
      } else {
        state = { enabled: true, centerId: entityId };
      }
    } else {
      if (entityId === null) return; // no centre to open on — no-op
      state = { enabled: true, centerId: entityId };
    }
    emit();
  },
  reset(): void {
    state = initial;
    emit();
  },
};

export function useMindMapState<T>(selector: (s: MindMapState) => T): T {
  const cache = useRef<{ state: MindMapState; value: T } | null>(null);
  return useSyncExternalStore(mindMapStore.subscribe, () => {
    const s = mindMapStore.getState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  });
}
