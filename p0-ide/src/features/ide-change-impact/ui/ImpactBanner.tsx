import { useTranslation } from "react-i18next";
import { useAgentWindow } from "@/features/ide-agent-window";
import { useInspectorContext } from "@/features/ide-inspector-context";
import { useChangeImpact } from "../model/useChangeImpact";

export function ImpactBanner() {
  const { t } = useTranslation();
  const data = useChangeImpact((s) => s.data);
  const isActive = useChangeImpact((s) => s.isActive);
  const { setImpactContext } = useInspectorContext();
  const { toggle: toggleAgent } = useAgentWindow();

  if (!isActive || !data) return null;

  return (
    <div className="ci-banner">
      <div className="ci-banner-left">
        <svg className="ci-banner-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="ci-banner-label">
          {t("ide.changeImpact.blastLabel", { n: data.files })}
        </span>
        <span className="ci-banner-conf">
          {t("ide.changeImpact.confidence", { v: data.confidence.toFixed(2) })}
        </span>
      </div>
      <p className="ci-banner-summary">{data.summary}</p>
      <div className="ci-banner-actions">
        <button
          type="button"
          className="ci-banner-btn"
          onClick={() => { setImpactContext(); }}
        >
          {t("ide.changeImpact.showImpacted")}
        </button>
        <button
          type="button"
          className="ci-banner-btn is-agent"
          onClick={toggleAgent}
        >
          {t("ide.changeImpact.askAgent")}
        </button>
      </div>
    </div>
  );
}
