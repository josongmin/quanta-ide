import { useTranslation } from "react-i18next";
import { useFlowTrace } from "../model/useFlowTrace";

export function FlowTraceOverlay() {
  const { t } = useTranslation();
  const { isActive, lines, deactivate } = useFlowTrace();
  if (!isActive || lines.length === 0) return null;

  return (
    <div className="flowtrace-banner">
      <div className="flowtrace-label">{t("ide.flowTrace.dataFlowBanner")}</div>
      <div className="flowtrace-path">
        {lines.map((l, i) => (
          <span key={l.lineNo} className="flowtrace-node">
            {i > 0 && <span className="flowtrace-arrow">→</span>}
            <span className={`flowtrace-tag flowtrace-${l.kind}`}>
              L{l.lineNo}
              <span className="flowtrace-kind">{l.kind}</span>
            </span>
          </span>
        ))}
      </div>
      <button type="button" className="flowtrace-close" onClick={deactivate} aria-label={t("ide.flowTrace.closeTrace")}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
    </div>
  );
}
