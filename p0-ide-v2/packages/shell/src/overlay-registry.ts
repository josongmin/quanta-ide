import { useSyncExternalStore, type ComponentType } from "react";

// ---------------------------------------------------------------------------
// Overlay registry — apps register global overlay components at mount time.
// Shell renders all registered overlays without knowing their concrete types.
// ---------------------------------------------------------------------------

const overlays = new Map<string, ComponentType>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

// Stable snapshot for useSyncExternalStore referential equality.
let cachedSnapshot: ComponentType[] = [];
let lastSize = 0;

function getSnapshot(): ComponentType[] {
  if (overlays.size !== lastSize) {
    lastSize = overlays.size;
    cachedSnapshot = [...overlays.values()];
  }
  return cachedSnapshot;
}

export const overlayRegistry = {
  register(id: string, component: ComponentType): () => void {
    overlays.set(id, component);
    // Invalidate cache unconditionally so getSnapshot rebuilds.
    lastSize = -1;
    notify();
    return () => {
      overlays.delete(id);
      lastSize = -1;
      notify();
    };
  },

  getAll: getSnapshot,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** React hook — returns the current list of registered overlay components. */
export function useOverlays(): ComponentType[] {
  return useSyncExternalStore(
    overlayRegistry.subscribe,
    overlayRegistry.getAll,
    overlayRegistry.getAll,
  );
}
