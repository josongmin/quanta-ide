// ReadinessScoreView — repo-wide agent-readiness composite dashboard.
// --------------------------------------------------------------------
// Reference: OpenAI GPTs readiness (2024); Codeium AI-readiness score
// (2024); Anthropic "Preparing your codebase for Claude" (2024). A
// 0..100 composite score over six factors (docs, tests, types, naming,
// commits, arch) answers "is this repo ready for agents?" at a glance.
// Score ring is drawn via strokeDasharray sweep; the factor radar
// draws in over 900ms; the per-factor gap table highlights which
// factor to invest in first. "Action items" on the right are derived
// from the lowest-scoring factors so the viewer always has a concrete
// next step.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  agentReadiness,
  type AgentReadiness,
} from "../../../shared/analytics/synth-metrics";

export interface ReadinessScoreViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 20;
const COUNTER_MS = 640;
const RING_SWEEP_MS = 900;
const POLYGON_DRAW_MS = 900;

const KEYFRAMES = `
@keyframes rsFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes rsRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes rsBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes rsRingSweep {
  from { stroke-dashoffset: var(--rs-circ); }
  to   { stroke-dashoffset: var(--rs-offset); }
}
@keyframes rsDrawStroke {
  from { stroke-dashoffset: var(--rs-perim); }
  to   { stroke-dashoffset: 0; }
}
`;

type FactorKey = keyof AgentReadiness["factors"];

interface FactorMeta {
  key: FactorKey;
  label: string;
  kr: string;
  target: number;
  weight: number;
  suggestion: string;
}

const FACTORS: readonly FactorMeta[] = [
  { key: "docs",    label: "Docs",    kr: "문서",         target: 0.70, weight: 18, suggestion: "docstring coverage 높이기" },
  { key: "tests",   label: "Tests",   kr: "테스트",       target: 0.70, weight: 22, suggestion: "커버리지 늘리기 · critical path 우선" },
  { key: "types",   label: "Types",   kr: "타입",         target: 0.75, weight: 18, suggestion: "any 제거 · 공개 API 시그니처 강화" },
  { key: "naming",  label: "Naming",  kr: "네이밍",       target: 0.70, weight: 14, suggestion: "축약어/모호한 이름 rename" },
  { key: "commits", label: "Commits", kr: "커밋 품질",    target: 0.75, weight: 14, suggestion: "commit 메시지 convention + 작은 단위" },
  { key: "arch",    label: "Arch",    kr: "아키텍처",     target: 0.75, weight: 14, suggestion: "layer boundary / FSD 위반 정리" },
];

interface Point { x: number; y: number }

function axisPoint(idx: number, total: number, r: number): Point {
  const a = -Math.PI / 2 + (idx / total) * Math.PI * 2;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
function polyPoints(values: number[], rMax: number): Point[] {
  return values.map((v, i) => axisPoint(i, values.length, v * rMax));
}
function pointsAttr(pts: Point[]): string {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
function perimeter(pts: Point[]): number {
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function bandColor(band: AgentReadiness["band"]): string {
  switch (band) {
    case "A": return color.success;
    case "B": return "#7db843";
    case "C": return color.warn;
    case "D": return "#e06a21";
    case "E": return color.danger;
  }
}

function bandCopy(band: AgentReadiness["band"]): string {
  switch (band) {
    case "A": return "우수";
    case "B": return "양호";
    case "C": return "주의";
    case "D": return "개선 필요";
    case "E": return "긴급";
  }
}

/** rAF interpolated counter 0→target, ease-out cubic. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
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

function ReadinessScoreViewImpl({ ctx }: ReadinessScoreViewProps): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const data = useMemo<AgentReadiness>(() => {
    return agentReadiness(ctx.tree);
  }, [ctx.tree]);

  const scoreAnim = useCounter(data.score, COUNTER_MS);

  if (data.score === 0 && !ctx.tree) {
    return (
      <div
        style={{
          width,
          height,
          background: color.bg0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          fontFamily: font.sans,
        }}
      >
        <style>{KEYFRAMES}</style>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>
          Workspace 로딩 중…
        </div>
      </div>
    );
  }

  const band = data.band;
  const ring = bandColor(band);

  // Ring geometry
  const R = 84;
  const circ = 2 * Math.PI * R;
  const scorePct = Math.max(0, Math.min(100, data.score)) / 100;
  const ringOffset = circ * (1 - scorePct);

  // Radar geometry
  const RADAR_SIZE = 280;
  const RR = RADAR_SIZE / 2 - 56;
  const factorValues = FACTORS.map(f => data.factors[f.key]);
  const radarPts = polyPoints(factorValues, RR);
  const radarPerim = perimeter(radarPts);
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Per-factor gap rows sorted by severity (biggest gap first).
  const factorRows = FACTORS.map(f => {
    const val = data.factors[f.key];
    const gap = val - f.target;
    return { ...f, val, gap };
  }).sort((a, b) => a.gap - b.gap);

  // Action items = top 3 lowest-scoring factors (gap < 0).
  const actionItems = factorRows.filter(r => r.gap < -0.05).slice(0, 4);

  return (
    <div
      style={{
        width,
        height,
        background: color.bg0,
        fontFamily: font.sans,
        color: color.text0,
        overflowY: "auto",
        boxSizing: "border-box",
        padding: `${space[5]}px ${space[6]}px`,
        animation: `rsFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={{ marginBottom: space[4] }}>
        <div
          style={{
            fontSize: font.size.display,
            fontWeight: font.weight.semibold,
            letterSpacing: font.letter.tight,
          }}
        >
          Readiness Score
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            marginTop: 2,
          }}
        >
          에이전트 투입 준비도 — OpenAI GPTs readiness · Codeium AI-readiness · Anthropic "Preparing your codebase for Claude" 2024
        </div>
      </div>

      {/* Top row: Hero (ring + medal) · Radar · Action items */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "420px minmax(0, 1fr) 300px",
          gap: space[3],
        }}
      >
        {/* Hero ring */}
        <div
          style={{
            ...panelStyle,
            padding: `${space[4]}px ${space[5]}px`,
            animation: `rsRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS}ms`,
          }}
        >
          <div style={panelLabelStyle}>Composite score</div>
          <div
            style={{
              marginTop: space[3],
              display: "flex",
              alignItems: "center",
              gap: space[4],
            }}
          >
            <svg width={200} height={200} viewBox="-100 -100 200 200">
              <circle cx={0} cy={0} r={R} fill="none" stroke={color.bg3} strokeWidth={12} />
              <circle
                cx={0}
                cy={0}
                r={R}
                fill="none"
                stroke={ring}
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray={`${circ.toFixed(2)}`}
                strokeDashoffset={circ.toFixed(2)}
                style={{
                  ["--rs-circ" as string]: circ.toFixed(2),
                  ["--rs-offset" as string]: ringOffset.toFixed(2),
                  animation: `rsRingSweep ${RING_SWEEP_MS}ms ${ENTRY_EASE} 120ms forwards`,
                }}
                transform="rotate(-90)"
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                fontFamily={font.mono}
                fontSize={44}
                fontWeight={font.weight.bold}
                fill={color.text0}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(scoreAnim)}
              </text>
              <text
                x={0}
                y={26}
                textAnchor="middle"
                fontFamily={font.sans}
                fontSize={11}
                fill={color.text2}
              >
                / 100
              </text>
            </svg>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[2] }}>
              <div
                style={{
                  fontSize: font.size.xxs,
                  color: color.text2,
                  letterSpacing: font.letter.ultra,
                  textTransform: "uppercase",
                  fontWeight: font.weight.semibold,
                }}
              >
                Band
              </div>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: ring,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: font.mono,
                  fontSize: 32,
                  fontWeight: font.weight.bold,
                  boxShadow: `0 6px 14px ${ring}33`,
                }}
              >
                {band}
              </div>
              <div
                style={{
                  fontSize: font.size.sm,
                  color: color.text1,
                  fontWeight: font.weight.medium,
                }}
              >
                Agent 투입 준비 상태: {bandCopy(band)}
              </div>
            </div>
          </div>
        </div>

        {/* Radar */}
        <div
          style={{
            ...panelStyle,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            animation: `rsRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS * 2}ms`,
          }}
        >
          <div style={panelLabelStyle}>6-factor radar</div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: space[3],
              minHeight: RADAR_SIZE,
            }}
          >
            <svg
              width={RADAR_SIZE}
              height={RADAR_SIZE}
              viewBox={`${-RADAR_SIZE / 2} ${-RADAR_SIZE / 2} ${RADAR_SIZE} ${RADAR_SIZE}`}
              style={{ display: "block", overflow: "visible" }}
              role="img"
              aria-label="Readiness radar"
            >
              <defs>
                <radialGradient id="rs-radar-fill" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={color.accent} stopOpacity={0.24} />
                  <stop offset="100%" stopColor={color.accent} stopOpacity={0.04} />
                </radialGradient>
              </defs>

              {/* Rings */}
              {rings.map((ringR, i) => (
                <circle
                  key={`r-${i}`}
                  cx={0}
                  cy={0}
                  r={RR * ringR}
                  fill="none"
                  stroke={color.border}
                  strokeWidth={0.7}
                  strokeDasharray={i === rings.length - 1 ? "0" : "2,4"}
                  opacity={i === rings.length - 1 ? 0.6 : 0.4}
                />
              ))}

              {/* Ring tick labels */}
              {rings.map((ringR, i) => (
                <text
                  key={`rl-${i}`}
                  x={4}
                  y={-RR * ringR + 3}
                  fontFamily={font.sans}
                  fontSize={9}
                  fill={color.text3}
                  opacity={0.7}
                >
                  {Math.round(ringR * 100)}
                </text>
              ))}

              {/* Spokes */}
              {FACTORS.map((f, i) => {
                const p = axisPoint(i, FACTORS.length, RR);
                return (
                  <line
                    key={`spoke-${f.key}`}
                    x1={0}
                    y1={0}
                    x2={p.x}
                    y2={p.y}
                    stroke={color.border}
                    strokeWidth={0.7}
                    opacity={0.6}
                  />
                );
              })}

              {/* Fill */}
              <polygon points={pointsAttr(radarPts)} fill="url(#rs-radar-fill)" />

              {/* Stroke (drawn) */}
              <polygon
                points={pointsAttr(radarPts)}
                fill="none"
                stroke={color.accent}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{
                  strokeDasharray: radarPerim.toFixed(2),
                  strokeDashoffset: radarPerim.toFixed(2),
                  animation: `rsDrawStroke ${POLYGON_DRAW_MS}ms ${ENTRY_EASE} 320ms forwards`,
                  ["--rs-perim" as string]: radarPerim.toFixed(2),
                } as CSSProperties}
              />

              {/* Vertices */}
              {radarPts.map((p, i) => (
                <circle
                  key={`vx-${FACTORS[i]!.key}`}
                  cx={p.x}
                  cy={p.y}
                  r={3.4}
                  fill={color.accent}
                  stroke={color.bg0}
                  strokeWidth={1.2}
                />
              ))}

              {/* Labels */}
              {FACTORS.map((f, i) => {
                const p = axisPoint(i, FACTORS.length, RR + 24);
                const anchor = Math.abs(p.x) < 8 ? "middle" : p.x > 0 ? "start" : "end";
                const val = data.factors[f.key];
                return (
                  <g key={`lbl-${f.key}`}>
                    <text
                      x={p.x}
                      y={p.y}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      fontFamily={font.sans}
                      fontSize={font.size.xs}
                      fontWeight={font.weight.semibold}
                      fill={color.text1}
                      style={{ letterSpacing: font.letter.wide }}
                    >
                      {f.label}
                    </text>
                    <text
                      x={p.x}
                      y={p.y + 12}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                      fontFamily={font.mono}
                      fontSize={9}
                      fill={color.text3}
                    >
                      {Math.round(val * 100)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Action items */}
        <div
          style={{
            ...panelStyle,
            animation: `rsRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS * 3}ms`,
          }}
        >
          <div style={panelLabelStyle}>Action items</div>
          <div
            style={{
              marginTop: space[3],
              display: "flex",
              flexDirection: "column",
              gap: space[2],
            }}
          >
            {actionItems.length === 0 ? (
              <div
                style={{
                  fontSize: font.size.sm,
                  color: color.success,
                  padding: `${space[2]}px 0`,
                }}
              >
                모든 factor가 목표치에 근접합니다.
              </div>
            ) : (
              actionItems.map((f, i) => (
                <div
                  key={f.key}
                  style={{
                    padding: `${space[2]}px ${space[3]}px`,
                    background: color.bg2,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.md,
                    animation: `rsRowIn 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${STAGGER_MS * 3 + i * 30}ms`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: font.size.sm,
                        color: color.text0,
                        fontWeight: font.weight.semibold,
                      }}
                    >
                      {f.label}
                      <span
                        style={{
                          marginLeft: space[1],
                          fontSize: font.size.xxs,
                          color: color.text3,
                          fontWeight: font.weight.regular,
                        }}
                      >
                        {f.kr}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: font.size.xxs,
                        color: color.danger,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {(f.gap * 100).toFixed(0)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: font.size.xxs,
                      color: color.text2,
                      lineHeight: 1.4,
                    }}
                  >
                    {f.suggestion}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Factor table with gap analysis */}
      <div
        style={{
          ...panelStyle,
          padding: 0,
          overflow: "hidden",
          marginTop: space[3],
          animation: `rsRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 4}ms`,
        }}
      >
        <div
          style={{
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${color.border}`,
            fontSize: font.size.xs,
            color: color.text2,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
            fontWeight: font.weight.semibold,
          }}
        >
          Factor gap analysis
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Factor", "Current", "Target", "Gap", "Weight", "Progress"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? "left" : i === 5 ? "left" : "right",
                    padding: `${space[2]}px ${space[4]}px`,
                    fontSize: font.size.xxs,
                    color: color.text2,
                    fontWeight: font.weight.medium,
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                    borderBottom: `1px solid ${color.border}`,
                    background: color.bg2,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorRows.map((f, i) => {
              const gapNeg = f.gap < 0;
              const priority = gapNeg && f.gap < -0.15;
              return (
                <tr
                  key={f.key}
                  style={{
                    animation: `rsRowIn 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${STAGGER_MS * 4 + i * 24}ms`,
                  }}
                >
                  <td
                    style={{
                      padding: `${space[2]}px ${space[4]}px`,
                      fontSize: font.size.sm,
                      color: color.text0,
                      fontWeight: font.weight.medium,
                      borderBottom: `1px solid ${color.border}`,
                    }}
                  >
                    {f.label}
                    <span
                      style={{
                        marginLeft: space[1],
                        fontSize: font.size.xxs,
                        color: color.text3,
                        fontWeight: font.weight.regular,
                      }}
                    >
                      {f.kr}
                    </span>
                    {priority && (
                      <span
                        style={{
                          marginLeft: space[2],
                          padding: "1px 6px",
                          borderRadius: radius.pill,
                          background: `${color.danger}1a`,
                          color: color.danger,
                          fontSize: font.size.xxs,
                          fontWeight: font.weight.semibold,
                        }}
                      >
                        개선 우선
                      </span>
                    )}
                  </td>
                  <td style={cellNumStyle}>{f.val.toFixed(2)}</td>
                  <td style={cellNumStyle}>{f.target.toFixed(2)}</td>
                  <td
                    style={{
                      ...cellNumStyle,
                      color: gapNeg ? color.danger : color.success,
                      fontWeight: font.weight.semibold,
                    }}
                  >
                    {f.gap >= 0 ? "+" : ""}{f.gap.toFixed(2)}
                  </td>
                  <td style={cellNumStyle}>{f.weight}</td>
                  <td
                    style={{
                      padding: `${space[2]}px ${space[4]}px`,
                      borderBottom: `1px solid ${color.border}`,
                      minWidth: 180,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        height: 8,
                        background: color.bg3,
                        borderRadius: radius.pill,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          width: `${Math.max(2, Math.min(100, f.val * 100))}%`,
                          background: gapNeg ? color.danger : color.success,
                          opacity: 0.85,
                          transformOrigin: "0 50%",
                          animation: `rsBarGrow 540ms ${ENTRY_EASE} both`,
                          animationDelay: `${STAGGER_MS * 4 + i * 24 + 80}ms`,
                        }}
                      />
                      {/* Target marker */}
                      <span
                        style={{
                          position: "absolute",
                          top: -3,
                          left: `${Math.max(2, Math.min(100, f.target * 100))}%`,
                          width: 2,
                          height: 14,
                          background: color.text2,
                          opacity: 0.8,
                          borderRadius: 1,
                        }}
                        title={`target ${f.target.toFixed(2)}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: `${space[3]}px ${space[4]}px`,
  boxSizing: "border-box",
};

const panelLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  fontWeight: font.weight.semibold,
};

const cellNumStyle: CSSProperties = {
  padding: `${space[2]}px ${space[4]}px`,
  fontSize: font.size.sm,
  color: color.text1,
  borderBottom: `1px solid ${color.border}`,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

export const ReadinessScoreView = memo(ReadinessScoreViewImpl);
