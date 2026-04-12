import type { WatcherStatus, WatcherTrend } from "@/entities/watcher";

interface WatcherVitalsProps {
  impactedFiles: number;
  status: WatcherStatus;
  trend: WatcherTrend;
}

const TREND_LABEL: Record<WatcherTrend, string> = {
  converging: "↓ converging",
  diverging: "↑ diverging",
  steady: "→ steady",
};

const STATUS_LABEL: Record<WatcherStatus, string> = {
  stable: "stable",
  "in-flux": "in flux",
  critical: "critical",
};

/**
 * Column 1 — Vitals
 * 큰 숫자(blast radius), 트렌드 한 줄, status dot.
 * 도메인 상태를 받기만 하고 store에 직접 묶이지 않음 (testable).
 */
export function WatcherVitals({ impactedFiles, status, trend }: WatcherVitalsProps) {
  return (
    <div className="wt-vitals" aria-label="Blast radius vitals">
      <div className="wt-vitals-num">
        <span className="wt-vitals-num-value">{impactedFiles}</span>
        <span className="wt-vitals-num-unit">files</span>
      </div>
      <div className={`wt-vitals-trend wt-trend-${trend}`}>
        {TREND_LABEL[trend]}
      </div>
      <div className={`wt-vitals-status wt-status-${status}`}>
        <span className={`wt-status-dot wt-status-dot-${status}`} aria-hidden />
        {STATUS_LABEL[status]}
      </div>
    </div>
  );
}
