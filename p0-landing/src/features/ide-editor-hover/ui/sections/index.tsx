/* =============================================================================
   sections/index.tsx — SymbolTooltip 재사용 섹션 컴포넌트들
   각 섹션은 독립적으로 렌더링 가능, null 반환으로 자동 숨김
   ============================================================================= */
import type { ReactNode, CSSProperties } from "react";
import type { SymbolInfo } from "../../model/symbols";
import {
  hasTaint, hasChurn, hasCoupledFiles,
  isFunctionSymbol, isConstructorSymbol, isAbstractMethodSymbol,
  isLambdaSymbol, isGeneratorSymbol, isGetterSymbol, isSetterSymbol,
  isOverloadSymbol, isOperatorSymbol,
  isClassSymbol, isStructSymbol, isInterfaceSymbol,
  isEnumSymbol, isEnumMemberSymbol, isTypeAliasSymbol, isTypeParameterSymbol, isTypeGuardSymbol,
  isFieldSymbol, isPropertySymbol, isParameterSymbol,
  isModuleSymbol, isCallSiteSymbol,
  isDecoratorSymbol, isEventSymbol, isExceptionSymbol,
} from "../../model/symbols";
import { riskColor, churnColor } from "./helpers";

const VIS_COLOR: Record<string, string> = {
  public:    "var(--token-ok)",
  protected: "var(--token-str)",
  private:   "var(--token-err)",
  internal:  "var(--ink-3)",
};

// ── Pill helper ───────────────────────────────────────────────────────────────

function Pill({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <span className={`symtip-badge-pill${warn ? " is-warn" : ""}`}>{children}</span>
  );
}

// ── RiskBar ───────────────────────────────────────────────────────────────────

export function RiskBarSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!info.riskScore || info.riskScore <= 0) return null;
  const c = riskColor(info.riskScore);
  return (
    <div className="symtip-risk-bar-wrap">
      <div className="symtip-risk-bar" style={{ width: `${info.riskScore}%`, background: c }} />
      <span className="symtip-risk-num" style={{ color: c }}>RISK {info.riskScore}</span>
    </div>
  );
}

// ── TaintSection ──────────────────────────────────────────────────────────────

const TAINT_META = {
  source:      {
    label: "TAINT SOURCE", tone: "var(--token-str)",
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  },
  sink:        {
    label: "TAINT SINK",   tone: "var(--token-err)",
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  },
  passthrough: {
    label: "PASSTHROUGH",  tone: "var(--ink-3)",
    icon: <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  },
} as const;

export function TaintSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!hasTaint(info)) return null;
  const meta = TAINT_META[info.taint];
  const origin  = "origin"  in info ? info.origin  : undefined;
  const flowsTo = "flowsTo" in info ? info.flowsTo : undefined;
  return (
    <div className="symtip-taint" style={{ "--taint-tone": meta.tone } as CSSProperties}>
      <span className="symtip-taint-pill">
        <span className="symtip-taint-icon">{meta.icon}</span>
        <span className="symtip-taint-label">{meta.label}</span>
      </span>
      {origin  && <span className="symtip-taint-path">{origin}</span>}
      {flowsTo && <span className="symtip-taint-flow"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><line x1="5" y1="12" x2="19" y2="12"/><polyline points="14 7 19 12 14 17"/></svg>{flowsTo}</span>}
    </div>
  );
}

// ── DetailSection ─────────────────────────────────────────────────────────────

export function DetailSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!info.detail) return null;
  return <div className="symtip-detail">{info.detail}</div>;
}

// ── MetricsSection ────────────────────────────────────────────────────────────

export function MetricsSection({ info }: { info: SymbolInfo }): ReactNode {
  const m: { k: string; v: string; hi?: boolean }[] = [];

  if (isFunctionSymbol(info)) {
    if (info.complexity  !== undefined) m.push({ k: "CPX",    v: info.complexity.toFixed(1), hi: info.complexity >= 8 });
    if (info.callers     !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
    if (info.callees     !== undefined) m.push({ k: "CALLEES", v: String(info.callees) });
    if (info.callDepth   !== undefined) m.push({ k: "DEPTH",   v: String(info.callDepth) });
    if (info.tests       !== undefined) m.push({ k: "TESTS",   v: info.tests, hi: info.tests.startsWith("0/") });
    if (info.branchCoverage !== undefined) m.push({ k: "BRANCH", v: info.branchCoverage });
  }
  if (isConstructorSymbol(info)) {
    if (info.paramCount !== undefined) m.push({ k: "PARAMS",  v: String(info.paramCount) });
    if (info.callers    !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
    if (info.tests      !== undefined) m.push({ k: "TESTS",   v: info.tests, hi: info.tests.startsWith("0/") });
  }
  if (isAbstractMethodSymbol(info)) {
    if (info.implementors !== undefined) m.push({ k: "IMPLS",   v: String(info.implementors), hi: info.implementors === 0 });
    if (info.callers      !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
    if (info.complexity   !== undefined) m.push({ k: "CPX",     v: info.complexity.toFixed(1) });
  }
  if (isLambdaSymbol(info)) {
    if (info.capturedVars !== undefined) m.push({ k: "CAPTURES", v: String(info.capturedVars), hi: info.capturedVars > 5 });
    if (info.callers      !== undefined) m.push({ k: "CALLERS",  v: String(info.callers) });
    if (info.complexity   !== undefined) m.push({ k: "CPX",      v: info.complexity.toFixed(1) });
  }
  if (isGeneratorSymbol(info)) {
    if (info.yieldCount !== undefined) m.push({ k: "YIELDS",  v: String(info.yieldCount) });
    if (info.callers    !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
    if (info.complexity !== undefined) m.push({ k: "CPX",     v: info.complexity.toFixed(1) });
  }
  if (isGetterSymbol(info) || isSetterSymbol(info)) {
    if (info.callers !== undefined) m.push({ k: "REFS", v: String(info.callers) });
  }
  if (isOverloadSymbol(info)) {
    if (info.signatureCount !== undefined) m.push({ k: "OVERLOADS", v: String(info.signatureCount) });
    if (info.callers        !== undefined) m.push({ k: "CALLERS",   v: String(info.callers) });
    if (info.complexity     !== undefined) m.push({ k: "CPX",       v: info.complexity.toFixed(1) });
  }
  if (isOperatorSymbol(info)) {
    if (info.callers !== undefined) m.push({ k: "USAGES", v: String(info.callers) });
  }
  if (isClassSymbol(info)) {
    if (info.methodCount !== undefined) m.push({ k: "METHODS", v: String(info.methodCount) });
    if (info.fieldCount  !== undefined) m.push({ k: "FIELDS",  v: String(info.fieldCount) });
    if (info.callers     !== undefined) m.push({ k: "USAGES",  v: String(info.callers) });
    if (info.tests       !== undefined) m.push({ k: "TESTS",   v: info.tests, hi: info.tests.startsWith("0/") });
  }
  if (isStructSymbol(info)) {
    if (info.fieldCount !== undefined) m.push({ k: "FIELDS", v: String(info.fieldCount) });
    if (info.callers    !== undefined) m.push({ k: "USAGES", v: String(info.callers) });
    if (info.tests      !== undefined) m.push({ k: "TESTS",  v: info.tests, hi: info.tests.startsWith("0/") });
  }
  if (isInterfaceSymbol(info)) {
    if (info.methodCount  !== undefined) m.push({ k: "METHODS", v: String(info.methodCount) });
    if (info.implementors !== undefined) m.push({ k: "IMPLS",   v: String(info.implementors) });
    if (info.usedBy       !== undefined) m.push({ k: "REFS",    v: String(info.usedBy) });
  }
  if (isEnumSymbol(info)) {
    if (info.memberCount    !== undefined) m.push({ k: "MEMBERS", v: String(info.memberCount) });
    if (info.coveredMembers !== undefined && info.memberCount !== undefined)
      {m.push({ k: "COVERED", v: `${info.coveredMembers}/${info.memberCount}`, hi: info.coveredMembers < info.memberCount });}
    if (info.usedBy !== undefined) m.push({ k: "REFS", v: String(info.usedBy) });
  }
  if (isEnumMemberSymbol(info)) {
    if (info.value  !== undefined) m.push({ k: "VALUE", v: String(info.value) });
    if (info.usedBy !== undefined) m.push({ k: "REFS",  v: String(info.usedBy) });
    if (info.covered !== undefined) m.push({ k: "TESTED", v: info.covered ? "yes" : "no", hi: !info.covered });
  }
  if (isTypeAliasSymbol(info)) {
    if (info.usedBy     !== undefined) m.push({ k: "REFS",  v: String(info.usedBy) });
    if (info.aliasDepth !== undefined) m.push({ k: "DEPTH", v: String(info.aliasDepth), hi: (info.aliasDepth ?? 0) >= 3 });
  }
  if (isTypeParameterSymbol(info)) {
    if (info.usedBy !== undefined) m.push({ k: "REFS", v: String(info.usedBy) });
  }
  if (isTypeGuardSymbol(info)) {
    if (info.callers        !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
    if (info.branchCoverage !== undefined) m.push({ k: "BRANCH",  v: info.branchCoverage });
  }
  if (isFieldSymbol(info)) {
    if (info.callers !== undefined) m.push({ k: "READS",  v: String(info.callers) });
    if (info.writers !== undefined) m.push({ k: "WRITES", v: String(info.writers), hi: (info.writers ?? 0) > 5 });
  }
  if (isPropertySymbol(info)) {
    if (info.callers !== undefined) m.push({ k: "READS", v: String(info.callers) });
  }
  if (isModuleSymbol(info)) {
    if (info.exportCount !== undefined)  m.push({ k: "EXPORTS",   v: String(info.exportCount) });
    if (info.importedBy  !== undefined)  m.push({ k: "IMPORTED BY", v: String(info.importedBy) });
  }
  if (isCallSiteSymbol(info)) {
    if (info.callDepth !== undefined) m.push({ k: "DEPTH",   v: String(info.callDepth) });
    if (info.callers   !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
  }
  if (isDecoratorSymbol(info)) {
    if (info.callers !== undefined) m.push({ k: "APPLIED", v: `${info.callers}×` });
  }
  if (isEventSymbol(info)) {
    if (info.emitters  !== undefined) m.push({ k: "EMITTERS",  v: String(info.emitters) });
    if (info.listeners !== undefined) m.push({ k: "LISTENERS", v: String(info.listeners) });
    if (info.hasCleanup !== undefined) m.push({ k: "CLEANUP",  v: info.hasCleanup ? "yes" : "no", hi: !info.hasCleanup });
  }
  if (isExceptionSymbol(info)) {
    if (info.thrownBy   !== undefined) m.push({ k: "THROWN BY", v: String(info.thrownBy) });
    if (info.caughtBy   !== undefined) m.push({ k: "CAUGHT BY", v: String(info.caughtBy), hi: info.caughtBy === 0 });
  }

  // generic fallback for kinds not explicitly handled above
  if (!m.length) {
    if ("usedBy"  in info && info.usedBy  !== undefined) m.push({ k: "REFS",    v: String(info.usedBy) });
    if ("callers" in info && info.callers !== undefined) m.push({ k: "CALLERS", v: String(info.callers) });
  }

  if (!m.length) return null;
  return (
    <div className="symtip-metrics">
      {m.map(({ k, v, hi }) => {
        const icon = METRIC_ICON[k];
        return (
          <div key={k} className={`symtip-metric${hi ? " is-hi" : ""}`}>
            {icon && <span className="symtip-metric-icon" aria-hidden>{icon}</span>}
            <span className="symtip-metric-k">{k}</span>
            <span className="symtip-metric-v">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

const METRIC_ICON: Record<string, React.ReactNode> = {
  REFS:     <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  CALLERS:  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  CALLEES:  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  WRITES:   <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  READS:    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  USAGES:   <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  TESTS:    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  METHODS:  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  FIELDS:   <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  CPX:      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  DEPTH:    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  IMPLS:    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
};

// ── ChurnSection ──────────────────────────────────────────────────────────────

export function ChurnSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!hasChurn(info)) return null;
  const risk = (info as { churnRisk?: string }).churnRisk ?? "low";
  const c = churnColor(risk);
  const churn = (info as { churn?: number }).churn;
  return (
    <div className="symtip-churn" style={{ color: c, borderColor: `color-mix(in srgb, ${c} 25%, transparent)`, background: `color-mix(in srgb, ${c} 6%, transparent)` }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      <span className="symtip-churn-label">CHURN</span>
      <span className="symtip-churn-val">{churn}</span>
      <span className="symtip-churn-period">/ 30d</span>
    </div>
  );
}

// ── CouplingSection ───────────────────────────────────────────────────────────

export function CouplingSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!hasCoupledFiles(info)) return null;
  return (
    <div className="symtip-coupling">
      <span className="symtip-coupling-label">CO-CHANGES</span>
      <div className="symtip-coupling-files">
        {info.coupledFiles.slice(0, 3).map((f) => (
          <span key={f} className="symtip-coupling-file">{f}</span>
        ))}
      </div>
    </div>
  );
}

// ── ParameterSection ──────────────────────────────────────────────────────────

export function ParameterSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isParameterSymbol(info)) return null;
  if (info.validated === undefined) return null;
  return (
    <div className="symtip-param-row" style={{ color: info.validated ? "var(--token-ok)" : "var(--token-err)" }}>
      {info.validated ? <><span>✓</span> validated</> : <><span>✗</span> no validation</>}
    </div>
  );
}

// ── CallSiteSection ───────────────────────────────────────────────────────────

export function CallSiteSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isCallSiteSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">CALLS</span>
      <span className="symtip-callsite-callee">{info.callee}</span>
      {info.isAsync    && <Pill>async</Pill>}
      {info.isTailCall && <Pill>tail</Pill>}
    </div>
  );
}

// ── FieldSection ──────────────────────────────────────────────────────────────

export function FieldSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isFieldSymbol(info)) return null;
  const vis = info.visibility;
  const vc = vis ? VIS_COLOR[vis] : undefined;
  return (
    <div className="symtip-field-row">
      {vis && <span className="symtip-vis-badge" style={{ color: vc, borderColor: `color-mix(in srgb, ${vc} 30%, transparent)`, background: `color-mix(in srgb, ${vc} 8%, transparent)` }}>{vis}</span>}
      {info.isMutable === false && <Pill>readonly</Pill>}
      {info.isNullable             && <Pill warn>nullable</Pill>}
      {info.initializedIn          && <span className="symtip-field-init">init: {info.initializedIn}</span>}
    </div>
  );
}

// ── PropertySection ───────────────────────────────────────────────────────────

export function PropertySection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isPropertySymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.hasGetter  && <Pill>get</Pill>}
      {info.hasSetter  && <Pill>set</Pill>}
      {info.sideEffect && <Pill warn>side-effect</Pill>}
      {info.visibility && <span className="symtip-vis-badge" style={{ color: VIS_COLOR[info.visibility] }}>{info.visibility}</span>}
    </div>
  );
}

// ── ConstructorSection ────────────────────────────────────────────────────────

export function ConstructorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isConstructorSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.injected   && <Pill>DI injected</Pill>}
      {info.visibility && <span className="symtip-vis-badge" style={{ color: VIS_COLOR[info.visibility] }}>{info.visibility}</span>}
    </div>
  );
}

// ── AbstractMethodSection ─────────────────────────────────────────────────────

export function AbstractMethodSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isAbstractMethodSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      <Pill warn>abstract</Pill>
      {info.implementors === 0 && <Pill warn>no impl</Pill>}
      {info.visibility && <span className="symtip-vis-badge" style={{ color: VIS_COLOR[info.visibility] }}>{info.visibility}</span>}
    </div>
  );
}

// ── LambdaSection ─────────────────────────────────────────────────────────────

export function LambdaSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isLambdaSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.isAsync                             && <Pill>async</Pill>}
      {info.capturedVars !== undefined && info.capturedVars > 5 && <Pill warn>{info.capturedVars} captures</Pill>}
      {info.capturedVars !== undefined && info.capturedVars <= 5 && <Pill>{info.capturedVars} captures</Pill>}
    </div>
  );
}

// ── GeneratorSection ──────────────────────────────────────────────────────────

export function GeneratorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isGeneratorSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.isAsync && <Pill>async</Pill>}
      <Pill>generator</Pill>
      {info.yieldCount !== undefined && <span className="symtip-field-init">{info.yieldCount} yields</span>}
    </div>
  );
}

// ── GetterSetterSection ───────────────────────────────────────────────────────

export function GetterSetterSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isGetterSymbol(info) && !isSetterSymbol(info)) return null;
  const isSet = isSetterSymbol(info);
  const vc = info.visibility ? VIS_COLOR[info.visibility] : undefined;
  return (
    <div className="symtip-field-row">
      <Pill>{isSet ? "setter" : "getter"}</Pill>
      {info.sideEffect && <Pill warn>side-effect</Pill>}
      {isSetterSymbol(info) && info.validated === false && <Pill warn>unvalidated input</Pill>}
      {info.visibility && vc && <span className="symtip-vis-badge" style={{ color: vc }}>{info.visibility}</span>}
    </div>
  );
}

// ── OverloadSection ───────────────────────────────────────────────────────────

export function OverloadSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isOverloadSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">SIGS</span>
      <span className="symtip-callsite-callee">{info.signatureCount ?? "?"} overloads</span>
    </div>
  );
}

// ── OperatorSection ───────────────────────────────────────────────────────────

export function OperatorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isOperatorSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">OP</span>
      <span className="symtip-callsite-callee">{info.op ?? "?"}</span>
      {info.sideEffect && <Pill warn>side-effect</Pill>}
    </div>
  );
}

// ── StructSection ─────────────────────────────────────────────────────────────

export function StructSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isStructSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      <Pill>struct</Pill>
      {info.isMutable && <Pill warn>mutable</Pill>}
    </div>
  );
}

// ── InterfaceSection ──────────────────────────────────────────────────────────

export function InterfaceSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isInterfaceSymbol(info) || !info.implementors) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">IMPLS</span>
      <span className="symtip-callsite-callee">{info.implementors} classes</span>
    </div>
  );
}

// ── EnumSection ───────────────────────────────────────────────────────────────

export function EnumSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isEnumSymbol(info)) return null;
  if (info.coveredMembers === undefined || info.memberCount === undefined) return null;
  const uncovered = info.memberCount - info.coveredMembers;
  const c = uncovered > 0 ? "var(--token-str)" : "var(--token-ok)";
  return (
    <div className="symtip-param-row" style={{ color: c }}>
      {uncovered > 0 ? <><span>⚠</span> {uncovered} members untested</> : <><span>✓</span> all members covered</>}
    </div>
  );
}

// ── EnumMemberSection ─────────────────────────────────────────────────────────

export function EnumMemberSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isEnumMemberSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">VALUE</span>
      <span className="symtip-callsite-callee">{info.value ?? "—"}</span>
      {info.covered !== undefined && (
        <Pill warn={!info.covered}>{info.covered ? "tested" : "untested"}</Pill>
      )}
    </div>
  );
}

// ── TypeAliasSection ──────────────────────────────────────────────────────────

export function TypeAliasSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeAliasSymbol(info) || !info.aliasDepth || info.aliasDepth < 2) return null;
  return (
    <div className="symtip-param-row" style={{ color: info.aliasDepth >= 3 ? "var(--token-str)" : "var(--ink-3)" }}>
      <span>⛓</span> alias depth {info.aliasDepth}
    </div>
  );
}

// ── TypeParameterSection ──────────────────────────────────────────────────────

export function TypeParameterSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeParameterSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      {info.constraint && <><span className="symtip-callsite-label">EXTENDS</span><span className="symtip-callsite-callee">{info.constraint}</span></>}
      {info.variance   && <Pill>{info.variance}</Pill>}
    </div>
  );
}

// ── TypeGuardSection ──────────────────────────────────────────────────────────

export function TypeGuardSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeGuardSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">NARROWS</span>
      <span className="symtip-callsite-callee">{info.guards ?? "unknown"}</span>
    </div>
  );
}

// ── ModuleSection ─────────────────────────────────────────────────────────────

export function ModuleSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isModuleSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.isCircular     && <Pill warn>circular dep</Pill>}
      {info.treeshakeable  && <Pill>tree-shakeable</Pill>}
      {info.hasBarrel      && <Pill>barrel</Pill>}
    </div>
  );
}

// ── DecoratorSection ──────────────────────────────────────────────────────────

export function DecoratorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isDecoratorSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.target     && <Pill>@{info.target}</Pill>}
      {info.sideEffect && <Pill warn>side-effect</Pill>}
    </div>
  );
}

// ── EventSection ──────────────────────────────────────────────────────────────

export function EventSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isEventSymbol(info)) return null;
  const leakRisk = info.listeners !== undefined && !info.hasCleanup;
  return (
    <div className="symtip-field-row">
      {info.isAsync && <Pill>async</Pill>}
      {leakRisk     && <Pill warn>leak risk</Pill>}
    </div>
  );
}

// ── ExceptionSection ──────────────────────────────────────────────────────────

export function ExceptionSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isExceptionSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.isUnhandled   && <Pill warn>unhandled</Pill>}
      {info.superClass    && <span className="symtip-field-init">extends {info.superClass}</span>}
    </div>
  );
}

// ── TagsSection ───────────────────────────────────────────────────────────────

const TAG_LABEL: Record<string, string> = {
  "dead": "dead code", "no-tests": "no tests", "external": "external",
  "hot-path": "hot path", "write": "db write", "async": "async",
  "stale": "stale", "taint-source": "taint src", "high-churn": "high churn",
  "override": "override", "deprecated": "deprecated", "abstract": "abstract",
  "virtual": "virtual", "pure": "pure fn", "nullable": "nullable",
  "mutable": "mutable", "injected": "injected", "side-effect": "side effect",
  "throws": "throws", "generator": "generator", "closure": "closure",
  "overloaded": "overloaded",
};

export function TagsSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!info.tags?.length) return null;
  return (
    <div className="symtip-tags">
      {info.tags.map((tag) => (
        <span key={tag} className={`symtip-tag symtip-tag-${tag}`}>{TAG_LABEL[tag] ?? tag}</span>
      ))}
    </div>
  );
}

// ── BlameSection ──────────────────────────────────────────────────────────────

export function BlameSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!info.blame) return null;
  const initial = info.blame.author.replace("@", "")[0].toUpperCase();
  return (
    <div className="symtip-blame">
      <span className="symtip-blame-avatar">{initial}</span>
      <span className="symtip-blame-who">{info.blame.author}</span>
      <span className="symtip-blame-sep">·</span>
      <span className="symtip-blame-when">{info.blame.when}</span>
    </div>
  );
}
