import { useSyncExternalStore } from "react";

// Figma-shell mode store (P0)
// -------------------------------------------------------------------
// Tracks the active *mode* for the Figma-style shell. Each mode tunes
// which overlays are prominent and which are dimmed. A mode is not a
// hard-preset (that's feature-presets.ts) — it's a visual emphasis tweak
// that the shell applies on top of the user's existing flag state.
//
// The store is deliberately tiny: one enum + one setter. Components that
// want to react to the mode subscribe through `useFigmaMode`.

export type FigmaMode =
  | "explore"
  | "analyze"
  | "trace"
  | "diff"
  | "investigate";

export interface FigmaModeState {
  mode: FigmaMode;
  /** Left rail open/closed — mirrors Figma's assets panel collapse. */
  leftOpen: boolean;
  /** Active left-rail tab. */
  leftTab: "layers" | "filters" | "focus" | "saved";
  /** Right inspector open/closed. */
  rightOpen: boolean;
  /** Active right-inspector tab. */
  rightTab: "summary" | "relations" | "activity" | "ai" | "evidence";
  /** Whole-shell chrome visibility. When false every shell panel
   *  (top bar + rails + overlays) is hidden so the canvas gets its
   *  full viewport back. Toggled by the `\` keybind. */
  shellVisible: boolean;
}

// Default rails CLOSED — the shell mounts as thin 44px icon columns so
// the canvas edges/files stay fully visible. Users open a rail by
// clicking its tab; a second click on the active tab collapses it
// again. This mirrors Figma's collapsed-assets default and avoids the
// "where did my edges go" regression when the shell first lands on top
// of a populated canvas.
let state: FigmaModeState = {
  mode: "explore",
  leftOpen: false,
  leftTab: "layers",
  rightOpen: false,
  rightTab: "summary",
  shellVisible: true,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): FigmaModeState { return state; }

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function setMode(mode: FigmaMode): void {
  if (state.mode === mode) return;
  state = { ...state, mode };
  emit();
}

function setLeftOpen(open: boolean): void {
  if (state.leftOpen === open) return;
  state = { ...state, leftOpen: open };
  emit();
}

function setLeftTab(tab: FigmaModeState["leftTab"]): void {
  if (state.leftTab === tab && state.leftOpen) return;
  state = { ...state, leftTab: tab, leftOpen: true };
  emit();
}

function setRightOpen(open: boolean): void {
  if (state.rightOpen === open) return;
  state = { ...state, rightOpen: open };
  emit();
}

function setRightTab(tab: FigmaModeState["rightTab"]): void {
  if (state.rightTab === tab && state.rightOpen) return;
  state = { ...state, rightTab: tab, rightOpen: true };
  emit();
}

function toggleShell(): void {
  state = { ...state, shellVisible: !state.shellVisible };
  emit();
}

export const figmaModeStore = {
  getState,
  subscribe,
  setMode,
  setLeftOpen,
  setLeftTab,
  setRightOpen,
  setRightTab,
  toggleShell,
};

export function useFigmaMode<T>(selector: (s: FigmaModeState) => T): T {
  return useSyncExternalStore(
    figmaModeStore.subscribe,
    () => selector(figmaModeStore.getState()),
    () => selector(figmaModeStore.getState()),
  );
}

// Public label map — both the breadcrumb and the mode-switch pill use it.
export const FIGMA_MODE_LABEL: Record<FigmaMode, string> = {
  explore: "Explore",
  analyze: "Analyze",
  trace: "Trace",
  diff: "Diff",
  investigate: "Investigate",
};

export const FIGMA_MODE_HINT: Record<FigmaMode, string> = {
  explore: "Default. Neighborhood + semantic zoom.",
  analyze: "Surface risk, violations, anomalies.",
  trace: "Path following + evidence rail.",
  diff: "Compare before/after.",
  investigate: "Pin nodes, notes, saved views.",
};
