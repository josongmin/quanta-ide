import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { useAnalysisStore } from "@/app/stores/useAnalysisStore";
import { cn } from "@/shared/lib/cn";

/**
 * Weber-Fechner: perceived change ∝ log(new/old)
 * Animated number uses spring physics — bounce intensity scales with change magnitude
 */
function AnimatedNum({ value, color }: { value: number; color?: string }) {
  const motionVal = useMotionValue(value);
  const display = useTransform(motionVal, (v) => Math.round(v));
  const prevRef = useRef(value);

  useEffect(() => {
    const delta = Math.abs(value - prevRef.current);
    const stiffness = delta > 5 ? 120 : 300; // bigger change = more dramatic spring
    const damping = delta > 5 ? 14 : 25;
    animate(motionVal, value, { type: "spring", stiffness, damping });
    prevRef.current = value;
  }, [value, motionVal]);

  return (
    <motion.span className={cn("inline-block tabular-nums font-semibold", color)}>
      {display}
    </motion.span>
  );
}

/**
 * Miller's Law: 7±2 chunks max
 * Risk bar shows exactly 4 data points: score, taint, unsafe, files
 * Grouped by Gestalt proximity into logical clusters
 */
export function RiskBar() {
  const { riskScore, taintPaths, unsafeWrites, affectedFiles, isAnalyzing } = useAnalysisStore();

  const riskLevel =
    riskScore >= 75 ? { label: "HIGH", color: "text-risk-critical", bar: "bg-risk-critical", glow: "shadow-[0_0_12px_rgba(255,68,68,0.15)]" } :
    riskScore >= 50 ? { label: "MED", color: "text-risk-warning", bar: "bg-risk-warning", glow: "shadow-[0_0_8px_rgba(240,145,58,0.1)]" } :
    { label: "LOW", color: "text-risk-safe", bar: "bg-risk-safe", glow: "" };

  return (
    <div className={cn(
      "h-10 flex items-center px-4 gap-5 text-[11px] font-mono shrink-0 select-none",
      riskLevel.glow,
    )}>
      {/* Cluster 1: Risk identity — Von Restorff: most distinctive element */}
      <div className={cn("flex items-center gap-2 font-semibold", riskLevel.color)}>
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: riskScore >= 75 ? 1.5 : 3, ease: "easeInOut" }}
          className="w-2 h-2 rounded-full bg-current"
        />
        <span className="text-[10px] tracking-wider">{riskLevel.label}</span>
        <AnimatedNum value={riskScore} color={riskLevel.color} />
      </div>

      {/* Cluster 2: Risk gauge — preattentive processing via filled area */}
      <div className="w-24 h-[5px] bg-surface-4 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", riskLevel.bar)}
          animate={{ width: `${riskScore}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 28 }}
        />
      </div>

      {/* Cluster 3: Key metrics — Gestalt proximity grouping */}
      <div className="flex items-center gap-4 text-text-secondary">
        {[
          { label: "taint", value: taintPaths, color: "text-risk-critical", dot: "bg-risk-critical" },
          { label: "unsafe", value: unsafeWrites, color: "text-risk-warning", dot: "bg-risk-warning" },
          { label: "files", value: affectedFiles, color: "text-risk-info", dot: "bg-risk-info" },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-1.5">
            <span className={cn("w-[5px] h-[5px] rounded-full", m.dot)} />
            <span className="text-[10px]">{m.label}</span>
            <AnimatedNum value={m.value} color={m.color} />
          </div>
        ))}
      </div>

      {/* Cluster 4: Status — Serial Position Effect: last item = status */}
      <div className="ml-auto">
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2 text-risk-caution"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className="inline-block w-3 h-3 border-[1.5px] border-risk-caution border-t-transparent rounded-full"
              />
              <span className="text-[10px]">analyzing</span>
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-1.5 text-risk-safe text-[10px]"
            >
              <span className="w-[5px] h-[5px] rounded-full bg-risk-safe" />
              <span>ready</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
