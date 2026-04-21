// AnalyzePanel — SOTA redesign
// ---------------------------------------------------------------
// Entity preview card (with live metrics) + bento-grid of question
// cards grouped by category. Each question card carries a glyph,
// a short English tag, and a metric badge when the graph can
// answer the question at-a-glance ("12 callers", "47 blast").
//
// Categories:
//   관계 (Relations) — what uses/used by/blast
//   구조 (Structure) — coupling / cycles / layer violations
//   우선순위 (Priorities) — risk hotspots / refactor ROI
//
// Visual language:
//   soft gradient cards, per-category accent, staggered fade-in,
//   hover lift, glyph-first iconography. No emojis (카드 좌측 stripe
//   metaphor intentionally avoided — accent lives in glyph/dot).

import { useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { Entity, EntityTree, WorkspaceGraph } from "@quanta/canvas-engine";
import { color, font, kindIcon, kindLabel, radius, space, transition } from "../../../shared/ui/tokens";
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

  // Collect building descendants (or self if building)
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

  // Transitive blast (up to 3 hops of inbound fan-in)
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

// ── Question meta (decoration only; IDs still come from ./questions) ──

interface QMeta {
  id: QuestionId;
  glyph: string;
  tag: string;
  size: "sm" | "lg";
  metric?: keyof Metrics;
  metricUnit?: string;
}

interface CatDef {
  id: string;
  ko: string;
  en: string;
  accent: string;
  questions: readonly QMeta[];
}

const CATS: readonly CatDef[] = [
  {
    id: "relations",
    ko: "관계",
    en: "RELATIONS",
    accent: "#0d99ff",
    questions: [
      { id: "what-uses-this",     glyph: "←", tag: "Callers",  size: "sm", metric: "callers", metricUnit: "files" },
      { id: "what-does-this-use", glyph: "→", tag: "Callees",  size: "sm", metric: "callees", metricUnit: "files" },
      { id: "blast-radius",       glyph: "◈", tag: "Blast",    size: "lg", metric: "blast",   metricUnit: "reachable" },
    ],
  },
  {
    id: "structure",
    ko: "구조",
    en: "STRUCTURE",
    accent: "#e09321",
    questions: [
      { id: "package-coupling",    glyph: "⬡", tag: "Chord",  size: "sm" },
      { id: "cycles-here",         glyph: "⟳", tag: "Arc",    size: "sm" },
      { id: "what-layers-violate", glyph: "⊟", tag: "Layers", size: "lg" },
    ],
  },
  {
    id: "priorities",
    ko: "우선순위",
    en: "PRIORITIES",
    accent: "#9e77ff",
    questions: [
      { id: "risk-hotspots",      glyph: "◆", tag: "Quadrant", size: "sm" },
      { id: "refactor-priority",  glyph: "⚡", tag: "ROI",      size: "sm" },
    ],
  },
];

const QMAP = new Map(QUESTIONS.map(q => [q.id, q]));

// ── Risk palette ───────────────────────────────────────────────────────

function riskTone(r: number): { fg: string; bg: string; label: string } {
  if (r >= 70) return { fg: "#c42b30", bg: "rgba(229,72,77,0.10)", label: "high" };
  if (r >= 40) return { fg: "#a76a0e", bg: "rgba(224,147,33,0.10)", label: "med"  };
  return            { fg: "#1e7f50", bg: "rgba(34,160,107,0.10)",  label: "low"  };
}

function abbrevNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Styles ─────────────────────────────────────────────────────────────

const ROOT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[5],
  padding: `${space[2]}px ${space[4]}px ${space[4]}px`,
};

const SECTION_HEADER: CSSProperties = {
  display: "flex", alignItems: "baseline", gap: space[2],
  marginBottom: space[2],
};

const CAT_DOT_BASE: CSSProperties = {
  width: 8, height: 8, borderRadius: 999,
  flexShrink: 0,
  alignSelf: "center",
};

const CAT_KO: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const CAT_EN: CSSProperties = {
  fontSize: 9,
  fontWeight: font.weight.semibold,
  color: color.text3,
  letterSpacing: 0.15,
  textTransform: "uppercase",
};

const CAT_LINE: CSSProperties = {
  flex: 1, height: 1,
  background: `linear-gradient(90deg, ${color.border}, transparent)`,
};

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: space[2],
};

// Entity preview card — top of panel

const PREVIEW_CARD: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  borderRadius: radius.lg + 4,
  background: `linear-gradient(135deg, rgba(13,153,255,0.06) 0%, rgba(13,153,255,0.01) 100%)`,
  border: `1px solid ${color.border}`,
  position: "relative",
  overflow: "hidden",
};

const PREVIEW_TOP: CSSProperties = {
  display: "flex", alignItems: "center", gap: space[2],
};

const PREVIEW_GLYPH: CSSProperties = {
  width: 30, height: 30,
  display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 8,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  fontSize: 16,
  color: color.accent,
  flexShrink: 0,
  fontFamily: font.sans,
};

const PREVIEW_NAME: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const PREVIEW_KIND: CSSProperties = {
  fontSize: 9,
  fontWeight: font.weight.semibold,
  color: color.text3,
  letterSpacing: 0.2,
  textTransform: "uppercase",
  marginTop: 1,
};

const STAT_ROW: CSSProperties = {
  display: "flex",
  gap: space[3],
  flexWrap: "wrap",
};

const STAT: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  minWidth: 52,
};

const STAT_NUM: CSSProperties = {
  fontSize: font.size.xl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  fontFamily: font.mono,
  letterSpacing: -0.2,
  lineHeight: 1,
};

const STAT_LABEL: CSSProperties = {
  fontSize: 9,
  fontWeight: font.weight.medium,
  color: color.text2,
  letterSpacing: 0.15,
  textTransform: "uppercase",
};

// Question card

const CARD_BASE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: `${space[3]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg + 2,
  textAlign: "left",
  fontFamily: font.sans,
  cursor: "pointer",
  transition: `transform ${transition.fast}, box-shadow ${transition.fast}, border-color ${transition.fast}, background ${transition.fast}`,
  color: color.text0,
  position: "relative",
  overflow: "hidden",
};

const CARD_TOP_ROW: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: space[2],
};

const CARD_GLYPH_BASE: CSSProperties = {
  width: 26, height: 26,
  display: "flex", alignItems: "center", justifyContent: "center",
  borderRadius: 7,
  fontSize: 15,
  fontWeight: font.weight.semibold,
  flexShrink: 0,
  transition: transition.fast,
};

const CARD_TAG: CSSProperties = {
  fontSize: 8.5,
  fontWeight: font.weight.semibold,
  color: color.text3,
  letterSpacing: 0.2,
  textTransform: "uppercase",
  padding: "1px 5px",
  border: `1px solid ${color.border}`,
  borderRadius: 999,
  fontFamily: font.mono,
  flexShrink: 0,
};

const CARD_LABEL: CSSProperties = {
  fontSize: font.size.md + 1,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
  lineHeight: 1.25,
};

const CARD_HINT: CSSProperties = {
  fontSize: 10,
  fontWeight: font.weight.regular,
  color: color.text2,
  lineHeight: 1.35,
  letterSpacing: -0.01,
};

const CARD_METRIC_ROW: CSSProperties = {
  display: "flex", alignItems: "baseline", gap: 4,
  marginTop: space[1],
};

const CARD_METRIC_NUM: CSSProperties = {
  fontSize: font.size.lg,
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
  letterSpacing: -0.2,
  lineHeight: 1,
};

const CARD_METRIC_UNIT: CSSProperties = {
  fontSize: 9,
  fontWeight: font.weight.medium,
  color: color.text2,
  letterSpacing: 0.15,
  textTransform: "uppercase",
};

// ── Component ──────────────────────────────────────────────────────────

export function AnalyzePanel({ entity, tree, graph }: AnalyzePanelProps): ReactElement {
  const metrics = useMemo(() => computeMetrics(entity, tree, graph), [entity, tree, graph]);
  const [hovered, setHovered] = useState<QuestionId | null>(null);

  const risk = riskTone(metrics.risk);
  const breadcrumbPath = entity.path || entity.name;

  let cardIdx = 0;

  return (
    <section
      data-inspector-section="analyze"
      data-inspector-state="ready"
      style={ROOT}
    >
      {/* Entity preview card */}
      <div style={PREVIEW_CARD}>
        <div style={PREVIEW_TOP}>
          <div style={PREVIEW_GLYPH}>{kindIcon[entity.kind]}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={PREVIEW_NAME} title={entity.name}>{entity.name}</div>
            <div style={PREVIEW_KIND}>{kindLabel[entity.kind]}</div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            background: risk.bg,
            color: risk.fg,
            fontSize: 9,
            fontWeight: font.weight.semibold,
            letterSpacing: 0.15,
            textTransform: "uppercase",
            fontFamily: font.sans,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: risk.fg }} />
            risk {metrics.risk}
          </div>
        </div>
        <div style={STAT_ROW}>
          <Stat num={metrics.fileCount} label="files" />
          <Stat num={abbrevNum(metrics.loc)} label="LoC" />
          <Stat num={metrics.callers} label="callers" tone={color.accent} />
          <Stat num={metrics.callees} label="callees" tone="#22a06b" />
          <Stat num={metrics.internalEdges} label="internal" />
        </div>
        {entity.path ? (
          <div style={{
            fontSize: 10,
            fontFamily: font.mono,
            color: color.text2,
            letterSpacing: -0.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
            title={breadcrumbPath}
          >
            {breadcrumbPath}
          </div>
        ) : null}
      </div>

      {/* Category sections */}
      {CATS.map(cat => (
        <div key={cat.id} style={{ display: "flex", flexDirection: "column" }}>
          <div style={SECTION_HEADER}>
            <span style={{ ...CAT_DOT_BASE, background: cat.accent }} />
            <span style={CAT_KO}>{cat.ko}</span>
            <span style={CAT_EN}>{cat.en}</span>
            <span style={CAT_LINE} />
          </div>

          <div style={GRID}>
            {cat.questions.map((qmeta) => {
              const q = QMAP.get(qmeta.id);
              if (!q) return null;
              const applicable = isQuestionApplicable(q, entity.kind);
              const isHover    = hovered === qmeta.id;
              const metricVal  = qmeta.metric ? metrics[qmeta.metric] as number : undefined;
              const fadeDelay  = cardIdx * 30;
              cardIdx++;

              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={!applicable}
                  onClick={() => applyQuestion(q.id, entity, tree)}
                  onMouseEnter={() => applicable && setHovered(qmeta.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...CARD_BASE,
                    gridColumn: qmeta.size === "lg" ? "1 / -1" : "auto",
                    background: applicable && isHover
                      ? `linear-gradient(135deg, ${cat.accent}14 0%, ${cat.accent}04 100%)`
                      : color.bg1,
                    borderColor: applicable && isHover ? `${cat.accent}66` : color.border,
                    transform: applicable && isHover ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: applicable && isHover
                      ? `0 6px 16px ${cat.accent}22`
                      : "none",
                    opacity: applicable ? 1 : 0.4,
                    cursor: applicable ? "pointer" : "not-allowed",
                    animation: `analyze-card-in 320ms cubic-bezier(0.2, 0.8, 0.2, 1) ${fadeDelay}ms backwards`,
                  }}
                  data-question-id={q.id}
                  data-question-state={applicable ? "ready" : "not-applicable"}
                  title={applicable ? q.hint : `${q.hint} — not applicable to ${entity.kind}`}
                >
                  {/* Corner accent bar */}
                  <span style={{
                    position: "absolute",
                    top: 0, left: 0,
                    width: isHover && applicable ? 3 : 0,
                    height: "100%",
                    background: cat.accent,
                    transition: `width ${transition.fast}`,
                  }} />

                  <div style={CARD_TOP_ROW}>
                    <div style={{
                      ...CARD_GLYPH_BASE,
                      background: applicable && isHover ? cat.accent : `${cat.accent}18`,
                      color: applicable && isHover ? "#ffffff" : cat.accent,
                      border: `1px solid ${applicable && isHover ? cat.accent : `${cat.accent}33`}`,
                    }}>
                      {qmeta.glyph}
                    </div>
                    <span style={CARD_TAG}>{qmeta.tag}</span>
                  </div>

                  <div>
                    <div style={CARD_LABEL}>{q.label}</div>
                    <div style={{ ...CARD_HINT, marginTop: 2 }}>
                      {q.hint.split(" — ")[0]}
                    </div>
                  </div>

                  {metricVal !== undefined && metricVal > 0 && (
                    <div style={CARD_METRIC_ROW}>
                      <span style={{ ...CARD_METRIC_NUM, color: cat.accent }}>
                        {abbrevNum(metricVal)}
                      </span>
                      <span style={CARD_METRIC_UNIT}>{qmeta.metricUnit}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Keyframes for card entrance */}
      <style>{`
        @keyframes analyze-card-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

// ── Helper: stat pill ──────────────────────────────────────────────────

function Stat({ num, label, tone }: { num: number | string; label: string; tone?: string }): ReactElement {
  return (
    <div style={STAT}>
      <span style={{ ...STAT_NUM, color: tone ?? color.text0 }}>{num}</span>
      <span style={STAT_LABEL}>{label}</span>
    </div>
  );
}
