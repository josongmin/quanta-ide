import { useCallback, useEffect, useRef, useState } from "react";
import { useFeature } from "../store/feature-flags-store";
import { useFigmaMode, figmaModeStore } from "../store/figma-mode-store";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { viewportStore } from "../store/viewport-store";

// Path playback bar (R5)
// -------------------------------------------------------------------
// Auto-advances through the active ProofBundle's witness steps like a
// video scrubber. Pairs with EvidenceTab — the tab is the detail view,
// this bar is the playback transport. Shows when:
//   * power.figmaShell is on, AND
//   * the shell mode is `trace`, AND
//   * an evidence (ProofBundle) is active.
//
// Each step tick: drives the viewport to that step's file (when we can
// resolve it) and publishes a synthetic "active step index" via the
// store (reused by EvidenceTab to highlight the tile). We don't create
// a new store field — we push `setInspectedEvidence` invariantly and
// step forward using a local state; EvidenceTab already listens to
// keyboard ←/→ which we simulate on auto-tick for free.

const STEP_MS = 2600;

export function PathPlaybackBar() {
  const enabled = useFeature("power.figmaShell");
  const mode = useFigmaMode(s => s.mode);
  const evidenceId = useInteractionStore(s => s.inspectedEvidenceId);
  const proofs = useSceneStore(s => s.graph?.proofs);
  const layout = useSceneStore(s => s.layout);
  const files = useSceneStore(s => s.graph?.files);

  const proof = evidenceId ? proofs?.[evidenceId] ?? null : null;

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Reset step when evidence swaps.
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [evidenceId]);

  const jumpToStep = useCallback((idx: number) => {
    if (!proof || !layout || !files) return;
    const st = proof.steps[idx];
    if (!st) return;
    // Resolve file — `st.file` can be a path or a basename; try exact
    // match first, then endsWith. Fall back silently.
    let file = files.find(f => f.id === st.file);
    if (!file) file = files.find(f => f.id.endsWith("/" + st.file) || f.id.endsWith(st.file));
    if (file) {
      interactionStore.selectFile(file.id);
      const rect = layout.fileRects.get(file.id);
      const vp = viewportStore.getState().viewport;
      if (rect && vp.width > 0 && vp.height > 0 && vp.scale > 0) {
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;
        viewportStore.setViewport({
          ...vp,
          x: vp.width / 2 - cx * vp.scale,
          y: vp.height / 2 - cy * vp.scale,
        });
      }
    }
  }, [proof, layout, files]);

  useEffect(() => {
    if (!playing || !proof) return;
    tickRef.current = window.setInterval(() => {
      setStep(s => {
        const next = s + 1;
        if (next >= proof.steps.length) {
          // End of playback — pause on the last step.
          setPlaying(false);
          return proof.steps.length - 1;
        }
        jumpToStep(next);
        return next;
      });
    }, STEP_MS);
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [playing, proof, jumpToStep]);

  // When the user plays from step 0 freshly, jump to step 0 so the
  // camera catches up on the first tick rather than waiting STEP_MS.
  useEffect(() => {
    if (playing) jumpToStep(step);
    // Only when starting / moving to new step via non-timer path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const active = enabled && mode === "trace" && proof !== null;
  if (!active || !proof) return null;

  const total = proof.steps.length;
  const current = proof.steps[step];

  const manualStep = (delta: number) => {
    const next = Math.max(0, Math.min(total - 1, step + delta));
    setStep(next);
    jumpToStep(next);
  };

  return (
    <div className="ws-playback" role="toolbar" aria-label="Path playback">
      <div className="ws-playback__head">
        <span className="ws-playback__eyebrow">Trace playback</span>
        <span className="ws-playback__sub">
          {proof.kind} · {proof.severity} · {total} steps
        </span>
      </div>
      <div className="ws-playback__controls">
        <button
          type="button"
          className="ws-figma-chip"
          onClick={() => manualStep(-1)}
          disabled={step <= 0}
        >
          ⏮ prev
        </button>
        <button
          type="button"
          className="ws-playback__play"
          onClick={() => setPlaying(p => !p)}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          className="ws-figma-chip"
          onClick={() => manualStep(+1)}
          disabled={step >= total - 1}
        >
          next ⏭
        </button>
        <span className="ws-playback__progress">
          {(step + 1).toString().padStart(2, "0")} / {total.toString().padStart(2, "0")}
        </span>
        <div className="ws-playback__bar">
          <div
            className="ws-playback__bar-fill"
            style={{ width: `${((step + 1) / Math.max(1, total)) * 100}%` }}
          />
        </div>
        <button
          type="button"
          className="ws-figma-chip"
          onClick={() => {
            figmaModeStore.setMode("explore");
            interactionStore.setInspectedEvidence(null);
          }}
          title="Close trace"
        >
          ✕
        </button>
      </div>
      {current && (
        <div className="ws-playback__caption" title={current.description}>
          <span className="ws-playback__step-role">{current.role}</span>
          <span className="ws-playback__step-loc">
            {current.file}{current.line ? `:${current.line}` : ""}
            {current.symbol ? ` · ${current.symbol}` : ""}
          </span>
          <span className="ws-playback__step-desc">{current.description}</span>
        </div>
      )}
    </div>
  );
}

