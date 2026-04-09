import { create } from "zustand";

export interface ContextMenuItem {
  id: string;
  labelKey: string;
  shortcut?: string;
  divider?: boolean;
  ghost?: { before: string; after: string };
}

export const CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: "callgraph", labelKey: "ide.ctx.callgraph", shortcut: "⌘G" },
  { id: "dataflow", labelKey: "ide.ctx.dataflow", shortcut: "⌘." },
  { id: "blast", labelKey: "ide.ctx.blast", shortcut: "⌘B" },
  { id: "taint", labelKey: "ide.ctx.taint" },
  { id: "div1", labelKey: "", divider: true },
  { id: "simulate", labelKey: "ide.ctx.simulate", shortcut: "⌘⇧S" },
  { id: "extract", labelKey: "ide.ctx.extract", shortcut: "⌘E" },
  {
    id: "fix",
    labelKey: "ide.ctx.fix",
    shortcut: "⌘F",
    ghost: {
      before: "  const amount = req.body.amount;",
      after: "  const safe = sanitizeAmount(amount);",
    },
  },
  { id: "div2", labelKey: "", divider: true },
  { id: "refs", labelKey: "ide.ctx.refs", shortcut: "⇧F12" },
  { id: "history", labelKey: "ide.ctx.history", shortcut: "⌘H" },
  { id: "dead", labelKey: "ide.ctx.dead" },
  { id: "ask", labelKey: "ide.ctx.ask", shortcut: "⌘K" },
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
