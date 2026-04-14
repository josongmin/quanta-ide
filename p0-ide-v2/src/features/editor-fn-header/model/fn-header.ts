import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { FunctionHeader } from "@/entities/function";

function isNotable(h: FunctionHeader): boolean {
  if (h.dead) return true;
  if (h.taint) return true;
  if (h.riskScore >= 50) return true;
  if (h.blast >= 10) return true;
  if (h.complexity >= 7) return true;
  if (h.tests.startsWith("0/") && h.tests !== "0/0") return true;
  return false;
}

class FnHeaderWidget extends WidgetType {
  constructor(readonly h: FunctionHeader, readonly indent: number) {
    super();
  }
  override eq(other: WidgetType): boolean {
    return other instanceof FnHeaderWidget
      && other.h.line === this.h.line
      && other.indent === this.indent;
  }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    const tone =
      this.h.riskScore >= 70 ? "high" :
      this.h.riskScore >= 40 ? "mid" : "low";
    el.className = `cm-fnhead cm-fnhead--${tone}`;
    el.style.marginLeft = `${this.indent}ch`;

    const chips: string[] = [];

    if (this.h.blast >= 10)
      chips.push(`<span class="cm-fnhead__chip"><span class="cm-fnhead__ico">blast</span>${this.h.blast}${
        this.h.blastCritical ? `<em>·${this.h.blastCritical} crit</em>` : ""
      }</span>`);

    if (this.h.complexity >= 5)
      chips.push(`<span class="cm-fnhead__chip${
        this.h.budgetPct && this.h.budgetPct >= 80 ? " is-warn" : ""
      }"><span class="cm-fnhead__ico">cpx</span>${this.h.complexity}${
        this.h.bigO ? `<span class="cm-fnhead__sub"> ${this.h.bigO}</span>` : ""
      }</span>`);

    if (this.h.tests.startsWith("0/") && this.h.tests !== "0/0")
      chips.push(`<span class="cm-fnhead__chip is-bad"><span class="cm-fnhead__ico">tests</span>${this.h.tests}</span>`);

    if (this.h.taint)
      chips.push(`<span class="cm-fnhead__chip cm-fnhead__chip--taint-${this.h.taint}"><span class="cm-fnhead__ico">taint</span>${this.h.taint}</span>`);

    if (this.h.dead)
      chips.push(`<span class="cm-fnhead__chip is-muted">dead</span>`);

    chips.push(`<span class="cm-fnhead__risk"><span class="cm-fnhead__ico">risk</span>${this.h.riskScore}</span>`);

    el.innerHTML = chips.join("");
    return el;
  }
  override get estimatedHeight(): number {
    return 18;
  }
}

function leadingSpaces(text: string): number {
  let i = 0;
  while (i < text.length && (text[i] === " " || text[i] === "\t")) {
    i += text[i] === "\t" ? 4 : 1;
  }
  return i;
}

export function fnHeaders(headers: FunctionHeader[]) {
  const notable = headers.filter(isNotable);
  const byLine = new Map<number, FunctionHeader>();
  for (const h of notable) byLine.set(h.line, h);
  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);

  return StateField.define<DecorationSet>({
    create(state) {
      const b = new RangeSetBuilder<Decoration>();
      const doc = state.doc;
      for (const line of sortedLines) {
        if (line < 1 || line > doc.lines) continue;
        const lineObj = doc.line(line);
        const indent = leadingSpaces(lineObj.text);
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
