import { create } from "zustand";
import type { AnchorRect } from "@/shared/ui/tooltip/smartPos";
import type { SymbolInfo } from "./symbols";

export type { SymbolInfo } from "./symbols";

export interface LineContext {
  lineNo: number;
  risk?: 1 | 2 | 3 | 4;
  summary?: string;
  detail?: string;
  x?: number;
  y?: number;
}

export interface SymbolHover {
  info: SymbolInfo;
  anchor: AnchorRect;
}

/** Delay (ms) before the tooltip disappears — gives the user time to move the cursor onto it. */
const DISMISS_DELAY = 200;

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearDismiss() {
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
}

interface EditorHoverState {
  hoveredLine: LineContext | null;
  hoveredSymbol: SymbolHover | null;
  isOverTooltip: boolean;
  setLine: (line: LineContext | null) => void;
  setSymbol: (s: SymbolHover | null) => void;
  scheduleDismiss: () => void;
  cancelDismiss: () => void;
  dismissFromTooltip: () => void;
}

export const useEditorHover = create<EditorHoverState>()((set, get) => ({
  hoveredLine: null,
  hoveredSymbol: null,
  isOverTooltip: false,
  setLine: (line) => { set({ hoveredLine: line }); },
  setSymbol: (s) => {
    clearDismiss();
    if (!s) { set({ hoveredSymbol: null }); return; }
    const cur = get().hoveredSymbol;
    if (cur !== null && cur.info.name === s.info.name && cur.info.kind === s.info.kind) {
      // Same symbol — just cancel any pending dismiss, keep tooltip alive
      return;
    }
    set({ hoveredSymbol: s, hoveredLine: null, isOverTooltip: false });
  },
  scheduleDismiss: () => {
    clearDismiss();
    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      if (!get().isOverTooltip) {
        set({ hoveredSymbol: null });
      }
    }, DISMISS_DELAY);
  },
  cancelDismiss: () => {
    clearDismiss();
    set({ isOverTooltip: true });
  },
  dismissFromTooltip: () => {
    set({ isOverTooltip: false });
    // Use delayed dismiss — gives the underlying symbol span time to fire
    // onMouseEnter and cancel the dismiss, preventing flicker.
    clearDismiss();
    dismissTimer = setTimeout(() => {
      dismissTimer = null;
      set({ hoveredSymbol: null });
    }, DISMISS_DELAY);
  },
}));
