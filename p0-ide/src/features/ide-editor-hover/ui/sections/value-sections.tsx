/* =============================================================================
   value-sections.tsx — Value/field symbol sections
   ============================================================================= */
import type { ReactNode } from "react";
import type { SymbolInfo } from "../../model/symbols";
import {
  isParameterSymbol, isCallSiteSymbol,
  isFieldSymbol, isPropertySymbol,
  isModuleSymbol,
  isDecoratorSymbol, isEventSymbol, isExceptionSymbol,
} from "../../model/symbols";
import { VIS_COLOR, Pill } from "./shared-sections";

// ── ParameterSection ─────────────────────────────────────────────────────────

export function ParameterSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isParameterSymbol(info)) return null;
  if (info.validated === undefined) return null;
  return (
    <div className="symtip-param-row" style={{ color: info.validated ? "var(--token-ok)" : "var(--token-err)" }}>
      {info.validated ? <><span>✓</span> validated</> : <><span>✗</span> no validation</>}
    </div>
  );
}

// ── CallSiteSection ──────────────────────────────────────────────────────────

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

// ── FieldSection ─────────────────────────────────────────────────────────────

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

// ── PropertySection ──────────────────────────────────────────────────────────

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

// ── ModuleSection ────────────────────────────────────────────────────────────

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

// ── DecoratorSection ─────────────────────────────────────────────────────────

export function DecoratorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isDecoratorSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.target     && <Pill>@{info.target}</Pill>}
      {info.sideEffect && <Pill warn>side-effect</Pill>}
    </div>
  );
}

// ── EventSection ─────────────────────────────────────────────────────────────

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

// ── ExceptionSection ─────────────────────────────────────────────────────────

export function ExceptionSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isExceptionSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.isUnhandled   && <Pill warn>unhandled</Pill>}
      {info.superClass    && <span className="symtip-field-init">extends {info.superClass}</span>}
    </div>
  );
}
