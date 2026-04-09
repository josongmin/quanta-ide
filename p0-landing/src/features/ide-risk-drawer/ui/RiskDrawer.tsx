import { useEffect } from "react";
import { useRiskDrawer, RISK_BREAKDOWN, RISK_HISTORY, RISK_RECENT } from "../model/useRiskDrawer";

export function RiskDrawer() {
  const { isOpen, close } = useRiskDrawer();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Sparkline
  const max = Math.max(...RISK_HISTORY);
  const min = Math.min(...RISK_HISTORY);
  const range = max - min || 1;
  const W = 220;
  const H = 38;
  const step = W / (RISK_HISTORY.length - 1);
  const points = RISK_HISTORY.map((v, i) => {
    const x = i * step;
    const y = H - ((v - min) / range) * H;
    return `${x.toString()},${y.toString()}`;
  }).join(" ");

  return (
    <div className="rdw-root">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop */}
      <div className="rdw-backdrop" onClick={close} />
      <aside className="rdw-panel" role="dialog" aria-modal="true">
        <header className="rdw-head">
          <div className="rdw-head-label">// SYSTEM RISK</div>
          <button type="button" className="rdw-close" onClick={close} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>

        <div className="rdw-body">
          <section className="rdw-section">
            <div className="rdw-score">
              <div className="rdw-score-num">78</div>
              <div className="rdw-score-meta">
                <div className="rdw-score-label">Risk Score</div>
                <div className="rdw-score-state">above warning threshold (80)</div>
              </div>
            </div>
          </section>

          <section className="rdw-section">
            <div className="rdw-section-label">Breakdown</div>
            <div className="rdw-breakdown">
              {RISK_BREAKDOWN.map((b) => (
                <div key={b.k} className="rdw-bar-row">
                  <div className="rdw-bar-k">{b.k}</div>
                  <div className="rdw-bar-track">
                    <div
                      className="rdw-bar-fill"
                      style={{ width: `${(b.bar * 100).toString()}%` }}
                    />
                  </div>
                  <div className="rdw-bar-v">{b.v}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rdw-section">
            <div className="rdw-section-label">Last 7 days</div>
            <div className="rdw-spark-wrap">
              <svg
                viewBox={`0 0 ${W.toString()} ${H.toString()}`}
                className="rdw-spark"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="rdw-spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline
                  points={`0,${H.toString()} ${points} ${W.toString()},${H.toString()}`}
                  fill="url(#rdw-spark-fill)"
                  stroke="none"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="rdw-spark-meta">
                <span>{min}</span>
                <span>peak {max}</span>
              </div>
            </div>
          </section>

          <section className="rdw-section">
            <div className="rdw-section-label">Recent Changes</div>
            <div className="rdw-recent">
              {RISK_RECENT.map((r, i) => (
                <div key={i} className="rdw-recent-row">
                  <span className={`rdw-delta${r.delta.startsWith("−") ? " is-down" : ""}`}>{r.delta}</span>
                  <span className="rdw-recent-reason">{r.reason}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
