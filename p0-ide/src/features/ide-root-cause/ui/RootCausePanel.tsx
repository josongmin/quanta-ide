import { useTranslation } from "react-i18next";
import { SAMPLE_TRACE } from "../model/root-cause-data";

export function RootCausePanel() {
  const { t } = useTranslation();
  const trace = SAMPLE_TRACE;

  return (
    <div className="rcause">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.rootCause.title")}</span>
      </div>

      <div className="rcause-header">
        <div className="rcause-header-left">
          <span className="rcause-id">{trace.errorId}</span>
          <span className={`rcause-sev rcause-sev--${trace.severity.toLowerCase()}`}>{trace.severity}</span>
          <span className={`rcause-conf rcause-conf--${trace.confidence}`}>{trace.confidence}</span>
        </div>
        <div className="rcause-title">{trace.errorTitle}</div>
      </div>

      <div className="rcause-root">
        <span className="rcause-root-label">{t("ide.rootCause.rootCause")}</span>
        <span className="rcause-root-sym">{trace.rootSymbol}</span>
        <span className="rcause-root-loc">{trace.rootFile}:{trace.rootLine}</span>
      </div>

      <div className="rcause-explanation">{trace.explanation}</div>

      <div className="rcause-trace">
        <div className="rcause-trace-label">{t("ide.rootCause.trace")}</div>
        {trace.trace.map((step, i) => (
          <div key={step.id} className={`rcause-step rcause-step--${step.kind}`}>
            <div className="rcause-step-rail">
              <span className="rcause-step-dot" />
              {i < trace.trace.length - 1 && <span className="rcause-step-line" />}
            </div>
            <div className="rcause-step-body">
              <div className="rcause-step-head">
                <span className="rcause-step-sym">{step.symbol}</span>
                <span className="rcause-step-loc">{step.file}:{step.line}</span>
              </div>
              <div className="rcause-step-summary">{step.summary}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
