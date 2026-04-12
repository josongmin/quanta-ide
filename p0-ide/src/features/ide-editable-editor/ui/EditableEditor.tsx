import { useCallback, useEffect, useRef } from "react";
import { EditorState, StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { EditorView, lineNumbers, keymap, Decoration, type DecorationSet, GutterMarker, gutter, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useEditorHover } from "@/features/ide-editor-hover";
import type { SymbolInfo } from "@/features/ide-editor-hover";
import type { LineMeta } from "@/app/ide/mock-source";
import { SYMBOL_INFO } from "@/app/ide/mock-source";

/* ═══════════════════════════════════════════════════════════════════════
   1. Syntax highlighting — matches IDE design tokens
   ═══════════════════════════════════════════════════════════════════════ */
const ideHighlight = HighlightStyle.define([
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
  { tag: tags.comment,            color: "var(--ink-4)", fontStyle: "italic" },
  { tag: tags.operator,           color: "var(--ink-2)" },
  { tag: tags.punctuation,        color: "var(--ink-3)" },
  { tag: tags.variableName,       color: "var(--ink)" },
  { tag: tags.self,               color: "var(--token-kw)" },
  { tag: tags.typeName,           color: "var(--token-fn)" },
  { tag: tags.propertyName,       color: "var(--ink)" },
  { tag: tags.meta,               color: "var(--token-str)" },
]);

/* ═══════════════════════════════════════════════════════════════════════
   2. Dark theme matching IDE
   ═══════════════════════════════════════════════════════════════════════ */
const ideTheme = EditorView.theme({
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
    backgroundColor: "transparent",
    borderRight: "1px solid var(--line)",
    color: "var(--ink-4)",
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
    float: "right",
    paddingRight: "12px",
  },
}, { dark: true });

/* ═══════════════════════════════════════════════════════════════════════
   3. Risk gutter extension
   ═══════════════════════════════════════════════════════════════════════ */
class RiskMarker extends GutterMarker {
  risk: 1 | 2 | 3 | 4;
  constructor(risk: 1 | 2 | 3 | 4) { super(); this.risk = risk; }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = `cm-risk-marker cm-risk-${this.risk}`;
    return el;
  }
}

const setLineMeta = StateEffect.define<Record<number, LineMeta>>();

const lineMetaField = StateField.define<Record<number, LineMeta>>({
  create: () => ({}),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setLineMeta)) return e.value;
    }
    return value;
  },
});

const riskGutter = gutter({
  class: "cm-risk-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.risk) return new RiskMarker(m.risk);
    return null;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   3b. Coverage gap gutter — red marker for uncovered lines
   ═══════════════════════════════════════════════════════════════════════ */
class CoverageMarker extends GutterMarker {
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-coverage-marker";
    return el;
  }
}
const coverageGutter = gutter({
  class: "cm-coverage-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.uncovered) return new CoverageMarker();
    return null;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   3c. Churn heatmap gutter — intensity-based accent bar
   ═══════════════════════════════════════════════════════════════════════ */
class ChurnMarker extends GutterMarker {
  intensity: number;
  constructor(intensity: number) { super(); this.intensity = intensity; }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-churn-marker";
    const alpha = Math.round(this.intensity * 45);
    el.style.backgroundColor = `color-mix(in srgb, var(--accent) ${alpha.toString()}%, transparent)`;
    return el;
  }
}
const churnGutter = gutter({
  class: "cm-churn-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.churn !== undefined && m.churn > 0) return new ChurnMarker(m.churn);
    return null;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   3d. Dead code line decoration — dims entire line + strikethrough
   ═══════════════════════════════════════════════════════════════════════ */
const deadLineDeco = Decoration.line({ class: "cm-dead-line" });

function buildDeadDecorations(view: EditorView): DecorationSet {
  const meta = view.state.field(lineMetaField);
  const builder = new RangeSetBuilder<Decoration>();
  for (let i = 1; i <= view.state.doc.lines; i++) {
    const m = meta[i] as LineMeta | undefined;
    if (m?.dead) {
      const line = view.state.doc.line(i);
      builder.add(line.from, line.from, deadLineDeco);
    }
  }
  return builder.finish();
}

const deadLinesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = buildDeadDecorations(view); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.state.field(lineMetaField) !== update.startState.field(lineMetaField)) {
        this.decorations = buildDeadDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/* ═══════════════════════════════════════════════════════════════════════
   4. Inline hints decoration (line widgets after text)
   ═══════════════════════════════════════════════════════════════════════ */
function buildHintDecorations(view: EditorView): DecorationSet {
  const meta = view.state.field(lineMetaField);
  const builder = new RangeSetBuilder<Decoration>();

  for (let i = 1; i <= view.state.doc.lines; i++) {
    const m = meta[i] as LineMeta | undefined;
    if (!m) continue;
    const line = view.state.doc.line(i);

    const parts: string[] = [];

    // inline label (e.g. "impact root", "taint sink")
    if (m.inline) {
      parts.push(`<span class="cm-inline-label ${m.inlineWarn ? "cm-inline-label-warn" : "cm-inline-label-normal"}">${escHtml(m.inline)}</span>`);
    }

    // hint chips
    if (m.hints && m.hints.length > 0) {
      const hintHtml = m.hints.map((h) => escHtml(h)).join('<span class="cm-inline-hint-sep">·</span>');
      parts.push(`<span class="cm-inline-hint">${hintHtml}</span>`);
    }

    if (parts.length > 0) {
      const deco = Decoration.widget({
        widget: new InlineHintWidget(parts.join("")),
        side: 1,
      });
      builder.add(line.to, line.to, deco);
    }
  }

  return builder.finish();
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

class InlineHintWidget extends WidgetType {
  html: string;
  constructor(html: string) { super(); this.html = html; }
  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-inline-overlay";
    span.innerHTML = this.html;
    return span;
  }
  override eq(other: InlineHintWidget): boolean { return this.html === other.html; }
  override ignoreEvent(): boolean { return true; }
}

/* ═══════════════════════════════════════════════════════════════════════
   4b. Symbol hover extension — looks up SYMBOL_INFO and calls setSymbol
   ═══════════════════════════════════════════════════════════════════════ */
/** Extract the identifier at a given document position, looking at the whole line. */
function identifierAtPos(view: EditorView, pos: number): { from: number; to: number; text: string } | null {
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const col = pos - line.from;
  // Match all Python identifiers on the line and find the one containing col
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lineText)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (col >= start && col <= end) {
      return { from: line.from + start, to: line.from + end, text: m[0] };
    }
  }
  return null;
}

function createHoverExtension(
  setSymbol: (s: { info: SymbolInfo; x: number; y: number } | null) => void,
) {
  let lastWord = "";
  return EditorView.domEventHandlers({
    mousemove(event, view) {
      // use { bias: -1 } so edges still resolve to a valid pos
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }, false);
      if (pos < 0) {
        if (lastWord) { lastWord = ""; setSymbol(null); }
        return;
      }
      const ident = identifierAtPos(view, pos);
      if (!ident) {
        if (lastWord) { lastWord = ""; setSymbol(null); }
        return;
      }
      if (ident.text === lastWord) return;

      const info = SYMBOL_INFO[ident.text] as SymbolInfo | undefined;
      if (info) {
        lastWord = ident.text;
        const coords = view.coordsAtPos(ident.from);
        if (coords) {
          setSymbol({ info, x: coords.left, y: coords.top });
        }
      } else if (lastWord) {
        lastWord = "";
        setSymbol(null);
      }
    },
    mouseleave() {
      if (lastWord) { lastWord = ""; setSymbol(null); }
    },
  });
}

// Make it a proper WidgetType by extending via plugin
const inlineHintsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildHintDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.state.field(lineMetaField) !== update.startState.field(lineMetaField)) {
        this.decorations = buildHintDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

/* ═══════════════════════════════════════════════════════════════════════
   5. React component
   ═══════════════════════════════════════════════════════════════════════ */
interface EditableEditorProps {
  tabs: { name: string; active?: boolean }[];
  source: string;
  lineMeta?: Record<number, LineMeta>;
  onTabClick?: (name: string) => void;
  onTabClose?: (name: string) => void;
  onChange?: (code: string, changedLine: number) => void;
  impactBanner?: React.ReactNode;
  flowTraceBanner?: React.ReactNode;
}

function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  source: string,
  lineMeta: Record<number, LineMeta>,
  onChange?: (code: string, changedLine: number) => void,
) {
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setSymbol = useEditorHover((s) => s.setSymbol);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const newCode = update.state.doc.toString();
      let changedLine = 1;
      for (const tr of update.transactions) {
        tr.changes.iterChanges((_fromA, _toA, _fromB) => {
          changedLine = update.state.doc.lineAt(_fromB).number;
        });
      }
      if (onChangeRef.current) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          onChangeRef.current?.(newCode, changedLine);
        }, 400);
      }
    });

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        python(),
        syntaxHighlighting(ideHighlight),
        ideTheme,
        lineMetaField.init(() => lineMeta),
        riskGutter,
        coverageGutter,
        churnGutter,
        deadLinesPlugin,
        inlineHintsPlugin,
        createHoverExtension(setSymbol),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSymbol(null);
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // update lineMeta when it changes without remounting
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({ effects: setLineMeta.of(lineMeta) });
    }
  }, [lineMeta]);
}

export function EditableEditor({
  tabs,
  source,
  lineMeta = {},
  onTabClick,
  onTabClose,
  onChange,
  impactBanner,
  flowTraceBanner,
}: EditableEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  useCodeMirror(editorRef, source, lineMeta, onChange);

  const handleTabClose = useCallback((name: string) => {
    onTabClose?.(name);
  }, [onTabClose]);

  return (
    <main className="ide-editor">
      <div className="ide-editor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            type="button"
            className={`ide-editor-tab${tab.active ? " is-active" : ""}`}
            onClick={() => onTabClick?.(tab.name)}
          >
            <span>{tab.name}</span>
            {onTabClose && (
              <span
                className="ide-editor-tab-close"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleTabClose(tab.name); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTabClose(tab.name);
                  }
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      {flowTraceBanner}
      <div className="ide-editor-body editable-editor-body" ref={editorRef} />
      {impactBanner}
    </main>
  );
}
