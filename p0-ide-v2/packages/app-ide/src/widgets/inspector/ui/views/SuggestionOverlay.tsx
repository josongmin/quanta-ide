import "./suggestion-overlay.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "@quanta/shell/stores/toast-store";
import { focusStore } from "@quanta/app-ide/stores/focus-store";
import {
  complianceStore,
  useComplianceStore,
} from "@quanta/app-ide/entities/compliance";
import type { ProofReplayData, SuggestionData } from "./SuggestionOverlay.types";
import { RiskDelta } from "./SuggestionRiskDelta";
import { VerificationList } from "./SuggestionVerificationList";
import { ComplianceCard } from "./SuggestionComplianceCard";
import { CounterfactualProjection } from "./SuggestionCounterfactualProjection";
import { CounterfactualCard } from "./SuggestionCounterfactualCard";
import { ProofReplay } from "./SuggestionProofReplay";
import { PatchTrail } from "./SuggestionPatchTrail";

export type {
  VerifyState,
  VerifyItem,
  CounterfactualState,
  CounterfactualItem,
  CounterfactualData,
  ProofReplayCheck,
  ProofReplayData,
  PatchAction,
  PatchTrailEntry,
  SuggestionData,
} from "./SuggestionOverlay.types";

interface Props {
  data: SuggestionData;
  onClose: () => void;
}

const CURRENT_CHANGE_ID = "cs-live";

export function SuggestionOverlay({ data, onClose }: Props) {
  const [replay, setReplay] = useState<ProofReplayData>(data.proofReplay);
  const [applying, setApplying] = useState(false);
  const allEvents = useComplianceStore((s) => s.events);
  const complianceForChange = useMemo(
    () => allEvents.filter((e) => e.changeSetId === CURRENT_CHANGE_ID),
    [allEvents],
  );

  // Timer ref for apply timeout — ensures cleanup on unmount.
  const applyTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (applyTimerRef.current !== null) window.clearTimeout(applyTimerRef.current);
  }, []);

  const handleApply = useCallback(() => {
    if (applying || replay.status === "verified") return;
    setApplying(true);
    toast.info("Applying patch…", data.title, "taint v2 · behavior diff");
    setReplay((r) => ({ ...r, status: "pending" }));

    applyTimerRef.current = window.setTimeout(() => {
      applyTimerRef.current = null;
      setReplay((r) => ({
        ...r,
        status: "verified",
        verifiedAt: "just now",
      }));
      setApplying(false);

      const events = complianceStore.submit({
        id: CURRENT_CHANGE_ID,
        label: data.title,
        files: ["orchestrator.py"],
        author: "agent",
        agentId: "quanta-agent",
        agentClaim: "no-api-break",
        sessionId: "s-live",
      });
      const lies = events.filter((e) => e.isLie).length;
      const pass = events.filter((e) => e.status === "pass").length;

      toast.success(
        "Patch verified",
        `${pass}/${events.length} compliance rules passed · risk ${data.riskBefore} → ${data.riskAfter}`,
        "proof replay",
      );
      if (lies > 0) {
        toast.danger(
          `Lie detected · ${lies} rule${lies > 1 ? "s" : ""}`,
          "Agent claim did not match engine verdict",
          "compliance",
        );
      }
    }, 1800);
  }, [applying, replay.status, data]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleApply();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, handleApply]);

  function handleDismiss() {
    toast.warn("Patch dismissed", "Counterfactual cost recorded in patch trail", "patch trail");
    onClose();
  }

  function handleSimulate() {
    toast.info("Simulate change opened", "Engine will preview blast · taint · cpx delta", "simulate");
    focusStore.toggleSimulate(true);
    onClose();
  }

  return createPortal(
    <div className="sugg-overlay" role="dialog" aria-label="Suggested action">
      <div className="sugg-overlay__scrim" onClick={onClose} aria-hidden />
      <div className="sugg-overlay__panel">
        <div className="sugg-overlay__head">
          <span className="sugg-overlay__kicker">L3 · Suggested action</span>
          <span className="sugg-overlay__title">evidence-backed patch</span>
          <button
            type="button"
            className="sugg-overlay__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="sugg-overlay__body">
          <div className="fix">
            <div className="fix__title-row">
              <span className="fix__title">{data.title}</span>
              <span className="fix__conf">confidence {data.confidence.toFixed(2)}</span>
            </div>
            <p className="fix__rationale">{data.rationale}</p>

            <RiskDelta before={data.riskBefore} after={data.riskAfter} />

            <pre className="fix__code">{data.diff}</pre>

            <VerificationList items={data.verification} />

            <ComplianceCard events={complianceForChange} />

            <CounterfactualProjection />

            <CounterfactualCard data={data.counterfactual} riskAfter={data.riskAfter} />

            <ProofReplay data={replay} />

            <PatchTrail entries={data.patchTrail} />
          </div>
        </div>

        <div className="sugg-overlay__foot">
          <span className="sugg-overlay__hint">
            <kbd>Esc</kbd> dismiss · <kbd>⌘⇧S</kbd> simulate · <kbd>⌘⏎</kbd> apply
          </span>
          <div className="sugg-overlay__actions">
            <button type="button" className="btn btn--ghost" onClick={handleDismiss} disabled={applying}>
              Dismiss
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleSimulate} disabled={applying}>
              Simulate
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleApply}
              disabled={applying || replay.status === "verified"}
            >
              {applying ? "Applying…" : replay.status === "verified" ? "Applied ✓" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
