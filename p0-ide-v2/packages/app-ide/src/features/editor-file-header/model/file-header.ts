import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
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
    const drift = file.apiDrift;
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
      file.cycleCount,
      file.busFactor,
      file.godScore,
      drift?.added, drift?.removed, drift?.deprecated, drift?.bumpHint,
      file.llmSignals?.length,
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
  // `cm-chip-bar-wrap--file` modifier in CSS (no inline horizontal style
  // on the inner element).
  override toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-chip-bar-wrap cm-chip-bar-wrap--file";
    wrap.setAttribute("role", "presentation");

    const el = document.createElement("div");
    el.className = `cm-chip-bar cm-chip-bar--${tone(this.file.riskScore)} cm-chip-bar--file`;
    el.setAttribute("role", "group");
    el.setAttribute(
      "aria-label",
      `${this.file.name} risk summary, risk score ${this.file.riskScore}`,
    );

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

    // ── Structural integrity signals ──
    if (this.file.cycleCount && this.file.cycleCount > 0) {
      chips.push(createChip({ ico: "cycle", value: this.file.cycleCount, kind: "warn" }));
    }

    if (this.file.godScore != null && this.file.godScore >= 70) {
      chips.push(createChip({ ico: "god", value: this.file.godScore, kind: "bad" }));
    }

    // ── Knowledge / ownership signals ──
    if (this.file.busFactor === 1) {
      chips.push(createChip({ ico: "silo", value: "1", kind: "warn" }));
    }

    // ── API surface drift ──
    if (this.file.apiDrift) {
      const d = this.file.apiDrift;
      const summary = `+${d.added}/-${d.removed}`;
      const isMajor = d.bumpHint === "major";
      chips.push(createChip({
        ico: "api",
        value: summary,
        sub: d.bumpHint,
        kind: isMajor ? "bad" : "warn",
      }));
    }

    // ── LLM-specific risks (count) ──
    if (this.file.llmSignals && this.file.llmSignals.length > 0) {
      chips.push(createChip({
        ico: "llm",
        value: this.file.llmSignals.length,
        kind: "bad",
      }));
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

function buildFileHeaderDeco(file: FileFacts): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  b.add(
    0,
    0,
    Decoration.widget({ widget: new FileHeaderWidget(file), side: -1, block: true }),
  );
  return b.finish();
}

/**
 * Dispatch with `view.dispatch({ effects: setFileHeaderFacts.of(newFacts) })`
 * to swap the file-header chip bar contents without recreating the editor.
 * The widget's signature-based `eq()` will short-circuit when the rendered
 * fields haven't actually changed, so spurious dispatches are cheap.
 */
export const setFileHeaderFacts = StateEffect.define<FileFacts>();

export function fileHeader(initial: FileFacts) {
  return StateField.define<DecorationSet>({
    create(_state) {
      return buildFileHeaderDeco(initial);
    },
    update(deco, tr) {
      for (const e of tr.effects) {
        if (e.is(setFileHeaderFacts)) return buildFileHeaderDeco(e.value);
      }
      return tr.docChanged ? deco.map(tr.changes) : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
