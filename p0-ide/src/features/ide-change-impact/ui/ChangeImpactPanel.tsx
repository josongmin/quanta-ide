import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useInspectorContext } from "@/features/ide-inspector-context";
import { useChangeImpact } from "../model/useChangeImpact";
import type { ImpactedFile, PropagationStep } from "../model/useChangeImpact";

/* ── reuse fii / rii / sii class system from inspector-context ── */

const SEV_ICON: Record<ImpactedFile["severity"], string> = {
  critical: "⬇",
  high: "⚑",
  medium: "◎",
  low: "◌",
};
const SEV_CLASS: Record<ImpactedFile["severity"], string> = {
  critical: "is-crit",
  high: "is-warn",
  medium: "is-warn",
  low: "is-info",
};

function riskColor(score: number) {
  if (score >= 70) return "var(--token-err)";
  if (score >= 40) return "var(--token-str)";
  return "var(--token-ok)";
}

/* ── Propagation list (reuses fii-signal rows) ── */
function PropagationList({ steps }: { steps: PropagationStep[] }) {
  return (
    <div className="fii-signals">
      {steps.map((s) => (
        <div key={s.order} className="fii-signal is-warn">
          <span className="fii-signal-icon" style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{s.order}</span>
          <span className="fii-signal-msg">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Impacted file rows (reuses fii-signal pattern) ── */
function ImpactedFileList({ files }: { files: ImpactedFile[] }) {
  return (
    <div className="fii-signals">
      {files.map((f) => (
        <div key={f.name} className={`fii-signal ${SEV_CLASS[f.severity]}`}>
          <span className="fii-signal-icon">{SEV_ICON[f.severity]}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="fii-signal-msg" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>{f.name}</span>
              <span className="fii-signal-sym">{f.severity}</span>
            </div>
            <span style={{ fontSize: "0.61rem", color: "var(--ink-4)", lineHeight: 1.3, fontStyle: "italic" }}>{f.reason}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Section wrapper (same as fii-section) ── */
function CiSection({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <div className="fii-section">
      <div className="fii-section-header">
        <span className="fii-section-label">{label}</span>
        {count !== undefined && <span className="fii-section-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Renders inside IdeInspector when inspector mode is "impact".
 * Layout mirrors SymbolInspector: sii-hero header → stat strip → sections → children.
 */
export function ChangeImpactPanel({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  const data = useChangeImpact((s) => s.data);
  const { resetToFile } = useInspectorContext();

  if (!data) return null;

  const rc = riskColor(data.riskScore);

  return (
    <div className="sii-root">
      {/* ── Hero header (same pattern as SymbolInspector) ── */}
      <div className="sii-hero">
        <button
          type="button"
          className="sii-back"
          onClick={() => { resetToFile(data.originFn); }}
          aria-label="Back to file"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="sii-back-file">{t("ide.changeImpact.pgLabel")}</span>
          <span className="sii-back-sep">/</span>
          <span className="sii-back-sym">{data.originFn}</span>
        </button>

        <div className="sii-identity">
          <span className="sii-kind-glyph">⚡</span>
          <span className="sii-hero-name">{data.originFn}</span>
          <span className="sii-risk-badge" style={{ color: rc, borderColor: rc }}>
            RISK {data.riskScore}
          </span>
        </div>
      </div>

      {/* ── Stat strip (same as SymbolInspector) ── */}
      <div className="sii-stat-strip">
        <div className="sii-stat">
          <span className="sii-stat-k">FILES</span>
          <span className="sii-stat-v">{data.files}</span>
        </div>
        <div className="sii-stat">
          <span className="sii-stat-k">FUNCS</span>
          <span className="sii-stat-v">{data.functions}</span>
        </div>
        <div className="sii-stat">
          <span className="sii-stat-k">APIS</span>
          <span className={`sii-stat-v${data.apis > 0 ? " is-hi" : ""}`}>{data.apis}</span>
        </div>
        <div className="sii-stat">
          <span className="sii-stat-k">TESTS</span>
          <span className="sii-stat-v">{data.tests}</span>
        </div>
      </div>

      {/* ── Propagation order ── */}
      <CiSection label={t("ide.changeImpact.propagation").toUpperCase()} count={data.propagation.length}>
        <PropagationList steps={data.propagation} />
      </CiSection>

      {/* ── Top impacted files ── */}
      <CiSection label={t("ide.changeImpact.topFiles").toUpperCase()} count={data.topFiles.length}>
        <ImpactedFileList files={data.topFiles} />
      </CiSection>

      {/* ── Injected sections (BlastRadiusViz, etc.) ── */}
      {children}
    </div>
  );
}
