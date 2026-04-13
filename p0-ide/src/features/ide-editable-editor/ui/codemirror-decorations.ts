import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate, WidgetType, type EditorView } from "@codemirror/view";
import type { LineMeta } from "@/app/ide/mock-source";
import { lineMetaField } from "./codemirror-gutters";

/* ═══════════════════════════════════════════════════════════════════════
   Dead code line decoration — dims entire line + strikethrough
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

export const deadLinesPlugin = ViewPlugin.fromClass(
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
   Inline hints decoration (line widgets after text)
   ═══════════════════════════════════════════════════════════════════════ */
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

export function buildHintDecorations(view: EditorView): DecorationSet {
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

export const inlineHintsPlugin = ViewPlugin.fromClass(
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
