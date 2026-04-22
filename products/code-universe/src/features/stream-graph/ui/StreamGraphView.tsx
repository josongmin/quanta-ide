// StreamGraphView — stacked symmetric-baseline stream of package LoC.
// --------------------------------------------------------------------
// X axis = month (last 12). Y = stacked LoC split by package. Layout
// uses the Byron & Wattenberg "silhouette" / symmetric offset: the
// stack is centered around y = 0 so the thickest bands sit in the
// middle and the whole thing reads as a flowing river.
//
// Reference: Byron & Wattenberg.
// "Stacked Graphs: Geometry & Aesthetics", IEEE InfoVis 2008.
// (The classic NYT movie chart, Lee Byron's music.last.fm Listening
// History graph.)
//
// Per-package time series is synthesized with a smoothed random walk
// seeded from the entity id so the graph is stable across sessions.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  hashId,
  seeded,
} from "../../../shared/analytics/synth-metrics";

const N_MONTHS = 12;
const MAX_STREAMS = 14;
const VIEW_W = 1200;
const VIEW_H = 520;
const MARGIN_L = 68;
const MARGIN_R = 24;
const MARGIN_T = 28;
const MARGIN_B = 48;

const KEYFRAMES = `
@keyframes sgEnter {
  0%   { opacity: 0; transform: scale(0.97); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes sgGrow {
  0%   { transform: scaleY(0); opacity: 0.0; }
  35%  { opacity: 0.9; }
  100% { transform: scaleY(1); opacity: 1.0; }
}
`;

interface Stream {
  id: string;
  label: string;
  color: string;
  values: number[];               // length N_MONTHS
  peakMonth: number;
  peakValue: number;
}

interface LaidStream {
  stream: Stream;
  topPath: string;
  bottomPath: string;
  fullPath: string;
  labelX: number;
  labelY: number;
}

export interface StreamGraphViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
}

function StreamGraphViewImpl({ tree, onFocusEntity }: StreamGraphViewProps): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.streamGraphKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const streams = useMemo(() => buildStreams(tree), [tree]);
  const laid = useMemo(() => layoutSilhouette(streams), [streams]);
  const totals = useMemo(() => {
    const totals = new Array(N_MONTHS).fill(0);
    for (const s of streams) {
      for (let i = 0; i < N_MONTHS; i++) totals[i] += s.values[i] ?? 0;
    }
    return totals;
  }, [streams]);

  const monthLabels = useMemo(() => makeMonthLabels(N_MONTHS), []);

  if (streams.length === 0) {
    return (
      <div style={{ ...rootStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: color.text3, fontSize: font.size.md }}>
          패키지를 찾을 수 없습니다
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Stream Graph</div>
          <div style={subtitleStyle}>
            Byron & Wattenberg InfoVis 2008 · silhouette layout · 12-month LoC
          </div>
        </div>
        <div style={totalsStyle}>
          <span style={{ color: color.text2 }}>stacked peak</span>
          <span style={{ fontWeight: font.weight.bold, marginLeft: 4 }}>
            {formatLoC(Math.max(...totals))}
          </span>
        </div>
      </header>

      <div style={canvasWrapStyle}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={svgStyle}
        >
          <defs>
            {streams.map(s => (
              <linearGradient
                key={`g-${s.id}`}
                id={`sg-grad-${cssSafe(s.id)}`}
                x1="0" x2="0" y1="0" y2="1"
              >
                <stop offset="0%"  stopColor={s.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>

          {/* Baseline reference */}
          <line
            x1={MARGIN_L}
            x2={VIEW_W - MARGIN_R}
            y1={MARGIN_T + (VIEW_H - MARGIN_T - MARGIN_B) / 2}
            y2={MARGIN_T + (VIEW_H - MARGIN_T - MARGIN_B) / 2}
            stroke={color.borderSoft}
            strokeDasharray="2 6"
          />

          {/* Streams — thick bands. Animated bottom-up by reversing order. */}
          {laid.map((l, i) => {
            const isHovered = hoveredId === l.stream.id;
            const dimmed = hoveredId && !isHovered;
            return (
              <g
                key={l.stream.id}
                style={{
                  cursor: "pointer",
                  transformBox: "fill-box",
                  transformOrigin: "center center",
                  animation: `sgGrow 640ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${Math.min((laid.length - i) * 28, 420)}ms`,
                  transition: "opacity 180ms ease-out",
                  opacity: dimmed ? 0.35 : 1,
                }}
                onMouseEnter={() => setHoveredId(l.stream.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onFocusEntity?.(l.stream.id)}
              >
                <path
                  d={l.fullPath}
                  fill={`url(#sg-grad-${cssSafe(l.stream.id)})`}
                  stroke={isHovered ? color.text0 : "rgba(20, 30, 45, 0.12)"}
                  strokeWidth={isHovered ? 1.2 : 0.6}
                  style={{ transition: "stroke 180ms ease-out, stroke-width 180ms ease-out" }}
                />
              </g>
            );
          })}

          {/* Peak-month labels for the top 5 streams (avoid clutter) */}
          {laid.slice(0, 5).map((l) => (
            <text
              key={`lbl-${l.stream.id}`}
              x={l.labelX}
              y={l.labelY}
              textAnchor="middle"
              fontFamily={font.sans}
              fontSize={10.5}
              fontWeight={font.weight.semibold}
              fill={color.text0}
              fillOpacity={0.88}
              style={{ pointerEvents: "none" }}
            >
              {l.stream.label.length > 18
                ? l.stream.label.slice(0, 16) + "…"
                : l.stream.label}
            </text>
          ))}

          {/* Month axis */}
          {monthLabels.map((m, i) => {
            const x = MARGIN_L +
              (i * (VIEW_W - MARGIN_L - MARGIN_R)) / (N_MONTHS - 1);
            return (
              <g key={`mo-${i}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={VIEW_H - MARGIN_B + 2}
                  y2={VIEW_H - MARGIN_B + 6}
                  stroke={color.border}
                />
                <text
                  x={x}
                  y={VIEW_H - MARGIN_B + 20}
                  textAnchor="middle"
                  fontFamily={font.sans}
                  fontSize={10}
                  fill={color.text2}
                >
                  {m}
                </text>
              </g>
            );
          })}

          {/* Hover tooltip (bottom-left corner) */}
          {hoveredId && (
            <TooltipPanel
              stream={streams.find(s => s.id === hoveredId) ?? null}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

// ── Silhouette layout ─────────────────────────────────────────────────
function layoutSilhouette(streams: Stream[]): LaidStream[] {
  if (streams.length === 0) return [];
  const n = streams.length;
  const t = N_MONTHS;

  // Values matrix v[k][i].
  const v: number[][] = streams.map(s => s.values);

  // Column sums.
  const sums = new Array(t).fill(0);
  for (let i = 0; i < t; i++) {
    for (let k = 0; k < n; k++) sums[i] += v[k]![i]!;
  }

  // Baseline g[i]: Byron & Wattenberg "silhouette" is symmetric: start
  // each column at -sum/2. This centers the stack around y = 0.
  const g = new Array(t).fill(0);
  for (let i = 0; i < t; i++) g[i] = -sums[i] / 2;

  // Cumulative lower/upper per stream.
  const lower: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  const upper: number[][] = Array.from({ length: n }, () => new Array(t).fill(0));
  for (let i = 0; i < t; i++) {
    let y = g[i]!;
    for (let k = 0; k < n; k++) {
      lower[k]![i] = y;
      y += v[k]![i]!;
      upper[k]![i] = y;
    }
  }

  // Normalize to pixel Y range. Find data min/max across all lower/upper.
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < t; i++) {
      dataMin = Math.min(dataMin, lower[k]![i]!);
      dataMax = Math.max(dataMax, upper[k]![i]!);
    }
  }
  if (!isFinite(dataMin) || dataMax === dataMin) {
    dataMin = -1; dataMax = 1;
  }

  const pixelYTop = MARGIN_T;
  const pixelYBottom = VIEW_H - MARGIN_B;
  const scaleY = (y: number) =>
    pixelYTop + ((dataMax - y) / (dataMax - dataMin)) * (pixelYBottom - pixelYTop);
  const scaleX = (i: number) =>
    MARGIN_L + (i * (VIEW_W - MARGIN_L - MARGIN_R)) / (N_MONTHS - 1);

  const laid: LaidStream[] = [];
  for (let k = 0; k < n; k++) {
    const s = streams[k]!;
    const topPts: [number, number][] = [];
    const botPts: [number, number][] = [];
    for (let i = 0; i < t; i++) {
      topPts.push([scaleX(i), scaleY(upper[k]![i]!)]);
      botPts.push([scaleX(i), scaleY(lower[k]![i]!)]);
    }
    const topPath = catmullRomPath(topPts);
    const botPathRev = catmullRomPath([...botPts].reverse());
    const fullPath = `${topPath} L${botPts[botPts.length - 1]![0].toFixed(2)},${botPts[botPts.length - 1]![1].toFixed(2)} ${stripM(catmullRomPath([...botPts].reverse()))} Z`;

    // Label anchor: at the peak column, midway between top and bottom.
    const peakI = s.peakMonth;
    const labelX = scaleX(peakI);
    const labelY = (scaleY(upper[k]![peakI]!) + scaleY(lower[k]![peakI]!)) / 2 + 3;

    laid.push({
      stream: s,
      topPath,
      bottomPath: botPathRev,
      fullPath,
      labelX,
      labelY,
    });
  }
  return laid;
}

function stripM(path: string): string {
  // Turn the leading "M" into "L" so it continues the current path.
  if (path.startsWith("M")) return "L" + path.slice(1);
  return path;
}

function catmullRomPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0]![0]},${points[0]![1]}`;
  const parts: string[] = [`M${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(
      `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`,
    );
  }
  return parts.join(" ");
}

// ── Data build ────────────────────────────────────────────────────────
function buildStreams(tree: EntityTree): Stream[] {
  const all = Array.from(tree.byId.values());
  const pkgs = all
    .filter(e => e.kind === "galaxy" || e.kind === "street")
    .sort((a, b) => {
      const fa = a.metrics?.fileCount ?? 0;
      const fb = b.metrics?.fileCount ?? 0;
      return fb - fa;
    })
    .slice(0, MAX_STREAMS);

  // Order streams for visual stability: biggest in middle reduces
  // baseline wobble (classic Byron ordering).
  pkgs.sort((a, b) => {
    const fa = a.metrics?.fileCount ?? 0;
    const fb = b.metrics?.fileCount ?? 0;
    return fa - fb;
  });

  const streams: Stream[] = [];
  for (const p of pkgs) {
    const values = synthesizeSeries(p);
    let peakMonth = 0;
    let peakValue = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i]! > peakValue) {
        peakValue = values[i]!;
        peakMonth = i;
      }
    }
    streams.push({
      id: p.id,
      label: p.name,
      color: streamColor(p),
      values,
      peakMonth,
      peakValue,
    });
  }
  return streams;
}

function synthesizeSeries(entity: Entity): number[] {
  const base =
    (entity.metrics?.fileCount ?? 12) * 80 +
    (entity.metrics?.loc ?? 400);
  const out: number[] = [];
  let x = base * 0.6;
  for (let i = 0; i < N_MONTHS; i++) {
    const rng = seeded(entity.id, `m${i}`);
    const delta = (rng() - 0.35) * base * 0.22;
    // Smooth growth — cumulative + mild trend.
    x = Math.max(base * 0.25, x * 0.75 + (x + delta) * 0.25);
    out.push(x);
  }
  // Apply a bump at a seeded month — emulates feature shipping pulse.
  const bumpAt = Math.floor(seeded(entity.id, "bump")() * N_MONTHS);
  out[bumpAt] = out[bumpAt]! * (1 + seeded(entity.id, "bump-amt")() * 0.7);
  return out;
}

function streamColor(entity: Entity): string {
  const h = hashId(entity.id) % 360;
  return `hsl(${h} 62% 66%)`;
}

function cssSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

function makeMonthLabels(n: number): string[] {
  const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(NAMES[d.getMonth()]!);
  }
  return out;
}

function formatLoC(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

// ── Tooltip ───────────────────────────────────────────────────────────
function TooltipPanel({ stream }: { stream: Stream | null }) {
  if (!stream) return null;
  const monthNames = makeMonthLabels(N_MONTHS);
  return (
    <g transform={`translate(${MARGIN_L + 8}, ${VIEW_H - MARGIN_B - 72})`}>
      <rect
        x={0}
        y={0}
        width={220}
        height={64}
        rx={6}
        ry={6}
        fill={color.bg0}
        stroke={color.border}
        strokeWidth={0.8}
        style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.08))" }}
      />
      <circle cx={10} cy={14} r={5} fill={stream.color} />
      <text x={22} y={18} fontFamily={font.sans} fontSize={12} fontWeight={font.weight.semibold} fill={color.text0}>
        {stream.label.length > 26 ? stream.label.slice(0, 24) + "…" : stream.label}
      </text>
      <text x={10} y={36} fontFamily={font.sans} fontSize={10} fill={color.text2}>
        peak {monthNames[stream.peakMonth]}
      </text>
      <text x={10} y={52} fontFamily={font.sans} fontSize={10} fill={color.text1} style={{ fontVariantNumeric: "tabular-nums" }}>
        {formatLoC(stream.peakValue)} LoC
      </text>
    </g>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: color.bg0,
  padding: `${space[6]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  color: color.text0,
  animation: "sgEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: space[4],
  gap: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  marginTop: space[1],
};

const totalsStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
};

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.bg2,
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

export const StreamGraphView = memo(StreamGraphViewImpl);
