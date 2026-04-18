import { useEffect, useState } from "react";
import type { LayoutProgress } from "../store/workspace-canvas-store";

interface Props {
  progress: LayoutProgress;
  hasGraph: boolean;
}

// Human-readable stage labels. elk-running shows a nondeterministic spinner
// because ELK doesn't report internal progress.
const STAGE_LABEL: Record<LayoutProgress["stage"], string> = {
  idle:         "Preparing workspace…",
  requested:    "Computing grid layout…",
  "grid-ready": "Rendering grid…",
  "elk-running": "Refining with ELK layered layout…",
  "elk-skipped": "Grid layout ready (ELK skipped — too many nodes)",
  "elk-done":    "ELK layout applied",
  "elk-failed":  "Grid layout ready (ELK failed, using grid)",
};

export function LoadingOverlay({ progress, hasGraph }: Props) {
  const [now, setNow] = useState(() => performance.now());

  // Tick elapsed time so the user sees that something is alive. The stage
  // transitions come from the worker; this loop is only for the live timer.
  useEffect(() => {
    if (progress.stage === "elk-done" || progress.stage === "idle") return;
    const id = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(id);
  }, [progress.stage]);

  const elapsedMs = progress.startedAt > 0 ? Math.max(0, now - progress.startedAt) : 0;
  const seconds = (elapsedMs / 1000).toFixed(1);
  const filesText = progress.filesCount > 0 ? `${progress.filesCount.toLocaleString()} files` : "";
  const isSpinning = progress.stage === "requested" || progress.stage === "elk-running";

  return (
    <div className="ws-loading">
      <div className="ws-loading__inner">
        <div className="ws-loading__headline">
          {hasGraph ? STAGE_LABEL[progress.stage] : "Loading workspace…"}
          {isSpinning && <span className="ws-loading__spinner" aria-hidden />}
        </div>
        {hasGraph && (
          <div className="ws-loading__meta">
            {filesText}
            {filesText && <span className="ws-loading__sep">·</span>}
            <span className="ws-loading__timer">{seconds}s</span>
          </div>
        )}
        {/* Indeterminate bar — no true progress from ELK, but visual feedback */}
        {isSpinning && (
          <div className="ws-loading__bar">
            <div className="ws-loading__bar-fill" />
          </div>
        )}
      </div>
    </div>
  );
}
