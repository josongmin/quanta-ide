// FossilView — deprecated-API timeline.
// --------------------------------------------------------------------
// A horizontally-oriented "timeline of sins". Each row is a legacy /
// deprecated API. The X axis is the year in which the API was first
// introduced into the workspace (older on the left). Each file that
// still imports the API gets plotted as a dot along the row; the dot's
// horizontal position is a deterministic jitter within the API's year
// band. Row tint (and rank) comes from the total use count.
//
// The dataset is synthesised: a fixed deprecated-API list × stable
// per-entity uses from `fossilCount`. When the static analyzer ships
// a real list of known-deprecated imports we swap the `USES` source;
// the visual contract stays identical.

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { color as tokenColor, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { fossilCount, hashId, seeded } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import type { Entity } from "../../../entities/entity";

// ── Fossil catalog ───────────────────────────────────────────────────
// "firstYear" is the year the API shipped (approximate). Rows below
// this list that actually have uses in the workspace get rendered;
// zero-use rows still appear but dim so the user can see coverage.

interface Fossil {
  id: string;
  name: string;
  /** Year the API first shipped. */
  firstYear: number;
  /** Why it's a fossil. */
  reason: string;
}

const FOSSILS: readonly Fossil[] = [
  { id: "moment",          name: "moment",                   firstYear: 2011, reason: "replaced by date-fns / Temporal" },
  { id: "request",         name: "request",                  firstYear: 2011, reason: "deprecated, use fetch/undici" },
  { id: "node-sass",       name: "node-sass",                firstYear: 2013, reason: "deprecated, use dart-sass" },
  { id: "rr3",             name: "React.createClass",        firstYear: 2013, reason: "use function components" },
  { id: "enzyme",          name: "enzyme",                   firstYear: 2015, reason: "abandoned, use Testing Library" },
  { id: "lodash-chain",    name: "lodash.chain",             firstYear: 2013, reason: "tree-shake hostile" },
  { id: "tslint",          name: "TSLint",                   firstYear: 2013, reason: "use ESLint + @typescript-eslint" },
  { id: "intrinsic-any",   name: "JSX.IntrinsicElements<any>", firstYear: 2016, reason: "erases type safety" },
];

// ── Layout ───────────────────────────────────────────────────────────

interface FossilUse {
  file: Entity;
  /** Deterministic x-jitter inside the fossil's year band (0..1). */
  jitter: number;
}

interface FossilRow {
  fossil: Fossil;
  uses: FossilUse[];
  useCount: number;
}

interface FossilLayout {
  rows: FossilRow[];
  firstYear: number;
  lastYear: number;
  maxUseCount: number;
  totalUses: number;
}

const PAD_LEFT = 40;
const PAD_RIGHT = 40;
const PAD_TOP = 80;
const PAD_BOTTOM = 50;
const ROW_H = 54;
const ROW_GAP = 8;
const LABEL_W = 200;

function buildLayout(ctx: ViewContextValue): FossilLayout | null {
  if (!ctx.tree) return null;

  const files = ctx.tree.byKind("building");
  if (files.length === 0) return null;

  const rows: FossilRow[] = FOSSILS.map(fossil => {
    const uses: FossilUse[] = [];
    for (const f of files) {
      // Each file has a synthetic fossil budget; distribute that budget
      // across the fossils via hash residue so a file "uses" a specific
      // subset of fossils deterministically.
      const budget = fossilCount(f);
      if (budget <= 0) continue;
      const rng = seeded(f.id, `fossil:${fossil.id}`);
      // Probability proportional to budget; higher-budget files show
      // up across more fossil rows.
      const prob = Math.min(0.8, 0.12 + budget * 0.08);
      if (rng() < prob) {
        const jitter = seeded(f.id, `fj:${fossil.id}`)();
        uses.push({ file: f, jitter });
      }
    }
    return { fossil, uses, useCount: uses.length };
  });

  // Sort worst-offenders first.
  rows.sort((a, b) => b.useCount - a.useCount);

  const years = FOSSILS.map(f => f.firstYear);
  const firstYear = Math.min(...years) - 1;
  const lastYear = new Date().getFullYear();
  const maxUseCount = rows.reduce((m, r) => Math.max(m, r.useCount), 0);
  const totalUses = rows.reduce((n, r) => n + r.useCount, 0);

  return { rows, firstYear, lastYear, maxUseCount, totalUses };
}

// ── Component ────────────────────────────────────────────────────────

export function FossilView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);

  useEffect(() => {
    let raf1 = 0, raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const { w, h } = ctx.viewportSize;
  const layout = useMemo(() => buildLayout(ctx), [ctx]);

  if (!ctx.tree) {
    return <EmptyState label="데이터 없음" sub="Entity tree가 필요합니다" />;
  }
  if (!layout) {
    return <EmptyState label="로딩 중" sub="화석 스캔 중…" />;
  }

  const axisLeft = PAD_LEFT + LABEL_W;
  const axisRight = Math.max(axisLeft + 120, w - PAD_RIGHT);
  const axisWidth = axisRight - axisLeft;
  const yearSpan = Math.max(1, layout.lastYear - layout.firstYear);

  function xForYear(year: number, jitter: number): number {
    const yearStart = axisLeft + ((year - layout!.firstYear) / yearSpan) * axisWidth;
    const yearNext  = axisLeft + ((year + 1 - layout!.firstYear) / yearSpan) * axisWidth;
    return yearStart + jitter * Math.max(8, yearNext - yearStart);
  }

  // Year tick list — every 2 years, decluttered.
  const yearTicks: number[] = [];
  for (let y = layout.firstYear; y <= layout.lastYear; y += 2) yearTicks.push(y);
  if (yearTicks[yearTicks.length - 1] !== layout.lastYear) yearTicks.push(layout.lastYear);

  const rootStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: tokenColor.bg0,
    color: tokenColor.text0,
    fontFamily: font.sans,
    overflow: "hidden",
  };

  const entryStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? "scale(1)" : "scale(0.96)",
    transition: "opacity 500ms cubic-bezier(0.22, 1, 0.28, 1), transform 500ms cubic-bezier(0.22, 1, 0.28, 1)",
    willChange: "opacity, transform",
    width: "100%",
    height: "100%",
    position: "relative",
  };

  const contentHeight = layout.rows.length * (ROW_H + ROW_GAP);
  const needsScroll = contentHeight + PAD_TOP + PAD_BOTTOM > h;

  return (
    <div style={rootStyle} onClick={() => ctx.dispatch.selectEntity(null)}>
      <div style={entryStyle}>
        {/* Title */}
        <div
          style={{
            position: "absolute",
            left: PAD_LEFT,
            top: space[3],
            display: "flex",
            gap: space[3],
            alignItems: "baseline",
          }}
        >
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
            Fossil Timeline
          </div>
          <div style={{ fontSize: font.size.xs, color: tokenColor.text2 }}>
            {layout.rows.length} deprecated APIs ·{" "}
            <span style={{ color: layout.totalUses > 0 ? tokenColor.danger : tokenColor.success }}>
              {layout.totalUses} surviving uses
            </span>
          </div>
        </div>

        {/* Year axis */}
        <svg
          width={w}
          height={h}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          aria-hidden
        >
          {/* Axis line */}
          <line
            x1={axisLeft}
            x2={axisRight}
            y1={PAD_TOP - 16}
            y2={PAD_TOP - 16}
            stroke={tokenColor.border}
            strokeWidth={1}
          />
          {yearTicks.map((y) => {
            const x = axisLeft + ((y - layout.firstYear) / yearSpan) * axisWidth;
            return (
              <g key={y}>
                <line
                  x1={x}
                  x2={x}
                  y1={PAD_TOP - 20}
                  y2={PAD_TOP - 14}
                  stroke={tokenColor.border}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={PAD_TOP - 26}
                  textAnchor="middle"
                  fill={tokenColor.text2}
                  fontSize={font.size.xxs}
                  fontFamily={font.sans}
                >
                  {y}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Scrollable rows viewport */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: PAD_TOP,
            width: "100%",
            height: `calc(100% - ${PAD_TOP + PAD_BOTTOM}px)`,
            overflow: needsScroll ? "auto" : "hidden",
          }}
        >
          <div style={{ position: "relative", height: contentHeight, width: "100%" }}>
            {layout.rows.map((row, rIdx) => {
              const y = rIdx * (ROW_H + ROW_GAP);
              const intensity = layout.maxUseCount > 0
                ? row.useCount / layout.maxUseCount
                : 0;
              const hovered = hoveredRow === row.fossil.id;
              const dimmed = hoveredRow !== null && !hovered;
              const yearX = axisLeft + ((row.fossil.firstYear - layout.firstYear) / yearSpan) * axisWidth;

              const rowBg = `rgba(229, 72, 77, ${(0.03 + intensity * 0.18).toFixed(3)})`;

              return (
                <div
                  key={row.fossil.id}
                  onMouseEnter={() => setHoveredRow(row.fossil.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    position: "absolute",
                    left: PAD_LEFT,
                    top: y,
                    width: `calc(100% - ${PAD_LEFT + PAD_RIGHT}px)`,
                    height: ROW_H,
                    display: "flex",
                    opacity: mounted ? (dimmed ? 0.35 : 1) : 0,
                    transform: mounted ? "translateY(0)" : "translateY(8px)",
                    transition: "opacity 180ms ease-out, transform 500ms cubic-bezier(0.22,1,0.28,1)",
                    transitionDelay: `${Math.min(400, rIdx * 20)}ms`,
                  }}
                >
                  {/* Label column */}
                  <div
                    style={{
                      width: LABEL_W,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      paddingRight: space[3],
                      borderRight: `1px solid ${tokenColor.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: space[2],
                        fontSize: font.size.md,
                        fontWeight: font.weight.semibold,
                        color: row.useCount > 0 ? tokenColor.text0 : tokenColor.text3,
                        fontFamily: font.mono,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: radius.pill,
                          background: row.useCount > 0 ? tokenColor.danger : tokenColor.border,
                        }}
                      />
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {row.fossil.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: font.size.xxs,
                        color: tokenColor.text2,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={row.fossil.reason}
                    >
                      {row.fossil.reason}
                    </div>
                    <div
                      style={{
                        fontSize: font.size.xxs,
                        color: row.useCount > 0 ? tokenColor.danger : tokenColor.text3,
                        marginTop: 2,
                        fontWeight: font.weight.medium,
                      }}
                    >
                      {row.useCount} uses
                    </div>
                  </div>

                  {/* Timeline cell */}
                  <div
                    style={{
                      position: "relative",
                      flex: 1,
                      height: "100%",
                      background: rowBg,
                      borderRadius: radius.sm,
                      marginLeft: space[2],
                    }}
                  >
                    {/* Intro marker */}
                    <div
                      style={{
                        position: "absolute",
                        left: yearX - PAD_LEFT - LABEL_W - space[2],
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: tokenColor.borderStrong,
                        opacity: 0.6,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: yearX - PAD_LEFT - LABEL_W - space[2] + 4,
                        top: 4,
                        fontSize: font.size.xxs,
                        color: tokenColor.text2,
                      }}
                    >
                      intro {row.fossil.firstYear}
                    </div>

                    {/* Dots */}
                    {row.uses.map((use) => {
                      const dotXAbs = xForYear(row.fossil.firstYear, use.jitter);
                      // Position inside the timeline cell (which starts at axisLeft)
                      const localX = dotXAbs - (PAD_LEFT + LABEL_W + space[2]);
                      const localY = ROW_H / 2 + (hashId(use.file.id) % 1000) / 1000 * 12 - 6;
                      const isSelected = ctx.selectedId === use.file.id;
                      const isHovered = hoveredFileId === use.file.id;
                      return (
                        <div
                          key={`${row.fossil.id}:${use.file.id}`}
                          onMouseEnter={(ev) => {
                            ev.stopPropagation();
                            setHoveredFileId(use.file.id);
                          }}
                          onMouseLeave={() => setHoveredFileId(null)}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            ctx.dispatch.selectEntity(use.file.id);
                          }}
                          title={`${use.file.path}`}
                          style={{
                            position: "absolute",
                            left: localX - 4,
                            top: localY - 4,
                            width: 8,
                            height: 8,
                            borderRadius: radius.pill,
                            background: isSelected ? tokenColor.accent : tokenColor.danger,
                            boxShadow: isHovered ? shadow.sm : "none",
                            opacity: isHovered ? 1 : 0.75,
                            cursor: "pointer",
                            transform: isHovered ? "scale(1.4)" : "scale(1)",
                            transition:
                              "transform 180ms ease-out, opacity 180ms ease-out, box-shadow 180ms ease-out, background 180ms ease-out",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom caption */}
        <div
          style={{
            position: "absolute",
            left: PAD_LEFT,
            bottom: space[3],
            fontSize: font.size.xxs,
            color: tokenColor.text2,
          }}
        >
          오래된 + 지금도 쓰이는 = 청소 최우선
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label, sub }: { label: string; sub: string }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space[2],
        color: tokenColor.text2,
        fontFamily: font.sans,
        background: tokenColor.bg0,
      }}
    >
      <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold }}>
        {label}
      </div>
      <div style={{ fontSize: font.size.xs }}>{sub}</div>
    </div>
  );
}
