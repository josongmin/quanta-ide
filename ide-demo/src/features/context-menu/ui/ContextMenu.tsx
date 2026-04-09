import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";
import { cn } from "@/shared/lib/cn";

interface MenuState {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  show: (x: number, y: number, items: MenuItem[]) => void;
  hide: () => void;
}

export interface MenuItem {
  icon: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  divider?: boolean;
  action?: () => void;
}

export const useContextMenu = create<MenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  items: [],
  show: (x, y, items) => set({ open: true, x, y, items }),
  hide: () => set({ open: false }),
}));

/**
 * Hick's Law: decision time = log₂(n+1)
 * Items grouped by category with dividers → reduces effective n per group
 * Spatial memory: order is stable — users build muscle memory after 2-3 uses
 *
 * Miller's Law: max 4 items per group (3 groups × 4 = 12 items, within 7±2 per group)
 */
export const FUNCTION_MENU: MenuItem[] = [
  /* Group 1: Understand (read-only, safe) */
  { icon: "🔍", label: "Trace call graph", shortcut: "⌘⇧G" },
  { icon: "💥", label: "Blast radius", shortcut: "⌘⇧B" },
  { icon: "🔀", label: "Show data flow", shortcut: "⌘⇧D" },
  { icon: "🛡️", label: "Taint trace", shortcut: "⌘⇧T" },
  { icon: "", label: "", divider: true },
  /* Group 2: Act (modifies code) */
  { icon: "✂️", label: "Extract / Refactor", shortcut: "⌘⇧R" },
  { icon: "🔬", label: "Find all mutations" },
  { icon: "💀", label: "Dead code check" },
  { icon: "", label: "", divider: true },
  /* Group 3: Investigate (deep analysis) */
  { icon: "📜", label: "Why does this exist?", shortcut: "⌘⇧X" },
  { icon: "⚡", label: "Simulate change", shortcut: "⌘⇧S" },
  { icon: "🛠️", label: "Fix this safely" },
];

export const IMPORT_MENU: MenuItem[] = [
  { icon: "📦", label: "Show bundle impact" },
  { icon: "🚨", label: "CVE scan" },
  { icon: "🗑️", label: "Remove safely", danger: true },
];

export function ContextMenu() {
  const { open, x, y, items, hide } = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") { hide(); return; }
      if (e instanceof MouseEvent && ref.current && !ref.current.contains(e.target as Node)) hide();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", handler); };
  }, [open, hide]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          className="fixed z-50 min-w-[240px] py-1.5 glass rounded-xl shadow-2xl shadow-black/40"
          style={{ left: Math.min(x, window.innerWidth - 260), top: Math.min(y, window.innerHeight - 400) }}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 mx-2 border-t border-border" />
            ) : (
              <motion.button
                key={i}
                type="button"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02, duration: 0.12 }}
                onClick={() => { item.action?.(); hide(); }}
                className={cn(
                  "flex items-center w-full gap-2.5 px-3 py-[7px] text-[11.5px] font-mono text-text-secondary rounded-[3px] mx-1",
                  "hover:bg-white/[0.06] hover:text-text-primary transition-all",
                  item.danger && "hover:text-risk-critical hover:bg-risk-critical/8"
                )}
                style={{ width: "calc(100% - 8px)" }}
              >
                <span className="w-5 text-center text-[13px]">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[9px] text-text-muted bg-surface-4/50 px-1.5 py-0.5 rounded">{item.shortcut}</span>
                )}
              </motion.button>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
