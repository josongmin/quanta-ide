import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePanelStore } from "@/app/stores/usePanelStore";
import { cn } from "@/shared/lib/cn";

interface Command {
  icon: string;
  label: string;
  description: string;
  category: "analyze" | "navigate" | "refactor" | "explain";
  action?: () => void;
}

const COMMANDS: Command[] = [
  { icon: "💥", label: "Show blast radius", description: "Show impact range of current function", category: "analyze" },
  { icon: "🛡️", label: "Show taint paths", description: "Trace data flow from source to sink", category: "analyze" },
  { icon: "🔍", label: "Trace call graph", description: "Visualize all call dependencies", category: "analyze" },
  { icon: "⚡", label: "Simulate change", description: "Preview impact before editing", category: "analyze" },
  { icon: "🔬", label: "Deep scan", description: "Full analysis: behavior, contracts, concurrency", category: "analyze" },
  { icon: "🔥", label: "Most dangerous code", description: "Jump to highest risk function", category: "navigate" },
  { icon: "💀", label: "Find dead code", description: "List all unused functions and imports", category: "navigate" },
  { icon: "📊", label: "Top risk surface", description: "Show 5 riskiest files in repo", category: "navigate" },
  { icon: "✂️", label: "Extract method safely", description: "Refactor with behavior verification", category: "refactor" },
  { icon: "🛠️", label: "Fix taint path", description: "Auto-insert sanitizer on taint route", category: "refactor" },
  { icon: "🗑️", label: "Remove dead code cascade", description: "Delete unused code and all its orphans", category: "refactor" },
  { icon: "📜", label: "Why does this code exist?", description: "Git history + PR intent analysis", category: "explain" },
  { icon: "❓", label: "Why is this risky?", description: "Explain warnings with evidence", category: "explain" },
  { icon: "🧠", label: "Explain this function", description: "Structure: input → transform → output", category: "explain" },
];

const CATEGORY_LABELS: Record<string, string> = {
  analyze: "ANALYZE",
  navigate: "NAVIGATE",
  refactor: "REFACTOR",
  explain: "EXPLAIN",
};

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPalette } = usePanelStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const cmd of filtered) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPalette(!commandPaletteOpen);
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPalette(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, setCommandPalette]);

  // Arrow keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && filtered[selected]) {
      filtered[selected].action?.();
      setCommandPalette(false);
    }
  };

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => setCommandPalette(false)}
          />
          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-50 top-[15%] left-1/2 -translate-x-1/2 w-[520px] glass rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <span className="text-brand/60 text-sm font-semibold">⌘K</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                onKeyDown={handleKeyDown}
                placeholder="What do you want to do?"
                className="flex-1 bg-transparent text-[14px] font-mono text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-text-muted text-[12px] font-mono">
                  No matching commands
                </div>
              )}
              {Array.from(grouped).map(([category, cmds]) => (
                <div key={category}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    {CATEGORY_LABELS[category]}
                  </div>
                  {cmds.map((cmd) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={cmd.label}
                        type="button"
                        onClick={() => { cmd.action?.(); setCommandPalette(false); }}
                        onMouseEnter={() => setSelected(idx)}
                        className={cn(
                          "flex items-center w-full gap-3 px-4 py-2 text-left transition-colors",
                          idx === selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                        )}
                      >
                        <span className="text-[16px] w-6 text-center">{cmd.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-mono text-text-primary">{cmd.label}</div>
                          <div className="text-[10px] text-text-muted truncate">{cmd.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] font-mono text-text-muted">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
