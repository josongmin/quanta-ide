import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SAMPLE_RUN, type AnalysisStatus } from "../model/incremental-data";

const STATUS_ICON: Record<AnalysisStatus, string> = {
  reanalyzed: "●",
  cached: "○",
  skipped: "–",
  queued: "◌",
};

const COLLAPSED_LIMIT = 7;

export function IncrementalPanel() {
  const { t } = useTranslation();
  const run = SAMPLE_RUN;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? run.files : run.files.slice(0, COLLAPSED_LIMIT);
  const remaining = run.files.length - COLLAPSED_LIMIT;
  const savedPct = run.totalFiles > 0 ? Math.round(((run.cached + run.skipped) / run.totalFiles) * 100) : 0;

  return (
    <div className="incr">
      <div className="sii-section-header">
        <span className="sii-section-label">{t("ide.incremental.title")}</span>
      </div>

      <div className="incr-stats">
        <div className="incr-stat">
          <span className="incr-stat-k">{t("ide.incremental.reanalyzed")}</span>
          <span className="incr-stat-v">{run.reanalyzed}</span>
        </div>
        <div className="incr-stat">
          <span className="incr-stat-k">{t("ide.incremental.cached")}</span>
          <span className="incr-stat-v">{run.cached}</span>
        </div>
        <div className="incr-stat">
          <span className="incr-stat-k">{t("ide.incremental.saved")}</span>
          <span className="incr-stat-v">{savedPct}%</span>
        </div>
      </div>

      <div className="incr-summary">
        <span className="incr-summary-time">{(run.totalDurationMs / 1000).toFixed(1)}s</span>
        <span className="incr-summary-label">{t("ide.incremental.totalTime")}</span>
        <span className="incr-summary-vs">{t("ide.incremental.vsFull", { n: run.totalFiles })}</span>
      </div>

      <ul className="incr-list">
        {visible.map((f) => (
          <li key={f.id} className={`incr-row incr-row--${f.status}`}>
            <span className="incr-status">{STATUS_ICON[f.status]}</span>
            <span className="incr-file">{f.file}</span>
            {f.durationMs !== undefined && (
              <span className="incr-dur">{(f.durationMs / 1000).toFixed(1)}s</span>
            )}
            <span className="incr-reason">{f.reason}</span>
          </li>
        ))}
      </ul>

      {!expanded && remaining > 0 && (
        <button type="button" className="incr-expand" onClick={() => { setExpanded(true); }}>
          + {remaining} more
        </button>
      )}
    </div>
  );
}
