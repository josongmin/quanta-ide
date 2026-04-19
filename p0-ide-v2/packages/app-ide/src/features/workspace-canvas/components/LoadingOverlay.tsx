import { useEffect, useState } from "react";
import type { LayoutProgress } from "../store/scene-store";

interface Props {
  progress: LayoutProgress;
  hasGraph: boolean;
}

// Human-readable stage labels. The "refining" stage shows a nondeterministic
// spinner because the layered-layout pass doesn't report internal progress.
const STAGE_LABEL: Record<LayoutProgress["stage"], string> = {
  idle:         "Preparing workspace…",
  requested:    "Computing layout…",
  "grid-ready": "Rendering…",
  "elk-running": "Refining layout…",
  "elk-skipped": "Layout ready",
  "elk-done":    "Layout ready",
  "elk-failed":  "Layout ready",
  "worker-error": "Canvas worker crashed",
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
  const isError = progress.stage === "worker-error";

  // Terminal error state — the canvas worker died, so the layout will never
  // arrive. Show a red headline, the underlying error message, and a reload
  // CTA. Full reload is cheap and avoids having to bolt a worker-reset path
  // into every sub-store; the user's repo path is re-loaded by app boot.
  if (isError) {
    return (
      <div className="ws-loading ws-loading--error">
        <div className="ws-loading__inner">
          <div className="ws-loading__headline ws-loading__headline--error">
            Canvas worker crashed
          </div>
          {progress.error && (
            <div className="ws-loading__err-msg">{progress.error}</div>
          )}
          <button
            type="button"
            className="ws-loading__reload"
            onClick={() => window.location.reload()}
          >
            reload
          </button>
        </div>
      </div>
    );
  }

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
