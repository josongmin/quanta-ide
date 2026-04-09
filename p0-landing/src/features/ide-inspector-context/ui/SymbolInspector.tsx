import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SymbolContext } from "../model/useInspectorContext";
import { useInspectorContext } from "../model/useInspectorContext";

/* ── helpers ── */
function riskColor(score: number) {
  if (score >= 70) return "var(--token-err)";
  if (score >= 40) return "var(--token-str)";
  return "var(--token-ok)";
}

function taintInfo(t: string): { label: string; color: string; icon: string } {
  if (t === "source") return { label: "TAINT SOURCE", color: "var(--token-str)", icon: "⬆" };
  if (t === "sink")   return { label: "TAINT SINK",   color: "var(--token-err)", icon: "⬇" };
  return                       { label: "PASSTHROUGH", color: "var(--ink-3)",     icon: "↔" };
}

/* ── Section ── */
function SiiSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sii-section">
      <div className="sii-section-header">
        <span className="sii-section-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Metric chip ── */
function Chip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`sii-chip${accent ? " is-accent" : ""}`}>
      <span className="sii-chip-label">{label}</span>
      <span className="sii-chip-value">{value}</span>
    </div>
  );
}

/* ── Props ── */
export interface SymbolInspectorProps {
  ctx: SymbolContext;
  /** Injected sections: CallGraph, DataFlow, SuggestedFix, TimeTravelCompare, BlastRadius */
  children?: ReactNode;
}

export function SymbolInspector({ ctx, children }: SymbolInspectorProps) {
  const { t } = useTranslation();
  const { resetToFile } = useInspectorContext();

  const cpx = ctx.complexity ?? 0;
  const riskScore = cpx >= 8 ? 78 : cpx >= 5 ? 52 : 23;
  const rc = riskColor(riskScore);
  const taint = ctx.taint ? taintInfo(ctx.taint) : null;

  return (
    <div className="sii-root">

      {/* ── Breadcrumb ── */}
      <button
        type="button"
        className="sii-back"
        onClick={() => { resetToFile(ctx.fileName); }}
        aria-label={`Back to ${ctx.fileName}`}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="sii-back-file">{ctx.fileName}</span>
        <span className="sii-back-sep">/</span>
        <span className="sii-back-sym">{ctx.name}</span>
      </button>

      {/* ── Symbol Header ── */}
      <div className="sii-head">
        <div className="sii-head-row">
          <span className="sii-kind">ƒ</span>
          <span className="sii-name">{ctx.name}</span>
          <span className="sii-risk" style={{ color: rc, borderColor: rc }}>
            <span className="sii-risk-dot" style={{ background: rc }} />
            RISK {riskScore}
          </span>
        </div>

        {taint && (
          <div className="sii-taint-row">
            <span className="sii-taint-badge" style={{ color: taint.color, borderColor: `color-mix(in srgb, ${taint.color} 40%, transparent)`, background: `color-mix(in srgb, ${taint.color} 10%, transparent)` }}>
              {taint.icon} {taint.label}
            </span>
          </div>
        )}

        {ctx.blame && (
          <div className="sii-blame">
            <span className="sii-blame-avatar">{ctx.blame.author[0].toUpperCase()}</span>
            <span className="sii-blame-text">{ctx.blame.author} · {ctx.blame.when}</span>
          </div>
        )}
      </div>

      {/* ── Metric Chips ── */}
      <div className="sii-chips">
        {ctx.complexity !== undefined && (
          <Chip label="CPX" value={ctx.complexity.toFixed(1)} accent={ctx.complexity >= 8} />
        )}
        {ctx.callers !== undefined && (
          <Chip label="CALLERS" value={ctx.callers} />
        )}
        {ctx.origin && (
          <Chip label="FROM" value={ctx.origin} />
        )}
        {ctx.flowsTo && (
          <Chip label="FLOWS TO" value={ctx.flowsTo} />
        )}
      </div>

      {/* ── Hint when no children ── */}
      {!children && (
        <p className="sii-hint">{t("ide.symbolInspector.hint")}</p>
      )}

      {/* ── Injected sections: BlastRadius, CallGraph, DataFlow, Fix, TimeTravel ── */}
      {children}
    </div>
  );
}

/* ── re-export SiiSection for use in IdePage ── */
export { SiiSection };
