import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRiskDrawer, RISK_BREAKDOWN, RISK_HISTORY, RISK_RECENT } from "../model/useRiskDrawer";

const POPOVER_W = 340;
const POPOVER_MAX_H = 480;
const GAP = 6;
const MARGIN = 8;

export function RiskDrawer() {
  const { t } = useTranslation();
  const { isOpen, anchor, close } = useRiskDrawer();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); }
    };
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); };
  }, [isOpen, close]);

  // Click-outside: close when clicking outside the panel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    };
    // Use capture so it fires before other handlers
    window.addEventListener("mousedown", handler, true);
    return () => { window.removeEventListener("mousedown", handler, true); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  // ── Position calculation ──
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  if (anchor) {
    // Prefer aligning right edge of popover to right edge of button
    const preferredLeft = anchor.right - POPOVER_W;
    // Clamp so it doesn't bleed off screen edges
    left = Math.max(MARGIN, Math.min(preferredLeft, vw - POPOVER_W - MARGIN));

    // Prefer below the button
    const spaceBelow = vh - anchor.bottom - GAP - MARGIN;
    if (spaceBelow >= POPOVER_MAX_H || spaceBelow > vh / 2) {
      top = anchor.bottom + GAP;
    } else {
      // flip above
      top = anchor.bottom - GAP - Math.min(POPOVER_MAX_H, spaceBelow + anchor.bottom);
      top = Math.max(MARGIN, top);
    }
  } else {
    // fallback: center-ish
    left = Math.max(MARGIN, vw - POPOVER_W - MARGIN);
    top = 48;
  }

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
    <div
      ref={panelRef}
      className="rdw-popover"
      role="dialog"
      aria-modal="true"
      style={{ top, left, width: POPOVER_W }}
    >
      <header className="rdw-head">
        <div className="rdw-head-label">{t("ide.risk.head")}</div>
        <button type="button" className="rdw-close" onClick={close} aria-label={t("ide.risk.closeAria")}>
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
              <div className="rdw-score-label">{t("ide.risk.scoreLabel")}</div>
              <div className="rdw-score-state">{t("ide.risk.scoreState")}</div>
            </div>
          </div>
        </section>

        <section className="rdw-section">
          <div className="rdw-section-label">{t("ide.risk.breakdown")}</div>
          <div className="rdw-breakdown">
            {RISK_BREAKDOWN.map((b) => (
              <div key={b.kKey} className="rdw-bar-row">
                <div className="rdw-bar-k">{t(`ide.risk.${b.kKey}`)}</div>
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
          <div className="rdw-section-label">{t("ide.risk.last7")}</div>
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
              <span>{t("ide.risk.peak", { n: max })}</span>
            </div>
          </div>
        </section>

        <section className="rdw-section">
          <div className="rdw-section-label">{t("ide.risk.recent")}</div>
          <div className="rdw-recent">
            {RISK_RECENT.map((r, i) => (
              <div key={i} className="rdw-recent-row">
                <span className={`rdw-delta${r.delta.startsWith("−") ? " is-down" : ""}`}>{r.delta}</span>
                <span className="rdw-recent-reason">{t(`ide.risk.${r.reasonKey}`)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
