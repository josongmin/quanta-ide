import { useEffect } from "react";
import type { ProofBundle, WitnessRole } from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";

// Slide-in "why was this flagged?" panel. Triggered by cmd+click on a safety
// or impact edge with a populated `evidenceId`. Shows analyzer metadata +
// step-by-step witness trace so reviewers can audit the flow instead of
// trusting the headline label. Semgrep Explore / CodeQL Path Explorer do
// the same — walking the actual proof makes false positives cheap to spot.

const ROLE_COLOR: Record<WitnessRole, string> = {
  source: "#dc2626",
  sink: "#b91c1c",
  propagation: "#ea580c",
  "sanitizer-bypass": "#d97706",
  flow: "#6b7280",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#dc2626",
  critical: "#7f1d1d",
};

function useProof(): ProofBundle | null {
  const evidenceId = useInteractionStore(s => s.inspectedEvidenceId);
  const proofs = useSceneStore(s => s.graph?.proofs);
  if (!evidenceId) return null;
  return proofs?.[evidenceId] ?? null;
}

export function EvidencePanel() {
  const proof = useProof();
  const open = proof !== null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        interactionStore.setInspectedEvidence(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!proof) return null;

  const fmtDate = proof.createdAt
    ? new Date(proof.createdAt).toISOString().slice(0, 10)
    : "—";

  return (
    <div className="ws-evidence" role="dialog" aria-label="Evidence">
      <div className="ws-evidence__header">
        <div className="ws-evidence__title">
          <span
            className="ws-evidence__severity"
            style={{ background: SEVERITY_COLOR[proof.severity] }}
          >
            {proof.severity}
          </span>
          <span className="ws-evidence__kind">{proof.kind}</span>
          {proof.rule && <span className="ws-evidence__rule">{proof.rule}</span>}
        </div>
        <button
          type="button"
          className="ws-evidence__close"
          onClick={() => interactionStore.setInspectedEvidence(null)}
          title="Close (Esc)"
        >×</button>
      </div>

      <div className="ws-evidence__summary">{proof.summary}</div>

      <div className="ws-evidence__meta">
        <span>analyzer · {proof.analyzer}</span>
        {typeof proof.confidence === "number" && (
          <span>confidence · {(proof.confidence * 100).toFixed(0)}%</span>
        )}
        <span>{fmtDate}</span>
      </div>

      <div className="ws-evidence__steps">
        {proof.steps.map((step, idx) => (
          <div key={step.stepId} className="ws-evidence__step">
            <div className="ws-evidence__step-head">
              <span className="ws-evidence__step-num">{idx + 1}</span>
              <span
                className="ws-evidence__step-role"
                style={{ background: ROLE_COLOR[step.role] }}
              >
                {step.role}
              </span>
              <span className="ws-evidence__step-loc">
                {step.file}
                {step.line && `:${step.line}`}
                {step.symbol && ` · ${step.symbol}`}
              </span>
            </div>
            {step.snippet && (
              <pre className="ws-evidence__snippet">{step.snippet}</pre>
            )}
            <div className="ws-evidence__step-desc">{step.description}</div>
          </div>
        ))}
      </div>

      <div className="ws-evidence__footer">
        <span className="ws-evidence__hint">Esc to close</span>
      </div>
    </div>
  );
}
