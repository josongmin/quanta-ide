import { useTranslation } from "react-i18next";
import { useToast } from "@/features/ide-toast";
import { Panel, PanelHeader, PanelBody, PanelFooter, Button } from "@/shared/ui";
import { useSimulateChange } from "../model/useSimulateChange";

export function SimulatePanel() {
  const { t } = useTranslation();
  const { isOpen, close } = useSimulateChange();
  const { show: showToast } = useToast();

  return (
    <Panel
      tier="sheet"
      size="md"
      open={isOpen}
      onClose={close}
      ariaLabel={t("ide.sim.closeAria")}
      className="sim"
    >
      <PanelHeader onClose={close} ariaLabel={t("ide.sim.closeAria")}>
        <div className="sim-head-label">{t("ide.sim.head")}</div>
      </PanelHeader>

      <PanelBody className="sim-body">
        <section className="sim-section">
          <div className="sim-section-label">{t("ide.sim.diff")}</div>
          <pre className="sim-diff">
            <span className="line"><span className="lineno">7</span>{"  const validated = parse(amount);"}</span>
            <span className="line del"><span className="lineno">8</span>{"- if (amount > 0) {"}</span>
            <span className="line add"><span className="lineno">8</span>{"+ if (amount >= 0) {"}</span>
            <span className="line"><span className="lineno">9</span>{"    await db.update({ amount });"}</span>
            <span className="line"><span className="lineno">10</span>{"  }"}</span>
          </pre>
        </section>

        <section className="sim-section">
          <div className="sim-section-label">{t("ide.sim.impact")}</div>
          <div className="sim-impact-grid">
            <div className="sim-impact">
              <div className="sim-impact-k">{t("ide.sim.blastK")}</div>
              <div className="sim-impact-v">31 <span className="arrow">→</span> 37 <span className="delta">(+6)</span></div>
            </div>
            <div className="sim-impact">
              <div className="sim-impact-k">{t("ide.sim.taintK")}</div>
              <div className="sim-impact-v">2 <span className="arrow">→</span> 3 <span className="delta">(+1)</span></div>
            </div>
            <div className="sim-impact">
              <div className="sim-impact-k">{t("ide.sim.testsK")}</div>
              <div className="sim-impact-v">12 <span className="arrow">→</span> 14 <span className="delta">(+2)</span></div>
            </div>
            <div className="sim-impact">
              <div className="sim-impact-k">{t("ide.sim.behaviorDeltaK")}</div>
              <div className="sim-impact-v">{t("ide.sim.behaviorPath")}</div>
            </div>
          </div>
        </section>

        <section className="sim-section">
          <div className="sim-section-label">{t("ide.sim.behaviorSection")}</div>
          <div className="sim-behavior">
            <div className="sim-behavior-row">
              <span className="sim-behavior-cond">amount === 0</span>
              <span className="sim-behavior-arrow">→</span>
              <span className="sim-behavior-result">{t("ide.sim.reachDb")}</span>
            </div>
          </div>
        </section>

        <section className="sim-section">
          <div className="sim-section-label">{t("ide.sim.newTaint")}</div>
          <div className="sim-flow">
            <div className="sim-flow-step">req.body.amount</div>
            <div className="sim-flow-arrow">↓</div>
            <div className="sim-flow-step">processRefund</div>
            <div className="sim-flow-arrow">↓</div>
            <div className="sim-flow-step is-sink">db.update</div>
          </div>
        </section>

        <section className="sim-section">
          <div className="sim-section-label">{t("ide.sim.affectedTests")}</div>
          <div className="sim-tests">
            <div className="sim-test"><span className="status">fail</span>test_zero_amount_rejection</div>
            <div className="sim-test"><span className="status">fail</span>test_negative_returns_400</div>
            <div className="sim-test"><span className="status pass">pass</span>test_positive_amount</div>
            <div className="sim-test"><span className="status pass">pass</span>test_idempotency</div>
          </div>
        </section>

        <section className="sim-meta">
          <div className="sim-meta-row">
            <span className="sim-meta-k">{t("ide.sim.metaConfidence")}</span>
            <span className="sim-meta-v">high</span>
          </div>
          <div className="sim-meta-row">
            <span className="sim-meta-k">{t("ide.sim.metaAnalyzed")}</span>
            <span className="sim-meta-v">340ms</span>
          </div>
          <div className="sim-meta-row">
            <span className="sim-meta-k">{t("ide.sim.metaEngine")}</span>
            <span className="sim-meta-v">behavior_diff · taint_flow</span>
          </div>
        </section>
      </PanelBody>

      <PanelFooter align="end">
        <Button
          onClick={() => {
            showToast(t("ide.sim.toastDiscard"));
            close();
          }}
        >
          {t("ide.sim.discard")} <span className="ide-btn-key">⎋</span>
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            showToast(t("ide.sim.toastApply"));
            close();
          }}
        >
          {t("ide.sim.apply")} <span className="ide-btn-key">⏎</span>
        </Button>
      </PanelFooter>
    </Panel>
  );
}
