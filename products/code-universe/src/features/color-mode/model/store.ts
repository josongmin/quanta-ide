import { useSyncExternalStore } from "react";

// Colour-mode store
// --------------------------------------------------------------------
// Picks which colour function the Pixi scene uses for entity fill:
//
//   palette  — per-kind flat colour (default, good for structural read)
//   risk     — riskScore gradient (emerald → amber → red), hotspots pop
//   layer    — per-ArchLayer colour (domain / adapter / infra / ui / util)
//   heat     — `taintCount + archViolations + deadCount` heatmap
//              (shows where trouble concentrates at a glance)
//
// Switching modes doesn't rebuild the layout or tree — the viewport
// just rebuilds the colour-override Map and sends a new frame.

export type ColorMode = "palette" | "risk" | "layer" | "heat";

interface ColorState {
  mode: ColorMode;
}

let state: ColorState = { mode: "palette" };
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

export const colorModeStore = {
  getState(): ColorState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setMode(mode: ColorMode): void {
    if (state.mode === mode) return;
    state = { mode };
    emit();
  },
};

export function useColorMode<T>(selector: (s: ColorState) => T): T {
  return useSyncExternalStore(
    colorModeStore.subscribe,
    () => selector(colorModeStore.getState()),
    () => selector(colorModeStore.getState()),
  );
}
