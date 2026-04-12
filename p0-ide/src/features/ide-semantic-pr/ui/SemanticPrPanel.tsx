import { useTranslation } from "react-i18next";
import type { PrDraft } from "@/app/ide/mock-pr";
import { useToast } from "@/features/ide-toast";
import { Panel, PanelHeader, PanelBody, PanelFooter, Button } from "@/shared/ui";
import { useSemanticPr } from "../model/useSemanticPr";

interface SemanticPrPanelProps {
  draft: PrDraft;
  onPreflight?: () => void;
}

export function SemanticPrPanel({ draft, onPreflight }: SemanticPrPanelProps) {
  const { t } = useTranslation();
  const { isOpen, close } = useSemanticPr();
  const { show: showToast } = useToast();

  return (
    <Panel
      tier="sheet"
      size="md"
      open={isOpen}
      onClose={close}
      ariaLabel={t("ide.semanticPr.panelAria")}
      className="spr"
    >
      <PanelHeader onClose={close} ariaLabel={t("ide.semanticPr.closeAria")}>
        <div className="spr-head-left">
          <span className="spr-head-label">{t("ide.semanticPr.draft")}</span>
          <span className="spr-head-branch">{draft.branch}</span>
        </div>
      </PanelHeader>

      <PanelBody className="spr-body">
        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.title")}</div>
          <input
            type="text"
            className="spr-title"
            defaultValue={draft.title}
            spellCheck={false}
            aria-label={t("ide.semanticPr.titleAria")}
          />
        </section>

        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.summary")}</div>
          <div className="spr-text">{draft.summary}</div>
        </section>

        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.impact")}</div>
          <div className="spr-impact">
            {draft.impact.map((row) => (
              <div key={row.label} className="spr-impact-row">
                <span className="spr-bullet">•</span>
                {row.label}: <strong>{row.before} → {row.after}</strong>{" "}
                <span className={`spr-delta${row.resolved === true ? " is-down" : ""}`}>{row.delta}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="spr-section spr-section-attn">
          <div className="spr-label">{t("ide.semanticPr.reviewer")}</div>
          <div className="spr-text">
            <strong>{draft.reviewerGuide.ref}</strong> — {draft.reviewerGuide.reason}.
            <span className="spr-dim"> {t("ide.semanticPr.confidence", { v: draft.reviewerGuide.confidence })}</span>
          </div>
        </section>

        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.behaviorDiff")}</div>
          <div className="spr-behavior">
            {draft.behavior.map((b, i) => (
              <div key={i} className="spr-bh-row">
                <span className={`spr-bh-mark ${b.ok ? "ok" : "warn"}`}>{b.ok ? "✓" : "⚠"}</span>
                <span>
                  {b.text}
                  {b.detail !== undefined && <span className="spr-dim"> ({b.detail})</span>}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.history")}</div>
          <div className="spr-history">
            {draft.history.map((h, i) => (
              <div key={i} className="spr-history-row">
                <span className="spr-history-tag">{h.tag}</span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="spr-section">
          <div className="spr-label">{t("ide.semanticPr.filesChanged", { count: draft.files.length })}</div>
          <div className="spr-files">
            {draft.files.map((f) => (
              <div key={f.path} className="spr-file">
                <span className="spr-file-stat">{f.stat}</span>
                <span className="spr-file-name">{f.path}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="spr-badge">
          <span className="spr-badge-dot" />
          {t("ide.semanticPr.badge")}
        </div>
      </PanelBody>

      <PanelFooter align="end">
        <Button onClick={close}>
          {t("ide.semanticPr.cancel")}<span className="ide-btn-key">⎋</span>
        </Button>
        <Button
          onClick={() => {
            showToast(t("ide.semanticPr.toastCopy", { title: draft.title }));
          }}
        >
          {t("ide.semanticPr.copyMarkdown")}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            if (onPreflight) {
              close();
              onPreflight();
            } else {
              showToast(t("ide.semanticPr.toastPush", { branch: draft.branch.split(" ")[0] }));
              close();
            }
          }}
        >
          {onPreflight ? t("ide.semanticPr.preflight") : t("ide.semanticPr.github")}<span className="ide-btn-key">⏎</span>
        </Button>
      </PanelFooter>
    </Panel>
  );
}
