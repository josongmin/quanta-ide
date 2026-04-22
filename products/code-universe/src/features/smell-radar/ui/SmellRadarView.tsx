// SmellRadarView — multi-axis radar / spider chart of repo smell profile.
// --------------------------------------------------------------------
// Axes (6): god-class, long-method, deep-nesting, magic-number, dead-code,
// circular-dep. Each axis 0..1 (normalised across files). Current repo
// profile = solid polygon; last-week profile = dashed ghost polygon so
// drift reads immediately.
//
// A "radar sweep" arm rotates continuously (22s / rev) behind the polygon,
// emitting a soft trailing gradient — makes the panel feel alive without
// demanding attention. Entrance: polygon stroke draws in via
// stroke-dashoffset over 900ms after axes/labels settle.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  SMELL_KINDS,
  seeded,
  smellProfile,
  type SmellKind,
} from "../../../shared/analytics/synth-metrics";

// ── Axis metadata ────────────────────────────────────────────────────
interface AxisMeta {
  kind: SmellKind;
  label: string;
  kr: string;
  accent: string;
}
const AXES: readonly AxisMeta[] = [
  { kind: "god-class",    label: "God-Class",    kr: "거대 클래스",   accent: "#e5484d" },
  { kind: "long-method",  label: "Long-Method",  kr: "긴 메서드",     accent: "#e09321" },
  { kind: "deep-nesting", label: "Deep-Nesting", kr: "깊은 중첩",     accent: "#f76b15" },
  { kind: "magic-number", label: "Magic-Number", kr: "매직 넘버",     accent: "#9e77ff" },
  { kind: "dead-code",    label: "Dead-Code",    kr: "데드 코드",     accent: "#8c9bab" },
  { kind: "circular-dep", label: "Circular-Dep", kr: "순환 의존",     accent: "#0d99ff" },
];

// ── Animation constants ──────────────────────────────────────────────
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const SWEEP_DURATION_MS = 22_000;
const POLYGON_DRAW_MS = 900;

const KEYFRAMES = `
@keyframes sr-fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sr-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes sr-drawStroke {
  from { stroke-dashoffset: var(--sr-perim); }
  to   { stroke-dashoffset: 0; }
}
@keyframes sr-breatheFill {
  0%, 100% { opacity: 0.16; }
  50%       { opacity: 0.28; }
}
@keyframes sr-ghostDrift {
  0%, 100% { stroke-dashoffset: 0; }
  100%      { stroke-dashoffset: -160; }
}
@keyframes sr-labelIn {
  from { opacity: 0; transform: translate(0, 4px); }
  to   { opacity: 1; transform: translate(0, 0);   }
}
`;

// ── Aggregation ──────────────────────────────────────────────────────
interface Aggregated {
  /** Per-axis mean in 0..1 — current week. */
  current: Record<SmellKind, number>;
  /** Per-axis mean in 0..1 — previous week (synthesized drift). */
  ghost:   Record<SmellKind, number>;
  /** Raw totals per axis for the side legend. */
  totals:  Record<SmellKind, number>;
  /** Number of file entities sampled. */
  fileCount: number;
}

function aggregate(ctx: ViewContextValue): Aggregated | null {
  if (!ctx.tree) return null;
  const totals = {} as Record<SmellKind, number>;
  const current = {} as Record<SmellKind, number>;
  const ghost = {} as Record<SmellKind, number>;
  for (const k of SMELL_KINDS) {
    totals[k] = 0;
    current[k] = 0;
    ghost[k] = 0;
  }

  let n = 0;
  // Per-kind max across the repo, used to normalise each axis.
  const perFilePerKind = new Map<string, Record<SmellKind, number>>();
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const prof = smellProfile(e);
    perFilePerKind.set(e.id, prof);
    n++;
    for (const k of SMELL_KINDS) totals[k] += prof[k];
  }
  if (n === 0) return null;

  // Normalise: each axis's max over files → 1.0. Cap at 8 (the synth
  // generator's upper bound per file per kind), then average to get the
  // repo-wide profile as 0..1.
  for (const k of SMELL_KINDS) {
    // Mean per-file occurrence / 8 (theoretical max)
    const mean = totals[k] / n;
    current[k] = Math.min(1, mean / 4); // scale so mean=4 = full axis
  }

  // Ghost = stable drift from current — separate seeded noise so the
  // user sees one-week-ago as a related-but-distinct polygon.
  for (const k of SMELL_KINDS) {
    const drift = (seeded(`smell-radar::${k}`, "ghost")() - 0.5) * 0.22;
    ghost[k] = Math.max(0, Math.min(1, current[k] - drift));
  }

  return { current, ghost, totals, fileCount: n };
}

// ── Geometry helpers ─────────────────────────────────────────────────
interface Point { x: number; y: number }

/** Polar → cartesian. Axis index 0 is "up" (-π/2). */
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

// ── Component ────────────────────────────────────────────────────────
function SmellRadarViewImpl({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const [hoveredAxis, setHoveredAxis] = useState<SmellKind | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const data = useMemo(() => aggregate(ctx), [ctx]);

  if (!data) {
    return (
      <div style={emptyStateStyle}>
        <span style={emptyTitleStyle}>No file entities to scan</span>
        <span style={emptySubtitleStyle}>Workspace tree is empty or loading.</span>
      </div>
    );
  }

  // Radar sizes itself to the smaller of the two viewport dims, leaving
  // headroom for the side legend on the right.
  const SIDE_PANEL_W = 260;
  const usableW = Math.max(320, width - SIDE_PANEL_W - space[7]);
  const chartSize = Math.min(usableW, height - 120);
  const R = chartSize / 2 - 80; // room for labels outside the rim

  const cx = chartSize / 2;
  const cy = chartSize / 2;

  const currentValues = AXES.map(a => data.current[a.kind]);
  const ghostValues   = AXES.map(a => data.ghost[a.kind]);
  const currentPts    = polyPoints(currentValues, R);
  const ghostPts      = polyPoints(ghostValues,   R);
  const perim         = perimeter(currentPts);

  const rings = [0.25, 0.5, 0.75, 1.0];

  // Overall health score — rough "all axes low = healthy" metric.
  const healthScore = Math.round(
    (1 - currentValues.reduce((a, b) => a + b, 0) / currentValues.length) * 100,
  );
  const healthColor =
    healthScore >= 70 ? color.success : healthScore >= 45 ? color.warn : color.danger;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Smell Radar</span>
          <span style={subtitleStyle}>코드 스멜 레이더 — 전체 repo 건강 상태</span>
        </div>
        <div style={healthBadgeStyle(healthColor)}>
          <span style={healthValueStyle}>{healthScore}</span>
          <span style={healthLabelStyle}>/ 100</span>
        </div>
      </div>

      {/* Chart + legend */}
      <div style={bodyStyle}>
        <div style={{ ...chartAreaStyle, width: chartSize, height: chartSize }}>
          <svg
            width={chartSize}
            height={chartSize}
            viewBox={`${-cx} ${-cy} ${chartSize} ${chartSize}`}
            style={{ display: "block", overflow: "visible", animation: `sr-fadeIn 520ms ${ENTRY_EASE} both` }}
            role="img"
            aria-label="Smell radar"
          >
            <defs>
              {/* Rotating sweep gradient — a narrow wedge that trails off
               *  into transparency so the panel reads as "radar scanning". */}
              <linearGradient id="sr-sweep-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={color.accent} stopOpacity={0} />
                <stop offset="60%"  stopColor={color.accent} stopOpacity={0.05} />
                <stop offset="92%"  stopColor={color.accent} stopOpacity={0.22} />
                <stop offset="100%" stopColor={color.accent} stopOpacity={0.36} />
              </linearGradient>
              <radialGradient id="sr-poly-fill" cx="50%" cy="50%" r="60%">
                <stop offset="0%"   stopColor={color.accent} stopOpacity={0.26} />
                <stop offset="100%" stopColor={color.accent} stopOpacity={0.04} />
              </radialGradient>
              <filter id="sr-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                <feOffset dx="0" dy="2" result="off" />
                <feColorMatrix in="off" type="matrix"
                  values="0 0 0 0 0.05  0 0 0 0 0.60  0 0 0 0 1  0 0 0 0.18 0" />
                <feComposite in2="SourceGraphic" operator="over" />
              </filter>
            </defs>

            {/* Concentric guide rings */}
            {rings.map((ring, i) => (
              <circle
                key={`r-${i}`}
                cx={0} cy={0} r={R * ring}
                fill="none"
                stroke={color.border}
                strokeWidth={0.7}
                strokeDasharray={i === rings.length - 1 ? "0" : "2,4"}
                opacity={i === rings.length - 1 ? 0.6 : 0.4}
              />
            ))}

            {/* Ring tick labels along the top axis */}
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

            {/* Axis spokes */}
            {AXES.map((a, i) => {
              const p = axisPoint(i, AXES.length, R);
              return (
                <line
                  key={`spoke-${a.kind}`}
                  x1={0} y1={0}
                  x2={p.x} y2={p.y}
                  stroke={color.border}
                  strokeWidth={0.7}
                  opacity={0.6}
                />
              );
            })}

            {/* Radar sweep arm — breathing rotation, 22s per revolution. */}
            <g style={{ animation: `sr-sweep ${SWEEP_DURATION_MS}ms linear infinite`, transformOrigin: "0 0" }}>
              <path
                d={`M 0 0 L ${R} 0 A ${R} ${R} 0 0 0 ${(R * Math.cos(-Math.PI / 6)).toFixed(2)} ${(R * Math.sin(-Math.PI / 6)).toFixed(2)} Z`}
                fill="url(#sr-sweep-grad)"
                opacity={0.9}
              />
              {/* Crisp leading edge */}
              <line
                x1={0} y1={0}
                x2={R} y2={0}
                stroke={color.accent}
                strokeWidth={1.0}
                strokeOpacity={0.52}
              />
            </g>

            {/* Ghost polygon — last week */}
            <polygon
              points={pointsAttr(ghostPts)}
              fill="none"
              stroke={color.text2}
              strokeWidth={1.0}
              strokeDasharray="4,4"
              strokeLinejoin="round"
              opacity={0.55}
              style={{
                animation: `sr-ghostDrift 4200ms linear infinite`,
              }}
            />

            {/* Current polygon fill */}
            <polygon
              points={pointsAttr(currentPts)}
              fill="url(#sr-poly-fill)"
              style={{
                animation: `sr-breatheFill 2800ms ease-in-out infinite`,
              }}
            />

            {/* Current polygon stroke — drawn in */}
            <polygon
              points={pointsAttr(currentPts)}
              fill="none"
              stroke={color.accent}
              strokeWidth={1.6}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#sr-soft-shadow)"
              style={{
                strokeDasharray: perim.toFixed(2),
                strokeDashoffset: perim.toFixed(2),
                animation: `sr-drawStroke ${POLYGON_DRAW_MS}ms ${ENTRY_EASE} 220ms forwards`,
                ["--sr-perim" as string]: perim.toFixed(2),
              } as CSSProperties}
            />

            {/* Axis value vertices */}
            {currentPts.map((p, i) => {
              const a = AXES[i]!;
              const hovered = hoveredAxis === a.kind;
              return (
                <circle
                  key={`vx-${a.kind}`}
                  cx={p.x} cy={p.y}
                  r={hovered ? 5 : 3.2}
                  fill={a.accent}
                  stroke={color.bg0}
                  strokeWidth={1.2}
                  style={{
                    transition: "r 160ms ease-out",
                    animation: `sr-fadeIn 420ms ${ENTRY_EASE} ${320 + i * 18}ms both`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredAxis(a.kind)}
                  onMouseLeave={() => setHoveredAxis(null)}
                />
              );
            })}

            {/* Axis labels — set just outside the rim */}
            {AXES.map((a, i) => {
              const p = axisPoint(i, AXES.length, R + 26);
              // Anchor based on which quadrant the label sits in
              const anchor =
                Math.abs(p.x) < 8 ? "middle" : p.x > 0 ? "start" : "end";
              const hovered = hoveredAxis === a.kind;
              const rawVal = data.current[a.kind];
              const label = `${a.label}`;
              return (
                <g
                  key={`lbl-${a.kind}`}
                  style={{
                    animation: `sr-labelIn 420ms ${ENTRY_EASE} ${360 + i * 20}ms both`,
                  }}
                >
                  <text
                    x={p.x}
                    y={p.y}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    fontFamily={font.sans}
                    fontSize={font.size.xs}
                    fontWeight={hovered ? 700 : 600}
                    fill={hovered ? a.accent : color.text1}
                    style={{ letterSpacing: "0.02em" }}
                  >
                    {label}
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
                    {Math.round(rawVal * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Center node */}
            <circle
              cx={0} cy={0} r={3.4}
              fill={color.accent}
              opacity={0.85}
            />
            <circle
              cx={0} cy={0} r={11}
              fill="none"
              stroke={color.accent}
              strokeWidth={0.8}
              strokeOpacity={0.32}
            />
          </svg>
        </div>

        {/* Side legend */}
        <div style={legendStyle}>
          <div style={legendSectionStyle}>
            <span style={legendHeadStyle}>Axes</span>
            {AXES.map((a) => {
              const v = data.current[a.kind];
              const ghost = data.ghost[a.kind];
              const diff = v - ghost;
              const hovered = hoveredAxis === a.kind;
              return (
                <div
                  key={`leg-${a.kind}`}
                  style={legendRowStyle(hovered)}
                  onMouseEnter={() => setHoveredAxis(a.kind)}
                  onMouseLeave={() => setHoveredAxis(null)}
                >
                  <span style={{ ...legendDotStyle, background: a.accent }} />
                  <div style={legendTextBlockStyle}>
                    <span style={legendLabelStyle}>{a.label}</span>
                    <span style={legendKrStyle}>{a.kr}</span>
                  </div>
                  <span style={legendValueStyle}>{Math.round(v * 100)}</span>
                  <span style={legendDriftStyle(diff)}>
                    {diff >= 0 ? "▲" : "▼"} {Math.abs(Math.round(diff * 100))}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={legendFooterStyle}>
            <span style={legendCaptionStyle}>
              실선 = 이번 주 · 점선 = 지난 주
            </span>
            <span style={legendCaptionStyle}>
              {data.fileCount} files scanned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: color.bg0,
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  color: color.text0,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[4]}px ${space[5]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
};

const titleBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};
const subtitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text2,
};

const healthBadgeStyle = (c: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  padding: `${space[2]}px ${space[3]}px`,
  borderRadius: radius.lg,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  color: c,
  fontFamily: font.mono,
});
const healthValueStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
};
const healthLabelStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: space[6],
  padding: space[5],
  minHeight: 0,
};

const chartAreaStyle: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const legendStyle: CSSProperties = {
  width: 260,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: `sr-fadeIn 520ms ${ENTRY_EASE} 320ms both`,
};

const legendSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const legendHeadStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: space[1],
};
const legendRowStyle = (hovered: boolean): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "10px 1fr auto auto",
  gap: space[2],
  alignItems: "center",
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
  background: hovered ? color.hover : "transparent",
  transition: "background 140ms ease-out",
  cursor: "default",
});
const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: radius.pill,
};
const legendTextBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};
const legendLabelStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
};
const legendKrStyle: CSSProperties = {
  fontSize: 10,
  color: color.text3,
};
const legendValueStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
};
const legendDriftStyle = (diff: number): CSSProperties => ({
  fontFamily: font.mono,
  fontSize: 10,
  color: diff > 0 ? color.danger : diff < 0 ? color.success : color.text3,
  minWidth: 36,
  textAlign: "right",
});
const legendFooterStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingTop: space[2],
  borderTop: `1px solid ${color.border}`,
};
const legendCaptionStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text3,
};

const emptyStateStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  background: color.bg0,
  fontFamily: font.sans,
};
const emptyTitleStyle: CSSProperties = {
  fontSize: font.size.md,
  color: color.text1,
  fontWeight: font.weight.medium,
};
const emptySubtitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text3,
};

export const SmellRadarView = memo(SmellRadarViewImpl);
