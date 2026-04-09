import { motion, AnimatePresence } from "framer-motion";
import { create } from "zustand";
import { cn } from "@/shared/lib/cn";

interface HoverState {
  visible: boolean;
  x: number;
  y: number;
  data: HoverData | null;
  show: (x: number, y: number, data: HoverData) => void;
  hide: () => void;
}

export interface HoverData {
  name: string;
  type: "function" | "import" | "variable";
  complexity?: number;
  callers?: number;
  tested?: boolean;
  taintSource?: boolean;
  bundleSize?: string;
  cve?: string;
  lastModified?: string;
}

export const useHoverCard = create<HoverState>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  data: null,
  show: (x, y, data) => set({ visible: true, x, y, data }),
  hide: () => set({ visible: false }),
}));

/**
 * Preattentive processing: filled bar length encodes value instantly (no reading needed)
 * Weber-Fechner: bar color threshold at perceptually meaningful breakpoints (5, 7)
 */
function ComplexityBar({ value }: { value: number }) {
  const pct = (value / 10) * 100;
  const color = value > 7 ? "bg-risk-critical" : value > 5 ? "bg-risk-warning" : "bg-risk-safe";
  const label = value > 7 ? "HIGH" : value > 5 ? "MED" : "LOW";
  const labelColor = value > 7 ? "text-risk-critical" : value > 5 ? "text-risk-warning" : "text-risk-safe";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-[4px] bg-surface-4 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className={cn("text-[9px] font-semibold tabular-nums", labelColor)}>{value.toFixed(1)} {label}</span>
    </div>
  );
}

/**
 * Gestalt: card uses proximity + enclosure to group related info
 * Serial Position: most critical info (taint warning) at bottom = recency effect
 * Miller's Law: max 5 data rows in a card
 */
export function HoverCard() {
  const { visible, x, y, data } = useHoverCard();

  return (
    <AnimatePresence>
      {visible && data && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.98 }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="fixed z-40 pointer-events-none"
          style={{ left: Math.min(x, window.innerWidth - 300), top: y + 24 }}
        >
          <div className="min-w-[250px] max-w-[300px] glass rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header — Von Restorff: function name is the only bold element */}
            <div className="px-3 pt-2.5 pb-1.5">
              <span className="text-[12px] font-mono font-semibold text-text-primary">
                {data.name}{data.type === "function" ? "()" : ""}
              </span>
            </div>

            <div className="mx-3 h-px bg-border" />

            {/* Body */}
            <div className="px-3 py-2 space-y-2">
              {data.type === "function" && (
                <>
                  {data.complexity != null && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
                      <span>complexity</span>
                      <ComplexityBar value={data.complexity} />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
                    <span>callers</span>
                    <span className="text-text-primary font-semibold tabular-nums">{data.callers ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
                    <span>coverage</span>
                    <span className={cn("font-semibold", data.tested ? "text-risk-safe" : "text-risk-critical")}>
                      {data.tested ? "✓ tested" : "✗ none"}
                    </span>
                  </div>
                  {data.lastModified && (
                    <div className="text-[9px] font-mono text-text-muted">{data.lastModified}</div>
                  )}
                </>
              )}

              {data.type === "import" && (
                <>
                  {data.bundleSize && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary">
                      <span>bundle</span>
                      <span className="text-risk-warning font-semibold">{data.bundleSize}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer alert — Serial Position: last = most remembered (recency) */}
            {data.taintSource && (
              <div className="px-3 py-2 bg-risk-critical/8 border-t border-risk-critical/15 flex items-center gap-2 text-[10px] font-mono text-risk-critical">
                <span className="w-[5px] h-[5px] rounded-full bg-risk-critical animate-pulse" />
                taint source — user input
              </div>
            )}
            {data.cve && (
              <div className="px-3 py-2 bg-risk-critical/8 border-t border-risk-critical/15 flex items-center gap-2 text-[10px] font-mono text-risk-critical">
                <span className="w-[5px] h-[5px] rounded-full bg-risk-critical animate-pulse" />
                {data.cve}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
