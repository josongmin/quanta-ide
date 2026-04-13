import { EditorView } from "@codemirror/view";
import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/* ═══════════════════════════════════════════════════════════════════════
   Syntax highlighting — matches IDE design tokens
   ═══════════════════════════════════════════════════════════════════════ */
export const ideHighlight = HighlightStyle.define([
  { tag: tags.keyword,            color: "var(--token-kw)" },
  { tag: tags.controlKeyword,     color: "var(--token-kw)" },
  { tag: tags.operatorKeyword,    color: "var(--token-kw)" },
  { tag: tags.definitionKeyword,  color: "var(--token-kw)" },
  { tag: tags.function(tags.definition(tags.variableName)), color: "var(--token-fn)" },
  { tag: tags.function(tags.variableName), color: "var(--token-fn)" },
  { tag: tags.className,          color: "var(--token-fn)" },
  { tag: tags.definition(tags.className), color: "var(--token-fn)" },
  { tag: tags.string,             color: "var(--token-str)" },
  { tag: tags.number,             color: "var(--token-num)" },
  { tag: tags.bool,               color: "var(--token-num)" },
  { tag: tags.comment,            color: "color-mix(in srgb, var(--ink-4) 55%, transparent)", fontStyle: "italic" },
  { tag: tags.operator,           color: "var(--ink-2)" },
  { tag: tags.punctuation,        color: "var(--ink-3)" },
  { tag: tags.variableName,       color: "var(--ink)" },
  { tag: tags.self,               color: "var(--token-kw)" },
  { tag: tags.typeName,           color: "var(--token-fn)" },
  { tag: tags.propertyName,       color: "var(--ink)" },
  { tag: tags.meta,               color: "var(--token-str)" },
]);

/* ═══════════════════════════════════════════════════════════════════════
   Dark theme matching IDE
   ═══════════════════════════════════════════════════════════════════════ */
export const ideTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  },
  ".cm-content": { caretColor: "var(--ink)", padding: "4px 0", lineHeight: "1.7" },
  ".cm-line": { lineHeight: "1.7" },
  ".cm-cursor": { borderLeftColor: "var(--ink)", borderLeftWidth: "1.5px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "color-mix(in srgb, var(--accent) 25%, transparent) !important",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)" },
  ".cm-gutters": {
    backgroundColor: "var(--paper)",
    borderRight: "1px solid var(--line)",
    color: "var(--ink-4)",
    zIndex: "2",
  },
  ".cm-lineNumbers": {
    minWidth: "52px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontFamily: "var(--font-mono)", fontSize: "11px",
    padding: "0 12px 0 8px", minWidth: "52px", textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
    color: "var(--ink-2)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },

  /* risk gutter */
  ".cm-risk-gutter .cm-gutterElement": {
    width: "3px", padding: "0", minWidth: "3px",
  },
  ".cm-risk-marker": {
    display: "block", width: "3px", height: "100%", borderRadius: "1px",
  },
  ".cm-risk-1": { backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)" },
  ".cm-risk-2": { backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)" },
  ".cm-risk-3": { backgroundColor: "color-mix(in srgb, var(--accent) 28%, transparent)" },
  ".cm-risk-4": { backgroundColor: "color-mix(in srgb, var(--accent) 42%, transparent)" },

  /* coverage gap gutter */
  ".cm-coverage-gutter .cm-gutterElement": {
    width: "3px", padding: "0", minWidth: "3px",
  },
  ".cm-coverage-marker": {
    display: "block", width: "3px", height: "100%", borderRadius: "1px",
    backgroundColor: "color-mix(in srgb, var(--color-feedback-danger-fg, #f87171) 50%, transparent)",
  },

  /* churn heatmap gutter */
  ".cm-churn-gutter .cm-gutterElement": {
    width: "3px", padding: "0", minWidth: "3px",
  },
  ".cm-churn-marker": {
    display: "block", width: "3px", height: "100%", borderRadius: "1px",
  },

  /* dead code line dimming */
  ".cm-dead-line": {
    opacity: "0.35",
    textDecoration: "line-through",
    textDecorationColor: "var(--ink-4)",
  },

  /* inline hints */
  ".cm-inline-hint": {
    fontFamily: "var(--font-ui)", fontSize: "0.62rem", fontWeight: "400",
    color: "var(--ink-4)", marginLeft: "12px", whiteSpace: "nowrap",
    letterSpacing: "0.01em",
  },
  ".cm-inline-hint-sep": { margin: "0 5px", opacity: "0.4" },
  ".cm-inline-label": {
    fontFamily: "var(--font-ui)", fontSize: "0.62rem", fontWeight: "400",
    marginLeft: "8px", padding: "0 5px", borderRadius: "3px", whiteSpace: "nowrap",
  },
  ".cm-inline-label-normal": {
    color: "var(--token-fn)",
    backgroundColor: "color-mix(in srgb, var(--token-fn) 12%, transparent)",
  },
  ".cm-inline-label-warn": {
    color: "var(--token-str)",
    backgroundColor: "color-mix(in srgb, var(--token-str) 14%, transparent)",
  },
  ".cm-inline-overlay": {
    position: "sticky",
    right: "0",
    float: "right",
    paddingRight: "12px",
    paddingLeft: "32px",
    background: "linear-gradient(to right, transparent, var(--paper) 24px)",
  },
}, { dark: true });
