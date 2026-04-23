// PlanningHorizonView — per-task reliable planning depth.
// --------------------------------------------------------------------
// Top: 6-task table with horizonSteps (reliable ≥80%), breakdownStep
// (drops <50%), plus a task-complexity indicator. Middle: multi-line
// chart — 6 lines (one per task), X = step #, Y = accuracy. Each curve
// is drawn-in via strokeDasharray 900ms so the decay reads. Bottom:
// insight — example "refactor horizon: 6 steps → chunk beyond that".
// Right: automated chunking recommendations for tasks beyond horizon.
//
// Reference: METR "Measuring AI Ability to Complete Long Tasks" 2024;
// Valmeekam et al. "PlanBench" 2024; Wei et al. "CoT" NeurIPS 2022.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  AI_TASK_KINDS,
  planningHorizon,
  type AITaskKind,
  type PlanningHorizonRow,
} from "../../../shared/analytics/synth-metrics";

export interface PlanningHorizonViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const DRAW_IN_MS = 900;

const KEYFRAMES = `
@keyframes ph-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes ph-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ph-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ph-draw  { from { stroke-dashoffset: var(--ph-draw-len); } to { stroke-dashoffset: 0; } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

// 6 line colors — stable across the view, legend uses the same.
const TASK_LINE_COLOR: Record<AITaskKind, string> = {
  explain: "#0d99ff",
  "fix-bug": "#e5484d",
  "add-feature": "#22a06b",
  refactor: "#e09321",
  test: "#7e4ed6",
  review: "#3d3d3d",
};

function complexityLabel(steps: number): { label: string; tint: string } {
  if (steps <= 3) return { label: "short", tint: color.danger };
  if (steps <= 6) return { label: "medium", tint: color.warn };
  if (steps <= 10) return { label: "long", tint: color.success };
  return { label: "very long", tint: color.accent };
}

function PlanningHorizonViewImpl({ entity, empty }: PlanningHorizonViewProps): ReactElement {
  const [hoveredTask, setHoveredTask] = useState<AITaskKind | null>(null);
  const rows = useMemo<PlanningHorizonRow[] | null>(() => {
    if (!entity) return null;
    return planningHorizon(entity);
  }, [entity]);

  if (empty || !entity || !rows) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const byTask = new Map<AITaskKind, PlanningHorizonRow>();
  for (const r of rows) byTask.set(r.task, r);

  // Find the task with the shortest horizon (first to "break down").
  let shortest: PlanningHorizonRow = rows[0]!;
  for (const r of rows) if (r.horizonSteps < shortest.horizonSteps) shortest = r;

  // Automated chunking candidates: tasks whose horizon < 6.
  const chunkCandidates = [...rows].filter(r => r.horizonSteps < 6);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Planning Horizon ·{" "}
            <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>
              {entity.name}
            </span>
          </div>
          <div style={subtitleStyle}>
            per-step accuracy^k · horizon = reliable (≥80%) · breakdown = &lt;50%
          </div>
        </div>
        <div style={refStyle}>
          METR long-task horizons 2024 · Valmeekam PlanBench 2024 · Wei CoT NeurIPS 2022
        </div>
      </header>

      <section style={heroTableSection}>
        <div style={sectionHeadRow}>
          <span style={sectionHead}>Per-task horizon</span>
          <span style={mutedMono}>reliable ≥80% · break &lt;50%</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, flex: 1 }}>task</span>
            <span style={{ ...headCell, width: 110, textAlign: "right" }}>horizon</span>
            <span style={{ ...headCell, width: 130, textAlign: "right" }}>breakdown</span>
            <span style={{ ...headCell, width: 100, textAlign: "right" }}>complexity</span>
          </div>
          {rows.map((r, i) => {
            const c = complexityLabel(r.horizonSteps);
            const isHover = hoveredTask === r.task;
            return (
              <div
                key={r.task}
                onMouseEnter={() => setHoveredTask(r.task)}
                onMouseLeave={() => setHoveredTask(null)}
                style={{
                  ...fileRow,
                  background: isHover ? color.accentSofter : "transparent",
                  animationDelay: `${160 + i * STAGGER_MS}ms`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: space[2] }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radius.pill,
                      background: TASK_LINE_COLOR[r.task],
                      display: "inline-block",
                    }}
                  />
                  <span>
                    <span style={rowName}>{TASK_KOREAN[r.task]}</span>
                    <span style={rowPath}>{r.task}</span>
                  </span>
                </span>
                <span style={{ width: 110, textAlign: "right" }}>
                  <span style={bigNum}>{r.horizonSteps}</span>
                  <span style={tinyLabel}> steps</span>
                </span>
                <span style={{ width: 130, textAlign: "right" }}>
                  <span style={{ ...bigNum, color: color.danger }}>{r.breakdownStep}</span>
                  <span style={tinyLabel}> steps</span>
                </span>
                <span style={{ width: 100, display: "flex", justifyContent: "flex-end" }}>
                  <ComplexityPill label={c.label} tint={c.tint} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section style={bodyGrid}>
        <div style={chartWrap}>
          <div style={chartHead}>
            <span style={sectionHead}>Decay curves — accuracy vs step #</span>
            <span style={mutedMono}>hover 행으로 강조 · y=0.80 / 0.50 reference</span>
          </div>
          <DecayChart rows={rows} hoveredTask={hoveredTask} />
          <div style={legendRow}>
            {AI_TASK_KINDS.map(t => (
              <div
                key={t}
                onMouseEnter={() => setHoveredTask(t)}
                onMouseLeave={() => setHoveredTask(null)}
                style={{
                  ...legendItem,
                  opacity: hoveredTask !== null && hoveredTask !== t ? 0.35 : 1,
                }}
              >
                <div
                  style={{
                    ...legendSwatch,
                    background: TASK_LINE_COLOR[t],
                  }}
                />
                <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2 }}>
                  {TASK_KOREAN[t]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Recommendations</span>
            <span style={mutedMono}>automated chunking</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightIcon}>◷</div>
              <div style={insightTitle}>
                {TASK_KOREAN[shortest.task]} horizon: {shortest.horizonSteps} steps
              </div>
              <div style={insightBody}>
                복잡 {shortest.task} 작업은 {shortest.horizonSteps} step 이하로 분해 권장.
                그 이상 누적되면 accuracy가 50% 아래로 떨어짐 (step {shortest.breakdownStep}).
              </div>
            </div>
            {chunkCandidates.length > 0 ? (
              chunkCandidates.slice(0, 3).map((r, i) => (
                <div
                  key={r.task}
                  style={{
                    ...insightCardMuted,
                    animationDelay: `${STAGGER_MS * (4 + i)}ms`,
                  }}
                >
                  <div style={insightSub}>
                    <strong>{TASK_KOREAN[r.task]}</strong>: chunk into ≤{r.horizonSteps}-step
                    sub-plans; escape-hatch review after step {r.breakdownStep}.
                  </div>
                </div>
              ))
            ) : (
              <div style={insightCardMuted}>
                <div style={insightSub}>
                  모든 태스크가 6-step 이상 horizon 유지 — 이 파일은 long-plan
                  agent 실행 candidate.
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function DecayChart({
  rows, hoveredTask,
}: {
  rows: PlanningHorizonRow[];
  hoveredTask: AITaskKind | null;
}): ReactElement {
  const W = 720;
  const H = 280;
  const PL = 56;
  const PR = 24;
  const PT = 18;
  const PB = 40;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const steps = rows[0]?.successCurve.length ?? 20;

  const xAt = (k: number) => PL + (k / Math.max(1, steps - 1)) * innerW;
  const yAt = (p: number) => PT + (1 - Math.max(0, Math.min(1, p))) * innerH;

  // Reference bands.
  const y80 = yAt(0.80);
  const y50 = yAt(0.50);

  return (
    <div style={{ padding: space[3] }}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="decay curves">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const y = yAt(t);
          return (
            <g key={`grid-y-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.55} />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          );
        })}

        {/* Reference lines at 80% and 50%. */}
        <line x1={PL} y1={y80} x2={PL + innerW} y2={y80} stroke={color.success} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        <text x={PL + innerW - 4} y={y80 - 4} textAnchor="end" fontSize={font.size.xxs} fill={color.success} fontFamily={font.mono}>
          reliable 80%
        </text>
        <line x1={PL} y1={y50} x2={PL + innerW} y2={y50} stroke={color.danger} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        <text x={PL + innerW - 4} y={y50 - 4} textAnchor="end" fontSize={font.size.xxs} fill={color.danger} fontFamily={font.mono}>
          break 50%
        </text>

        {/* x-axis tick labels */}
        {Array.from({ length: steps }).map((_, k) => {
          if (k % 4 !== 0 && k !== steps - 1) return null;
          return (
            <text
              key={`xt-${k}`}
              x={xAt(k)}
              y={PT + innerH + 14}
              textAnchor="middle"
              fontSize={font.size.xxs}
              fill={color.text3}
              fontFamily={font.mono}
            >
              {k + 1}
            </text>
          );
        })}
        <text
          x={PL + innerW / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={font.size.xs}
          fill={color.text2}
          fontFamily={font.sans}
        >
          step #
        </text>
        <text
          x={0} y={0}
          textAnchor="middle"
          fontSize={font.size.xs}
          fill={color.text2}
          fontFamily={font.sans}
          transform={`translate(14, ${PT + innerH / 2}) rotate(-90)`}
        >
          accuracy
        </text>

        {/* Lines */}
        {rows.map((r, rowI) => {
          const path = r.successCurve
            .map((p, k) => `${k === 0 ? "M" : "L"} ${xAt(k)} ${yAt(p)}`)
            .join(" ");
          // Approx path length for the dash-offset draw-in. Each segment ~
          // sqrt((dx)^2 + (dy)^2); dx is roughly innerW/(steps-1) per step.
          const dx = innerW / Math.max(1, steps - 1);
          let approxLen = 0;
          for (let k = 1; k < r.successCurve.length; k++) {
            const dy = Math.abs(yAt(r.successCurve[k]!) - yAt(r.successCurve[k - 1]!));
            approxLen += Math.sqrt(dx * dx + dy * dy);
          }
          approxLen = Math.max(100, Math.ceil(approxLen));
          const stroke = TASK_LINE_COLOR[r.task];
          const dimmed = hoveredTask !== null && hoveredTask !== r.task;
          return (
            <g key={r.task}>
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={hoveredTask === r.task ? 2.5 : 1.8}
                opacity={dimmed ? 0.18 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: approxLen,
                  ["--ph-draw-len" as string]: `${approxLen}`,
                  animation: `ph-draw ${DRAW_IN_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${160 + rowI * 80}ms`,
                }}
              />
              {/* Horizon marker dot — where curve hits 0.8. */}
              {r.horizonSteps > 0 && r.horizonSteps <= r.successCurve.length && (
                <circle
                  cx={xAt(r.horizonSteps - 1)}
                  cy={yAt(r.successCurve[r.horizonSteps - 1] ?? 0.8)}
                  r={hoveredTask === r.task ? 5 : 3.5}
                  fill={stroke}
                  opacity={dimmed ? 0.2 : 1}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ComplexityPill({ label, tint }: { label: string; tint: string }): ReactElement {
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
        minWidth: 82,
        textAlign: "center",
      }}
    >
      {label}
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
  animation: `ph-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const heroTableSection: CSSProperties = {
  marginBottom: space[5],
};

const sectionHeadRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
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

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
  boxShadow: shadow.xs,
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
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `ph-row 440ms ${ENTRY_EASE} both`,
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
};

const bigNum: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xl,
  fontWeight: font.weight.bold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
};

const tinyLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginLeft: 3,
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: space[4],
};

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: `${space[3]}px 0`,
};

const chartHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[4]}px`,
};

const legendRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  borderTop: `1px solid ${color.borderSoft}`,
};

const legendItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "default",
  transition: "opacity 160ms ease-out",
};

const legendSwatch: CSSProperties = {
  width: 16,
  height: 3,
  borderRadius: radius.pill,
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

const insightCard: CSSProperties = {
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `ph-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 3}ms`,
};

const insightCardMuted: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `ph-tile 440ms ${ENTRY_EASE} both`,
};

const insightIcon: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.accent,
  marginBottom: 2,
};

const insightTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
  marginTop: 2,
};

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

const insightSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

export const PlanningHorizonView = memo(PlanningHorizonViewImpl);
