/* =============================================================================
   symbols.ts — Discriminated union SymbolInfo type system
   각 kind는 자신에게 의미있는 필드만 가짐 (no optional pollution)

   Kind taxonomy — LSP SymbolKind + SonarQube + Pyright complete:
     Callable:   function | method | constructor | abstract-method
                 | lambda | generator | getter | setter | overload | operator
     Type:       class | struct | interface | enum | type-alias | type-parameter
                 | type-guard
     Value:      variable | const | parameter | field | property | enum-member
     Module:     module | import
     Meta:       call-site | decorator | event | exception
     Legacy:     type (generic fallback)
   ============================================================================= */

// ── Shared primitives ────────────────────────────────────────────────────────

export type TaintKind = "source" | "sink" | "passthrough";

export type SymbolTag =
  | "dead" | "no-tests" | "external" | "hot-path"
  | "write" | "async" | "stale" | "taint-source" | "high-churn"
  | "override" | "deprecated" | "abstract" | "virtual" | "pure"
  | "nullable" | "mutable" | "injected" | "side-effect"
  | "throws" | "generator" | "closure" | "overloaded";

export type ChurnRisk = "low" | "mid" | "high";
export type Visibility = "public" | "protected" | "private" | "internal";

export interface BlameInfo { author: string; when: string; }

export interface AnalysisBase {
  name: string;
  riskScore?: number;
  detail?: string;
  blame?: BlameInfo;
  tags?: SymbolTag[];
}

export interface ChurnMixin {
  churn?: number;
  churnRisk?: ChurnRisk;
  coupledFiles?: string[];
}

export interface VisibilityMixin {
  visibility?: Visibility;
}

// ════════════════════════════════════════════════════════════════════════════
//  CALLABLE
// ════════════════════════════════════════════════════════════════════════════

export interface FunctionSymbol extends AnalysisBase, ChurnMixin {
  kind: "function" | "method";
  complexity?: number;
  callers?: number;
  callees?: number;
  callDepth?: number;
  tests?: string;
  branchCoverage?: string;
  taint?: TaintKind;
  origin?: string;
  flowsTo?: string;
  visibility?: Visibility;
  isAsync?: boolean;
  isPure?: boolean;
}

export interface ConstructorSymbol extends AnalysisBase, ChurnMixin {
  kind: "constructor";
  paramCount?: number;
  injected?: boolean;
  callers?: number;
  visibility?: Visibility;
  tests?: string;
}

export interface AbstractMethodSymbol extends AnalysisBase {
  kind: "abstract-method";
  implementors?: number;   // how many concrete impls exist
  callers?: number;
  complexity?: number;
  visibility?: Visibility;
}

export interface LambdaSymbol extends AnalysisBase {
  kind: "lambda";
  capturedVars?: number;   // closure capture count
  taint?: TaintKind;
  isAsync?: boolean;
  complexity?: number;
  callers?: number;
}

export interface GeneratorSymbol extends AnalysisBase, ChurnMixin {
  kind: "generator";
  yieldCount?: number;     // number of yield points
  complexity?: number;
  callers?: number;
  taint?: TaintKind;
  isAsync?: boolean;       // async generator
}

export interface GetterSymbol extends AnalysisBase {
  kind: "getter";
  taint?: TaintKind;
  sideEffect?: boolean;
  callers?: number;
  visibility?: Visibility;
}

export interface SetterSymbol extends AnalysisBase {
  kind: "setter";
  taint?: TaintKind;
  sideEffect?: boolean;
  callers?: number;
  visibility?: Visibility;
  validated?: boolean;     // input validation in setter
}

export interface OverloadSymbol extends AnalysisBase {
  kind: "overload";
  signatureCount?: number; // number of overload signatures
  callers?: number;
  complexity?: number;
}

export interface OperatorSymbol extends AnalysisBase {
  kind: "operator";
  op?: string;             // e.g. "+", "==", "[]"
  callers?: number;
  sideEffect?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
//  TYPE
// ════════════════════════════════════════════════════════════════════════════

export interface ClassSymbol extends AnalysisBase, ChurnMixin {
  kind: "class";
  methodCount?: number;
  fieldCount?: number;
  callers?: number;
  tests?: string;
  visibility?: Visibility;
  isAbstract?: boolean;
  superClass?: string;
  interfaces?: string[];
}

export interface StructSymbol extends AnalysisBase, ChurnMixin {
  kind: "struct";
  fieldCount?: number;
  callers?: number;
  isMutable?: boolean;     // mutable struct is a risk
  tests?: string;
}

export interface InterfaceSymbol extends AnalysisBase {
  kind: "interface";
  methodCount?: number;
  implementors?: number;
  usedBy?: number;
  branchCoverage?: string;
}

export interface EnumSymbol extends AnalysisBase {
  kind: "enum";
  memberCount?: number;
  coveredMembers?: number;
  usedBy?: number;
}

export interface TypeAliasSymbol extends AnalysisBase {
  kind: "type-alias";
  usedBy?: number;
  aliasDepth?: number;
  branchCoverage?: string;
}

export interface TypeParameterSymbol extends AnalysisBase {
  kind: "type-parameter";
  constraint?: string;
  usedBy?: number;
  variance?: "covariant" | "contravariant" | "invariant";
}

export interface TypeGuardSymbol extends AnalysisBase {
  kind: "type-guard";
  guards?: string;         // e.g. "s is string"
  callers?: number;
  branchCoverage?: string; // narrowing branches covered
}

// ════════════════════════════════════════════════════════════════════════════
//  VALUE
// ════════════════════════════════════════════════════════════════════════════

export interface VariableSymbol extends AnalysisBase {
  kind: "variable";
  taint?: TaintKind;
  origin?: string;
  flowsTo?: string;
  callers?: number;
  isMutable?: boolean;
  isNullable?: boolean;
}

export interface ConstSymbol extends AnalysisBase {
  kind: "const";
  usedBy?: number;
  isMagicNumber?: boolean;
}

export interface ParameterSymbol extends AnalysisBase {
  kind: "parameter";
  taint?: TaintKind;
  origin?: string;
  flowsTo?: string;
  validated?: boolean;
  isOptional?: boolean;
  hasDefault?: boolean;
  isNullable?: boolean;
}

export interface FieldSymbol extends AnalysisBase, ChurnMixin {
  kind: "field";
  taint?: TaintKind;
  visibility?: Visibility;
  isMutable?: boolean;
  isNullable?: boolean;
  initializedIn?: string;
  callers?: number;
  writers?: number;
}

export interface PropertySymbol extends AnalysisBase {
  kind: "property";
  hasGetter?: boolean;
  hasSetter?: boolean;
  taint?: TaintKind;
  visibility?: Visibility;
  callers?: number;
  sideEffect?: boolean;
}

export interface EnumMemberSymbol extends AnalysisBase {
  kind: "enum-member";
  value?: string | number;
  covered?: boolean;
  usedBy?: number;
}

// ════════════════════════════════════════════════════════════════════════════
//  MODULE
// ════════════════════════════════════════════════════════════════════════════

export interface ModuleSymbol extends AnalysisBase {
  kind: "module";
  exportCount?: number;    // how many symbols exported
  importedBy?: number;     // how many files import this module
  isCircular?: boolean;
  treeshakeable?: boolean;
  hasBarrel?: boolean;     // index re-export barrel file
}

export interface ImportSymbol extends AnalysisBase {
  kind: "import";
  origin?: string;
  usedBy?: number;
  callers?: number;
  taint?: TaintKind;
  isCircular?: boolean;
  treeshakeable?: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
//  META
// ════════════════════════════════════════════════════════════════════════════

export interface CallSiteSymbol extends AnalysisBase {
  kind: "call-site";
  callee: string;
  callDepth?: number;
  callers?: number;
  taint?: TaintKind;
  origin?: string;
  isAsync?: boolean;
  isTailCall?: boolean;
}

export interface DecoratorSymbol extends AnalysisBase {
  kind: "decorator";
  target?: string;
  sideEffect?: boolean;
  callers?: number;
}

export interface EventSymbol extends AnalysisBase {
  kind: "event";
  emitters?: number;
  listeners?: number;
  hasCleanup?: boolean;
  taint?: TaintKind;
  isAsync?: boolean;
}

export interface ExceptionSymbol extends AnalysisBase {
  kind: "exception";
  thrownBy?: number;       // how many functions throw this
  caughtBy?: number;       // how many catch blocks handle it
  isUnhandled?: boolean;   // thrown but never caught
  superClass?: string;     // e.g. "RuntimeError"
}

// ════════════════════════════════════════════════════════════════════════════
//  LEGACY
// ════════════════════════════════════════════════════════════════════════════

export interface TypeSymbol extends AnalysisBase {
  kind: "type";
  usedBy?: number;
  branchCoverage?: string;
}

// ── Master union ─────────────────────────────────────────────────────────────

export type SymbolInfo =
  // Callable
  | FunctionSymbol | ConstructorSymbol | AbstractMethodSymbol
  | LambdaSymbol | GeneratorSymbol
  | GetterSymbol | SetterSymbol
  | OverloadSymbol | OperatorSymbol
  // Type
  | ClassSymbol | StructSymbol | InterfaceSymbol
  | EnumSymbol | TypeAliasSymbol | TypeParameterSymbol | TypeGuardSymbol
  // Value
  | VariableSymbol | ConstSymbol | ParameterSymbol
  | FieldSymbol | PropertySymbol | EnumMemberSymbol
  // Module
  | ModuleSymbol | ImportSymbol
  // Meta
  | CallSiteSymbol | DecoratorSymbol | EventSymbol | ExceptionSymbol
  // Legacy
  | TypeSymbol;

// ── Type guards ──────────────────────────────────────────────────────────────

export const isFunctionSymbol       = (s: SymbolInfo): s is FunctionSymbol       => s.kind === "function" || s.kind === "method";
export const isConstructorSymbol    = (s: SymbolInfo): s is ConstructorSymbol    => s.kind === "constructor";
export const isAbstractMethodSymbol = (s: SymbolInfo): s is AbstractMethodSymbol => s.kind === "abstract-method";
export const isLambdaSymbol         = (s: SymbolInfo): s is LambdaSymbol         => s.kind === "lambda";
export const isGeneratorSymbol      = (s: SymbolInfo): s is GeneratorSymbol      => s.kind === "generator";
export const isGetterSymbol         = (s: SymbolInfo): s is GetterSymbol         => s.kind === "getter";
export const isSetterSymbol         = (s: SymbolInfo): s is SetterSymbol         => s.kind === "setter";
export const isOverloadSymbol       = (s: SymbolInfo): s is OverloadSymbol       => s.kind === "overload";
export const isOperatorSymbol       = (s: SymbolInfo): s is OperatorSymbol       => s.kind === "operator";
export const isClassSymbol          = (s: SymbolInfo): s is ClassSymbol          => s.kind === "class";
export const isStructSymbol         = (s: SymbolInfo): s is StructSymbol         => s.kind === "struct";
export const isInterfaceSymbol      = (s: SymbolInfo): s is InterfaceSymbol      => s.kind === "interface";
export const isEnumSymbol           = (s: SymbolInfo): s is EnumSymbol           => s.kind === "enum";
export const isTypeAliasSymbol      = (s: SymbolInfo): s is TypeAliasSymbol      => s.kind === "type-alias";
export const isTypeParameterSymbol  = (s: SymbolInfo): s is TypeParameterSymbol  => s.kind === "type-parameter";
export const isTypeGuardSymbol      = (s: SymbolInfo): s is TypeGuardSymbol      => s.kind === "type-guard";
export const isVariableSymbol       = (s: SymbolInfo): s is VariableSymbol       => s.kind === "variable";
export const isConstSymbol          = (s: SymbolInfo): s is ConstSymbol          => s.kind === "const";
export const isParameterSymbol      = (s: SymbolInfo): s is ParameterSymbol      => s.kind === "parameter";
export const isFieldSymbol          = (s: SymbolInfo): s is FieldSymbol          => s.kind === "field";
export const isPropertySymbol       = (s: SymbolInfo): s is PropertySymbol       => s.kind === "property";
export const isEnumMemberSymbol     = (s: SymbolInfo): s is EnumMemberSymbol     => s.kind === "enum-member";
export const isModuleSymbol         = (s: SymbolInfo): s is ModuleSymbol         => s.kind === "module";
export const isImportSymbol         = (s: SymbolInfo): s is ImportSymbol         => s.kind === "import";
export const isCallSiteSymbol       = (s: SymbolInfo): s is CallSiteSymbol       => s.kind === "call-site";
export const isDecoratorSymbol      = (s: SymbolInfo): s is DecoratorSymbol      => s.kind === "decorator";
export const isEventSymbol          = (s: SymbolInfo): s is EventSymbol          => s.kind === "event";
export const isExceptionSymbol      = (s: SymbolInfo): s is ExceptionSymbol      => s.kind === "exception";
export const isTypeSymbol           = (s: SymbolInfo): s is TypeSymbol           => s.kind === "type";

// ── Field guards ─────────────────────────────────────────────────────────────

export function hasTaint(s: SymbolInfo): s is SymbolInfo & { taint: TaintKind } {
  return "taint" in s && s.taint !== undefined;
}
export function hasChurn(s: SymbolInfo): s is SymbolInfo & ChurnMixin {
  return "churn" in s && (s as ChurnMixin).churn !== undefined;
}
export function hasCoupledFiles(s: SymbolInfo): s is SymbolInfo & { coupledFiles: string[] } {
  return "coupledFiles" in s && Array.isArray((s as ChurnMixin).coupledFiles) && ((s as ChurnMixin).coupledFiles?.length ?? 0) > 0;
}
export function hasVisibility(s: SymbolInfo): s is SymbolInfo & { visibility: Visibility } {
  return "visibility" in s && (s as VisibilityMixin).visibility !== undefined;
}
