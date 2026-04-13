import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks";
import { Panel, PanelHeader, PanelBody, PanelFooter, Button, Badge, type BadgeVariant } from "@/shared/ui";
import { useChangeCard } from "../model/useChangeCard";

type RiskLevel = "low" | "medium" | "high" | "critical";
type ConfidenceLevel = "low" | "medium" | "high";

const RISK_VARIANT: Record<RiskLevel, BadgeVariant> = {
  low: "success",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const CONFIDENCE_VARIANT: Record<ConfidenceLevel, BadgeVariant> = {
  high: "success",
  medium: "warn",
  low: "danger",
};

export function ChangeCard() {
  const { t } = useTranslation();
  const { isOpen, proposal, close } = useChangeCard();
  const { show: showToast } = useToast();

  useEffect(() => {
    if (!isOpen || !proposal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const taintMsg = proposal.impact.taintDelta < 0 ? `${Math.abs(proposal.impact.taintDelta).toString()} taint path resolved` : "no taint change";
        showToast(`Applied: ${proposal.title} — ${taintMsg}`);
        close();
      }
      if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        showToast(`${proposal.id} rejected`);
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, proposal, close, showToast]);

  const blastDelta = proposal?.impact
    ? proposal.impact.blastAfter - proposal.impact.blastBefore
    : 0;

  return (
    <Panel
      tier="dialog"
      size="md"
      open={isOpen && proposal !== null}
      onClose={close}
      ariaLabel={t("ide.changeCard.closeAria")}
      className="ccard"
    >
      {proposal && (
        <>
        <PanelHeader onClose={close} ariaLabel={t("ide.changeCard.closeAria")}>
          <div className="ccard-source">
            <span className="ccard-source-dot" data-source={proposal.source} />
            <span className="ccard-source-label">{proposal.source} {t("ide.changeCard.proposalSuffix")}</span>
          </div>
        </PanelHeader>

        <PanelBody className="ccard-body">
          <div className="ccard-title">{proposal.title}</div>
          <div className="ccard-summary">{proposal.summary}</div>

          {/* Diff */}
          <section className="ccard-section">
            <div className="ccard-section-label">{t("ide.changeCard.change")}</div>
            <pre className="ccard-diff" aria-label="Proposed code diff">
              {proposal.diff.map((l, i) => (
                <span key={i} className={`ccard-diff-line ccard-diff-${l.type}`}>
                  <span className="ccard-diff-no">{l.line}</span>
                  <span className="ccard-diff-mark">{l.type === "add" ? "+" : l.type === "del" ? "−" : " "}</span>
                  <span className="ccard-diff-text">{l.text}</span>
                </span>
              ))}
            </pre>
          </section>

          {/* Impact */}
          <section className="ccard-section">
            <div className="ccard-section-label">{t("ide.changeCard.impact")}</div>
            <div className="ccard-impact">
              <div className="ccard-impact-row">
                <span className="ccard-k">{t("ide.changeCard.blast")}</span>
                <span className="ccard-v">
                  {proposal.impact.blastBefore} → {proposal.impact.blastAfter}
                  {blastDelta !== 0 && (
                    <span className={`ccard-delta${blastDelta < 0 ? " is-down" : ""}`}>
                      {blastDelta > 0 ? `+${blastDelta.toString()}` : blastDelta.toString()}
                    </span>
                  )}
                </span>
              </div>
              <div className="ccard-impact-row">
                <span className="ccard-k">{t("ide.changeCard.tests")}</span>
                <span className="ccard-v">
                  {proposal.impact.testsAtRisk} {t("ide.changeCard.atRisk")}
                  {proposal.impact.testsBroken > 0 && (
                    <span className="ccard-warn">{t("ide.changeCard.broken", { n: proposal.impact.testsBroken })}</span>
                  )}
                </span>
              </div>
              <div className="ccard-impact-row">
                <span className="ccard-k">{t("ide.changeCard.taint")}</span>
                <span className="ccard-v">
                  <span className={`ccard-delta${proposal.impact.taintDelta < 0 ? " is-down" : ""}`}>
                    {proposal.impact.taintDelta > 0 ? `+${proposal.impact.taintDelta.toString()}` : proposal.impact.taintDelta.toString()}{" "}
                    {t("ide.changeCard.pathSuffix")}
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* Behavior */}
          {proposal.behavior.length > 0 && (
            <section className="ccard-section">
              <div className="ccard-section-label">{t("ide.changeCard.behaviorChange")}</div>
              <div className="ccard-behavior">
                {proposal.behavior.map((b, i) => (
                  <div key={i} className="ccard-behavior-row">
                    <span className="ccard-behavior-mark">{b.intentional ? "✓" : "⚠"}</span>
                    <span className="ccard-behavior-text">{b.change}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Verification */}
          <section className="ccard-section">
            <div className="ccard-section-label">{t("ide.changeCard.verification")}</div>
            <div className="ccard-verify">
              <div className="ccard-verify-row">
                <span className="ccard-verify-k">{t("ide.changeCard.behavior")}</span>
                <span className={`ccard-verify-v ccard-verify-${proposal.verification.behavior}`}>
                  {proposal.verification.behavior}
                </span>
              </div>
              <div className="ccard-verify-row">
                <span className="ccard-verify-k">{t("ide.changeCard.sideEffects")}</span>
                <span className={`ccard-verify-v ccard-verify-${proposal.verification.sideEffects}`}>
                  {proposal.verification.sideEffects}
                </span>
              </div>
              <div className="ccard-verify-row">
                <span className="ccard-verify-k">{t("ide.changeCard.tests")}</span>
                <span className={`ccard-verify-v ccard-verify-${proposal.verification.tests}`}>
                  {proposal.verification.tests}
                </span>
              </div>
            </div>
          </section>

          {/* Evidence */}
          <section className="ccard-section">
            <div className="ccard-section-label">{t("ide.changeCard.evidence")}</div>
            <div className="ccard-evidence">
              {proposal.evidence.map((e, i) => (
                <div key={i} className="ccard-evidence-row">
                  <span className="ccard-evidence-mark">›</span>
                  <span className="ccard-evidence-label">{e.label}</span>
                  {e.loc !== undefined && <span className="ccard-evidence-loc">{e.loc}</span>}
                </div>
              ))}
            </div>
          </section>
        </PanelBody>

        <PanelFooter align="between">
          <div className="ccard-foot-meta">
            <div className="ccard-meta-row">
              <span className="ccard-k">{t("ide.changeCard.risk")}</span>
              <Badge variant={RISK_VARIANT[proposal.risk]}>{proposal.risk}</Badge>
            </div>
            <div className="ccard-meta-row">
              <span className="ccard-k">{t("ide.changeCard.confidence")}</span>
              <Badge variant={CONFIDENCE_VARIANT[proposal.confidence]}>{proposal.confidence}</Badge>
            </div>
          </div>
          <div className="ccard-foot-actions">
            <Button
              onClick={() => {
                showToast(`${proposal.title} — opened in editor for manual edit`);
                close();
              }}
            >
              {t("ide.changeCard.modify")}
            </Button>
            <Button
              onClick={() => {
                showToast(`${proposal.id} rejected`);
                close();
              }}
            >
              {t("ide.changeCard.reject")}<span className="ide-btn-key">⌘⌫</span>
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const taintMsg = proposal.impact.taintDelta < 0 ? `${Math.abs(proposal.impact.taintDelta).toString()} taint path resolved` : "no taint change";
                const testMsg = proposal.impact.testsBroken === 0 ? "0 tests broken" : `${proposal.impact.testsBroken.toString()} tests need update`;
                showToast(`Applied: ${proposal.title} — ${taintMsg}, ${testMsg}`);
                close();
              }}
            >
              {t("ide.changeCard.approve")}<span className="ide-btn-key">⏎</span>
            </Button>
          </div>
        </PanelFooter>
        </>
      )}
    </Panel>
  );
}
