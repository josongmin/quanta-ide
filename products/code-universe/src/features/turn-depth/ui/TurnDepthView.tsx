// TurnDepthView — 6-task turn-depth + brittleness radar.
// --------------------------------------------------------------------
// Reference: Anthropic agentic behavior studies 2024; "Measuring AI
// agent brittleness" emerging field. For the selected file, shows
// distribution of back-and-forth turns per task kind, replan rate per
// task, and a radar that reads at-a-glance which task types get
// brittle on this file (high replan rate = brittle).

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  turnDepthStats,
  type AITaskKind,
  type TurnDepthRow,
} from "../../../shared/analytics/synth-metrics";

export interface TurnDepthViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const POLYGON_DRAW_MS = 900;

const KEYFRAMES = `
@keyframes tdFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tdRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes tdBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes tdDrawStroke {
  from { stroke-dashoffset: var(--td-perim); }
  to   { stroke-dashoffset: 0; }
}
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const BRITTLE_THRESHOLD = 0.30;

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

function TurnDepthViewImpl({
  ctx,
  entity,
  empty,
}: TurnDepthViewProps): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rows = useMemo<TurnDepthRow[] | null>(() => {
    if (!entity) return null;
    return turnDepthStats(entity);
  }, [entity]);

  if (empty || !entity || !rows || rows.length === 0) {
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
          파일을 선택하세요.
        </div>
        <div style={{ fontSize: font.size.xs, color: color.text3 }}>
          태스크별 agent 턴 깊이와 재계획 빈도를 집계합니다.
        </div>
      </div>
    );
  }

  const maxTurns = Math.max(1, ...rows.map(r => r.p95));

  // Radar geometry
  const RADAR_SIZE = 240;
  const R = RADAR_SIZE / 2 - 46;
  const replanValues = rows.map(r => r.replanRate);
  const radarPts = polyPoints(replanValues, R);
  const radarPerim = perimeter(radarPts);
  const rings = [0.25, 0.5, 0.75, 1.0];

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
        animation: `tdFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
          Turn Depth
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            marginTop: 2,
          }}
        >
          턴 깊이 · 재계획 빈도 — Anthropic agentic behavior studies 2024 · brittleness 연구
        </div>
        <div
          style={{
            fontSize: font.size.xxs,
            color: color.text3,
            marginTop: 2,
            fontFamily: font.mono,
          }}
        >
          target: {entity.name}
        </div>
      </div>

      {/* Stats table */}
      <div
        style={{
          ...panelStyle,
          padding: 0,
          overflow: "hidden",
          marginTop: space[3],
          animation: `tdRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS}ms`,
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
          Task distribution
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Task", "p50", "p95", "max", "Replan rate", ""].map((h, i) => (
                <th
                  key={h || `h-${i}`}
                  style={{
                    textAlign: i === 0 ? "left" : i === 4 ? "left" : "right",
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
            {rows.map((r, i) => {
              const brittle = r.replanRate > BRITTLE_THRESHOLD;
              const pct = Math.min(1, r.replanRate) * 100;
              return (
                <tr
                  key={r.task}
                  style={{
                    animation: `tdRowIn 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${STAGGER_MS + i * 24}ms`,
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
                    {TASK_KOREAN[r.task]}
                  </td>
                  <td style={cellNumStyle}>{r.p50}</td>
                  <td style={cellNumStyle}>{r.p95}</td>
                  <td style={cellNumStyle}>{r.maxDepth}</td>
                  <td
                    style={{
                      padding: `${space[2]}px ${space[4]}px`,
                      borderBottom: `1px solid ${color.border}`,
                      minWidth: 160,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
                      <span
                        style={{
                          display: "inline-block",
                          flex: 1,
                          height: 6,
                          background: color.bg3,
                          borderRadius: radius.pill,
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${Math.max(2, pct)}%`,
                            background: brittle ? color.danger : color.accent,
                            opacity: 0.85,
                            transformOrigin: "0 50%",
                            animation: `tdBarGrow 540ms ${ENTRY_EASE} both`,
                            animationDelay: `${STAGGER_MS + i * 24 + 60}ms`,
                          }}
                        />
                      </span>
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: font.size.xxs,
                          color: color.text1,
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 36,
                          textAlign: "right",
                        }}
                      >
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: `${space[2]}px ${space[4]}px`,
                      borderBottom: `1px solid ${color.border}`,
                      textAlign: "right",
                    }}
                  >
                    {brittle && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: radius.pill,
                          background: `${color.danger}1a`,
                          color: color.danger,
                          fontSize: font.size.xxs,
                          fontWeight: font.weight.semibold,
                          letterSpacing: font.letter.wide,
                          textTransform: "uppercase",
                          border: `1px solid ${color.danger}40`,
                        }}
                      >
                        brittle
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Range chart (p50 / p95 bars) */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          animation: `tdRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 2}ms`,
        }}
      >
        <div style={panelLabelStyle}>Turn range — p50 ↔ p95</div>
        <div
          style={{
            marginTop: space[3],
            display: "flex",
            flexDirection: "column",
            gap: space[2],
          }}
        >
          {rows.map((r, i) => {
            const p50Pct = (r.p50 / maxTurns) * 100;
            const p95Pct = (r.p95 / maxTurns) * 100;
            return (
              <div
                key={r.task}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 88px",
                  alignItems: "center",
                  gap: space[3],
                }}
              >
                <span
                  style={{
                    fontSize: font.size.sm,
                    color: color.text0,
                    fontWeight: font.weight.medium,
                  }}
                >
                  {TASK_KOREAN[r.task]}
                </span>
                <span
                  style={{
                    position: "relative",
                    display: "block",
                    height: 14,
                    background: color.bg3,
                    borderRadius: radius.pill,
                    overflow: "hidden",
                  }}
                >
                  {/* p95 (wider, softer) */}
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${Math.max(2, Math.min(100, p95Pct))}%`,
                      background: color.accent,
                      opacity: 0.35,
                      transformOrigin: "0 50%",
                      animation: `tdBarGrow 540ms ${ENTRY_EASE} both`,
                      animationDelay: `${STAGGER_MS * 2 + i * 26}ms`,
                    }}
                  />
                  {/* p50 (inner, saturated) */}
                  <span
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: "100%",
                      width: `${Math.max(2, Math.min(100, p50Pct))}%`,
                      background: color.accent,
                      opacity: 0.95,
                      transformOrigin: "0 50%",
                      animation: `tdBarGrow 540ms ${ENTRY_EASE} both`,
                      animationDelay: `${STAGGER_MS * 2 + i * 26 + 60}ms`,
                    }}
                  />
                </span>
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    color: color.text2,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.p50} / {r.p95}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: space[3],
            fontSize: font.size.xxs,
            color: color.text3,
            fontFamily: font.mono,
          }}
        >
          dark = p50 · faded = p95
        </div>
      </div>

      {/* Brittleness radar */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          animation: `tdRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 3}ms`,
        }}
      >
        <div style={panelLabelStyle}>Brittleness radar — replan rate per task</div>
        <div
          style={{
            marginTop: space[3],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: RADAR_SIZE + 40,
          }}
        >
          <svg
            width={RADAR_SIZE}
            height={RADAR_SIZE}
            viewBox={`${-RADAR_SIZE / 2} ${-RADAR_SIZE / 2} ${RADAR_SIZE} ${RADAR_SIZE}`}
            style={{ display: "block", overflow: "visible" }}
            role="img"
            aria-label="Brittleness radar"
          >
            <defs>
              <radialGradient id="td-radar-fill" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor={color.danger} stopOpacity={0.24} />
                <stop offset="100%" stopColor={color.danger} stopOpacity={0.04} />
              </radialGradient>
            </defs>

            {/* Rings */}
            {rings.map((ring, i) => (
              <circle
                key={`r-${i}`}
                cx={0}
                cy={0}
                r={R * ring}
                fill="none"
                stroke={color.border}
                strokeWidth={0.7}
                strokeDasharray={i === rings.length - 1 ? "0" : "2,4"}
                opacity={i === rings.length - 1 ? 0.6 : 0.4}
              />
            ))}

            {/* Ring tick labels */}
            {rings.map((ring, i) => (
              <text
                key={`rl-${i}`}
                x={4}
                y={-R * ring + 3}
                fontFamily={font.sans}
                fontSize={9}
                fill={color.text3}
                opacity={0.7}
              >
                {Math.round(ring * 100)}
              </text>
            ))}

            {/* Spokes */}
            {rows.map((r, i) => {
              const p = axisPoint(i, rows.length, R);
              return (
                <line
                  key={`spoke-${r.task}`}
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

            {/* Polygon fill */}
            <polygon points={pointsAttr(radarPts)} fill="url(#td-radar-fill)" />

            {/* Polygon stroke — drawn in */}
            <polygon
              points={pointsAttr(radarPts)}
              fill="none"
              stroke={color.danger}
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{
                strokeDasharray: radarPerim.toFixed(2),
                strokeDashoffset: radarPerim.toFixed(2),
                animation: `tdDrawStroke ${POLYGON_DRAW_MS}ms ${ENTRY_EASE} 220ms forwards`,
                ["--td-perim" as string]: radarPerim.toFixed(2),
              } as CSSProperties}
            />

            {/* Vertices */}
            {radarPts.map((p, i) => (
              <circle
                key={`vx-${rows[i]!.task}`}
                cx={p.x}
                cy={p.y}
                r={3.2}
                fill={color.danger}
                stroke={color.bg0}
                strokeWidth={1.2}
              />
            ))}

            {/* Axis labels */}
            {rows.map((r, i) => {
              const p = axisPoint(i, rows.length, R + 22);
              const anchor = Math.abs(p.x) < 8 ? "middle" : p.x > 0 ? "start" : "end";
              return (
                <g key={`lbl-${r.task}`}>
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
                    {TASK_KOREAN[r.task]}
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
                    {Math.round(r.replanRate * 100)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
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

export const TurnDepthView = memo(TurnDepthViewImpl);
