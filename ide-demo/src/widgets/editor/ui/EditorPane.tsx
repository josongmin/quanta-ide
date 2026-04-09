import { useEffect, useRef } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, keymap, gutter, GutterMarker } from "@codemirror/view";
import { EditorState, type Extension, RangeSetBuilder, StateField } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, HighlightStyle, foldGutter, bracketMatching } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { tags } from "@lezer/highlight";
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { useEditorStore } from "@/app/stores/useEditorStore";
import { useAnalysisStore } from "@/app/stores/useAnalysisStore";
import { SAMPLE_FILES } from "@/entities/code/model/sampleCode";
import { LINE_ANNOTATIONS, FUNCTION_META } from "@/entities/code/model/analysisData";
import { useContextMenu, FUNCTION_MENU, IMPORT_MENU } from "@/features/context-menu/ui/ContextMenu";
import { useHoverCard } from "@/features/hover-card/ui/HoverCard";
import { TabBar } from "@/widgets/editor/ui/TabBar";

/**
 * ── p0 Dark Theme ──
 *
 * Perceptual principles applied:
 * - Background luminance: 6-8% (reduces eye strain for long sessions)
 * - Line height 1.7x font size (optimal reading rhythm per Bringhurst)
 * - Cursor: high-contrast blue on dark = instant position recognition
 * - Active line: barely visible (2% white) — not distracting but orientation-preserving
 * - Gutter: same bg as editor (Gestalt figure-ground: code is figure, gutter is ground)
 */
const p0Theme = EditorView.theme({
  "&": {
    backgroundColor: "#111116",
    color: "#e4e4e7",
    fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  ".cm-content": { caretColor: "#a78bfa", lineHeight: "22px", padding: "14px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#a78bfa", borderLeftWidth: "1.5px" },
  ".cm-activeLine": { backgroundColor: "rgba(167,139,250,0.04)" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(167,139,250,0.15) !important" },
  ".cm-gutters": { backgroundColor: "#111116", color: "#282840", border: "none", minWidth: "52px" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#71717a" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px", minWidth: "36px", fontSize: "11px" },
  ".cm-foldGutter": { width: "14px" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(167,139,250,0.15)" },
  ".cm-matchingBracket": { backgroundColor: "rgba(167,139,250,0.1)", outline: "1px solid rgba(167,139,250,0.25)" },
  ".cm-searchMatch": { backgroundColor: "rgba(232,185,49,0.15)", outline: "1px solid rgba(232,185,49,0.25)" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-anno": { fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", opacity: "0.65", marginLeft: "20px", letterSpacing: "0.2px" },
  ".cm-anno-critical": { color: "#FF4455" },
  ".cm-anno-warning": { color: "#F0913A" },
  ".cm-anno-info": { color: "#3E3E52" },
  ".cm-codelens": { fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "rgba(167,139,250,0.35)", padding: "3px 0 1px 52px", lineHeight: "18px", letterSpacing: "0.3px" },
  ".cm-heat-high": { backgroundColor: "rgba(255, 68, 85, 0.03)" },
  ".cm-heat-med": { backgroundColor: "rgba(240, 145, 58, 0.02)" },
}, { dark: true });

/**
 * Syntax highlighting — perceptual color coding:
 * - Keywords: purple (mnemonic: "structure" = cool tone)
 * - Strings: green (mnemonic: "data" = natural tone)
 * - Functions: blue (mnemonic: "action" = active tone)
 * - Types: warm yellow (mnemonic: "classification" = warm neutral)
 * - Comments: very low contrast (ground, not figure)
 *
 * Max 6 distinct hues (Miller's Law for color categories)
 */
const p0Highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#C792EA" },
  { tag: tags.string, color: "#C3E88D" },
  { tag: tags.number, color: "#F78C6C" },
  { tag: tags.bool, color: "#F78C6C" },
  { tag: tags.comment, color: "#3D3D50", fontStyle: "italic" },
  { tag: tags.function(tags.variableName), color: "#82AAFF" },
  { tag: tags.definition(tags.variableName), color: "#E4E4EC" },
  { tag: tags.typeName, color: "#FFCB6B" },
  { tag: tags.propertyName, color: "#B8B8CC" },
  { tag: tags.operator, color: "#89DDFF" },
  { tag: tags.punctuation, color: "#505068" },
  { tag: tags.variableName, color: "#E4E4EC" },
  { tag: tags.className, color: "#FFCB6B" },
  { tag: tags.constant(tags.variableName), color: "#F78C6C" },
  { tag: tags.tagName, color: "#FF5370" },
]);

/* ── Annotation widget (end-of-line) ── */
class AnnoWidget extends WidgetType {
  constructor(private label: string, private severity: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.className = `cm-anno cm-anno-${this.severity}`;
    span.textContent = `  // ${this.label}`;
    return span;
  }
}

/* ── CodeLens widget (above line) ── */
class CodeLensWidget extends WidgetType {
  constructor(private text: string) { super(); }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-codelens";
    div.textContent = this.text;
    return div;
  }
}

/* ── Gutter markers ── */
class DotMarker extends GutterMarker {
  constructor(private color: string) { super(); }
  toDOM() {
    const el = document.createElement("span");
    el.style.cssText = `display:inline-block;width:6px;height:6px;border-radius:50%;background:${this.color};margin:8px 4px;`;
    return el;
  }
}

const taintDot = new DotMarker("#FF4444");
const unsafeDot = new DotMarker("#FF8844");
const deadDot = new DotMarker("#555566");

function buildAnnotationGutter(filePath: string) {
  const annotations = LINE_ANNOTATIONS[filePath] ?? [];
  return gutter({
    class: "cm-p0-gutter",
    lineMarker: (_view, line) => {
      const lineNum = _view.state.doc.lineAt(line.from).number;
      const a = annotations.find((x) => x.line === lineNum);
      if (!a) return null;
      if (a.type === "taint-source" || a.type === "taint-sink") return taintDot;
      if (a.type === "unsafe-write") return unsafeDot;
      if (a.type === "dead-code") return deadDot;
      return null;
    },
    initialSpacer: () => taintDot,
  });
}

/* ── CodeLens (block widgets) — must use StateField ── */
function buildCodeLens(filePath: string) {
  const functions = FUNCTION_META[filePath] ?? [];

  return StateField.define<DecorationSet>({
    create(state) {
      const decos: { from: number; deco: Decoration }[] = [];
      for (const fn of functions) {
        if (fn.startLine <= state.doc.lines) {
          const line = state.doc.line(fn.startLine);
          const text = [
            `⚡ ${fn.complexity.toFixed(1)}`,
            fn.tested ? "✓ tested" : "💀 no tests",
            fn.hotspot ? "🔥 hotspot" : null,
            `📍 blast: ${fn.blastRadius}`,
          ].filter(Boolean).join("   ");
          decos.push({ from: line.from, deco: Decoration.widget({ widget: new CodeLensWidget(text), block: true, side: -1 }) });
        }
      }
      decos.sort((a, b) => a.from - b.from);
      const builder = new RangeSetBuilder<Decoration>();
      for (const d of decos) builder.add(d.from, d.from, d.deco);
      return builder.finish();
    },
    update(decos, tr) {
      return tr.docChanged ? decos.map(tr.changes) : decos;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}

/* ── Inline annotations + heat (non-block) — ViewPlugin is fine ── */
function buildInlineDecorations(filePath: string) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView): DecorationSet {
      const annotations = LINE_ANNOTATIONS[filePath] ?? [];
      const functions = FUNCTION_META[filePath] ?? [];
      const doc = view.state.doc;
      const decos: { from: number; to: number; deco: Decoration; sortKey: number }[] = [];

      // Background heat (line decoration)
      for (const fn of functions) {
        if (!fn.tested || fn.complexity > 6) {
          const cls = fn.complexity > 7 ? "cm-heat-high" : "cm-heat-med";
          for (let i = fn.startLine; i <= Math.min(fn.endLine, doc.lines); i++) {
            const line = doc.line(i);
            decos.push({ from: line.from, to: line.from, deco: Decoration.line({ class: cls }), sortKey: 0 });
          }
        }
      }

      // Inline annotations (widget at end of line)
      for (const a of annotations) {
        if (a.line <= doc.lines) {
          const line = doc.line(a.line);
          decos.push({ from: line.to, to: line.to, deco: Decoration.widget({ widget: new AnnoWidget(a.label, a.severity), side: 1 }), sortKey: 1 });
        }
      }

      decos.sort((a, b) => a.from - b.from || a.sortKey - b.sortKey);
      const builder = new RangeSetBuilder<Decoration>();
      for (const d of decos) builder.add(d.from, d.to, d.deco);
      return builder.finish();
    }
  }, { decorations: (v) => v.decorations });
}

/* ── Cursor line tracker ── */
function cursorTracker(onLine: (n: number) => void) {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (update.selectionSet) {
      const pos = update.state.selection.main.head;
      const line = update.state.doc.lineAt(pos).number;
      onLine(line);
    }
  });
}

/* ── Context menu handler ── */
function contextMenuHandler(filePath: string) {
  return EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      event.preventDefault();
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return;
      const lineNum = view.state.doc.lineAt(pos).number;
      const annotations = LINE_ANNOTATIONS[filePath] ?? [];
      const anno = annotations.find((a) => a.line === lineNum);

      // Pick menu based on line content
      const lineText = view.state.doc.lineAt(pos).text;
      const isImport = lineText.trimStart().startsWith("import ");
      const menu = isImport ? IMPORT_MENU : FUNCTION_MENU;

      useContextMenu.getState().show(event.clientX, event.clientY, menu);
    },
  });
}

/* ── Hover handler ── */
function hoverHandler(filePath: string) {
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  const functions = FUNCTION_META[filePath] ?? [];

  return EditorView.domEventHandlers({
    mousemove: (event, view) => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) { useHoverCard.getState().hide(); return; }
        const lineNum = view.state.doc.lineAt(pos).number;
        const fn = functions.find((f) => lineNum >= f.startLine && lineNum <= f.endLine);
        const lineText = view.state.doc.lineAt(pos).text;
        const isImport = lineText.trimStart().startsWith("import ");

        if (fn) {
          useHoverCard.getState().show(event.clientX, event.clientY, {
            name: fn.name,
            type: "function",
            complexity: fn.complexity,
            callers: fn.callers,
            tested: fn.tested,
            taintSource: fn.taintPaths > 0,
            lastModified: "3 days ago · @kimdev",
          });
        } else if (isImport && lineText.includes("axios")) {
          useHoverCard.getState().show(event.clientX, event.clientY, {
            name: "axios",
            type: "import",
            bundleSize: "+42kb (gzip 14kb)",
            cve: "CVE-2025-30066 CRITICAL",
          });
        } else {
          useHoverCard.getState().hide();
        }
      }, 400);
    },
    mouseleave: () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      useHoverCard.getState().hide();
    },
  });
}

/* ── Edit change detection ── */
function editDetector() {
  let prevContent = "";
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.docChanged) return;
    const content = update.state.doc.toString();
    if (prevContent && content !== prevContent) {
      // Detect specific changes
      if (content.includes(">= 0") && prevContent.includes("> 0")) {
        useAnalysisStore.getState().simulateEdit("widen-condition");
      } else if (!content.includes("validateUser") && prevContent.includes("validateUser")) {
        useAnalysisStore.getState().simulateEdit("remove-validate");
      }
    }
    prevContent = content;
  });
}

/* ── Assemble extensions ── */
function buildExtensions(filePath: string, onCursorLine: (n: number) => void): Extension[] {
  return [
    p0Theme,
    syntaxHighlighting(p0Highlight),
    javascript({ typescript: true, jsx: true }),
    lineNumbers(),
    highlightActiveLine(),
    highlightSpecialChars(),
    drawSelection(),
    bracketMatching(),
    foldGutter(),
    history(),
    highlightSelectionMatches(),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    buildAnnotationGutter(filePath),
    buildCodeLens(filePath),
    buildInlineDecorations(filePath),
    cursorTracker(onCursorLine),
    contextMenuHandler(filePath),
    hoverHandler(filePath),
    editDetector(),
    EditorState.tabSize.of(2),
  ];
}

export function EditorPane() {
  const { activeFile, setCursorLine } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const file = SAMPLE_FILES[activeFile];

  useEffect(() => {
    if (!containerRef.current || !file) return;

    // Destroy previous
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: file.code,
      extensions: buildExtensions(activeFile, setCursorLine),
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [activeFile, file, setCursorLine]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-2 text-text-muted text-sm font-mono">
        Select a file to open
      </div>
    );
  }

  return (
    <div className="h-full relative flex flex-col">
      <TabBar />
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  );
}
