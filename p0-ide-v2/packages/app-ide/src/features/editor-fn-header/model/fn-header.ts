import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { FunctionHeader } from "@quanta/app-ide/entities/function";
import {
  CM_LINE_PAD_PX,
  createChip,
  signature,
  tone,
} from "@quanta/app-ide/features/editor-chip-bar";
import type { ChipKind } from "@quanta/app-ide/features/editor-chip-bar";

function isNotable(h: FunctionHeader): boolean {
  if (h.dead) return true;
  if (h.taint) return true;
  if (h.riskScore >= 50) return true;
  if (h.blast >= 10) return true;
  if (h.complexity >= 7) return true;
  if (h.tests.startsWith("0/") && h.tests !== "0/0") return true;
  return false;
}

function taintKind(t: FunctionHeader["taint"]): ChipKind {
  switch (t) {
    case "source": return "taint-source";
    case "sink": return "taint-sink";
    case "passthrough": return "taint-passthrough";
    default: return "default";
  }
}

class FnHeaderWidget extends WidgetType {
  constructor(readonly h: FunctionHeader, readonly indent: number) {
    super();
  }
  private get sig(): string {
    return signature(
      this.h.line, this.h.name, this.h.kind, this.indent,
      this.h.blast, this.h.blastCritical, this.h.complexity, this.h.bigO,
      this.h.tests, this.h.taint, this.h.dead, this.h.riskScore, this.h.budgetPct,
    );
  }
  override eq(other: WidgetType): boolean {
    return other instanceof FnHeaderWidget && other.sig === this.sig;
  }
  override toDOM(): HTMLElement {
    // Outer wrapper owns vertical spacing via padding so CodeMirror's
    // offsetHeight measurement matches the rendered footprint.
    // Wrapper also owns horizontal indent: CM_LINE_PAD_PX mirrors
    // `.cm-line` left padding (theme), and `${indent}ch` matches the
    // line's leading whitespace — chip bar lands directly above the
    // def's first char.
    const wrap = document.createElement("div");
    wrap.className = "cm-fnhead-wrap";
    wrap.style.paddingLeft = `calc(${CM_LINE_PAD_PX}px + ${this.indent}ch)`;

    const el = document.createElement("div");
    const t = tone(this.h.riskScore);
    el.className = `cm-fnhead cm-fnhead--${t}`;

    const chips: HTMLElement[] = [];

    if (this.h.blast >= 10) {
      chips.push(createChip({
        ico: "blast",
        value: this.h.blast,
        em: this.h.blastCritical ? `${this.h.blastCritical} crit` : undefined,
      }));
    }

    if (this.h.complexity >= 5) {
      chips.push(createChip({
        ico: "cpx",
        value: this.h.complexity,
        sub: this.h.bigO ?? undefined,
        kind: this.h.budgetPct && this.h.budgetPct >= 80 ? "warn" : "default",
      }));
    }

    if (this.h.tests.startsWith("0/") && this.h.tests !== "0/0") {
      chips.push(createChip({
        ico: "tests",
        value: this.h.tests,
        kind: "bad",
      }));
    }

    if (this.h.taint) {
      chips.push(createChip({
        ico: "taint",
        value: this.h.taint,
        kind: taintKind(this.h.taint),
      }));
    }

    if (this.h.dead) {
      chips.push(createChip({
        ico: "dead",
        value: "",
        kind: "muted",
      }));
    }

    chips.push(createChip({
      ico: "risk",
      value: this.h.riskScore,
    }));

    for (const c of chips) el.appendChild(c);
    wrap.appendChild(el);
    return wrap;
  }
  override get estimatedHeight(): number {
    return 26;
  }
}

/**
 * Compute the visual column width of a line's leading whitespace,
 * expanding tabs to the next tab stop. Stops at the first non-whitespace
 * character. Returns column count (used as `${indent}ch` in CSS).
 *
 * Example: leadingCols("\t  x", 4) === 6  // tab→4, two spaces→2
 */
function leadingCols(text: string, tabSize: number): number {
  let col = 0;
  for (let idx = 0; idx < text.length; idx++) {
    const ch = text[idx];
    if (ch === " ") col += 1;
    else if (ch === "\t") col += tabSize - (col % tabSize);
    else break;
  }
  return col;
}

export function fnHeaders(headers: FunctionHeader[]) {
  const notable = headers.filter(isNotable);
  const byLine = new Map<number, FunctionHeader>();
  for (const h of notable) byLine.set(h.line, h);
  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);

  return StateField.define<DecorationSet>({
    create(state: EditorState) {
      const b = new RangeSetBuilder<Decoration>();
      const doc = state.doc;
      const tab = state.tabSize;
      for (const line of sortedLines) {
        if (line < 1 || line > doc.lines) continue;
        const lineObj = doc.line(line);
        const indent = leadingCols(lineObj.text, tab);
        const h = byLine.get(line)!;
        b.add(
          lineObj.from,
          lineObj.from,
          Decoration.widget({ widget: new FnHeaderWidget(h, indent), side: -1, block: true }),
        );
      }
      return b.finish();
    },
    update(deco, tr) {
      return tr.docChanged ? deco.map(tr.changes) : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
