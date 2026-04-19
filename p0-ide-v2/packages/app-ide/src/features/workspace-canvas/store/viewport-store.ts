import { useSyncExternalStore } from "react";
import type { Viewport } from "@quanta/canvas-engine";

// Viewport store
// -------------------------------------------------------------------
// Isolated from scene / interaction / settings so that a 60 Hz pan or
// zoom only wakes subscribers that actually care about camera state.
// Invariant: mutating this store MUST NOT touch any other store. Any
// downstream consumer that needs to recompute from viewport (e.g. LOD,
// visibleScene) does so via the orchestrator, which reads this store
// but writes to the scene / interaction stores.

export interface ViewportState {
  viewport: Viewport;
}

const initialViewport: Viewport = { x: 0, y: 0, scale: 0.1, width: 0, height: 0 };

let state: ViewportState = { viewport: initialViewport };

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): ViewportState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  setViewport(viewport: Viewport) {
    const cur = state.viewport;
    if (
      cur.x === viewport.x &&
      cur.y === viewport.y &&
      cur.scale === viewport.scale &&
      cur.width === viewport.width &&
      cur.height === viewport.height
    ) return;
    state = { viewport };
    emit();
  },

  setContainerSize(width: number, height: number) {
    if (state.viewport.width === width && state.viewport.height === height) return;
    state = { viewport: { ...state.viewport, width, height } };
    emit();
  },
};

export const viewportStore = { getState, subscribe, ...actions };

export function useViewportStore<T>(selector: (s: ViewportState) => T): T {
  return useSyncExternalStore(
    viewportStore.subscribe,
    () => selector(viewportStore.getState()),
    () => selector(viewportStore.getState()),
  );
}
