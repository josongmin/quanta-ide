import type { WatcherStatus, WatcherTrend } from "@/entities/watcher";

interface WatcherVitalsProps {
  impactedFiles: number;
  status: WatcherStatus;
  trend: WatcherTrend;
  peak: number;
}

const TREND_GLYPH: Record<WatcherTrend, string> = {
  converging: "↓",
  diverging: "↑",
  steady: "→",
};

const TREND_WORD: Record<WatcherTrend, string> = {
  converging: "converging",
  diverging: "diverging",
  steady: "steady",
};

const STATUS_LABEL: Record<WatcherStatus, string> = {
  stable: "stable",
  "in-flux": "in flux",
  critical: "critical",
};

/**
 * Column 1 — Vitals (redesigned)
 * 큰 숫자 + 링 게이지 + 트렌드 + status badge.
 */
export function WatcherVitals({ impactedFiles, status, trend, peak }: WatcherVitalsProps) {
  /* ring gauge: impactedFiles / peak 비율 (0→1) */
  const ratio = peak > 0 ? Math.min(impactedFiles / peak, 1) : 0;
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="wt-vitals" aria-label="Blast radius vitals">
      {/* ring gauge 배경 */}
      <div className="wt-vitals-ring-wrap">
        <svg className="wt-vitals-ring" viewBox="0 0 64 64" aria-hidden>
          <circle className="wt-ring-track" cx="32" cy="32" r="28"
            fill="none" strokeWidth="3" />
          <circle
            className={`wt-ring-fill wt-ring-${status}`}
            cx="32" cy="32" r="28"
            fill="none" strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div className="wt-vitals-num-over-ring">
          <span className="wt-vitals-num-value">{impactedFiles}</span>
        </div>
      </div>

      <div className="wt-vitals-meta">
        <span className="wt-vitals-unit">files watched</span>
        <div className={`wt-vitals-trend wt-trend-${trend}`}>
          <span className="wt-trend-glyph">{TREND_GLYPH[trend]}</span>
          {TREND_WORD[trend]}
        </div>
        <div className={`wt-vitals-badge wt-badge-${status}`}>
          <span className={`wt-status-dot wt-status-dot-${status}`} aria-hidden />
          {STATUS_LABEL[status]}
        </div>
      </div>
    </div>
  );
}
