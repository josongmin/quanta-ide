import { useTranslation } from "react-i18next";
import { getChurnFromDB } from "@/app/ide/analysis-data";

const TREND_ICON: Record<string, string> = { rising: "↑", stable: "→", falling: "↓" };

function MiniSpark({ data }: { data: number[] }) {
  const w = 42;
  const h = 14;
  const step = w / (data.length - 1);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(h - v * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="churn-spark">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface ChurnHotspotPanelProps {
  fileName?: string;
}

export function ChurnHotspotPanel({ fileName = "orchestrator.py" }: ChurnHotspotPanelProps) {
  const { t } = useTranslation();
  const files = getChurnFromDB(fileName);

  if (files.length === 0) return null;

  const maxCommits = Math.max(...files.map((f) => f.commits30d));

  return (
    <div className="churn">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.churnHotspot.title")}</span>
      </div>

      <div className="churn-stats">
        <div className="churn-stat">
          <span className="churn-stat-k">{t("ide.churnHotspot.hotspots")}</span>
          <span className="churn-stat-v">{files.length}</span>
        </div>
        <div className="churn-stat">
          <span className="churn-stat-k">{t("ide.churnHotspot.rising")}</span>
          <span className="churn-stat-v">{files.filter((f) => f.riskTrend === "rising").length}</span>
        </div>
        <div className="churn-stat">
          <span className="churn-stat-k">{t("ide.churnHotspot.totalChurn")}</span>
          <span className="churn-stat-v">{files.reduce((s, f) => s + f.churnLines, 0)}</span>
        </div>
      </div>

      <ul className="churn-list">
        {files.map((f) => {
          const barPct = Math.round((f.commits30d / maxCommits) * 100);
          return (
            <li key={f.id} className="churn-row">
              <span className="churn-row-name">{f.file}</span>
              <span className={`churn-row-trend churn-trend--${f.riskTrend}`}>{TREND_ICON[f.riskTrend] ?? "→"}</span>
              <span className="churn-row-commits">{f.commits30d}</span>
              <span className="churn-row-bar-track">
                <span className="churn-row-bar-fill" style={{ width: `${barPct.toString()}%` }} />
              </span>
              <MiniSpark data={f.spark} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
