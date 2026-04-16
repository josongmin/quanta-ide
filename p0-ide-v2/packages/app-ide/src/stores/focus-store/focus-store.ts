import { useSyncExternalStore } from "react";
import { createInspectorModeStore, type InspectorMode, type InspectorModeState } from "./inspector-mode-store";
import { createOverlayStore, type OverlayState } from "./overlay-store";

export type { InspectorMode };

export interface FocusState extends InspectorModeState, OverlayState {}

// Shared subscriber bus: every mutation fans out to facade listeners
// regardless of whether it came from the mode store or the overlay store.
const listeners = new Set<() => void>();
const notify = () => {
  for (const l of [...listeners]) l();
};

const modeStore = createInspectorModeStore(notify);
const overlayStore = createOverlayStore(notify);

// Stable snapshot cache so useSyncExternalStore gets referential stability
// until something actually changes.
let cachedSnapshot: FocusState = { ...modeStore.get(), ...overlayStore.get() };
let lastMode = modeStore.get();
let lastOverlay = overlayStore.get();

function snapshot(): FocusState {
  const m = modeStore.get();
  const o = overlayStore.get();
  if (m !== lastMode || o !== lastOverlay) {
    lastMode = m;
    lastOverlay = o;
    cachedSnapshot = { ...m, ...o };
  }
  return cachedSnapshot;
}

export const focusStore = {
  get: (): FocusState => snapshot(),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setMode: (mode: InspectorMode, extra?: Partial<FocusState>) => {
    if (!extra) {
      modeStore.setMode(mode);
      return;
    }
    const { simulateOpen, contextInjectOpen, firewallOpen, ...modeExtra } = extra;
    modeStore.setMode(mode, modeExtra);
    if (simulateOpen !== undefined) overlayStore.toggleSimulate(simulateOpen);
    if (contextInjectOpen !== undefined) overlayStore.toggleContextInject(contextInjectOpen);
    if (firewallOpen !== undefined) overlayStore.toggleFirewall(firewallOpen);
  },
  openFlow: (pathId: string) => {
    modeStore.openFlow(pathId);
  },
  jumpTo: (line: number) => {
    modeStore.jumpTo(line);
  },
  toggleSimulate: (open?: boolean) => {
    overlayStore.toggleSimulate(open);
  },
  toggleContextInject: (open?: boolean) => {
    overlayStore.toggleContextInject(open);
  },
  toggleFirewall: (open?: boolean) => {
    overlayStore.toggleFirewall(open);
  },
};

export function useFocusStore<T>(selector: (s: FocusState) => T): T {
  return useSyncExternalStore(
    focusStore.subscribe,
    () => selector(snapshot()),
    () => selector(snapshot()),
  );
}
