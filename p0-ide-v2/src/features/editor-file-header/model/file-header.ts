import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { FileFacts } from "@/entities/file";

class FileHeaderWidget extends WidgetType {
  constructor(readonly file: FileFacts) {
    super();
  }
  override eq(other: WidgetType): boolean {
    return other instanceof FileHeaderWidget && other.file.name === this.file.name;
  }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    const tone =
      this.file.riskScore >= 70 ? "high" :
      this.file.riskScore >= 40 ? "mid" : "low";
    el.className = `cm-fnhead cm-fnhead--${tone} cm-fnhead--file`;

    const chips: string[] = [];

    chips.push(`<span class="cm-fnhead__chip"><span class="cm-fnhead__ico">blast</span>${this.file.blast}${
      this.file.blastCritical > 0 ? `<em>·${this.file.blastCritical} crit</em>` : ""
    }</span>`);

    if (this.file.taintCount > 0)
      chips.push(`<span class="cm-fnhead__chip is-bad"><span class="cm-fnhead__ico">taint</span>${this.file.taintCount}</span>`);

    chips.push(`<span class="cm-fnhead__chip${
      this.file.cpxBudgetPct >= 80 ? " is-warn" : ""
    }"><span class="cm-fnhead__ico">cpx</span>${this.file.cpxMax}<span class="cm-fnhead__sub"> ${this.file.cpxBudgetPct}%</span></span>`);

    if (this.file.archViolations > 0)
      chips.push(`<span class="cm-fnhead__chip is-bad"><span class="cm-fnhead__ico">arch</span>${this.file.archViolations}</span>`);

    if (this.file.deadCount > 0)
      chips.push(`<span class="cm-fnhead__chip is-muted"><span class="cm-fnhead__ico">dead</span>${this.file.deadCount}</span>`);

    if (this.file.incidents.length > 0)
      chips.push(`<span class="cm-fnhead__chip is-bad"><span class="cm-fnhead__ico">match</span>${this.file.incidents.length}</span>`);

    chips.push(`<span class="cm-fnhead__meta">${this.file.owner} · ${this.file.lastModified}</span>`);
    chips.push(`<span class="cm-fnhead__risk">${this.file.riskScore}</span>`);

    el.innerHTML = chips.join("");
    return el;
  }
  override get estimatedHeight(): number {
    return 22;
  }
}

export function fileHeader(file: FileFacts) {
  return StateField.define<DecorationSet>({
    create(_state) {
      const b = new RangeSetBuilder<Decoration>();
      b.add(
        0,
        0,
        Decoration.widget({ widget: new FileHeaderWidget(file), side: -1, block: true }),
      );
      return b.finish();
    },
    update(deco, tr) {
      return tr.docChanged ? deco.map(tr.changes) : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
