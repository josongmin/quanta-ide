import { useTranslation } from "react-i18next";
import { useToast } from "@/features/ide-toast";
import { Panel, PanelHeader, PanelBody, PanelFooter, Button } from "@/shared/ui";
import { usePrDisaster, DISASTER_DATA } from "../model/usePrDisaster";

export function PrDisasterPanel() {
  const { t } = useTranslation();
  const { isOpen, close } = usePrDisaster();
  const { show: showToast } = useToast();

  const uncoveredCount = DISASTER_DATA.brokenTests.filter((x) => x.uncovered).length;

  return (
    <Panel
      tier="sheet"
      size="md"
      open={isOpen}
      onClose={close}
      ariaLabel={t("ide.prDisaster.closeAria")}
      className="prd"
    >
      <PanelHeader onClose={close} ariaLabel={t("ide.prDisaster.closeAria")}>
        <div className="prd-head-left">
          <span className="prd-head-icon">⚠</span>
          <div className="prd-head-text">
            <div className="prd-head-title">{t("ide.prDisaster.panelTitle")}</div>
            <div className="prd-head-sub">{t("ide.prDisaster.panelSub")}</div>
          </div>
        </div>
      </PanelHeader>

      <PanelBody className="prd-body">
        {/* Headline numbers */}
        <section className="prd-headline">
          <div className="prd-headline-stat">
            <div className="prd-stat-k">{t("ide.prDisaster.changed")}</div>
            <div className="prd-stat-v">{DISASTER_DATA.changedFiles}</div>
            <div className="prd-stat-sub">{t("ide.prDisaster.files")}</div>
          </div>
          <div className="prd-headline-arrow">→</div>
          <div className="prd-headline-stat is-warn">
            <div className="prd-stat-k">{t("ide.prDisaster.realImpact")}</div>
            <div className="prd-stat-v">{DISASTER_DATA.realImpact}</div>
            <div className="prd-stat-sub">{t("ide.prDisaster.filesLinearDeps")}</div>
          </div>
        </section>

        {/* Affected files */}
        <section className="prd-section">
          <div className="prd-section-label">{t("ide.prDisaster.cascadeTop5")}</div>
          <div className="prd-affected">
            {DISASTER_DATA.affected.map((f) => (
              <div key={f.path} className="prd-affected-row">
                <span className="prd-risk-dot" data-risk={f.risk} />
                <span className="prd-affected-path">{f.path}</span>
                <span className="prd-affected-why">{t(`ide.prDisaster.why.${f.whyKey}`)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Broken tests */}
        <section className="prd-section">
          <div className="prd-section-label">
            {t("ide.prDisaster.testsAtRisk")}
            {" · "}
            <span className="prd-warn">{DISASTER_DATA.brokenTests.length}</span>
            {" · "}
            <span className="prd-dim">
              {uncoveredCount} {t("ide.prDisaster.uncovered")}
            </span>
          </div>
          <div className="prd-tests">
            {DISASTER_DATA.brokenTests.map((test) => (
              <div key={test.name} className="prd-test-row">
                <span className={`prd-test-mark${test.uncovered ? " is-warn" : ""}`}>
                  {test.uncovered ? "?" : "×"}
                </span>
                <span className="prd-test-name">{test.name}</span>
                <span className="prd-test-file">{test.file}</span>
              </div>
            ))}
          </div>
        </section>

        {/* New taint paths */}
        <section className="prd-section">
          <div className="prd-section-label">{t("ide.prDisaster.security")}</div>
          <div className="prd-security">
            <span className="prd-security-mark">⚠</span>
            <span className="prd-security-text">
              <strong>{t("ide.prDisaster.newTaintPathsStrong", { n: DISASTER_DATA.newTaintPaths })}</strong>{" "}
              {t("ide.prDisaster.introduced")}
            </span>
            <span className="prd-security-detail">{t("ide.prDisaster.securityDetailLine")}</span>
          </div>
        </section>

        {/* Conflicting peers */}
        <section className="prd-section">
          <div className="prd-section-label">{t("ide.prDisaster.concurrentConflicts")}</div>
          <div className="prd-conflicts">
            {DISASTER_DATA.conflicts.map((c) => (
              <div key={c.pr} className="prd-conflict-row">
                <span className="prd-conflict-author">{c.author}</span>
                <span className="prd-conflict-pr">{c.pr}</span>
                <span className="prd-conflict-file">{c.file}</span>
                <span className="prd-conflict-overlap">
                  {t("ide.prDisaster.overlapPrefix")}{" "}
                  <code>{c.overlap}</code>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Verdict */}
        <section className="prd-verdict">
          <div className="prd-verdict-label">{t("ide.prDisaster.verdict")}</div>
          <div className="prd-verdict-text">
            {t("ide.prDisaster.verdictPrefix")}
            <strong>{t("ide.prDisaster.verdictUnsafe")}</strong>
            {t("ide.prDisaster.verdictSuffix")}
            <br />
            <span className="prd-dim">
              {t("ide.prDisaster.verdictRecommend")}
            </span>
          </div>
        </section>
      </PanelBody>

      <PanelFooter align="end">
        <Button onClick={close}>
          {t("ide.prDisaster.cancel")}<span className="ide-btn-key">⎋</span>
        </Button>
        <Button onClick={() => { showToast(t("ide.prDisaster.toastSplit")); close(); }}>
          {t("ide.prDisaster.suggestSplit")}
        </Button>
        <Button variant="primary" onClick={() => { showToast(t("ide.prDisaster.toastPush")); close(); }}>
          {t("ide.prDisaster.pushAnyway")}
        </Button>
      </PanelFooter>
    </Panel>
  );
}
