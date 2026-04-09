import { create } from "zustand";

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  divider?: boolean;
  ghost?: { before: string; after: string };
}

export const CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: "callgraph", label: "Show call graph", shortcut: "⌘G" },
  { id: "dataflow", label: "Show data flow", shortcut: "⌘." },
  { id: "blast", label: "Show blast radius", shortcut: "⌘B" },
  { id: "taint", label: "Trace taint path" },
  { id: "div1", label: "", divider: true },
  { id: "simulate", label: "Simulate change", shortcut: "⌘⇧S" },
  { id: "extract", label: "Extract method", shortcut: "⌘E" },
  {
    id: "fix",
    label: "Suggest fix",
    shortcut: "⌘F",
    ghost: {
      before: "  const amount = req.body.amount;",
      after: "  const safe = sanitizeAmount(amount);",
    },
  },
  { id: "div2", label: "", divider: true },
  { id: "refs", label: "Find references", shortcut: "⇧F12" },
  { id: "history", label: "Open history", shortcut: "⌘H" },
  { id: "dead", label: "Check dead code" },
  { id: "ask", label: "Ask p0…", shortcut: "⌘K" },
];

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  hoveredId: string | null;
  open: (x: number, y: number) => void;
  close: () => void;
  setHovered: (id: string | null) => void;
}

export const useContextMenu = create<ContextMenuState>()((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  hoveredId: null,
  open: (x, y) => { set({ isOpen: true, x, y, hoveredId: null }); },
  close: () => { set({ isOpen: false, hoveredId: null }); },
  setHovered: (id) => { set({ hoveredId: id }); },
}));
