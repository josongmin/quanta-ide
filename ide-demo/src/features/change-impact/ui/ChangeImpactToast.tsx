import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysisStore } from "@/app/stores/useAnalysisStore";
import { cn } from "@/shared/lib/cn";

export function ChangeImpactToast() {
  const { lastChange, isAnalyzing } = useAnalysisStore();

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!lastChange || isAnalyzing) return;
    const t = setTimeout(() => {
      useAnalysisStore.setState({ lastChange: null });
    }, 6000);
    return () => clearTimeout(t);
  }, [lastChange, isAnalyzing]);

  const dismiss = () => useAnalysisStore.setState({ lastChange: null });

  return (
    <AnimatePresence>
      {(lastChange || isAnalyzing) && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-12 right-4 z-40 max-w-[360px]"
        >
          <div className={cn(
            "px-4 py-3 rounded-xl font-mono text-[12px] glass shadow-2xl shadow-black/40",
            isAnalyzing
              ? "border-risk-caution/20 text-risk-caution"
              : "border-risk-critical/20 text-text-primary"
          )}>
            {isAnalyzing ? (
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="inline-block w-3 h-3 border-2 border-risk-caution border-t-transparent rounded-full"
                />
                <span>Analyzing changes...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-risk-critical text-[14px]">⚠️</span>
                  <span className="font-semibold">Impact Updated</span>
                  <button type="button" onClick={dismiss} className="ml-auto text-text-muted hover:text-text-primary transition-colors text-[14px]">×</button>
                </div>
                <div className="text-text-secondary text-[11px] leading-relaxed mb-2">{lastChange}</div>
                <div className="flex gap-2">
                  <button type="button" className="px-2.5 py-1 rounded text-[10px] bg-risk-critical/15 text-risk-critical hover:bg-risk-critical/25 transition-colors font-medium">
                    View impact
                  </button>
                  <button type="button" onClick={dismiss} className="px-2.5 py-1 rounded text-[10px] bg-white/5 text-text-muted hover:bg-white/10 transition-colors">
                    Dismiss
                  </button>
                </div>
                {/* Auto-dismiss progress bar */}
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 6, ease: "linear" }}
                  className="h-[2px] bg-risk-critical/30 rounded-full mt-2"
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
