// ConvergenceScoreView — per-file agent convergence matrix.
// --------------------------------------------------------------------
// File-scoped. 6 task rows (explain / fix-bug / add-feature / refactor /
// test / review). Each row renders runs count, a success-rate bar, a
// solution-diversity bar, the composite convergence score, and median
// turns to completion.
// Top: hero showing the avg convergence across tasks + a letter grade
// (A / B / C / D / E) that maps "safe to automate" vs "needs review".
// Middle: 2D scatter — X = successRate, Y = (1 - solutionDiversity).
// Ideal corner = top-right (high success, low diversity). Each task is
// a single labelled dot.
// Bottom: interpretation card — plain-language summary of what
// convergence × diversity means for delegating this file.
//
// Reference: temperature / sampling determinism studies; Holtzman et
// al. "Nucleus Sampling" ICLR 2020; Wang et al. "Self-Consistency" 2023.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  convergenceScores,
  type AITaskKind,
  type ConvergenceRow,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;
const COUNTER_MS = 640;
const BAR_MS = 900;

const KEYFRAMES = `
@keyframes conv-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes conv-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes conv-row   { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes conv-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes conv-dot   { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

type Grade = "A" | "B" | "C" | "D" | "E";

function grade(score: number): Grade {
  if (score > 0.75) return "A";
  if (score > 0.55) return "B";
  if (score > 0.35) return "C";
  if (score > 0.20) return "D";
  return "E";
}

function gradeTint(g: Grade): string {
  if (g === "A") return color.success;
  if (g === "B") return "#7db843";
  if (g === "C") return color.warn;
  if (g === "D") return "#e06a21";
  return color.danger;
}

function gradeVerdict(g: Grade): string {
  if (g === "A") return "safe to automate — 모든 태스크 수렴";
  if (g === "B") return "대부분 자동화 가능 — 가끔 사람 리뷰";
  if (g === "C") return "사람 리뷰 필요 — 솔루션이 흔들림";
  if (g === "D") return "높은 다양성 — 자율 실행 비추천";
  return "지속적으로 발산 — 사람이 해야 함";
}

function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function ConvergenceScoreViewImpl({ ctx, entity, empty }: Props): ReactElement | null {
  void ctx;
  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: font.size.xxl, color: color.text2, fontWeight: font.weight.semibold }}>
              파일을 선택하세요
            </div>
            <div style={{ marginTop: space[2], fontSize: font.size.sm, color: color.text3 }}>
              building 또는 floor를 선택하면 수렴성을 계산합니다.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows = useMemo<ConvergenceRow[]>(() => convergenceScores(entity), [entity]);
  const avg = rows.reduce((a, r) => a + r.convergenceScore, 0) / Math.max(1, rows.length);
  const g = grade(avg);
  const tint = gradeTint(g);

  return (
    <ConvergenceLayout
      rows={rows}
      entity={entity}
      avg={avg}
      g={g}
      tint={tint}
    />
  );
}

function ConvergenceLayout({
  rows, entity, avg, g, tint,
}: {
  rows: ConvergenceRow[];
  entity: Entity;
  avg: number;
  g: Grade;
  tint: string;
}): ReactElement {
  const counter = useCounter(avg * 100, COUNTER_MS);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Convergence · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            같은 태스크 반복 실행 시 답이 얼마나 수렴하는가 · {rows.length} tasks
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Holtzman et al. Nucleus Sampling ICLR 2020<br />
          Wang et al. Self-Consistency ICLR 2023
        </div>
      </header>

      {/* Hero row */}
      <section style={heroGridStyle}>
        <div style={{ ...heroTileStyle, animationDelay: `0ms` }}>
          <div style={heroLabelStyle}>avg convergence</div>
          <div style={{ fontSize: 42, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, marginTop: 2, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
            {counter.toFixed(1)}%
          </div>
          <div style={heroSubStyle}>composite × 6 tasks</div>
        </div>
        <div style={{ ...heroTileStyle, animationDelay: `${STAGGER_MS}ms` }}>
          <div style={heroLabelStyle}>grade</div>
          <div style={{ fontSize: 52, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, marginTop: 2, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
            {g}
          </div>
          <div style={heroSubStyle}>A {'>'}0.75 · E ≤0.20</div>
        </div>
        <div style={{ ...heroTileStyle, gridColumn: "span 2", animationDelay: `${STAGGER_MS * 2}ms` }}>
          <div style={heroLabelStyle}>verdict</div>
          <div style={{
            marginTop: 6,
            padding: `6px 12px`,
            background: `${tint}18`,
            color: tint,
            borderRadius: radius.pill,
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            letterSpacing: font.letter.wide,
            fontFamily: font.mono,
            display: "inline-block",
          }}>
            {gradeVerdict(g)}
          </div>
          <div style={{ display: "flex", gap: space[3], marginTop: space[3], fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            <span>ideal = top-right</span>
            <span>high success × low diversity</span>
          </div>
        </div>
      </section>

      {/* Task matrix */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Task rows</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            runs · success · diversity · convergence · median turns
          </div>
        </div>
        <div style={listStyle}>
          <div style={tableHeaderStyle}>
            <span style={{ ...cellBase, flex: "0 0 120px" }}>task</span>
            <span style={{ ...cellBase, flex: "0 0 60px", textAlign: "right" }}>runs</span>
            <span style={{ ...cellBase, flex: 1 }}>success rate</span>
            <span style={{ ...cellBase, flex: 1 }}>solution diversity</span>
            <span style={{ ...cellBase, flex: "0 0 96px", textAlign: "right" }}>converge</span>
            <span style={{ ...cellBase, flex: "0 0 72px", textAlign: "right" }}>median turns</span>
          </div>
          {rows.map((r, i) => (
            <TaskRow key={r.task} row={r} index={i} />
          ))}
        </div>
      </section>

      {/* Scatter */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Success × Consistency</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            X = success · Y = 1 − diversity · 이상 = top-right
          </div>
        </div>
        <ConvergenceScatter rows={rows} />
      </section>

      {/* Interpretation */}
      <section style={interpretStyle}>
        <div style={interpretLabelStyle}>interpretation</div>
        <div style={{ fontSize: font.size.sm, color: color.text1, marginTop: space[2], lineHeight: 1.6 }}>
          <strong style={{ color: color.text0 }}>high convergence</strong>은 같은 질문에 항상 비슷한 답을 의미합니다 — 안전하게 자동화할 수 있습니다.
          반대로 <strong style={{ color: color.text0 }}>high diversity</strong>는 매번 다른 해답을 제시한다는 뜻이므로 사람 리뷰가 필요합니다.
          특히 <strong style={{ color: color.warn }}>{getWorstTask(rows)}</strong> 태스크가 가장 낮은 수렴을 보이므로 해당 작업은 항상 검수하세요.
        </div>
      </section>
    </div>
  );
}

function getWorstTask(rows: ConvergenceRow[]): string {
  if (rows.length === 0) return "—";
  const worst = rows.reduce((a, b) => (a.convergenceScore < b.convergenceScore ? a : b));
  return TASK_KOREAN[worst.task];
}

// ── Task row ───────────────────────────────────────────────────────────

function TaskRow({ row, index }: { row: ConvergenceRow; index: number }): ReactElement {
  const convTint = gradeTint(grade(row.convergenceScore));
  return (
    <div style={{ ...rowStyle, animationDelay: `${Math.min(index * STAGGER_MS, 240)}ms` }}>
      <span style={{ ...cellBase, flex: "0 0 120px", color: color.text0, fontWeight: font.weight.medium, fontFamily: font.sans }}>
        {TASK_KOREAN[row.task]}
      </span>
      <span style={{ ...cellBase, flex: "0 0 60px", textAlign: "right", color: color.text1 }}>
        {row.runs}
      </span>
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: space[2] }}>
        <span style={barBaseStyle}>
          <span style={{
            ...barFillStyle,
            width: `${row.successRate * 100}%`,
            background: color.success,
            animation: `conv-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${Math.min(index * STAGGER_MS, 240) + 120}ms`,
          }} />
        </span>
        <span style={{ ...cellBase, fontSize: font.size.xxs, color: color.text1, flex: "0 0 36px", textAlign: "right" }}>
          {Math.round(row.successRate * 100)}%
        </span>
      </span>
      <span style={{ flex: 1, display: "flex", alignItems: "center", gap: space[2] }}>
        <span style={barBaseStyle}>
          <span style={{
            ...barFillStyle,
            width: `${row.solutionDiversity * 100}%`,
            background: color.warn,
            animation: `conv-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${Math.min(index * STAGGER_MS, 240) + 180}ms`,
          }} />
        </span>
        <span style={{ ...cellBase, fontSize: font.size.xxs, color: color.text1, flex: "0 0 36px", textAlign: "right" }}>
          {Math.round(row.solutionDiversity * 100)}%
        </span>
      </span>
      <span style={{ ...cellBase, flex: "0 0 96px", textAlign: "right", color: convTint, fontWeight: font.weight.semibold }}>
        {(row.convergenceScore * 100).toFixed(0)}%
      </span>
      <span style={{ ...cellBase, flex: "0 0 72px", textAlign: "right", color: color.text1 }}>
        {row.medianTurns}
      </span>
    </div>
  );
}

// ── Scatter ────────────────────────────────────────────────────────────

function ConvergenceScatter({ rows }: { rows: ConvergenceRow[] }): ReactElement {
  const W = 720;
  const H = 260;
  const PL = 56; const PR = 16; const PT = 16; const PB = 40;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="success vs consistency scatter">
        {/* Ideal zone (top-right) */}
        <rect x={PL + innerW / 2} y={PT} width={innerW / 2} height={innerH / 2} fill={color.success} opacity={0.06} />
        {/* Danger zone (bottom-left) */}
        <rect x={PL} y={PT + innerH / 2} width={innerW / 2} height={innerH / 2} fill={color.danger} opacity={0.04} />

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`y-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const x = PL + innerW * t;
          return (
            <g key={`x-${t}`}>
              <line x1={x} y1={PT} x2={x} y2={PT + innerH} stroke={color.border} strokeDasharray="3 4" />
              <text x={x} y={PT + innerH + 14} textAnchor="middle" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          );
        })}

        {/* Dots */}
        {rows.map((r, i) => {
          const x = PL + r.successRate * innerW;
          const y = PT + innerH * (1 - (1 - r.solutionDiversity));
          const tint = gradeTint(grade(r.convergenceScore));
          return (
            <g key={r.task} style={{ animation: `conv-dot 520ms ${ENTRY_EASE} both`, animationDelay: `${i * 40}ms` }}>
              <circle cx={x} cy={y} r={6} fill={tint} opacity={0.8} />
              <text x={x + 8} y={y + 3} fontSize={font.size.xxs} fill={color.text1} fontFamily={font.mono}>
                {TASK_KOREAN[r.task]}
              </text>
            </g>
          );
        })}

        {/* Labels */}
        <text x={PL + innerW / 2} y={H - 6} textAnchor="middle" fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}>
          success rate →
        </text>
        <text x={0} y={0} textAnchor="middle" fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}
          transform={`translate(16, ${PT + innerH / 2}) rotate(-90)`}>
          consistency (1 − diversity) →
        </text>
        <text x={PL + innerW - 6} y={PT + 14} textAnchor="end" fontSize={font.size.xxs} fill={color.success} fontStyle="italic" fontFamily={font.sans} opacity={0.8}>
          ideal — safe to automate
        </text>
        <text x={PL + 6} y={PT + innerH - 6} fontSize={font.size.xxs} fill={color.danger} fontStyle="italic" fontFamily={font.sans} opacity={0.8}>
          danger — needs human
        </text>
      </svg>
    </div>
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
  animation: `conv-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 2fr",
  gap: space[3],
  marginBottom: space[5],
};

const heroTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `conv-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const sectionStyle: CSSProperties = {
  marginTop: space[5],
};

const sectionHeadRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const tableHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `conv-row 440ms ${ENTRY_EASE} both`,
  fontSize: font.size.xs,
};

const cellBase: CSSProperties = {
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const barBaseStyle: CSSProperties = {
  display: "block",
  position: "relative",
  flex: 1,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: radius.pill,
  transformOrigin: "left center",
};

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

const interpretStyle: CSSProperties = {
  marginTop: space[5],
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `conv-tile 460ms ${ENTRY_EASE} both`,
};

const interpretLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

export const ConvergenceScoreView = memo(ConvergenceScoreViewImpl);
