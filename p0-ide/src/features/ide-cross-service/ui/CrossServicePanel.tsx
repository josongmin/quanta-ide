import { useTranslation } from "react-i18next";
import { SAMPLE_CROSS_SERVICE } from "../model/cross-service-data";

const STATUS_DOT: Record<string, string> = {
  healthy: "●",
  degraded: "◐",
  down: "○",
};

export function CrossServicePanel() {
  const { t } = useTranslation();
  const data = SAMPLE_CROSS_SERVICE;
  const impactedEdges = data.edges.filter((e) => e.impacted);

  return (
    <div className="xsvc">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.crossService.title")}</span>
      </div>

      <div className="xsvc-stats">
        <div className="xsvc-stat">
          <span className="xsvc-stat-k">{t("ide.crossService.services")}</span>
          <span className="xsvc-stat-v">{data.services.length}</span>
        </div>
        <div className="xsvc-stat">
          <span className="xsvc-stat-k">{t("ide.crossService.impacted")}</span>
          <span className="xsvc-stat-v">{data.totalImpacted}</span>
        </div>
        <div className="xsvc-stat">
          <span className="xsvc-stat-k">{t("ide.crossService.edges")}</span>
          <span className="xsvc-stat-v">{impactedEdges.length}</span>
        </div>
      </div>

      <div className="xsvc-origin">
        <span className="xsvc-origin-label">ORIGIN</span>
        <span className="xsvc-origin-svc">{data.originService}</span>
        <span className="xsvc-origin-sym">{data.originSymbol}()</span>
      </div>

      <ul className="xsvc-list">
        {impactedEdges.map((edge) => {
          const target = data.services.find((s) => s.id === edge.to);
          if (!target) return null;
          return (
            <li key={`${edge.from}-${edge.to}`} className="xsvc-edge">
              <span className={`xsvc-dot xsvc-dot--${target.status}`}>{STATUS_DOT[target.status]}</span>
              <span className="xsvc-edge-name">{target.name}</span>
              <span className="xsvc-edge-proto">{edge.protocol}</span>
              <span className="xsvc-edge-owner">{target.owner}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
