import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import type { FunctionHeader } from "@quanta/app-ide/entities/function";
import { RISK_NOTABLE } from "@quanta/app-ide/entities/risk";
import {
  CM_LINE_PAD_PX,
  createChip,
  createRisk,
  signature,
  taintChipKind,
  tone,
} from "@quanta/app-ide/features/editor-chip-bar";

function isNotable(h: FunctionHeader): boolean {
  if (h.dead) return true;
  if (h.taint) return true;
  if (h.god) return true;
  if (h.flaky) return true;
  if (h.propertyGap) return true;
  if (h.mutationScore != null && h.mutationScore < 50) return true;
  if (h.riskScore >= RISK_NOTABLE) return true;
  if (h.blast >= 10) return true;
  if (h.complexity >= 7) return true;
  if (h.tests.startsWith("0/") && h.tests !== "0/0") return true;
  return false;
}

class FnHeaderWidget extends WidgetType {
  /** Cached signature — `eq()` is hot during reconciliation; recomputing
   * the 13-field join on every call is wasteful. */
  private readonly _sig: string;

  constructor(readonly h: FunctionHeader, readonly indent: number) {
    super();
    this._sig = signature(
      h.line, h.name, h.kind, indent,
      h.blast, h.blastCritical, h.complexity, h.bigO,
      h.tests, h.taint, h.dead, h.riskScore, h.budgetPct,
      h.god, h.mutationScore, h.propertyGap, h.flaky,
    );
  }

  override eq(other: WidgetType): boolean {
    return other instanceof FnHeaderWidget && other._sig === this._sig;
  }

  override toDOM(): HTMLElement {
    // Outer wrapper owns vertical spacing via padding so CodeMirror's
    // offsetHeight measurement matches the rendered footprint.
    // Wrapper also owns horizontal indent: CM_LINE_PAD_PX mirrors
    // `.cm-line` left padding (theme), and `${indent}ch` matches the
    // line's leading whitespace — chip bar lands directly above the
    // def's first char.
    const wrap = document.createElement("div");
    wrap.className = "cm-chip-bar-wrap";
    wrap.setAttribute("role", "presentation");
    // `1ch` resolves against the wrapper's own font. Force the mono font
    // here so the indent matches the editor's monospace columns exactly
    // (sans-serif `ch` would drift ~1-2px per indent level).
    wrap.style.fontFamily = "'JetBrains Mono', ui-monospace, monospace";
    wrap.style.paddingLeft = `calc(${CM_LINE_PAD_PX}px + ${this.indent}ch)`;

    const el = document.createElement("div");
    el.className = `cm-chip-bar cm-chip-bar--${tone(this.h.riskScore)}`;
    el.setAttribute("role", "group");
    el.setAttribute(
      "aria-label",
      `${this.h.name} (${this.h.kind}) risk summary, risk score ${this.h.riskScore}`,
    );

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
        kind: taintChipKind(this.h.taint),
      }));
    }

    if (this.h.dead) {
      // Label-only chip — omit `ico` so we get
      // `<span class="cm-chip-bar__chip is-muted">dead</span>` (pre-refactor shape).
      chips.push(createChip({ value: "dead", kind: "muted" }));
    }

    // ── Code-quality signals ──
    if (this.h.god) {
      chips.push(createChip({ value: "god", kind: "bad" }));
    }

    // ── Test-quality signals ──
    if (this.h.mutationScore != null) {
      chips.push(createChip({
        ico: "mut",
        value: `${this.h.mutationScore}%`,
        kind: this.h.mutationScore < 50 ? "bad"
            : this.h.mutationScore < 75 ? "warn" : "default",
      }));
    }

    if (this.h.propertyGap) {
      chips.push(createChip({ value: "prop", kind: "muted" }));
    }

    if (this.h.flaky) {
      chips.push(createChip({ value: "flaky", kind: "warn" }));
    }

    // Risk pill carries the `cm-chip-bar__risk` class (its own padding/
    // border-radius/hover bg in editor.css). Pass `"risk"` to keep the
    // small "risk" label that fn-header has historically shown.
    chips.push(createRisk(this.h.riskScore, "risk"));

    for (const c of chips) el.appendChild(c);
    wrap.appendChild(el);
    return wrap;
  }

  override get estimatedHeight(): number {
    return 30;
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

function buildFnHeaderDecos(state: EditorState, headers: FunctionHeader[]): DecorationSet {
  const notable = headers.filter(isNotable);
  const byLine = new Map<number, FunctionHeader>();
  for (const h of notable) byLine.set(h.line, h);
  const sortedLines = [...byLine.keys()].sort((a, b) => a - b);

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
}

/**
 * Dispatch with `view.dispatch({ effects: setFnHeaderFacts.of(newHeaders) })`
 * to swap the chip bars for all notable functions without recreating the
 * editor. The widget's signature-based `eq()` reuses unchanged DOM, so a
 * dispatch with an identical-content array is effectively a no-op.
 */
export const setFnHeaderFacts = StateEffect.define<FunctionHeader[]>();

export function fnHeaders(initial: FunctionHeader[]) {
  return StateField.define<DecorationSet>({
    create(state) {
      return buildFnHeaderDecos(state, initial);
    },
    update(deco, tr) {
      for (const e of tr.effects) {
        if (e.is(setFnHeaderFacts)) return buildFnHeaderDecos(tr.state, e.value);
      }
      return tr.docChanged ? deco.map(tr.changes) : deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
}
