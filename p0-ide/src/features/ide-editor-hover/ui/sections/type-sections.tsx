/* =============================================================================
   type-sections.tsx — Type/class symbol sections
   ============================================================================= */
import type { ReactNode } from "react";
import type { SymbolInfo } from "../../model/symbols";
import {
  isStructSymbol, isInterfaceSymbol,
  isEnumSymbol, isEnumMemberSymbol, isTypeAliasSymbol, isTypeParameterSymbol, isTypeGuardSymbol,
} from "../../model/symbols";
import { Pill } from "./shared-sections";

// ── StructSection ────────────────────────────────────────────────────────────

export function StructSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isStructSymbol(info)) return null;
  return (
    <div className="symtip-field-row">
      <Pill>struct</Pill>
      {info.isMutable && <Pill warn>mutable</Pill>}
    </div>
  );
}

// ── InterfaceSection ─────────────────────────────────────────────────────────

export function InterfaceSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isInterfaceSymbol(info) || !info.implementors) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">IMPLS</span>
      <span className="symtip-callsite-callee">{info.implementors} classes</span>
    </div>
  );
}

// ── EnumSection ──────────────────────────────────────────────────────────────

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

// ── EnumMemberSection ────────────────────────────────────────────────────────

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

// ── TypeAliasSection ─────────────────────────────────────────────────────────

export function TypeAliasSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeAliasSymbol(info) || !info.aliasDepth || info.aliasDepth < 2) return null;
  return (
    <div className="symtip-param-row" style={{ color: info.aliasDepth >= 3 ? "var(--token-str)" : "var(--ink-3)" }}>
      <span>⛓</span> alias depth {info.aliasDepth}
    </div>
  );
}

// ── TypeParameterSection ─────────────────────────────────────────────────────

export function TypeParameterSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeParameterSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      {info.constraint && <><span className="symtip-callsite-label">EXTENDS</span><span className="symtip-callsite-callee">{info.constraint}</span></>}
      {info.variance   && <Pill>{info.variance}</Pill>}
    </div>
  );
}

// ── TypeGuardSection ─────────────────────────────────────────────────────────

export function TypeGuardSection({ info }: { info: SymbolInfo }): ReactNode {
  if (!isTypeGuardSymbol(info)) return null;
  return (
    <div className="symtip-callsite">
      <span className="symtip-callsite-label">NARROWS</span>
      <span className="symtip-callsite-callee">{info.guards ?? "unknown"}</span>
    </div>
  );
}
