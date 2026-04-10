import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRiskDrawer, RISK_BREAKDOWN, RISK_HISTORY, RISK_RECENT } from "../model/useRiskDrawer";

const POPOVER_W = 360;
const POPOVER_MAX_H = 540;
const GAP = 8;
const MARGIN = 10;
const SCORE = 78;
const SCORE_MAX = 100;
const CARET_H = 7;

/* ── severity color per bar ratio ── */
function barColor(bar: number) {
  if (bar >= 0.6) return "var(--accent)";
  if (bar >= 0.35) return "#f59e0b";
  return "#4ade80";
}

/* ── ring arc helper ── */
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sx = cx + r * Math.cos(toRad(startDeg));
  const sy = cy + r * Math.sin(toRad(startDeg));
  const ex = cx + r * Math.cos(toRad(endDeg));
  const ey = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}

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

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("click", handler);
    return () => { document.removeEventListener("click", handler); };
  }, [isOpen, close]);

  if (!isOpen) return null;

  /* ── position ── */
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top: number;
  let left: number;
  let caretLeft: number | null = null;
  let flipUp = false;

  if (anchor) {
    const preferredLeft = anchor.right - POPOVER_W;
    left = Math.max(MARGIN, Math.min(preferredLeft, vw - POPOVER_W - MARGIN));
    caretLeft = anchor.left + (anchor.right - anchor.left) / 2 - left;

    const spaceBelow = vh - anchor.bottom - GAP - MARGIN;
    if (spaceBelow >= POPOVER_MAX_H || spaceBelow > vh / 2) {
      top = anchor.bottom + GAP;
    } else {
      flipUp = true;
      top = Math.max(MARGIN, anchor.bottom - GAP - Math.min(POPOVER_MAX_H, spaceBelow + anchor.bottom));
    }
  } else {
    left = Math.max(MARGIN, vw - POPOVER_W - MARGIN);
    top = 48;
  }

  /* ── sparkline ── */
  const max = Math.max(...RISK_HISTORY);
  const min = Math.min(...RISK_HISTORY);
  const range = max - min || 1;
  const SW = 310;
  const SH = 52;
  const step = SW / (RISK_HISTORY.length - 1);
  const pts = RISK_HISTORY.map((v, i) => ({
    x: i * step,
    y: SH - ((v - min) / range) * (SH - 8) - 4,
  }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const filled = `0,${SH} ${polyline} ${SW},${SH}`;

  /* ── ring ── */
  const pct = SCORE / SCORE_MAX;
  const START = -210;
  const SWEEP = 240;
  const R = 30;
  const CX = 40;
  const CY = 40;
  const endDeg = START + SWEEP * pct;

  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div
      ref={panelRef}
      className={`rdw-popover${flipUp ? " is-flip" : ""}`}
      role="dialog"
      aria-modal="true"
      style={{ top, left, width: POPOVER_W }}
    >
      {/* ── caret ── */}
      {caretLeft !== null && (
        <div
          className="rdw-caret"
          style={{
            left: Math.max(12, Math.min(caretLeft, POPOVER_W - 24)),
            ...(flipUp
              ? { bottom: -CARET_H, borderTop: `${CARET_H}px solid var(--paper)`, borderBottom: "none" }
              : { top: -CARET_H, borderBottom: `${CARET_H}px solid var(--paper)`, borderTop: "none" }),
          }}
        />
      )}

      {/* ── header ── */}
      <header className="rdw-head">
        <div className="rdw-head-left">
          <span className="rdw-head-slash">{"// "}</span>
          <span className="rdw-head-label">{t("ide.risk.head").replace("// ", "")}</span>
        </div>
        <button type="button" className="rdw-close" onClick={close} aria-label={t("ide.risk.closeAria")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </header>

      <div className="rdw-body">

        {/* ── Score card ── */}
        <div className="rdw-score-card">
          {/* Ring gauge */}
          <svg className="rdw-ring" viewBox="0 0 80 80" width="80" height="80">
            {/* track */}
            <path
              d={describeArc(CX, CY, R, START, START + SWEEP)}
              fill="none"
              stroke="var(--paper-3)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* fill */}
            <path
              d={describeArc(CX, CY, R, START, endDeg)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* number */}
            <text x={CX} y={CY + 5} textAnchor="middle" className="rdw-ring-num">{SCORE}</text>
          </svg>

          <div className="rdw-score-info">
            <div className="rdw-score-row">
              <span className="rdw-score-label">{t("ide.risk.scoreLabel")}</span>
              <span className="rdw-trend-badge is-up">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                +6
              </span>
            </div>
            <div className="rdw-score-state">
              <span className="rdw-warn-dot" />
              {t("ide.risk.scoreState")}
            </div>
            <div className="rdw-score-files">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              3 files affected
            </div>
          </div>
        </div>

        {/* ── Breakdown ── */}
        <section className="rdw-section">
          <div className="rdw-section-label">{t("ide.risk.breakdown")}</div>
          <div className="rdw-breakdown">
            {RISK_BREAKDOWN.map((b) => {
              const color = barColor(b.bar);
              return (
                <div key={b.kKey} className="rdw-bar-row">
                  <div className="rdw-bar-dot" style={{ background: color }} />
                  <div className="rdw-bar-k">{t(`ide.risk.${b.kKey}`)}</div>
                  <div className="rdw-bar-track">
                    <div
                      className="rdw-bar-fill"
                      style={{ width: `${(b.bar * 100).toString()}%`, background: color }}
                    />
                  </div>
                  <div className="rdw-bar-v" style={{ color }}>{b.v}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Sparkline ── */}
        <section className="rdw-section">
          <div className="rdw-section-label">{t("ide.risk.last7")}</div>
          <div className="rdw-spark-wrap">
            <svg
              viewBox={`0 0 ${SW} ${SH}`}
              className="rdw-spark"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="rdw-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={filled} fill="url(#rdw-spark-fill)" />
              <polyline
                points={polyline}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* dots on each data point */}
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === pts.length - 1 ? 3.5 : 2}
                  fill={i === pts.length - 1 ? "var(--accent)" : "var(--paper-1)"}
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            {/* day labels */}
            <div className="rdw-spark-days">
              {days.map((d, i) => (
                <span key={i} className={i === days.length - 1 ? "is-today" : ""}>{d}</span>
              ))}
            </div>
            <div className="rdw-spark-meta">
              <span>min {min}</span>
              <span className="is-peak">▲ peak {max}</span>
            </div>
          </div>
        </section>

        {/* ── Recent changes ── */}
        <section className="rdw-section">
          <div className="rdw-section-label">{t("ide.risk.recent")}</div>
          <div className="rdw-recent">
            {RISK_RECENT.map((r, i) => {
              const isDown = r.delta.startsWith("−");
              return (
                <div key={i} className="rdw-recent-row">
                  <span className={`rdw-delta${isDown ? " is-down" : ""}`}>
                    {isDown
                      ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                      : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    }
                    {r.delta}
                  </span>
                  <span className="rdw-recent-reason">{t(`ide.risk.${r.reasonKey}`)}</span>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
