// HallucinationRiskView — repo-wide hallucination risk dashboard.
// --------------------------------------------------------------------
// Hero row: 4 stats — repo-wide risk %, HIGH-risk file count, top-1 risk
// file, average risk. Middle: 2D file scatter with X = rare-API score,
// Y = doc-gap score, bubble size = LoC. Top-right danger zone tinted red.
// Bottom: top-20 risk files ranked with 4-driver breakdown bars. Right
// rail: mitigation suggestions — "docstring top 5", "reduce generics in Y".
//
// Reference: Liu et al. "Exploring and Evaluating Hallucinations in LLM-
// based Code Generation" FSE 2024; Jesse et al. "Large Language Models
// and Simple, Stupid Bugs" ICSE 2023.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { hallucinationRisk } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes hr-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes hr-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes hr-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes hr-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes hr-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
`;

const PLOT_W = 560;
const PLOT_H = 360;
const PLOT_PAD_L = 48;
const PLOT_PAD_R = 18;
const PLOT_PAD_T = 22;
const PLOT_PAD_B = 40;

interface RiskRow {
  entity: Entity;
  score: number;
  loc: number;
  drivers: {
    rareApi: number;
    docGap: number;
    dynamicDispatch: number;
    genericTypes: number;
  };
}

function riskColor(score: number): string {
  if (score >= 0.7) return color.danger;
  if (score >= 0.5) return color.warn;
  if (score >= 0.3) return color.accent;
  return color.success;
}

function riskTier(score: number): string {
  if (score >= 0.7) return "HIGH";
  if (score >= 0.5) return "MED";
  if (score >= 0.3) return "LOW";
  return "SAFE";
}

function HallucinationRiskViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!ctx.tree) return null;
    const rows: RiskRow[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const h = hallucinationRisk(e);
      rows.push({
        entity: e,
        score: h.score,
        loc: e.metrics?.loc ?? 100,
        drivers: h.drivers,
      });
    }
    if (rows.length === 0) return null;
    rows.sort((a, b) => b.score - a.score);

    const totalScore = rows.reduce((acc, r) => acc + r.score, 0);
    const avg = totalScore / rows.length;
    const high = rows.filter(r => r.score >= 0.7).length;
    const top = rows[0]!;

    // Driver averages for mitigation suggestions.
    const sumDocGap = rows.reduce((a, r) => a + r.drivers.docGap, 0);
    const sumGeneric = rows.reduce((a, r) => a + r.drivers.genericTypes, 0);
    const sumRareApi = rows.reduce((a, r) => a + r.drivers.rareApi, 0);
    const sumDyn = rows.reduce((a, r) => a + r.drivers.dynamicDispatch, 0);

    const topByDocGap = [...rows].sort((a, b) => b.drivers.docGap - a.drivers.docGap).slice(0, 5);
    const topByGeneric = [...rows].sort((a, b) => b.drivers.genericTypes - a.drivers.genericTypes).slice(0, 3);

    return {
      rows,
      avg,
      high,
      top,
      count: rows.length,
      avgDocGap: sumDocGap / rows.length,
      avgGeneric: sumGeneric / rows.length,
      avgRareApi: sumRareApi / rows.length,
      avgDyn: sumDyn / rows.length,
      topByDocGap,
      topByGeneric,
    };
  }, [ctx.tree]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>리스크 데이터를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const maxLoc = Math.max(100, ...data.rows.map(r => r.loc));

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Hallucination Risk · <span style={{ color: color.danger, fontWeight: font.weight.semibold }}>
              repo-wide
            </span>
          </div>
          <div style={subtitleStyle}>
            API entropy × doc density × dynamic dispatch × generics · {data.count.toLocaleString()}개 파일
          </div>
        </div>
        <div style={refStyle}>
          Liu et al. (FSE 2024) · Jesse et al. (ICSE 2023)
        </div>
      </header>

      <section style={heroRow}>
        <HeroTile
          index={0}
          label="Repo risk"
          value={`${(data.avg * 100).toFixed(1)}%`}
          sub="average across files"
          tint={riskColor(data.avg)}
        />
        <HeroTile
          index={1}
          label="HIGH risk"
          value={`${data.high}`}
          sub="files · score ≥ 0.7"
          tint={color.danger}
        />
        <HeroTile
          index={2}
          label="Top-1 file"
          value={data.top.entity.name}
          sub={`${(data.top.score * 100).toFixed(1)}% risk`}
          tint={color.text0}
          mono
        />
        <HeroTile
          index={3}
          label="Avg score"
          value={(data.avg * 100).toFixed(1)}
          sub="0 = safe · 100 = certain"
          tint={color.warn}
        />
      </section>

      <section style={bodyGrid}>
        {/* ── Scatter ── */}
        <div style={scatterWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>File scatter · rare-API × doc-gap</span>
            <span style={mutedMono}>bubble size = LoC</span>
          </div>
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            role="img"
            aria-label="Hallucination risk scatter"
            style={{ display: "block" }}
          >
            {/* Danger zone — top-right. */}
            <rect
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.5}
              y={PLOT_PAD_T}
              width={(PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.5}
              height={(PLOT_H - PLOT_PAD_T - PLOT_PAD_B) * 0.5}
              fill={color.danger}
              opacity={0.08}
            />
            <text
              x={PLOT_W - PLOT_PAD_R - 8}
              y={PLOT_PAD_T + 16}
              textAnchor="end"
              fill={color.danger}
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fontWeight={font.weight.semibold}
              opacity={0.9}
            >
              환각 고위험 지대
            </text>

            {/* Axes — quarter gridlines. */}
            {[0.25, 0.5, 0.75].map(t => {
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              return (
                <g key={`grid-${t}`}>
                  <line
                    x1={PLOT_PAD_L} y1={y}
                    x2={PLOT_W - PLOT_PAD_R} y2={y}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.55}
                  />
                  <line
                    x1={x} y1={PLOT_PAD_T}
                    x2={x} y2={PLOT_H - PLOT_PAD_B}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.55}
                  />
                </g>
              );
            })}

            {/* Plot border. */}
            <rect
              x={PLOT_PAD_L} y={PLOT_PAD_T}
              width={PLOT_W - PLOT_PAD_L - PLOT_PAD_R}
              height={PLOT_H - PLOT_PAD_T - PLOT_PAD_B}
              fill="none"
              stroke={color.border}
            />

            {/* Axis tick labels. */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              return (
                <g key={`tick-${t}`}>
                  <text
                    x={x}
                    y={PLOT_H - PLOT_PAD_B + 14}
                    textAnchor="middle"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {t.toFixed(2)}
                  </text>
                  <text
                    x={PLOT_PAD_L - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {t.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Axis labels. */}
            <text
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) / 2}
              y={PLOT_H - 6}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
            >
              rare-API score → 희귀 API 빈도
            </text>
            <text
              x={0} y={0}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
              transform={`translate(12, ${PLOT_PAD_T + (PLOT_H - PLOT_PAD_T - PLOT_PAD_B) / 2}) rotate(-90)`}
            >
              doc-gap score → 문서 부재
            </text>

            {/* Dots. */}
            {data.rows.map((r, i) => {
              const x = PLOT_PAD_L + r.drivers.rareApi * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - r.drivers.docGap) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const bubble = 3 + Math.sqrt(Math.max(0, Math.min(1, r.loc / maxLoc))) * 10;
              const isHovered = hoveredId === r.entity.id;
              const opacity =
                hoveredId !== null && !isHovered ? 0.16 : isHovered ? 1 : 0.72;
              return (
                <g
                  key={r.entity.id}
                  style={{
                    cursor: "pointer",
                    animation: `hr-dot ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * 4, 600)}ms`,
                  }}
                  onMouseEnter={() => setHoveredId(r.entity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(r.entity.id)}
                >
                  <circle
                    cx={x} cy={y} r={bubble}
                    fill={riskColor(r.score)}
                    opacity={opacity}
                    stroke={isHovered ? color.text0 : "none"}
                    strokeWidth={isHovered ? 1.2 : 0}
                  />
                </g>
              );
            })}

            {/* Hover tooltip. */}
            {hoveredId !== null && (() => {
              const r = data.rows.find(x => x.entity.id === hoveredId);
              if (!r) return null;
              const x = PLOT_PAD_L + r.drivers.rareApi * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - r.drivers.docGap) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const boxW = 210, boxH = 62;
              const bx = Math.min(PLOT_W - boxW - 4, Math.max(4, x + 12));
              const by = Math.min(PLOT_H - boxH - 4, Math.max(4, y - boxH / 2));
              return (
                <g pointerEvents="none">
                  <rect
                    x={bx} y={by} width={boxW} height={boxH}
                    rx={radius.md} ry={radius.md}
                    fill={color.bg1}
                    stroke={color.border}
                  />
                  <text
                    x={bx + 10} y={by + 16}
                    fill={color.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.semibold}
                  >
                    {r.entity.name}
                  </text>
                  <text
                    x={bx + 10} y={by + 32}
                    fill={riskColor(r.score)}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fontWeight={font.weight.semibold}
                  >
                    risk {(r.score * 100).toFixed(1)}% · {riskTier(r.score)}
                  </text>
                  <text
                    x={bx + 10} y={by + 48}
                    fill={color.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    rareApi {(r.drivers.rareApi * 100).toFixed(0)} · docGap {(r.drivers.docGap * 100).toFixed(0)} · {r.loc} LoC
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* ── Mitigation sidebar ── */}
        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Mitigation</span>
            <span style={mutedMono}>biggest levers</span>
          </div>
          <div style={sidebarBody}>
            <MitigationCard
              index={0}
              icon="✎"
              title="add docstrings"
              body={`top 5 docGap files: ${data.topByDocGap.map(r => r.entity.name).join(", ")}`}
            />
            <MitigationCard
              index={1}
              icon="⊘"
              title="reduce generic types"
              body={`${data.topByGeneric.map(r => r.entity.name).join(", ")} are >0.7 generic-heavy`}
            />
            <MitigationCard
              index={2}
              icon="◈"
              title="pin rare APIs"
              body={`repo avg rareApi = ${(data.avgRareApi * 100).toFixed(0)}% — document 3rd-party wrappers`}
            />
            <MitigationCard
              index={3}
              icon="→"
              title="type dynamic dispatch"
              body={`repo avg ${(data.avgDyn * 100).toFixed(0)}% — replace any with discriminated unions`}
            />
          </div>
        </aside>
      </section>

      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Top 20 risk files</span>
          <span style={mutedMono}>4-driver breakdown · click to select</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, width: 28 }} />
            <span style={{ ...headCell, flex: 2 }}>file</span>
            <span style={{ ...headCell, width: 64 }}>risk</span>
            <span style={{ ...headCell, flex: 1 }}>rareApi</span>
            <span style={{ ...headCell, flex: 1 }}>docGap</span>
            <span style={{ ...headCell, flex: 1 }}>dynDisp</span>
            <span style={{ ...headCell, flex: 1 }}>generic</span>
          </div>
          {data.rows.slice(0, 20).map((r, i) => (
            <button
              key={r.entity.id}
              type="button"
              onClick={() => ctx.dispatch.selectEntity(r.entity.id)}
              style={{
                ...fileRow,
                animationDelay: `${160 + Math.min(i, 20) * STAGGER_MS}ms`,
              }}
            >
              <span style={{ ...rowRank, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={rowName}>{r.entity.name}</span>
                <span style={rowPath}>{r.entity.path}</span>
              </span>
              <span style={{ width: 64, display: "flex", justifyContent: "flex-end" }}>
                <RiskPill score={r.score} />
              </span>
              <DriverBar value={r.drivers.rareApi} tint={color.danger} delay={i} />
              <DriverBar value={r.drivers.docGap} tint={color.warn} delay={i + 2} />
              <DriverBar value={r.drivers.dynamicDispatch} tint={color.accent} delay={i + 4} />
              <DriverBar value={r.drivers.genericTypes} tint={color.text1} delay={i + 6} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroTile({
  index, label, value, sub, tint, mono,
}: {
  index: number;
  label: string;
  value: string;
  sub: string;
  tint: string;
  mono?: boolean;
}): ReactElement {
  return (
    <div
      style={{
        ...heroTile,
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      <div style={heroLabel}>{label}</div>
      <div
        style={{
          ...heroNum,
          color: tint,
          fontSize: mono ? 18 : 32,
          fontWeight: mono ? font.weight.semibold : font.weight.bold,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </div>
      <div style={heroSub} title={sub}>{sub}</div>
    </div>
  );
}

function MitigationCard({
  index, icon, title, body,
}: {
  index: number;
  icon: string;
  title: string;
  body: string;
}): ReactElement {
  return (
    <div
      style={{
        ...mitCard,
        animationDelay: `${200 + index * STAGGER_MS}ms`,
      }}
    >
      <div style={mitHead}>
        <span style={mitIcon}>{icon}</span>
        <span style={mitTitle}>{title}</span>
      </div>
      <div style={mitBody}>{body}</div>
    </div>
  );
}

function RiskPill({ score }: { score: number }): ReactElement {
  const tint = riskColor(score);
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        background: `color-mix(in srgb, ${tint} 18%, white)`,
        color: tint,
        padding: "2px 8px",
        borderRadius: radius.pill,
        minWidth: 46,
        textAlign: "center",
      }}
    >
      {(score * 100).toFixed(0)}
    </span>
  );
}

function DriverBar({
  value, tint, delay,
}: {
  value: number;
  tint: string;
  delay: number;
}): ReactElement {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={barBase}>
        <span
          style={{
            ...barFill,
            width: `${Math.max(3, value * 100)}%`,
            background: tint,
            animation: `hr-bar 480ms ${ENTRY_EASE} both`,
            animationDelay: `${180 + delay * 8}ms`,
            transformOrigin: "left center",
          }}
        />
      </span>
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `hr-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
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
  marginBottom: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const refStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const heroRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const heroTile: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minHeight: 108,
  animation: `hr-tile 460ms ${ENTRY_EASE} both`,
};

const heroLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroNum: CSSProperties = {
  fontFamily: font.mono,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
  marginTop: 2,
};

const heroSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${PLOT_W + 32}px 1fr`,
  gap: space[4],
};

const scatterWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[1]}px`,
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const mutedMono: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const sidebar: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  minWidth: 240,
};

const sidebarHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const sidebarBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
};

const mitCard: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `hr-tile 440ms ${ENTRY_EASE} both`,
};

const mitHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const mitIcon: CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.accent,
};

const mitTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const mitBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

const listSection: CSSProperties = {
  marginTop: space[5],
};

const listSectionHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const listHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
};

const headCell: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const fileRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `hr-row 440ms ${ENTRY_EASE} both`,
};

const rowRank: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barBase: CSSProperties = {
  display: "block",
  position: "relative",
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const barFill: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: radius.pill,
};

export const HallucinationRiskView = memo(HallucinationRiskViewImpl);
