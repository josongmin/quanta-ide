// CompoundingErrorView — chain length × per-step accuracy limits.
// --------------------------------------------------------------------
// Top hero: repo's average observed chain length + end-to-end success at
// the current per-step assumption. Middle: decay curve chart for three
// per-step accuracies (0.95 / 0.90 / 0.80) with 50% and 80% danger
// crossings marked. Bottom: per-task chain-length table where long chains
// (>15) are flagged "brittle" because compounded success drops sharply.
// Right rail: insight card contrasting 0.95→0.90 at 15 steps.
//
// Reference: Jimenez et al. "SWE-bench: Can Language Models Resolve
// Real-World GitHub Issues?" ICLR 2024; METR "Measuring AI Ability to
// Complete Long Tasks" (2024). Compounding error as industry-recognized
// 2026 agent limit.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  compoundingCurve,
  chainLengthDistribution,
  AI_TASK_KINDS,
  type AITaskKind,
  type CompoundingCurve,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes ce-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes ce-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ce-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ce-draw  { from { stroke-dashoffset: var(--dash-len); } to { stroke-dashoffset: 0; } }
@keyframes ce-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const ASSUMED_PER_STEP = 0.92;

// Chart layout.
const PLOT_W = 680;
const PLOT_H = 340;
const PLOT_PAD_L = 56;
const PLOT_PAD_R = 24;
const PLOT_PAD_T = 28;
const PLOT_PAD_B = 44;

// Log scale from 1 to 128 steps (= 2^7).
const MAX_STEPS = 128;
const LOG_MAX = Math.log2(MAX_STEPS);

function xForStep(step: number): number {
  const innerW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
  return PLOT_PAD_L + (Math.log2(Math.max(1, step)) / LOG_MAX) * innerW;
}
function yForAcc(acc: number): number {
  const innerH = PLOT_H - PLOT_PAD_T - PLOT_PAD_B;
  return PLOT_PAD_T + (1 - acc) * innerH;
}

function curveAt(perStep: number, k: number): number {
  return Math.pow(perStep, k);
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

interface TaskRow {
  entity: Entity;
  lengths: Map<AITaskKind, number>;
  avgLen: number;
  maxLen: number;
  e2eAt092: number;
}

interface Aggregate {
  firstFile: Entity;
  tasks: TaskRow[];
  avgChain: number;
  curves: { perStep: number; curve: CompoundingCurve }[];
  e2eRepo: number;
}

function aggregate(ctx: ViewContextValue): Aggregate | null {
  if (!ctx.tree) return null;
  const buildings: Entity[] = [];
  for (const e of ctx.tree.byId.values()) {
    if (e.kind === "building") buildings.push(e);
  }
  if (buildings.length === 0) return null;
  // Sample up to 6 representative tasks (files).
  const sample = buildings
    .slice()
    .sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0))
    .slice(0, 6);
  const rows: TaskRow[] = sample.map(e => {
    const lengths = chainLengthDistribution(e);
    let sum = 0;
    let max = 0;
    for (const v of lengths.values()) {
      sum += v;
      if (v > max) max = v;
    }
    const avgLen = sum / Math.max(1, lengths.size);
    const e2eAt092 = curveAt(0.9, Math.round(avgLen));
    return { entity: e, lengths, avgLen, maxLen: max, e2eAt092 };
  });
  const totalAvg = rows.reduce((a, r) => a + r.avgLen, 0) / Math.max(1, rows.length);
  const curves = [0.95, 0.9, 0.8].map(p => ({
    perStep: p,
    curve: compoundingCurve(p),
  }));
  const e2eRepo = curveAt(ASSUMED_PER_STEP, Math.round(totalAvg));
  return {
    firstFile: sample[0]!,
    tasks: rows,
    avgChain: totalAvg,
    curves,
    e2eRepo,
  };
}

function CompoundingErrorViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => aggregate(ctx), [ctx]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>체인 길이 데이터를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const avgChainCounter = useCounter(data.avgChain, COUNTER_MS);
  const e2eCounter = useCounter(data.e2eRepo * 100, COUNTER_MS);

  const band =
    data.e2eRepo >= 0.6
      ? { label: "healthy", tint: color.success, copy: "end-to-end 성공률 안정권" }
      : data.e2eRepo >= 0.3
      ? { label: "degrading", tint: color.warn, copy: "체인 누적으로 성공률 하락 — chain 단축 검토" }
      : { label: "brittle", tint: color.danger, copy: "compounding error가 지배적 — 사람 개입 필수" };

  // Fixed three per-step curves — colours.
  const CURVE_COLORS: Record<string, string> = {
    "0.95": color.success,
    "0.9": color.accent,
    "0.8": color.danger,
  };

  // Contrast numbers for insight.
  const cmp0_95 = curveAt(0.95, 15) * 100;
  const cmp0_9 = curveAt(0.9, 15) * 100;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Compounding Error · <span style={{ color: band.tint, fontWeight: font.weight.semibold }}>
              repo end-to-end
            </span>
          </div>
          <div style={subtitleStyle}>
            p^k 합성 정확도 × 태스크별 관찰 chain · {data.tasks.length}개 샘플
          </div>
        </div>
        <div style={refStyle}>
          Jimenez SWE-bench ICLR 2024<br />
          METR task horizons 2024
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroTile, animationDelay: "0ms", gridColumn: "span 2" }}>
          <div style={heroLabel}>현재 repo 평균 chain length</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: space[3], marginTop: 4 }}>
            <div style={{ ...heroNum, color: color.text0, fontSize: 40 }}>
              {avgChainCounter.toFixed(1)}
            </div>
            <div style={{ fontSize: font.size.sm, color: color.text2, fontFamily: font.mono }}>
              steps · across {data.tasks.length} tasks
            </div>
          </div>
          <div style={{ marginTop: space[3], display: "flex", gap: space[3], alignItems: "center" }}>
            <div style={{
              padding: "6px 12px",
              background: `${band.tint}18`,
              color: band.tint,
              borderRadius: radius.pill,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.wide,
              textTransform: "uppercase",
              fontFamily: font.mono,
            }}>
              {band.label}
            </div>
            <span style={{ fontSize: font.size.sm, color: color.text1 }}>{band.copy}</span>
          </div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS}ms` }}>
          <div style={heroLabel}>종단 성공률 @ {Math.round(ASSUMED_PER_STEP * 100)}%/step</div>
          <div style={{ ...heroNum, color: band.tint }}>
            {e2eCounter.toFixed(1)}%
          </div>
          <div style={heroSub} title="per-step × chain length">
            p={ASSUMED_PER_STEP}^k · k={Math.round(data.avgChain)}
          </div>
        </div>
      </section>

      <section style={bodyGrid}>
        {/* Decay curve chart */}
        <div style={scatterWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>End-to-end success vs chain length</span>
            <span style={mutedMono}>log scale · 1 → 128 steps</span>
          </div>
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            role="img"
            aria-label="compounding error curves"
            style={{ display: "block" }}
          >
            {/* Danger zone — below 0.5 */}
            <rect
              x={PLOT_PAD_L}
              y={yForAcc(0.5)}
              width={PLOT_W - PLOT_PAD_L - PLOT_PAD_R}
              height={PLOT_H - PLOT_PAD_B - yForAcc(0.5)}
              fill={color.danger}
              opacity={0.05}
            />
            <text
              x={PLOT_W - PLOT_PAD_R - 8}
              y={yForAcc(0.5) + 14}
              textAnchor="end"
              fill={color.danger}
              fontSize={font.size.xxs}
              fontFamily={font.mono}
              fontWeight={font.weight.semibold}
              opacity={0.9}
            >
              danger zone — &lt; 50%
            </text>

            {/* Horizontal grid (accuracy) */}
            {[0, 0.25, 0.5, 0.75, 1.0].map(a => {
              const y = yForAcc(a);
              return (
                <g key={`h-${a}`}>
                  <line
                    x1={PLOT_PAD_L} y1={y}
                    x2={PLOT_W - PLOT_PAD_R} y2={y}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.6}
                  />
                  <text
                    x={PLOT_PAD_L - 8} y={y + 3}
                    textAnchor="end"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {`${Math.round(a * 100)}%`}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid (steps, log) */}
            {[1, 2, 4, 8, 16, 32, 64, 128].map(s => {
              const x = xForStep(s);
              return (
                <g key={`v-${s}`}>
                  <line
                    x1={x} y1={PLOT_PAD_T}
                    x2={x} y2={PLOT_H - PLOT_PAD_B}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.5}
                  />
                  <text
                    x={x} y={PLOT_H - PLOT_PAD_B + 14}
                    textAnchor="middle"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {s}
                  </text>
                </g>
              );
            })}

            {/* Plot border */}
            <rect
              x={PLOT_PAD_L} y={PLOT_PAD_T}
              width={PLOT_W - PLOT_PAD_L - PLOT_PAD_R}
              height={PLOT_H - PLOT_PAD_T - PLOT_PAD_B}
              fill="none"
              stroke={color.border}
            />

            {/* 50% line */}
            <line
              x1={PLOT_PAD_L} y1={yForAcc(0.5)}
              x2={PLOT_W - PLOT_PAD_R} y2={yForAcc(0.5)}
              stroke={color.danger}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            {/* 80% line */}
            <line
              x1={PLOT_PAD_L} y1={yForAcc(0.8)}
              x2={PLOT_W - PLOT_PAD_R} y2={yForAcc(0.8)}
              stroke={color.warn}
              strokeOpacity={0.35}
              strokeWidth={1}
            />

            {/* Curves */}
            {data.curves.map((c, i) => {
              const key = String(c.perStep);
              const tint = CURVE_COLORS[key] ?? color.text2;
              const pts: string[] = [];
              const SAMPLES = 128;
              for (let j = 0; j <= SAMPLES; j++) {
                const t = j / SAMPLES;
                const step = Math.pow(2, t * LOG_MAX);
                const acc = curveAt(c.perStep, step);
                pts.push(`${xForStep(step).toFixed(2)},${yForAcc(acc).toFixed(2)}`);
              }
              const d = `M ${pts.join(" L ")}`;
              return (
                <g key={key}>
                  <path
                    d={d}
                    fill="none"
                    stroke={tint}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 1200,
                      animation: `ce-draw 900ms ${ENTRY_EASE} both`,
                      animationDelay: `${200 + i * 80}ms`,
                      // @ts-expect-error CSS var
                      "--dash-len": "1200px",
                    }}
                  />
                  {/* Label near right edge */}
                  <text
                    x={xForStep(MAX_STEPS) - 4}
                    y={yForAcc(curveAt(c.perStep, MAX_STEPS)) - 6}
                    textAnchor="end"
                    fill={tint}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fontWeight={font.weight.semibold}
                  >
                    p = {c.perStep}
                  </text>
                  {/* 50% crossing marker */}
                  {c.curve.break50Step > 1 && c.curve.break50Step < MAX_STEPS && (
                    <g>
                      <circle
                        cx={xForStep(c.curve.break50Step)}
                        cy={yForAcc(0.5)}
                        r={3.5}
                        fill={tint}
                      />
                      <text
                        x={xForStep(c.curve.break50Step) + 6}
                        y={yForAcc(0.5) - 6}
                        fontSize={font.size.xxs}
                        fontFamily={font.mono}
                        fill={tint}
                      >
                        50% @ k={c.curve.break50Step}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Axis labels */}
            <text
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) / 2}
              y={PLOT_H - 6}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
            >
              chain length (steps, log scale) →
            </text>
            <text
              x={0} y={0}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
              transform={`translate(14, ${PLOT_PAD_T + (PLOT_H - PLOT_PAD_T - PLOT_PAD_B) / 2}) rotate(-90)`}
            >
              end-to-end accuracy →
            </text>
          </svg>
        </div>

        {/* Insight sidebar */}
        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Insight</span>
            <span style={mutedMono}>5% drop</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>∿</span>
                <span style={insightTitle}>per-step 5% 차이</span>
              </div>
              <div style={insightBody}>
                15 steps 기준<br />
                p=0.95 → <b style={{ color: color.success }}>{cmp0_95.toFixed(0)}%</b><br />
                p=0.90 → <b style={{ color: color.warn }}>{cmp0_9.toFixed(0)}%</b>
                <br />
                <span style={{ color: color.text3 }}>
                  per-step 0.05 하락이 end-to-end 2배 가까이 떨어뜨린다.
                </span>
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>⟵</span>
                <span style={insightTitle}>chain 단축 효과</span>
              </div>
              <div style={insightBody}>
                15→8 steps (p=0.9): {(curveAt(0.9, 15) * 100).toFixed(0)}% → {(curveAt(0.9, 8) * 100).toFixed(0)}%
                <br />
                <span style={{ color: color.text3 }}>
                  tool 병합 / pre-plan으로 hop 줄이면 success 크게 상승.
                </span>
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>⚠</span>
                <span style={insightTitle}>danger 경계</span>
              </div>
              <div style={insightBody}>
                p=0.9 → 50% 붕괴: k=<b>{compoundingCurve(0.9).break50Step}</b><br />
                p=0.8 → 50% 붕괴: k=<b>{compoundingCurve(0.8).break50Step}</b>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Per-task chain length</span>
          <span style={mutedMono}>projected success @ 90% per-step · &gt;15 = brittle</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, width: 28 }} />
            <span style={{ ...headCell, flex: 2 }}>task</span>
            <span style={{ ...headCell, flex: 1 }}>task-kind</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" as const }}>avg steps</span>
            <span style={{ ...headCell, width: 72, textAlign: "right" as const }}>max steps</span>
            <span style={{ ...headCell, flex: 1 }}>e2e @ 0.9</span>
            <span style={{ ...headCell, width: 80, textAlign: "right" as const }}>verdict</span>
          </div>
          {data.tasks.map((row, i) => {
            const brittle = row.avgLen > 15;
            // Pick dominant task kind by max chain length.
            let dominant: AITaskKind = "explain";
            let best = -1;
            for (const t of AI_TASK_KINDS) {
              const v = row.lengths.get(t) ?? 0;
              if (v > best) {
                best = v;
                dominant = t;
              }
            }
            const proj = curveAt(0.9, Math.round(row.avgLen));
            const projTint =
              proj >= 0.6 ? color.success : proj >= 0.3 ? color.warn : color.danger;
            return (
              <button
                key={row.entity.id}
                type="button"
                onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                style={{
                  ...fileRow,
                  animationDelay: `${160 + Math.min(i, 10) * STAGGER_MS}ms`,
                }}
              >
                <span style={{ ...rowRank, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={rowName}>{row.entity.name}</span>
                  <span style={rowPath}>{row.entity.path}</span>
                </span>
                <span style={{ flex: 1, fontFamily: font.mono, fontSize: font.size.xs, color: color.text1 }}>
                  {TASK_KOREAN[dominant]}
                </span>
                <span style={{
                  width: 72,
                  textAlign: "right",
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  color: brittle ? color.danger : color.text0,
                  fontWeight: font.weight.semibold,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {row.avgLen.toFixed(1)}
                </span>
                <span style={{
                  width: 72,
                  textAlign: "right",
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  color: color.text2,
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {row.maxLen}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={barBase}>
                    <span
                      style={{
                        ...barFill,
                        width: `${Math.max(3, proj * 100)}%`,
                        background: projTint,
                        animation: `ce-bar 540ms ${ENTRY_EASE} both`,
                        animationDelay: `${220 + i * 10}ms`,
                        transformOrigin: "left center",
                      }}
                    />
                  </span>
                  <span style={{
                    marginTop: 2,
                    display: "block",
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    color: projTint,
                    fontWeight: font.weight.semibold,
                  }}>
                    {(proj * 100).toFixed(0)}%
                  </span>
                </span>
                <span style={{ width: 80, display: "flex", justifyContent: "flex-end" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: radius.pill,
                      background: brittle ? `${color.danger}1a` : `${color.success}1a`,
                      color: brittle ? color.danger : color.success,
                      fontSize: font.size.xxs,
                      fontFamily: font.mono,
                      fontWeight: font.weight.semibold,
                      letterSpacing: font.letter.wide,
                      textTransform: "uppercase",
                    }}
                  >
                    {brittle ? "brittle" : "ok"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
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
  animation: `ce-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  gridTemplateColumns: "2fr 1fr 1fr",
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
  animation: `ce-tile 460ms ${ENTRY_EASE} both`,
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
  fontSize: 32,
  fontWeight: font.weight.bold,
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

const insightCard: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `ce-tile 440ms ${ENTRY_EASE} both`,
};

const insightHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const insightIcon: CSSProperties = {
  width: 20,
  height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.accent,
};

const insightTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.5,
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
  animation: `ce-row 440ms ${ENTRY_EASE} both`,
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

export const CompoundingErrorView = memo(CompoundingErrorViewImpl);
