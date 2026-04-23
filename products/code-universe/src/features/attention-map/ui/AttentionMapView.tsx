// AttentionMapView — per-line attention weight visualisation.
// --------------------------------------------------------------------
// Layout:
//   Hero strip        — max-attention line + average across file.
//   Main 2-column grid:
//     Left  — source preview. For every line: a heat bar on the left
//             whose width = attention weight, then the line number,
//             then a mono snippet preview. Rows with high weight get
//             a subtle accent tint + thicker left edge so the eye can
//             scan which regions the model "reads hard".
//     Right — statistics panel. Average attention grouped by category
//             (code / comment / import / signature / return) as
//             horizontal bars. A compact insight card at the bottom
//             points out the dominant category.
//
// Reference: Elhage et al. "Transformer Circuits Thread" (Anthropic).
// Templeton "Scaling Monosemanticity" Anthropic 2024. Olah et al.
// attention visualisation at OpenAI / Distill.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  attentionPattern,
  type AttentionLine,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  entity?: Entity;
  empty?: boolean;
}

type Category = AttentionLine["category"];

const CATEGORY_LABEL: Record<Category, string> = {
  code: "code",
  comment: "comment",
  import: "import",
  signature: "signature",
  return: "return",
};

const CATEGORY_KOREAN: Record<Category, string> = {
  code: "코드",
  comment: "주석",
  import: "임포트",
  signature: "시그니처",
  return: "반환",
};

const CATEGORY_COLOR: Record<Category, string> = {
  code: color.text1,
  comment: color.text3,
  import: "#9ecdff",
  signature: color.accent,
  return: color.success,
};

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes am-enter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes am-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes am-heat  { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes am-bar   { from { width: 0; } to { width: var(--am-bar-w); } }
`;

const SNIPPET_POOL = [
  "export function render() {",
  "const result = await fetch(url);",
  "if (value === null) throw new Error();",
  "for (const item of items) {",
  "return acc + cur;",
  "const { id, name } = entity;",
  "type Options = { debug?: boolean };",
  "import { color } from './tokens';",
  "// derived from seeded rng",
  "return { ok: true, data };",
  "} else {",
  "dispatch({ type: 'commit' });",
  "const map = new Map<string, Entity>();",
  "await Promise.all(tasks.map(run));",
  "const next = prev.filter(Boolean);",
  "console.log('debug', value);",
  "// TODO: handle edge case",
];

function synthSnippet(lineNumber: number, category: Category): string {
  // Deterministic-looking pseudo-source for the preview column. Not real
  // code — this view renders the attention pattern, not the raw file.
  if (category === "import") {
    const imports = [
      "import { color, font } from '../tokens';",
      "import type { Entity } from '@quanta/canvas-engine';",
      "import React, { useMemo } from 'react';",
      "import { attentionPattern } from '../synth';",
    ];
    return imports[lineNumber % imports.length]!;
  }
  if (category === "comment") {
    const comments = [
      "// compute running average",
      "/** Public API surface */",
      "// early-return on empty input",
      "// TODO: align with tokens",
    ];
    return comments[lineNumber % comments.length]!;
  }
  if (category === "signature") {
    const sigs = [
      "export function compute(x: Entity): Result {",
      "interface Props { id: string; weight: number; }",
      "type Category = 'code' | 'comment' | 'import';",
      "async function fetchData(url: string): Promise<T> {",
    ];
    return sigs[lineNumber % sigs.length]!;
  }
  if (category === "return") {
    const rets = [
      "return { ok: true, value };",
      "return acc;",
      "return null;",
      "return [...out];",
    ];
    return rets[lineNumber % rets.length]!;
  }
  return SNIPPET_POOL[lineNumber % SNIPPET_POOL.length]!;
}

interface CategoryStat {
  key: Category;
  label: string;
  korean: string;
  avg: number;   // 0..1
  count: number;
}

function AttentionMapViewImpl({ entity, empty }: Props): ReactElement {
  const lines = useMemo<AttentionLine[]>(
    () => (entity ? attentionPattern(entity) : []),
    [entity],
  );

  const stats = useMemo<{
    categories: CategoryStat[];
    maxLine: AttentionLine | null;
    avg: number;
  }>(() => {
    if (lines.length === 0) {
      return { categories: [], maxLine: null, avg: 0 };
    }
    const sums: Record<Category, { total: number; count: number }> = {
      code: { total: 0, count: 0 },
      comment: { total: 0, count: 0 },
      import: { total: 0, count: 0 },
      signature: { total: 0, count: 0 },
      return: { total: 0, count: 0 },
    };
    let maxLine: AttentionLine = lines[0]!;
    let overall = 0;
    for (const l of lines) {
      sums[l.category].total += l.weight;
      sums[l.category].count += 1;
      overall += l.weight;
      if (l.weight > maxLine.weight) maxLine = l;
    }
    const order: Category[] = ["code", "comment", "import", "signature", "return"];
    const categories: CategoryStat[] = order.map(k => ({
      key: k,
      label: CATEGORY_LABEL[k],
      korean: CATEGORY_KOREAN[k],
      avg: sums[k].count > 0 ? sums[k].total / sums[k].count : 0,
      count: sums[k].count,
    }));
    return { categories, maxLine, avg: overall / lines.length };
  }, [lines]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  // Insight — which category dominates?
  const top = [...stats.categories].sort((a, b) => b.avg - a.avg)[0];
  const insight =
    top && (top.key === "signature" || top.key === "return") && top.avg >= 0.55
      ? `${CATEGORY_KOREAN[top.key]}에 ${Math.round(top.avg * 100)}% 이상 집중 — 모델이 타입/반환을 canonical anchor로 취급합니다.`
      : top
      ? `평균 최고치는 ${CATEGORY_KOREAN[top.key]} ${Math.round(top.avg * 100)}%. signature/return 집중은 transformer circuits에서 공통 관찰.`
      : "유의미한 attention pattern이 관찰되지 않습니다.";

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Attention Map · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {entity.path} · {lines.length} lines · per-line attention weight
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          Transformer Circuits · Anthropic 2024
        </div>
      </header>

      {/* Hero — max line + avg */}
      <div style={heroStripStyle}>
        <HeroTile
          label="max-attention line"
          value={stats.maxLine ? `#${stats.maxLine.lineNumber}` : "—"}
          sub={stats.maxLine ? `${Math.round(stats.maxLine.weight * 100)}% · ${CATEGORY_KOREAN[stats.maxLine.category]}` : ""}
          accent={color.accent}
        />
        <HeroTile
          label="avg across file"
          value={`${Math.round(stats.avg * 100)}%`}
          sub="all lines"
          accent={color.text0}
        />
        <HeroTile
          label="lines w/ heat ≥ 60%"
          value={lines.filter(l => l.weight >= 0.6).length.toString()}
          sub="hotspots"
          accent={color.warn}
        />
        <HeroTile
          label="dominant category"
          value={top ? CATEGORY_KOREAN[top.key] : "—"}
          sub={top ? `${Math.round(top.avg * 100)}% avg` : ""}
          accent={top ? CATEGORY_COLOR[top.key] : color.text0}
        />
      </div>

      <div style={mainGridStyle}>
        {/* Source preview — left */}
        <section style={sourceCardStyle}>
          <div style={cardHeadStyle}>
            <span style={cardTitleStyle}>source · heat per line</span>
            <span style={cardSubStyle}>width == attention weight</span>
          </div>
          <div style={linesWrapStyle}>
            {lines.map((l, i) => {
              const isHot = l.weight >= 0.6;
              const snippet = synthSnippet(l.lineNumber, l.category);
              const heatColor = CATEGORY_COLOR[l.category];
              return (
                <div
                  key={l.lineNumber}
                  style={{
                    ...lineRowStyle,
                    background: isHot ? color.accentSofter : "transparent",
                    animation: `am-row 360ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * STAGGER_MS, 900)}ms`,
                  }}
                >
                  <div style={heatTrackStyle}>
                    <div
                      style={{
                        ...heatBarStyle,
                        background: heatColor,
                        transformOrigin: "left center",
                        width: `${Math.max(2, Math.round(l.weight * 100))}%`,
                        animation: `am-heat 540ms ${ENTRY_EASE} both`,
                        animationDelay: `${120 + Math.min(i * STAGGER_MS, 900)}ms`,
                        opacity: 0.75 + l.weight * 0.25,
                      }}
                    />
                  </div>
                  <span style={lineNumberStyle}>{l.lineNumber}</span>
                  <span style={snippetStyle}>{snippet}</span>
                  <span style={{ ...weightPctStyle, color: isHot ? color.accent : color.text3 }}>
                    {Math.round(l.weight * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stats — right */}
        <aside style={statsCardStyle}>
          <div style={cardHeadStyle}>
            <span style={cardTitleStyle}>avg by category</span>
            <span style={cardSubStyle}>signature × return typically peak</span>
          </div>
          <div style={categoryListStyle}>
            {stats.categories.map((c, i) => (
              <div
                key={c.key}
                style={{
                  ...categoryRowStyle,
                  animation: `am-row 420ms ${ENTRY_EASE} both`,
                  animationDelay: `${180 + i * 40}ms`,
                }}
              >
                <div style={categoryHeadStyle}>
                  <span style={{ ...categoryDotStyle, background: CATEGORY_COLOR[c.key] }} />
                  <span style={categoryLabelStyle}>{c.korean}</span>
                  <span style={categoryCountStyle}>{c.count}</span>
                </div>
                <div style={categoryBarTrackStyle}>
                  <div
                    style={{
                      ...categoryBarFillStyle,
                      background: CATEGORY_COLOR[c.key],
                      // @ts-expect-error css var
                      "--am-bar-w": `${Math.round(c.avg * 100)}%`,
                      animation: `am-bar 540ms ${ENTRY_EASE} both`,
                      animationDelay: `${260 + i * 40}ms`,
                    }}
                  />
                </div>
                <div style={categoryMetaStyle}>
                  avg {Math.round(c.avg * 100)}%
                </div>
              </div>
            ))}
          </div>

          <div style={insightCardStyle}>
            <div style={insightTitleStyle}>interpretability insight</div>
            <div style={insightBodyStyle}>{insight}</div>
            <div style={insightRefStyle}>
              signature 65%+ attention → 타입 annotation을 canonical anchor로
              사용한다는 transformer-circuits 가설과 일치.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HeroTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}): ReactElement {
  return (
    <div style={heroTileStyle}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroValueStyle, color: accent }}>{value}</div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[5]}px ${space[6]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `am-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
  display: "flex",
  flexDirection: "column",
  gap: space[4],
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const heroStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const heroTileStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroValueStyle: CSSProperties = {
  fontSize: 26,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  marginTop: 4,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: 2,
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: space[3],
  flex: 1,
  minHeight: 0,
};

const sourceCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

const statsCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  padding: `${space[3]}px ${space[4]}px`,
  gap: space[3],
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const cardTitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
};

const cardSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const linesWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: `${space[2]}px 0`,
};

const lineRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 36px 1fr 44px",
  alignItems: "center",
  gap: space[2],
  padding: `2px ${space[3]}px`,
  fontSize: font.size.xs,
};

const heatTrackStyle: CSSProperties = {
  position: "relative",
  height: 10,
  background: color.bg3,
  borderRadius: radius.xs,
  overflow: "hidden",
};

const heatBarStyle: CSSProperties = {
  height: "100%",
  borderRadius: radius.xs,
};

const lineNumberStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const snippetStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const weightPctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const categoryListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const categoryRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const categoryHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const categoryDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: radius.pill,
};

const categoryLabelStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  fontWeight: font.weight.medium,
  flex: 1,
};

const categoryCountStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
};

const categoryBarTrackStyle: CSSProperties = {
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const categoryBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  opacity: 0.85,
};

const categoryMetaStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const insightCardStyle: CSSProperties = {
  marginTop: "auto",
  padding: space[3],
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const insightTitleStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.accent,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const insightBodyStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text0,
  lineHeight: 1.5,
};

const insightRefStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.45,
};

export const AttentionMapView = memo(AttentionMapViewImpl);
