// BlameClockView — authors × age on a circular clock face.
// --------------------------------------------------------------------
// Each tick is one file. Angle = deterministic hash-of-id slot (stable
// between renders). Radial distance = age (newer → inner, older → outer).
// Tick colour = primary author's hue.
//
// The clock face has classical ornamentation (hour marks, minute marks,
// second hand) so it reads as an instrument at a glance. A rotating
// "second hand" sweeps continuously (24s / rev) via requestAnimationFrame
// so the motion is smooth and decoupled from React re-renders. Click a
// tick to select that file; the center shows aggregate stats.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  ageDays,
  authorHue,
  hashId,
  primaryAuthor,
} from "../../../shared/analytics/synth-metrics";

// ── Animation constants ──────────────────────────────────────────────
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const SECOND_HAND_MS = 24_000;
const MAX_FILES = 180;

const KEYFRAMES = `
@keyframes bc-fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes bc-tickIn {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1);   }
}
@keyframes bc-breathe {
  0%, 100% { opacity: 0.38; }
  50%       { opacity: 0.70; }
}
@keyframes bc-pulseRing {
  0%   { r: var(--bc-r0); opacity: 0.45; }
  100% { r: var(--bc-r1); opacity: 0;    }
}
`;

// ── Types ────────────────────────────────────────────────────────────
interface ClockTick {
  id: string;
  name: string;
  path: string;
  author: string;
  authorHue: number;
  /** Position in clock face (radians, 0 = 3 o'clock, CW positive). */
  angle: number;
  /** Radius from center (0 = center, 1 = rim). */
  rNorm: number;
  /** Age in days. */
  age: number;
  loc: number;
}

interface AuthorRollup {
  id: string;
  hue: number;
  count: number;
}

// ── Hue helpers ──────────────────────────────────────────────────────
function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ── Component ────────────────────────────────────────────────────────
function BlameClockViewImpl({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [handAngle, setHandAngle] = useState(0);

  // Smooth continuous rotation of the second hand. RAF, not setInterval,
  // so the motion is frame-rate agnostic and pauses cleanly on unmount.
  const rafId = useRef<number>(0);
  useEffect(() => {
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const elapsed = t - start;
      const angle = ((elapsed % SECOND_HAND_MS) / SECOND_HAND_MS) * Math.PI * 2;
      setHandAngle(angle);
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

  const { ticks, authors, medianAge } = useMemo(() => {
    if (!ctx.tree) return { ticks: [] as ClockTick[], authors: [] as AuthorRollup[], medianAge: 0 };

    // Collect file entities, sort by LoC desc, keep top N to avoid visual
    // stampede on huge repos.
    const files: Entity[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind === "building") files.push(e);
    }
    files.sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0));
    const top = files.slice(0, MAX_FILES);

    // Age normalization across the sampled set, so ticks fan out across
    // the full radial range instead of bunching near the center.
    const ages = top.map(e => ageDays(e));
    const maxAge = Math.max(1, ...ages);
    const minAge = Math.min(...ages, 0);

    const authorCounts = new Map<string, number>();

    const ticks: ClockTick[] = top.map(e => {
      const author = primaryAuthor(e);
      authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
      // Angle from hash — stable across renders and ~uniformly distributed.
      const angle = (hashId(`${e.id}::clock-slot`) / 0xffffffff) * Math.PI * 2;
      const age = ageDays(e);
      const rNorm = (age - minAge) / (maxAge - minAge || 1);
      return {
        id: e.id,
        name: e.name,
        path: e.path,
        author,
        authorHue: authorHue(author),
        angle,
        rNorm,
        age,
        loc: e.metrics?.loc ?? 0,
      };
    });

    const authors: AuthorRollup[] = [...authorCounts.entries()]
      .map(([id, count]) => ({ id, count, hue: authorHue(id) }))
      .sort((a, b) => b.count - a.count);

    const sortedAges = [...ages].sort((a, b) => a - b);
    const median = sortedAges.length
      ? sortedAges[Math.floor(sortedAges.length / 2)] ?? 0
      : 0;

    return { ticks, authors, medianAge: median };
  }, [ctx.tree]);

  if (!ctx.tree || ticks.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <span style={emptyTitleStyle}>No files to read.</span>
        <span style={emptySubtitleStyle}>Workspace tree is empty or loading.</span>
      </div>
    );
  }

  // Clock sizes to the smaller of width/height minus header & legend.
  const LEG_W = 260;
  const chartSize = Math.min(width - LEG_W - space[6] - space[5] * 2, height - 140);
  const R = chartSize / 2 - 32; // margin for author-hue rim
  const rInner = 28; // central dial radius
  const rTickBand = R - 12;

  const hovered = hoveredId ? ticks.find(t => t.id === hoveredId) ?? null : null;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Blame Clock</span>
          <span style={subtitleStyle}>블레임 클럭 — 저자 × 나이 원형 매핑</span>
        </div>
        <div style={clockMetaStyle}>
          <span style={clockMetaChipStyle}>
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </span>
        </div>
      </div>

      <div style={bodyStyle}>
        <div style={{ ...chartFrameStyle, width: chartSize, height: chartSize }}>
          <svg
            width={chartSize}
            height={chartSize}
            viewBox={`${-chartSize / 2} ${-chartSize / 2} ${chartSize} ${chartSize}`}
            style={{
              display: "block",
              overflow: "visible",
              animation: `bc-fadeIn 560ms ${ENTRY_EASE} both`,
            }}
            role="img"
            aria-label="Blame clock"
          >
            <defs>
              <radialGradient id="bc-face-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={color.bg0}  stopOpacity={1} />
                <stop offset="82%"  stopColor={color.bg2}  stopOpacity={1} />
                <stop offset="100%" stopColor={color.bg3}  stopOpacity={1} />
              </radialGradient>
              <radialGradient id="bc-inner-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor={color.accent} stopOpacity={0.14} />
                <stop offset="100%" stopColor={color.accent} stopOpacity={0}    />
              </radialGradient>
              <filter id="bc-hand-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                <feOffset dx="0" dy="1" result="off" />
                <feColorMatrix in="off" type="matrix"
                  values="0 0 0 0 0.05  0 0 0 0 0.60  0 0 0 0 1  0 0 0 0.40 0" />
                <feComposite in2="SourceGraphic" operator="over" />
              </filter>
            </defs>

            {/* Clock face background */}
            <circle
              cx={0} cy={0} r={R + 8}
              fill={color.bg0}
              stroke={color.borderStrong}
              strokeWidth={1.2}
            />
            <circle
              cx={0} cy={0} r={R}
              fill="url(#bc-face-grad)"
              stroke={color.border}
              strokeWidth={0.6}
            />
            <circle
              cx={0} cy={0} r={R * 0.72}
              fill="url(#bc-inner-glow)"
            />

            {/* Radial age rings — 3 tiers */}
            {[0.33, 0.66, 1.0].map((frac, i) => (
              <circle
                key={`age-${i}`}
                cx={0} cy={0}
                r={rInner + (rTickBand - rInner) * frac}
                fill="none"
                stroke={color.border}
                strokeWidth={0.6}
                strokeDasharray="1.2 4"
                opacity={0.7}
              />
            ))}

            {/* Hour ticks — 12 major */}
            {Array.from({ length: 12 }, (_, i) => i).map(i => {
              const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
              const x1 = Math.cos(a) * (R - 10);
              const y1 = Math.sin(a) * (R - 10);
              const x2 = Math.cos(a) * R;
              const y2 = Math.sin(a) * R;
              return (
                <line
                  key={`h-${i}`}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={color.text1}
                  strokeWidth={i % 3 === 0 ? 1.4 : 0.9}
                  opacity={0.7}
                />
              );
            })}
            {/* Minute ticks — 60, finer */}
            {Array.from({ length: 60 }, (_, i) => i).map(i => {
              if (i % 5 === 0) return null; // dupe with hour
              const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
              const x1 = Math.cos(a) * (R - 4);
              const y1 = Math.sin(a) * (R - 4);
              const x2 = Math.cos(a) * R;
              const y2 = Math.sin(a) * R;
              return (
                <line
                  key={`m-${i}`}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={color.text3}
                  strokeWidth={0.4}
                  opacity={0.5}
                />
              );
            })}
            {/* Hour numerals — 12/3/6/9 */}
            {[
              { n: "12", a: -Math.PI / 2 },
              { n: "3",  a: 0 },
              { n: "6",  a: Math.PI / 2 },
              { n: "9",  a: Math.PI },
            ].map(({ n, a }) => (
              <text
                key={`num-${n}`}
                x={Math.cos(a) * (R - 24)}
                y={Math.sin(a) * (R - 24)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.sans}
                fontSize={10}
                fill={color.text3}
                opacity={0.7}
                letterSpacing="0.14em"
              >
                {n}
              </text>
            ))}

            {/* Author-hue rim — thin arcs along the outer edge proportional
             *  to each author's file share. Reads as a cohesive chromatic
             *  band that still explains which hue belongs to whom. */}
            <g>
              {(() => {
                const total = authors.reduce((a, b) => a + b.count, 0) || 1;
                let acc = -Math.PI / 2;
                return authors.slice(0, 10).map((au, i) => {
                  const span = (au.count / total) * Math.PI * 2;
                  const start = acc;
                  const end = acc + span;
                  acc = end;
                  const rim = R + 4;
                  const x0 = Math.cos(start) * rim;
                  const y0 = Math.sin(start) * rim;
                  const x1 = Math.cos(end) * rim;
                  const y1 = Math.sin(end) * rim;
                  const large = span > Math.PI ? 1 : 0;
                  return (
                    <path
                      key={`rim-${au.id}-${i}`}
                      d={`M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rim} ${rim} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`}
                      fill="none"
                      stroke={hsl(au.hue, 60, 55, 0.9)}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  );
                });
              })()}
            </g>

            {/* File ticks */}
            {ticks.map((t, i) => {
              const rTick = rInner + 6 + t.rNorm * (rTickBand - rInner - 6);
              const x = Math.cos(t.angle) * rTick;
              const y = Math.sin(t.angle) * rTick;
              const isHovered = hoveredId === t.id;
              const fill = hsl(t.authorHue, 60, isHovered ? 45 : 55, 0.9);
              return (
                <g
                  key={t.id}
                  style={{
                    animation: `bc-tickIn 380ms ${ENTRY_EASE} ${220 + (i * 4) % 480}ms both`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(t.id)}
                >
                  <circle
                    cx={x} cy={y}
                    r={isHovered ? 3.8 : 2.2}
                    fill={fill}
                    style={{ transition: "r 160ms ease-out" }}
                  />
                  {isHovered && (
                    <circle
                      cx={x} cy={y}
                      r={10}
                      fill="none"
                      stroke={fill}
                      strokeWidth={1}
                      strokeOpacity={0.5}
                      style={{
                        animation: "bc-pulseRing 900ms ease-out infinite",
                        ["--bc-r0" as string]: "4",
                        ["--bc-r1" as string]: "14",
                      } as CSSProperties}
                    />
                  )}
                </g>
              );
            })}

            {/* Second hand — rotates via handAngle */}
            <g
              style={{
                transform: `rotate(${(handAngle * 180) / Math.PI - 90}deg)`,
                transformOrigin: "0 0",
              }}
            >
              <line
                x1={0} y1={0}
                x2={R - 10} y2={0}
                stroke={color.accent}
                strokeWidth={1.4}
                strokeLinecap="round"
                filter="url(#bc-hand-shadow)"
                opacity={0.86}
              />
              <line
                x1={-12} y1={0}
                x2={0} y2={0}
                stroke={color.accent}
                strokeWidth={2.2}
                strokeLinecap="round"
                opacity={0.7}
              />
              <circle cx={R - 10} cy={0} r={2.4} fill={color.accent} opacity={0.9} />
            </g>

            {/* Center dial */}
            <circle cx={0} cy={0} r={rInner + 2} fill={color.bg0} stroke={color.borderStrong} strokeWidth={0.8} />
            <circle cx={0} cy={0} r={rInner - 2} fill={color.bg2} />

            {/* Center aggregate stats */}
            <g style={{ pointerEvents: "none" }}>
              <text
                x={0}
                y={-6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.mono}
                fontSize={font.size.md}
                fontWeight={font.weight.semibold}
                fill={color.text0}
              >
                {ticks.length}
              </text>
              <text
                x={0}
                y={6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.sans}
                fontSize={9}
                fill={color.text3}
                letterSpacing="0.14em"
              >
                FILES
              </text>
              <text
                x={0}
                y={18}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={font.mono}
                fontSize={9}
                fill={color.text2}
              >
                {authors.length} · {medianAge}d
              </text>
            </g>
          </svg>
        </div>

        {/* Side legend */}
        <div style={legendStyle}>
          <div style={legendSectionStyle}>
            <span style={legendHeadStyle}>Authors</span>
            {authors.slice(0, 10).map(au => (
              <div key={au.id} style={legendRowStyle}>
                <span style={{ ...legendDotStyle, background: hsl(au.hue, 60, 55) }} />
                <span style={legendAuthorStyle}>{au.id}</span>
                <span style={legendCountStyle}>{au.count}</span>
              </div>
            ))}
          </div>

          <div style={legendSectionStyle}>
            <span style={legendHeadStyle}>Hover</span>
            {hovered ? (
              <div style={hoverCardStyle}>
                <span style={hoverNameStyle}>{hovered.name}</span>
                <span style={hoverPathStyle}>{hovered.path}</span>
                <div style={hoverMetaRowStyle}>
                  <span style={{ ...hoverPillStyle, color: hsl(hovered.authorHue, 60, 40) }}>
                    {hovered.author}
                  </span>
                  <span style={hoverPillStyle}>{hovered.age}d</span>
                  <span style={hoverPillStyle}>{hovered.loc} LoC</span>
                </div>
              </div>
            ) : (
              <span style={hoverEmptyStyle}>Hover a tick to inspect.</span>
            )}
          </div>

          <div style={legendFooterStyle}>
            <span style={legendCaptionStyle}>inner = recent · outer = older</span>
            <span style={legendCaptionStyle}>color = primary author</span>
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
const titleBlockStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};
const subtitleStyle: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const clockMetaStyle: CSSProperties = { display: "flex", gap: space[2] };
const clockMetaChipStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
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
const chartFrameStyle: CSSProperties = {
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
  animation: `bc-fadeIn 560ms ${ENTRY_EASE} 320ms both`,
};
const legendSectionStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };
const legendHeadStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: space[1],
};
const legendRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "10px 1fr auto",
  gap: space[2],
  alignItems: "center",
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
};
const legendDotStyle: CSSProperties = { width: 10, height: 10, borderRadius: radius.pill };
const legendAuthorStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text1,
};
const legendCountStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
};

const hoverCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: `${space[2]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
};
const hoverNameStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
};
const hoverPathStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const hoverMetaRowStyle: CSSProperties = {
  display: "flex",
  gap: space[1],
  flexWrap: "wrap",
  marginTop: 2,
};
const hoverPillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  padding: `1px ${space[1]}px`,
  background: color.bg3,
  borderRadius: radius.xs,
  color: color.text2,
};
const hoverEmptyStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text3,
  fontStyle: "italic",
};

const legendFooterStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingTop: space[2],
  borderTop: `1px solid ${color.border}`,
};
const legendCaptionStyle: CSSProperties = { fontSize: font.size.xs, color: color.text3 };

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

export const BlameClockView = memo(BlameClockViewImpl);
