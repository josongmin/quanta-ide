import { useTranslation } from "react-i18next";
import { getComplianceFromDB } from "@/app/ide/analysis-data";

const VERDICT_ICON: Record<string, string> = { pass: "✓", fail: "✕", warn: "⚠" };

export function ComplianceAuditPanel() {
  const { t } = useTranslation();
  const entries = getComplianceFromDB();
  const pass = entries.filter((e) => e.verdict === "pass").length;
  const fail = entries.filter((e) => e.verdict === "fail").length;
  const warn = entries.filter((e) => e.verdict === "warn").length;

  return (
    <div className="caudit">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.complianceAudit.title")}</span>
      </div>

      <div className="caudit-stats">
        <div className="caudit-stat">
          <span className="caudit-stat-k">{t("ide.complianceAudit.pass")}</span>
          <span className="caudit-stat-v">{pass}</span>
        </div>
        <div className="caudit-stat">
          <span className="caudit-stat-k">{t("ide.complianceAudit.fail")}</span>
          <span className="caudit-stat-v">{fail}</span>
        </div>
        <div className="caudit-stat">
          <span className="caudit-stat-k">{t("ide.complianceAudit.warn")}</span>
          <span className="caudit-stat-v">{warn}</span>
        </div>
      </div>

      <ul className="caudit-list">
        {entries.map((entry) => (
          <li key={entry.id} className={`caudit-row caudit-row--${entry.verdict}`}>
            <span className="caudit-verdict">{VERDICT_ICON[entry.verdict] ?? "?"}</span>
            <span className="caudit-rule">{entry.rule}</span>
            <span className="caudit-detail">{entry.detail}</span>
            {entry.loc !== undefined && <span className="caudit-loc">{entry.loc}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
