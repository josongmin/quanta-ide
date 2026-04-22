// BlameClockView — authors × age on a circular clock face.
// --------------------------------------------------------------------
// Each tick is one file.
//   • Angle  → author wedge. Authors are ordered by file count and laid
//              around the clock (starting at 12, clockwise) so each
//              author owns a contiguous slice. Within the slice, file
//              sub-angle is a deterministic hash jitter.
//   • Radius → age (newer → inner, older → outer).
//   • Hue    → primary author (redundant with wedge, but reinforces
//              identity when reading individual ticks).
// The rim arcs are author labels — the dots underneath each rim segment
// belong to that author. Radial guide rings are labelled with their age
// bucket so radial distance has a unit, not a vibe.
//
// A second-hand sweeps continuously (24s / rev) via requestAnimationFrame
// so the instrument feels alive without driving React re-renders. Click
// a tick to select that file.

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
  /** Wedge start angle (rad, screen — 12 o'clock = -π/2). */
  startAngle: number;
  /** Wedge end angle (rad, screen). */
  endAngle: number;
  /** Mid-angle for label placement. */
  midAngle: number;
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

  const { ticks, authors, medianAge, maxAge } = useMemo(() => {
    if (!ctx.tree) {
      return {
        ticks: [] as ClockTick[],
        authors: [] as AuthorRollup[],
        medianAge: 0,
        maxAge: 0,
      };
    }

    // Collect file entities, sort by LoC desc, keep top N to avoid visual
    // stampede on huge repos.
    const files: Entity[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind === "building") files.push(e);
    }
    files.sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0));
    const top = files.slice(0, MAX_FILES);

    // Pre-pass: tally per-author file counts so we can lay out wedges
    // BEFORE we assign per-tick angles (each tick's angle depends on
    // its author's wedge bounds).
    const authorCounts = new Map<string, number>();
    const authorOf = new Map<string, string>();
    for (const e of top) {
      const a = primaryAuthor(e);
      authorOf.set(e.id, a);
      authorCounts.set(a, (authorCounts.get(a) ?? 0) + 1);
    }

    // Authors ordered by file count descending. The largest contributor
    // sits at 12 o'clock and we walk clockwise — same orientation as the
    // outer rim arcs, so rim and dots tell one story.
    const totalCount = top.length || 1;
    let acc = -Math.PI / 2;
    const authors: AuthorRollup[] = [...authorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const span = (count / totalCount) * Math.PI * 2;
        const startAngle = acc;
        const endAngle = acc + span;
        acc = endAngle;
        return {
          id,
          count,
          hue: authorHue(id),
          startAngle,
          endAngle,
          midAngle: (startAngle + endAngle) / 2,
        };
      });
    const wedgeByAuthor = new Map(authors.map(a => [a.id, a]));

    // Age normalization across the sampled set, so ticks fan out across
    // the full radial range instead of bunching near the center.
    const ages = top.map(e => ageDays(e));
    const maxAge = Math.max(1, ...ages);
    const minAge = Math.min(...ages, 0);

    const ticks: ClockTick[] = top.map(e => {
      const author = authorOf.get(e.id) ?? primaryAuthor(e);
      const wedge = wedgeByAuthor.get(author)!;
      // Sub-angle inside the wedge, deterministic so it doesn't flicker
      // between renders. 0.06..0.94 leaves a small gutter at each wedge
      // edge so neighbouring authors stay visually separable.
      const slot = hashId(`${e.id}::clock-slot`) / 0xffffffff;
      const t = 0.06 + slot * 0.88;
      const angle = wedge.startAngle + (wedge.endAngle - wedge.startAngle) * t;
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

    const sortedAges = [...ages].sort((a, b) => a - b);
    const median = sortedAges.length
      ? sortedAges[Math.floor(sortedAges.length / 2)] ?? 0
      : 0;

    return { ticks, authors, medianAge: median, maxAge };
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

            {/* Author wedges — faint sector fill, radial divider, outer
             *  rim arc, and curved label. The wedge is the load-bearing
             *  encoding: it groups all of an author's dots into one
             *  contiguous slice so you can read "which dots are kim's"
             *  by following the rim down to the centre. */}
            <g>
              {authors.map((au, i) => {
                const span = au.endAngle - au.startAngle;
                const large = span > Math.PI ? 1 : 0;
                const rim = R + 4;
                const inner = rInner + 4;
                // Sector path (pie slice from inner ring to outer face).
                const xa = Math.cos(au.startAngle) * inner;
                const ya = Math.sin(au.startAngle) * inner;
                const xb = Math.cos(au.startAngle) * R;
                const yb = Math.sin(au.startAngle) * R;
                const xc = Math.cos(au.endAngle) * R;
                const yc = Math.sin(au.endAngle) * R;
                const xd = Math.cos(au.endAngle) * inner;
                const yd = Math.sin(au.endAngle) * inner;
                const sector =
                  `M ${xa.toFixed(2)} ${ya.toFixed(2)} ` +
                  `L ${xb.toFixed(2)} ${yb.toFixed(2)} ` +
                  `A ${R} ${R} 0 ${large} 1 ${xc.toFixed(2)} ${yc.toFixed(2)} ` +
                  `L ${xd.toFixed(2)} ${yd.toFixed(2)} ` +
                  `A ${inner} ${inner} 0 ${large} 0 ${xa.toFixed(2)} ${ya.toFixed(2)} Z`;
                // Outer rim arc (the chromatic band).
                const x0r = Math.cos(au.startAngle) * rim;
                const y0r = Math.sin(au.startAngle) * rim;
                const x1r = Math.cos(au.endAngle) * rim;
                const y1r = Math.sin(au.endAngle) * rim;
                // Label arc — placed just outside the rim, with the
                // label flipped on the bottom half so text never reads
                // upside-down.
                const labelR = rim + 14;
                const flipped = au.midAngle > 0 && au.midAngle < Math.PI;
                const labelStart = flipped ? au.endAngle : au.startAngle;
                const labelEnd = flipped ? au.startAngle : au.endAngle;
                const sweep = flipped ? 0 : 1;
                const lx0 = Math.cos(labelStart) * labelR;
                const ly0 = Math.sin(labelStart) * labelR;
                const lx1 = Math.cos(labelEnd) * labelR;
                const ly1 = Math.sin(labelEnd) * labelR;
                const labelPath =
                  `M ${lx0.toFixed(2)} ${ly0.toFixed(2)} ` +
                  `A ${labelR} ${labelR} 0 ${large} ${sweep} ${lx1.toFixed(2)} ${ly1.toFixed(2)}`;
                const labelId = `bc-label-${i}`;
                // Wedges narrower than ~14° hide their text label.
                const showLabel = span > 0.24;
                return (
                  <g key={`wedge-${au.id}-${i}`}>
                    <path
                      d={sector}
                      fill={hsl(au.hue, 60, 55, 0.07)}
                      stroke="none"
                    />
                    {/* Faint divider between this wedge and the previous */}
                    {i > 0 && (
                      <line
                        x1={Math.cos(au.startAngle) * inner}
                        y1={Math.sin(au.startAngle) * inner}
                        x2={Math.cos(au.startAngle) * R}
                        y2={Math.sin(au.startAngle) * R}
                        stroke={color.border}
                        strokeWidth={0.6}
                        opacity={0.6}
                      />
                    )}
                    <path
                      d={`M ${x0r.toFixed(2)} ${y0r.toFixed(2)} A ${rim} ${rim} 0 ${large} 1 ${x1r.toFixed(2)} ${y1r.toFixed(2)}`}
                      fill="none"
                      stroke={hsl(au.hue, 60, 55, 0.9)}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                    {showLabel && (
                      <>
                        <defs>
                          <path id={labelId} d={labelPath} />
                        </defs>
                        <text
                          fontFamily={font.sans}
                          fontSize={10}
                          fontWeight={font.weight.semibold}
                          letterSpacing="0.08em"
                          fill={hsl(au.hue, 50, 38)}
                        >
                          <textPath href={`#${labelId}`} startOffset="50%" textAnchor="middle">
                            {au.id}
                          </textPath>
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Radial age rings — labelled with their day bucket so
             *  radial distance has a unit. */}
            {[0.33, 0.66, 1.0].map((frac, i) => {
              const r = rInner + (rTickBand - rInner) * frac;
              const days = Math.round(maxAge * frac);
              return (
                <g key={`age-${i}`}>
                  <circle
                    cx={0} cy={0}
                    r={r}
                    fill="none"
                    stroke={color.border}
                    strokeWidth={0.6}
                    strokeDasharray="1.2 4"
                    opacity={0.7}
                  />
                  <text
                    x={4}
                    y={-r}
                    fontFamily={font.mono}
                    fontSize={9}
                    fill={color.text3}
                    opacity={0.85}
                  >
                    {days}d
                  </text>
                </g>
              );
            })}

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
            <span style={legendCaptionStyle}>wedge = author · width ∝ file count</span>
            <span style={legendCaptionStyle}>radius = age (inner = recent, outer = older)</span>
            <span style={legendCaptionStyle}>color = primary author (matches rim)</span>
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
