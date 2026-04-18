// Single source of truth alignment between gutter glyphs and the
// right-side risk minimap.
//
// Contract (industry SOTA, mirrors VSCode/IntelliJ):
//   • `gutter[]` is the inline diagnostic source — every line with a
//     concrete anti-pattern marker. Each entry maps deterministically
//     to a minimap point at the same line.
//   • `extras[]` (FileFacts.minimap) is auxiliary — bars representing
//     hot-spots WITHOUT a specific glyph (e.g. high-blast classes,
//     cpx clusters), used to give the user a sense of overall density.
//   • The minimap rendered to the user is the *union* of both, sorted
//     by line. Same-line collisions render the higher severity.

import type { GutterMark } from "@quanta/app-ide/entities/gutter";
import type { RiskPoint } from "@quanta/app-ide/entities/risk";
import { GLYPH_META } from "@quanta/app-ide/features/editor-gutter-marks";
import type { GlyphMeta } from "@quanta/app-ide/features/editor-gutter-marks";

/** Glyph category → minimap colour bucket. */
const CATEGORY_TO_KIND: Record<GlyphMeta["category"], RiskPoint["kind"]> = {
  taint: "taint",
  arch: "arch",
  ownership: "arch",     // god/silo → structural integrity
  behavior: "typestate", // typestate/flaky → behavioural runtime
  incident: "taint",     // incident matches travel with the data path
  health: "dead",
};

/** Glyph severity → minimap bar weight. */
const SEVERITY_TO_NUM: Record<GlyphMeta["severity"], RiskPoint["severity"]> = {
  info: 1,
  warn: 3,
  danger: 4,
};

export function gutterToRiskPoint(g: GutterMark): RiskPoint {
  const meta = GLYPH_META[g.glyph];
  return {
    line: g.line,
    kind: CATEGORY_TO_KIND[meta.category],
    severity: SEVERITY_TO_NUM[meta.severity],
  };
}

/**
 * Project every gutter glyph onto the minimap, then layer auxiliary
 * hot-spot markers on top.
 *
 * Dedupe key: `(line, kind)` — a single line can carry multiple kinds
 * (e.g. line 484 = god/arch + blast hub), each rendering as its own
 * minimap dot. Same `(line, kind)` pair keeps the higher severity.
 *
 * Output is sorted by line ascending, then by kind alphabetically so
 * multi-kind lines render in a stable visual order across re-renders.
 */
export function deriveMinimap(
  gutter: GutterMark[],
  extras: RiskPoint[] = [],
): RiskPoint[] {
  const merged = [...gutter.map(gutterToRiskPoint), ...extras];

  const byKey = new Map<string, RiskPoint>();
  for (const p of merged) {
    const key = `${p.line}\u001f${p.kind}`;
    const cur = byKey.get(key);
    if (!cur || p.severity > cur.severity) byKey.set(key, p);
  }

  return [...byKey.values()].sort((a, b) =>
    a.line !== b.line ? a.line - b.line : a.kind.localeCompare(b.kind),
  );
}
