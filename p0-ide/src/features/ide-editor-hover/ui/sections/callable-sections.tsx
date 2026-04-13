/* =============================================================================
   callable-sections.tsx — Function-like symbol sections
   ============================================================================= */
import type { ReactNode } from "react";
import type { SymbolInfo } from "../../model/symbols";
import {
  isConstructorSymbol, isAbstractMethodSymbol,
  isLambdaSymbol, isGeneratorSymbol, isGetterSymbol, isSetterSymbol,
  isOverloadSymbol, isOperatorSymbol,
} from "../../model/symbols";
import { VIS_COLOR, Pill } from "./shared-sections";

// ── ConstructorSection ───────────────────────────────────────────────────────

export function ConstructorSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isConstructorSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      {info.injected   && <Pill>DI injected</Pill>}
      {info.visibility && <span className="symtip-vis-badge" style={{ color: VIS_COLOR[info.visibility] }}>{info.visibility}</span>}
    </div>
  );
}

// ── AbstractMethodSection ────────────────────────────────────────────────────

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

// ── LambdaSection ────────────────────────────────────────────────────────────

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

// ── GeneratorSection ─────────────────────────────────────────────────────────

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

// ── GetterSetterSection ──────────────────────────────────────────────────────

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

// ── OverloadSection ──────────────────────────────────────────────────────────

export function OverloadSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isOverloadSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">SIGS</span>
      <span className="symtip-callsite-callee">{info.signatureCount ?? "?"} overloads</span>
    </div>
  );
}

// ── OperatorSection ──────────────────────────────────────────────────────────

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
