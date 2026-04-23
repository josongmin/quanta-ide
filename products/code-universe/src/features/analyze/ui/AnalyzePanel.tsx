// AnalyzePanel — editorial-minimal redesign
// ---------------------------------------------------------------
// Aligned with the Inspector's overall design language: uppercase
// section labels, hairline-divided stat cells, flat row lists. No
// preview card (the Inspector hero already names the entity), no
// per-category accent colors (monochrome + accent blue on hover),
// no bento grid with gradients.
//
// Layout:
//   ┌ STAT GRID ─────────────────────────────────────┐
//   │ files · LoC · callers · callees · internal · risk│
//   ├────────────────────────────────────────────────┤
//   │ 관계   Relations                               │
//   │   ← Callers                              12 FILES│
//   │   → Callees                               8 FILES│
//   │   ◈ Blast radius                          47 REACHABLE│
//   ├────────────────────────────────────────────────┤
//   │ 구조   Structure                               │
//   │   ⬡ Package coupling     Chord view             │
//   │   ⟳ Cycles here          Arc diagram            │
//   │   ⊟ Layer violations                             │
//   ├────────────────────────────────────────────────┤
//   │ 우선순위 Priorities                            │
//   │   ◆ Risk hotspots        Churn × Risk            │
//   │   ⚡ Refactor priority   ROI-ranked              │
//   └────────────────────────────────────────────────┘

import { useMemo, type CSSProperties, type ReactElement } from "react";
import type { Entity, EntityTree, WorkspaceGraph } from "@quanta/canvas-engine";
import { color, font, space, transition } from "../../../shared/ui/tokens";
import { QUESTIONS, applyQuestion, isQuestionApplicable, type QuestionId } from "../model/questions";

interface AnalyzePanelProps {
  entity: Entity;
  tree: EntityTree;
  graph?: WorkspaceGraph | null;
}

// ── Metrics ────────────────────────────────────────────────────────────

interface Metrics {
  callers: number;
  callees: number;
  blast: number;
  loc: number;
  risk: number;
  fileCount: number;
  internalEdges: number;
}

function computeMetrics(entity: Entity, tree: EntityTree, graph: WorkspaceGraph | null | undefined): Metrics {
  const empty: Metrics = { callers: 0, callees: 0, blast: 0, loc: 0, risk: 0, fileCount: 0, internalEdges: 0 };
  if (!graph) return empty;

  const relevant = new Set<string>();
  const walk = (id: string): void => {
    const e = tree.byId.get(id);
    if (!e) return;
    if (e.kind === "building") relevant.add(id);
    for (const cid of e.childIds) walk(cid);
  };
  walk(entity.id);
  if (relevant.size === 0) return empty;

  let callers = 0, callees = 0, internalEdges = 0;
  for (const edge of graph.fileEdges) {
    const fromIn = relevant.has(edge.from);
    const toIn   = relevant.has(edge.to);
    if (fromIn && toIn) internalEdges++;
    else if (fromIn) callees++;
    else if (toIn)   callers++;
  }

  const visited = new Set<string>(relevant);
  let frontier: string[] = [...relevant];
  for (let hop = 0; hop < 3 && frontier.length > 0; hop++) {
    const next: string[] = [];
    const frontierSet = new Set(frontier);
    for (const edge of graph.fileEdges) {
      if (frontierSet.has(edge.to) && !visited.has(edge.from)) {
        visited.add(edge.from);
        next.push(edge.from);
      }
    }
    frontier = next;
  }
  const blast = visited.size - relevant.size;

  const files = graph.files.filter(f => relevant.has(f.id));
  const loc  = files.reduce((s, f) => s + f.loc, 0);
  const risk = files.length > 0
    ? Math.round(files.reduce((s, f) => s + f.riskScore, 0) / files.length)
    : 0;

  return { callers, callees, blast, loc, risk, fileCount: files.length, internalEdges };
}

// ── Question meta (decoration; IDs still from ./questions) ────────────

interface QMeta {
  id: QuestionId;
  glyph: string;
  tag: string;
  metric?: keyof Metrics;
  metricUnit?: string;
}

interface CatDef {
  id: string;
  ko: string;
  en: string;
  questions: readonly QMeta[];
}

const CATS: readonly CatDef[] = [
  {
    id: "relations",
    ko: "관계",
    en: "Relations",
    questions: [
      { id: "what-uses-this",     glyph: "←", tag: "Callers / fan-in",     metric: "callers", metricUnit: "files" },
      { id: "what-does-this-use", glyph: "→", tag: "Callees / fan-out",    metric: "callees", metricUnit: "files" },
      { id: "blast-radius",       glyph: "◈", tag: "Blast radius",         metric: "blast",   metricUnit: "reachable" },
    ],
  },
  {
    id: "structure",
    ko: "구조",
    en: "Structure",
    questions: [
      { id: "package-coupling",    glyph: "⬡", tag: "Chord view" },
      { id: "cycles-here",         glyph: "⟳", tag: "Arc diagram" },
      { id: "what-layers-violate", glyph: "⊟", tag: "Layer dependencies" },
    ],
  },
  {
    id: "priorities",
    ko: "우선순위",
    en: "Priorities",
    questions: [
      { id: "risk-hotspots",      glyph: "◆", tag: "Churn × Risk 2×2" },
      { id: "refactor-priority",  glyph: "⚡", tag: "ROI-ranked refactor" },
    ],
  },
];

const QMAP = new Map(QUESTIONS.map(q => [q.id, q]));

function abbrevNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function riskColor(r: number): string {
  if (r >= 70) return color.danger;
  if (r >= 40) return color.warn;
  if (r > 0)   return color.success;
  return color.text2;
}

// ── Styles ─────────────────────────────────────────────────────────────

const ROOT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  borderBottom: `1px solid ${color.border}`,
};

// Stat grid — 3 cols × 2 rows, hairline dividers (same idiom as
// Inspector.Metrics / TopBadgeStrip). Two rows keep values readable
// at 320px panel width; grouping is size/health on top, edge counts
// on bottom. No card chrome.
const STAT_GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const STAT_CELL_BASE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
  padding: `${space[2]}px ${space[2]}px`,
};

const STAT_VAL: CSSProperties = {
  fontSize: font.size.xl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: font.letter.tight,
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const STAT_KEY: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// Question sub-section
const GROUP: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: `${space[3]}px ${space[4]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const GROUP_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[2],
  marginBottom: space[2],
  userSelect: "none",
};

const GROUP_KO: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  color: color.text1,
};

const GROUP_EN: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  color: color.text3,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
};

// Row button — flat hairline rows. Hover paints the bg (color.hover).
const ROW_BASE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `6px ${space[2]}px`,
  background: "transparent",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  transition: `background ${transition.fast}, color ${transition.fast}`,
  fontFamily: font.sans,
  color: color.text0,
};

const ROW_GLYPH: CSSProperties = {
  width: 16,
  height: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  color: color.text2,
  flexShrink: 0,
  lineHeight: 1,
  transition: `color ${transition.fast}`,
};

const ROW_BODY: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 1,
};

const ROW_TITLE: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.medium,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const ROW_HINT: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const ROW_METRIC_NUM: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: font.letter.tight,
  flexShrink: 0,
};

const ROW_METRIC_UNIT: CSSProperties = {
  fontSize: font.size.xxs,
  fontWeight: font.weight.medium,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  marginLeft: 3,
  flexShrink: 0,
};

// ── Component ──────────────────────────────────────────────────────────

export function AnalyzePanel({ entity, tree, graph }: AnalyzePanelProps): ReactElement {
  const metrics = useMemo(() => computeMetrics(entity, tree, graph), [entity, tree, graph]);

  return (
    <section
      data-inspector-section="analyze"
      data-inspector-state="ready"
      style={ROOT}
    >
      {/* Stat grid — 3 cols × 2 rows.
          Row 1: files · LoC · risk   (size + health)
          Row 2: callers · callees · internal  (edge counts) */}
      <div style={STAT_GRID}>
        <StatCell num={metrics.fileCount}        label="files"    pos="tl" />
        <StatCell num={abbrevNum(metrics.loc)}   label="LoC"      pos="tc" />
        <StatCell num={metrics.risk}             label="risk"     pos="tr" tone={riskColor(metrics.risk)} />
        <StatCell num={metrics.callers}          label="callers"  pos="bl" tone={metrics.callers > 0 ? color.accent : undefined} />
        <StatCell num={metrics.callees}          label="callees"  pos="bc" tone={metrics.callees > 0 ? color.success : undefined} />
        <StatCell num={metrics.internalEdges}    label="internal" pos="br" />
      </div>

      {/* Question groups */}
      {CATS.map((cat, catIdx) => {
        const isLast = catIdx === CATS.length - 1;
        return (
          <div
            key={cat.id}
            style={{ ...GROUP, borderBottom: isLast ? "none" : `1px solid ${color.border}` }}
          >
            <div style={GROUP_HEADER}>
              <span style={GROUP_KO}>{cat.ko}</span>
              <span style={GROUP_EN}>{cat.en}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {cat.questions.map(qmeta => {
                const q = QMAP.get(qmeta.id);
                if (!q) return null;
                const applicable = isQuestionApplicable(q, entity.kind);
                const metricVal = qmeta.metric ? (metrics[qmeta.metric] as number) : undefined;
                const showMetric = metricVal !== undefined && metricVal > 0;

                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={!applicable}
                    onClick={() => applyQuestion(q.id, entity, tree)}
                    onMouseEnter={e => {
                      if (!applicable) return;
                      e.currentTarget.style.background = color.hover;
                      const g = e.currentTarget.querySelector("[data-row-glyph]") as HTMLElement | null;
                      if (g) g.style.color = color.accent;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                      const g = e.currentTarget.querySelector("[data-row-glyph]") as HTMLElement | null;
                      if (g) g.style.color = color.text2;
                    }}
                    style={{
                      ...ROW_BASE,
                      opacity: applicable ? 1 : 0.45,
                      cursor: applicable ? "pointer" : "not-allowed",
                    }}
                    data-question-id={q.id}
                    data-question-state={applicable ? "ready" : "not-applicable"}
                    title={applicable ? q.hint : `${q.hint} — not applicable to ${entity.kind}`}
                  >
                    <span data-row-glyph style={ROW_GLYPH}>{qmeta.glyph}</span>
                    <span style={ROW_BODY}>
                      <span style={ROW_TITLE}>{q.label}</span>
                      <span style={ROW_HINT}>{qmeta.tag}</span>
                    </span>
                    {showMetric ? (
                      <span style={{ display: "inline-flex", alignItems: "baseline", flexShrink: 0 }}>
                        <span style={ROW_METRIC_NUM}>{abbrevNum(metricVal!)}</span>
                        {qmeta.metricUnit ? <span style={ROW_METRIC_UNIT}>{qmeta.metricUnit}</span> : null}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ── Helper: stat cell ──────────────────────────────────────────────────

// Position in the 3×2 grid: t=top row, b=bottom row; l/c/r = left/center/right col.
type CellPos = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

function StatCell({
  num,
  label,
  pos,
  tone,
}: {
  num: number | string;
  label: string;
  pos: CellPos;
  tone?: string;
}): ReactElement {
  const isRight  = pos === "tr" || pos === "br";
  const isBottom = pos === "bl" || pos === "bc" || pos === "br";
  return (
    <div
      style={{
        ...STAT_CELL_BASE,
        borderRight:  isRight  ? "none" : `1px solid ${color.border}`,
        borderBottom: isBottom ? "none" : `1px solid ${color.border}`,
      }}
    >
      <span style={{ ...STAT_VAL, color: tone ?? color.text0 }}>{num}</span>
      <span style={STAT_KEY}>{label}</span>
    </div>
  );
}
