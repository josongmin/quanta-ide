import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SymbolContext } from "../model/useInspectorContext";
import { SymbolInspectorHero } from "./SymbolInspectorHero";

// ── helpers ───────────────────────────────────────────────────────────────────

function churnColor(risk?: string) {
  if (risk === "high") return "var(--token-err)";
  if (risk === "mid")  return "var(--token-str)";
  return "var(--token-ok)";
}

function taintInfo(t: string): { label: string; color: string; icon: string } {
  if (t === "source") return { label: "TAINT SOURCE", color: "var(--token-str)", icon: "⬆" };
  if (t === "sink")   return { label: "TAINT SINK",   color: "var(--token-err)", icon: "⬇" };
  return                       { label: "PASSTHROUGH", color: "var(--ink-3)",     icon: "↔" };
}

// ── SiiSection ────────────────────────────────────────────────────────────────

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

// ── Kind-specific sections ────────────────────────────────────────────────────

function ChurnTimeline({ ctx }: { ctx: SymbolContext }) {
  const churn = ctx.churn;
  if (!churn) return null;
  const c = churnColor(ctx.churnRisk);
  const bars = Array.from({ length: 12 }, (_, i) => {
    const h = Math.max(10, Math.min(100, (churn / 14) * 100 * (0.4 + Math.sin(i * 1.3 + 2) * 0.6)));
    const isRecent = i >= 9;
    return { h, isRecent };
  });
  return (
    <SiiSection label="CHURN — 30 DAY">
      <div className="sii-churn-timeline">
        <div className="sii-churn-bar-row">
          {bars.map(({ h, isRecent }, i) => (
            <div key={i} className="sii-churn-bar-wrap">
              <div
                className="sii-churn-bar"
                style={{
                  height: `${h}%`,
                  background: isRecent ? c : "var(--paper-3)",
                  opacity: isRecent ? 1 : 0.5,
                }}
              />
            </div>
          ))}
        </div>
        <div className="sii-churn-meta">
          <span className="sii-churn-count" style={{ color: c }}>{ctx.churn} commits</span>
          <span className="sii-churn-risk" style={{ color: c }}>{ctx.churnRisk?.toUpperCase() ?? "LOW"} CHURN</span>
        </div>
        {ctx.coupledFiles && ctx.coupledFiles.length > 0 && (
          <div className="sii-coupling-block">
            <div className="sii-coupling-label">CO-CHANGES WITH</div>
            <div className="sii-coupling-files">
              {ctx.coupledFiles.slice(0, 4).map((f) => (
                <div key={f} className="sii-coupling-file">{f}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SiiSection>
  );
}

function CallDepthSection({ ctx }: { ctx: SymbolContext }) {
  if (ctx.kind !== "call-site" && !ctx.callDepth) return null;
  const depth = ctx.callDepth ?? 1;
  const callee = ctx.callee ?? ctx.name;
  const levels = Array.from({ length: Math.min(depth, 5) }, (_, i) => i);
  return (
    <SiiSection label="CALL DEPTH">
      <div className="sii-calldepth">
        {levels.map((i) => (
          <div key={i} className="sii-calldepth-level" style={{ marginLeft: i * 16 }}>
            <span className="sii-calldepth-arrow">{i < levels.length - 1 ? "↳" : "→"}</span>
            <span className="sii-calldepth-name">
              {i === levels.length - 1 ? callee : i === 0 ? "caller" : `frame ${i}`}
            </span>
            {i === levels.length - 1 && (
              <span className="sii-calldepth-badge">depth {depth}</span>
            )}
          </div>
        ))}
      </div>
    </SiiSection>
  );
}

function ParameterFlowSection({ ctx }: { ctx: SymbolContext }) {
  if (ctx.kind !== "parameter") return null;
  return (
    <SiiSection label="PARAMETER FLOW">
      <div className="sii-paramflow">
        <div className="sii-paramflow-row">
          <span className="sii-paramflow-label">TYPE</span>
          <span className="sii-paramflow-val sii-paramflow-mono">{ctx.origin ?? "unknown"}</span>
        </div>
        <div className="sii-paramflow-row">
          <span className="sii-paramflow-label">VALIDATION</span>
          <span
            className="sii-paramflow-val"
            style={{ color: ctx.validated ? "var(--token-ok)" : "var(--token-err)" }}
          >
            {ctx.validated ? "✓ validated" : "✗ unvalidated"}
          </span>
        </div>
        {ctx.taint && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">TAINT</span>
            <span className="sii-paramflow-val" style={{ color: taintInfo(ctx.taint).color }}>
              {taintInfo(ctx.taint).icon} {taintInfo(ctx.taint).label}
            </span>
          </div>
        )}
        {ctx.flowsTo && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">FLOWS TO</span>
            <span className="sii-paramflow-val sii-paramflow-mono">{ctx.flowsTo}</span>
          </div>
        )}
      </div>
    </SiiSection>
  );
}

function ClassMembersSection({ ctx }: { ctx: SymbolContext }) {
  if (ctx.kind !== "class") return null;
  if (!ctx.methodCount && !ctx.fieldCount) return null;
  return (
    <SiiSection label="CLASS COMPOSITION">
      <div className="sii-class-members">
        {ctx.methodCount !== undefined && (
          <div className="sii-class-row">
            <span className="sii-class-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 9l3-3 3 3"/><path d="M12 6v12"/></svg>
            </span>
            <span className="sii-class-k">METHODS</span>
            <span className="sii-class-v">{ctx.methodCount}</span>
          </div>
        )}
        {ctx.fieldCount !== undefined && (
          <div className="sii-class-row">
            <span className="sii-class-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="8" width="18" height="8" rx="2"/></svg>
            </span>
            <span className="sii-class-k">FIELDS</span>
            <span className="sii-class-v">{ctx.fieldCount}</span>
          </div>
        )}
        {ctx.callers !== undefined && (
          <div className="sii-class-row">
            <span className="sii-class-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </span>
            <span className="sii-class-k">USAGES</span>
            <span className="sii-class-v">{ctx.callers}</span>
          </div>
        )}
        {ctx.tests !== undefined && (
          <div className="sii-class-row">
            <span className="sii-class-icon">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <span className="sii-class-k">TESTS</span>
            <span
              className="sii-class-v"
              style={{ color: ctx.tests.startsWith("0/") ? "var(--token-err)" : "var(--token-ok)" }}
            >
              {ctx.tests}
            </span>
          </div>
        )}
      </div>
    </SiiSection>
  );
}

function ImportUsageSection({ ctx }: { ctx: SymbolContext }) {
  if (ctx.kind !== "import") return null;
  return (
    <SiiSection label="IMPORT USAGE">
      <div className="sii-paramflow">
        {ctx.origin && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">PATH</span>
            <span className="sii-paramflow-val sii-paramflow-mono">{ctx.origin}</span>
          </div>
        )}
        {ctx.usedBy !== undefined && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">USED BY</span>
            <span className="sii-paramflow-val">{ctx.usedBy} files</span>
          </div>
        )}
        {ctx.callers !== undefined && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">IMPORTS</span>
            <span className="sii-paramflow-val">{ctx.callers}</span>
          </div>
        )}
      </div>
    </SiiSection>
  );
}

function TypeUsageSection({ ctx }: { ctx: SymbolContext }) {
  if (ctx.kind !== "type" && ctx.kind !== "const") return null;
  return (
    <SiiSection label="TYPE USAGE">
      <div className="sii-paramflow">
        {ctx.usedBy !== undefined && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">USED BY</span>
            <span className="sii-paramflow-val">{ctx.usedBy} files</span>
          </div>
        )}
        {ctx.branchCoverage && (
          <div className="sii-paramflow-row">
            <span className="sii-paramflow-label">BRANCHES</span>
            <span
              className="sii-paramflow-val"
              style={{ color: ctx.branchCoverage.startsWith("0/") ? "var(--token-err)" : "var(--ink-2)" }}
            >
              {ctx.branchCoverage}
            </span>
          </div>
        )}
      </div>
    </SiiSection>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SymbolInspectorProps {
  ctx: SymbolContext;
  /** Injected sections: CallGraph, DataFlow, SuggestedFix, TimeTravelCompare, BlastRadius */
  children?: ReactNode;
}

export function SymbolInspector({ ctx, children }: SymbolInspectorProps) {
  const { t } = useTranslation();

  // stat strip entries: kind-specific
  const stats: { k: string; v: string; mono?: boolean; hi?: boolean }[] = [];
  if (ctx.complexity !== undefined) stats.push({ k: "CPX", v: ctx.complexity.toFixed(1), hi: ctx.complexity >= 8 });
  if (ctx.callers !== undefined)    stats.push({ k: ctx.kind === "class" ? "USAGES" : "CALLERS", v: String(ctx.callers) });
  if (ctx.callees !== undefined)    stats.push({ k: "CALLEES", v: String(ctx.callees) });
  if (ctx.tests !== undefined)      stats.push({ k: "TESTS", v: ctx.tests, hi: ctx.tests.startsWith("0/") });
  if (ctx.methodCount !== undefined) stats.push({ k: "METHODS", v: String(ctx.methodCount) });
  if (ctx.fieldCount !== undefined) stats.push({ k: "FIELDS", v: String(ctx.fieldCount) });
  if (ctx.origin)                   stats.push({ k: "FROM", v: ctx.origin, mono: true });
  if (ctx.flowsTo)                  stats.push({ k: "→", v: ctx.flowsTo, mono: true });
  if (ctx.callee)                   stats.push({ k: "CALLS", v: ctx.callee, mono: true });
  if (ctx.callDepth !== undefined)  stats.push({ k: "DEPTH", v: String(ctx.callDepth) });
  if (ctx.usedBy !== undefined)     stats.push({ k: "USED BY", v: `${ctx.usedBy} files` });

  return (
    <div className="sii-root">

      {/* ── Hero header ── */}
      <SymbolInspectorHero ctx={ctx} />

      {/* ── Stat grid (same visual language as FileInspector stats) ── */}
      {stats.length > 0 && (
        <div className="sii-stat-strip">
          {stats.map(({ k, v, mono, hi }) => (
            <div key={k} className="sii-stat">
              <span className="sii-stat-k">{k}</span>
              <span className={`sii-stat-v${mono ? " sii-stat-mono" : ""}${hi ? " is-hi" : ""}`}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Kind-specific analysis sections ── */}
      {(ctx.kind === "function" || ctx.kind === "method") && <ChurnTimeline ctx={ctx} />}
      {ctx.kind === "class" && (
        <>
          <ClassMembersSection ctx={ctx} />
          <ChurnTimeline ctx={ctx} />
        </>
      )}
      {ctx.kind === "call-site" && <CallDepthSection ctx={ctx} />}
      {ctx.kind === "parameter" && <ParameterFlowSection ctx={ctx} />}
      {ctx.kind === "import" && <ImportUsageSection ctx={ctx} />}
      {(ctx.kind === "type" || ctx.kind === "const") && <TypeUsageSection ctx={ctx} />}

      {/* ── Hint when no children ── */}
      {!children && (ctx.kind === "function" || ctx.kind === "method" || ctx.kind === "class") && (
        <p className="sii-hint">{t("ide.symbolInspector.hint")}</p>
      )}

      {/* ── Injected sections (blast, call graph, data flow, fix) ── */}
      {(ctx.kind === "function" || ctx.kind === "method" || ctx.kind === "class") && children}
    </div>
  );
}

/* ── re-export SiiSection for use in IdePage ── */
export { SiiSection };
