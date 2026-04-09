import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Zeigarnik Effect: unfinished tasks are remembered better.
 * Each hint is an "open loop" — the user wants to close it.
 *
 * Progressive Disclosure: one hint at a time, each building on the last.
 *
 * Serial Position Effect: first hint = primacy (sets expectation),
 * last hint = recency (most impactful action).
 */
const HINTS = [
  { delay: 1500, text: "Click on a function name to see its call graph →", accent: "processRefund" },
  { delay: 9000, text: "Try changing  > 0  to  >= 0  on line 31 — watch the analysis react", accent: ">= 0" },
  { delay: 18000, text: "Press ⌘K to open the command palette", accent: "⌘K" },
];

export function OnboardingHint() {
  const [step, setStep] = useState(-1);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timers = HINTS.map((h, i) =>
      setTimeout(() => setStep(i), h.delay)
    );
    const autoHide = setTimeout(() => setDismissed(true), 28000);
    return () => { timers.forEach(clearTimeout); clearTimeout(autoHide); };
  }, []);

  if (dismissed || step < 0) return null;

  const hint = HINTS[step];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="fixed bottom-14 left-1/2 -translate-x-1/2 z-30"
      >
        <div
          className="flex items-center gap-3 px-4 py-2.5 bg-surface-3/95 border border-border rounded-lg shadow-2xl backdrop-blur-sm cursor-pointer group"
          onClick={() => setDismissed(true)}
        >
          {/* Pulse — attention cue (Doherty: immediate visual feedback) */}
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-risk-info shrink-0"
          />

          {/* Hint text */}
          <span className="text-[11px] font-mono text-text-secondary">
            {hint.text.split(hint.accent).map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="text-risk-info font-semibold">{hint.accent}</span>
                )}
              </span>
            ))}
          </span>

          {/* Step dots — Gestalt: proximity + similarity show progress */}
          <div className="flex gap-1 ml-2">
            {HINTS.map((_, i) => (
              <div key={i} className={`w-1 h-1 rounded-full transition-colors ${i <= step ? "bg-risk-info" : "bg-surface-4"}`} />
            ))}
          </div>

          {/* Dismiss hint */}
          <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-1">×</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
