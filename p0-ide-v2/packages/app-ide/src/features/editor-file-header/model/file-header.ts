import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  createChip,
  createMeta,
  createRisk,
  signature,
  tone,
} from "@quanta/app-ide/features/editor-chip-bar";

class FileHeaderWidget extends WidgetType {
  /** Cached signature — `eq()` is hot during reconciliation; recomputing
   * the 12-field join on every call is wasteful. */
  private readonly _sig: string;

  constructor(readonly file: FileFacts) {
    super();
    this._sig = signature(
      file.name,
      file.riskScore,
      file.blast,
      file.blastCritical,
      file.taintCount,
      file.cpxMax,
      file.cpxBudgetPct,
      file.archViolations,
      file.deadCount,
      file.incidents.length,
      file.owner,
      file.lastModified,
    );
  }

  override eq(other: WidgetType): boolean {
    return other instanceof FileHeaderWidget && other._sig === this._sig;
  }

  // XSS-safe DOM construction via the shared chip-bar primitives — no
  // innerHTML, so user-facing fields (owner, filename, …) flow through
  // textContent. The outer wrapper owns vertical spacing so its
  // offsetHeight matches what CodeMirror sees → gutter line numbers stay
  // aligned. The wrapper also owns the leftward gutter overhang via the
  // `cm-fnhead-wrap--file` modifier in CSS (no inline horizontal style
  // on the inner element).
  override toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-fnhead-wrap cm-fnhead-wrap--file";

    const el = document.createElement("div");
    el.className = `cm-fnhead cm-fnhead--${tone(this.file.riskScore)} cm-fnhead--file`;

    const chips: HTMLElement[] = [];

    chips.push(
      createChip({
        ico: "blast",
        value: this.file.blast,
        em: this.file.blastCritical > 0 ? `${this.file.blastCritical} crit` : undefined,
      }),
    );

    if (this.file.taintCount > 0) {
      chips.push(createChip({ ico: "taint", value: this.file.taintCount, kind: "bad" }));
    }

    chips.push(
      createChip({
        ico: "cpx",
        value: this.file.cpxMax,
        sub: `${this.file.cpxBudgetPct}%`,
        kind: this.file.cpxBudgetPct >= 80 ? "warn" : "default",
      }),
    );

    if (this.file.archViolations > 0) {
      chips.push(createChip({ ico: "arch", value: this.file.archViolations, kind: "bad" }));
    }

    if (this.file.deadCount > 0) {
      chips.push(createChip({ ico: "dead", value: this.file.deadCount, kind: "muted" }));
    }

    if (this.file.incidents.length > 0) {
      chips.push(createChip({ ico: "match", value: this.file.incidents.length, kind: "bad" }));
    }

    chips.push(createMeta(`${this.file.owner} · ${this.file.lastModified}`));
    chips.push(createRisk(this.file.riskScore));

    chips.forEach((c) => el.appendChild(c));
    wrap.appendChild(el);
    return wrap;
  }

  override get estimatedHeight(): number {
    return 40;
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
