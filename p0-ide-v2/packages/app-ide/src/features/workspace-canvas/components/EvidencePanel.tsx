import { useEffect } from "react";
import type { ProofBundle, WitnessRole } from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
import { WS_CLASSES } from "../lib/css-classes";

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
    <div className={WS_CLASSES.evidence} role="dialog" aria-label="Evidence">
      <div className={WS_CLASSES.evidenceHeader}>
        <div className={WS_CLASSES.evidenceTitle}>
          <span
            className={WS_CLASSES.evidenceSeverity}
            style={{ background: SEVERITY_COLOR[proof.severity] }}
          >
            {proof.severity}
          </span>
          <span className={WS_CLASSES.evidenceKind}>{proof.kind}</span>
          {proof.rule && <span className={WS_CLASSES.evidenceRule}>{proof.rule}</span>}
        </div>
        <button
          type="button"
          className={WS_CLASSES.evidenceClose}
          onClick={() => interactionStore.setInspectedEvidence(null)}
          title="Close (Esc)"
        >×</button>
      </div>

      <div className={WS_CLASSES.evidenceSummary}>{proof.summary}</div>

      <div className={WS_CLASSES.evidenceMeta}>
        <span>analyzer · {proof.analyzer}</span>
        {typeof proof.confidence === "number" && (
          <span>confidence · {(proof.confidence * 100).toFixed(0)}%</span>
        )}
        <span>{fmtDate}</span>
      </div>

      <div className={WS_CLASSES.evidenceSteps}>
        {proof.steps.map((step, idx) => (
          <div key={step.stepId} className={WS_CLASSES.evidenceStep}>
            <div className={WS_CLASSES.evidenceStepHead}>
              <span className={WS_CLASSES.evidenceStepNum}>{idx + 1}</span>
              <span
                className={WS_CLASSES.evidenceStepRole}
                style={{ background: ROLE_COLOR[step.role] }}
              >
                {step.role}
              </span>
              <span className={WS_CLASSES.evidenceStepLoc}>
                {step.file}
                {step.line && `:${step.line}`}
                {step.symbol && ` · ${step.symbol}`}
              </span>
            </div>
            {step.snippet && (
              <pre className={WS_CLASSES.evidenceSnippet}>{step.snippet}</pre>
            )}
            <div className={WS_CLASSES.evidenceStepDesc}>{step.description}</div>
          </div>
        ))}
      </div>

      <div className={WS_CLASSES.evidenceFooter}>
        <span className={WS_CLASSES.evidenceHint}>Esc to close</span>
      </div>
    </div>
  );
}
