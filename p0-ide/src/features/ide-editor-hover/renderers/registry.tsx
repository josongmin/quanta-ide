/* =============================================================================
   renderers/registry.tsx — kind → { icon, label, sections, footerHints }
   새 kind 추가 = 이 파일에만 등록 (OCP)
   ============================================================================= */
import type { ComponentType } from "react";
import type { SymbolInfo } from "../model/symbols";
import {
  RiskBarSection, TaintSection, DetailSection, MetricsSection,
  ChurnSection, CouplingSection,
  ParameterSection, CallSiteSection,
  FieldSection, PropertySection, ConstructorSection,
  AbstractMethodSection, LambdaSection, GeneratorSection,
  GetterSetterSection, OverloadSection, OperatorSection,
  StructSection, InterfaceSection, EnumSection, EnumMemberSection,
  TypeAliasSection, TypeParameterSection, TypeGuardSection,
  ModuleSection, DecoratorSection, EventSection, ExceptionSection,
  TagsSection, BlameSection,
} from "../ui/sections/index";

export interface SymbolRenderer {
  icon: string;
  label: string;
  sections: ComponentType<{ info: SymbolInfo }>[];
  footerHints: (info: SymbolInfo) => { kbd: string; label: string }[];
}

// ── Glyphs ────────────────────────────────────────────────────────────────────
const G: Record<SymbolInfo["kind"], string> = {
  // Callable
  "function":        "ƒ",
  "method":          "ƒ",
  "constructor":     "I",
  "abstract-method": "A",
  "lambda":          "λ",
  "generator":       "∗",
  "getter":          "g",
  "setter":          "s",
  "overload":        "⊕",
  "operator":        "±",
  // Type
  "class":           "C",
  "struct":          "S",
  "interface":       "«",
  "enum":            "E",
  "type-alias":      "~",
  "type-parameter":  "T",
  "type-guard":      "?",
  // Value
  "variable":        "v",
  "const":           "π",
  "parameter":       "p",
  "field":           "#",
  "property":        "p",
  "enum-member":     "e",
  // Module
  "module":          "◈",
  "import":          "◈",
  // Meta
  "call-site":       "→",
  "decorator":       "@",
  "event":           "⚡",
  "exception":       "✕",
  // Legacy
  "type":            "T",
};

// ── Shared pipelines ──────────────────────────────────────────────────────────

const CALLABLE_BASE = [
  RiskBarSection, TaintSection, DetailSection,
  MetricsSection, ChurnSection, CouplingSection,
  TagsSection, BlameSection,
] satisfies ComponentType<{ info: SymbolInfo }>[];

const TYPE_BASE = [
  RiskBarSection, DetailSection,
  MetricsSection, ChurnSection, CouplingSection,
  TagsSection, BlameSection,
] satisfies ComponentType<{ info: SymbolInfo }>[];

const VALUE_BASE = [
  TaintSection, DetailSection, MetricsSection,
  TagsSection, BlameSection,
] satisfies ComponentType<{ info: SymbolInfo }>[];

const fixHint = (info: SymbolInfo) =>
  info.riskScore && info.riskScore >= 40 ? [{ kbd: "⌘F", label: "suggest fix" }] : [];

// ── Registry ──────────────────────────────────────────────────────────────────

export const SYMBOL_REGISTRY: Record<SymbolInfo["kind"], SymbolRenderer> = {

  // ── CALLABLE ──────────────────────────────────────────────────────────────

  "function": {
    icon: G.function, label: "function",
    sections: CALLABLE_BASE,
    footerHints: (i) => [{ kbd: "⌘.", label: "show flow" }, ...fixHint(i)],
  },
  "method": {
    icon: G.method, label: "method",
    sections: CALLABLE_BASE,
    footerHints: (i) => [{ kbd: "⌘.", label: "show flow" }, ...fixHint(i)],
  },
  "constructor": {
    icon: G.constructor, label: "constructor",
    sections: [ConstructorSection, DetailSection, MetricsSection, ChurnSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "abstract-method": {
    icon: G["abstract-method"], label: "abstract method",
    sections: [AbstractMethodSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "lambda": {
    icon: G.lambda, label: "lambda",
    sections: [LambdaSection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: (i) => [...fixHint(i)],
  },
  "generator": {
    icon: G.generator, label: "generator",
    sections: [GeneratorSection, TaintSection, DetailSection, MetricsSection, ChurnSection, TagsSection, BlameSection],
    footerHints: () => [{ kbd: "⌘.", label: "show flow" }],
  },
  "getter": {
    icon: G.getter, label: "getter",
    sections: [GetterSetterSection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "setter": {
    icon: G.setter, label: "setter",
    sections: [GetterSetterSection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: (i) => [...fixHint(i)],
  },
  "overload": {
    icon: G.overload, label: "overload",
    sections: [OverloadSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "operator": {
    icon: G.operator, label: "operator",
    sections: [OperatorSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },

  // ── TYPE ──────────────────────────────────────────────────────────────────

  "class": {
    icon: G.class, label: "class",
    sections: TYPE_BASE,
    footerHints: () => [{ kbd: "⌘G", label: "call graph" }],
  },
  "struct": {
    icon: G.struct, label: "struct",
    sections: [StructSection, DetailSection, MetricsSection, ChurnSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "interface": {
    icon: G.interface, label: "interface",
    sections: [InterfaceSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "enum": {
    icon: G.enum, label: "enum",
    sections: [EnumSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "type-alias": {
    icon: G["type-alias"], label: "type alias",
    sections: [TypeAliasSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "type-parameter": {
    icon: G["type-parameter"], label: "type param",
    sections: [TypeParameterSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "type-guard": {
    icon: G["type-guard"], label: "type guard",
    sections: [TypeGuardSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },

  // ── VALUE ─────────────────────────────────────────────────────────────────

  "variable": {
    icon: G.variable, label: "variable",
    sections: VALUE_BASE,
    footerHints: (i) => "taint" in i && i.taint === "sink" ? [{ kbd: "⌘F", label: "suggest fix" }] : [],
  },
  "const": {
    icon: G.const, label: "const",
    sections: [DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "parameter": {
    icon: G.parameter, label: "parameter",
    sections: [TaintSection, ParameterSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "field": {
    icon: G.field, label: "field",
    sections: [FieldSection, TaintSection, DetailSection, MetricsSection, ChurnSection, TagsSection, BlameSection],
    footerHints: (i) => "taint" in i && i.taint === "sink" ? [{ kbd: "⌘F", label: "suggest fix" }] : [],
  },
  "property": {
    icon: G.property, label: "property",
    sections: [PropertySection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "enum-member": {
    icon: G["enum-member"], label: "enum member",
    sections: [EnumMemberSection, DetailSection, TagsSection, BlameSection],
    footerHints: () => [],
  },

  // ── MODULE ────────────────────────────────────────────────────────────────

  "module": {
    icon: G.module, label: "module",
    sections: [ModuleSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "import": {
    icon: G.import, label: "import",
    sections: [TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },

  // ── META ──────────────────────────────────────────────────────────────────

  "call-site": {
    icon: G["call-site"], label: "call site",
    sections: [CallSiteSection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [{ kbd: "⌘.", label: "show flow" }],
  },
  "decorator": {
    icon: G.decorator, label: "decorator",
    sections: [DecoratorSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "event": {
    icon: G.event, label: "event",
    sections: [EventSection, TaintSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
  "exception": {
    icon: G.exception, label: "exception",
    sections: [ExceptionSection, DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },

  // ── LEGACY ────────────────────────────────────────────────────────────────

  "type": {
    icon: G.type, label: "type",
    sections: [DetailSection, MetricsSection, TagsSection, BlameSection],
    footerHints: () => [],
  },
};
