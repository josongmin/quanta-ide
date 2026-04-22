// HubScoreView — fan-in × fan-out scatter for connection centrality.
// --------------------------------------------------------------------
// Simpler cartesian scatter: X axis = fan-in (imports of this file),
// Y axis = fan-out (imports done by this file). Points high on BOTH
// axes are structural hubs — "change this, everything wobbles".
//
// Data path:
//   1. If `ctx.graph.fileEdges` has entries, compute real fan-in/out
//      by tallying edge.from / edge.to occurrences.
//   2. Otherwise, synthesize via `fanIn(entity)` / `fanOut(entity)`
//      from synth-metrics (deterministic seeded RNG).
//
// Axis domains adapt: max(fanIn) and max(fanOut) across plotted files,
// with a floor of 10 so sparse graphs still render axes usefully.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  kindColor,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { fanIn, fanOut } from "../../../shared/analytics/synth-metrics";

export interface HubScoreViewProps {
  ctx: ViewContextValue;
}

const PAD_LEFT = 72;
const PAD_RIGHT = 40;
const PAD_TOP = 56;
const PAD_BOTTOM = 64;

const MIN_R = 3;
const MAX_R = 14;

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes hubFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface HubPoint {
  id: string;
  name: string;
  fin: number;
  fout: number;
  total: number;
  color: string;
}

function HubScoreViewImpl({ ctx }: HubScoreViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);

  const { points, xMax, yMax } = useMemo(() => {
    if (!ctx.tree) return { points: [] as HubPoint[], xMax: 10, yMax: 10 };

    // synth-metrics fanIn/fanOut consume edges in the engine's native
    // { from, to } shape — no remapping needed.
    const edgesForSynth =
      ctx.graph && ctx.graph.fileEdges.length > 0
        ? ctx.graph.fileEdges
        : undefined;

    const out: HubPoint[] = [];
    let xm = 0;
    let ym = 0;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const fin = fanIn(e, edgesForSynth);
      const fout = fanOut(e, edgesForSynth);
      if (fin === 0 && fout === 0) continue; // skip isolates
      if (fin > xm) xm = fin;
      if (fout > ym) ym = fout;
      out.push({
        id: e.id,
        name: e.name,
        fin,
        fout,
        total: fin + fout,
        color: kindColor[e.kind],
      });
    }
    // Floor so axes don't collapse to 1.
    const xMax = Math.max(10, xm);
    const yMax = Math.max(10, ym);
    // Sort larger total first — bigger dots to the back.
    out.sort((a, b) => b.total - a.total);
    return { points: out, xMax, yMax };
  }, [ctx.tree, ctx.graph]);

  const isEmpty = points.length === 0;

  if (!ctx.tree || isEmpty) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokenColor.text3,
          fontFamily: font.sans,
          fontSize: font.size.md,
          background: tokenColor.bg0,
        }}
      >
        <style>{KEYFRAMES}</style>
        데이터가 아직 없어요
      </div>
    );
  }

  const maxTotal = points[0]?.total ?? 1;

  const xTickVals = axisTicks(xMax);
  const yTickVals = axisTicks(yMax);

  const rootStyle: CSSProperties = {
    animation: `hubFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center center",
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent" }}
        role="img"
        aria-label="Hub — fan-in × fan-out"
      >
        <g style={rootStyle}>
          {/* Title + subtitle */}
          <text
            x={PAD_LEFT}
            y={28}
            fill={tokenColor.text0}
            fontSize={font.size.xxl}
            fontFamily={font.sans}
            fontWeight={font.weight.bold}
          >
            Hub
          </text>
          <text
            x={PAD_LEFT}
            y={46}
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
          >
            연결 중심성 — 우상단에 있으면 '바꾸면 터짐' 후보
          </text>

          {/* Hub-zone tint (top-right quadrant) */}
          <rect
            x={plotX + plotW / 2}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.accent}
            opacity={0.05}
          />

          {/* Grid */}
          {yTickVals.map(v => {
            const y = plotY + (1 - v / yMax) * plotH;
            return (
              <line
                key={`gy-${v}`}
                x1={plotX}
                y1={y}
                x2={plotX + plotW}
                y2={y}
                stroke={tokenColor.border}
                strokeOpacity={0.5}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            );
          })}
          {xTickVals.map(v => {
            const x = plotX + (v / xMax) * plotW;
            return (
              <line
                key={`gx-${v}`}
                x1={x}
                y1={plotY}
                x2={x}
                y2={plotY + plotH}
                stroke={tokenColor.border}
                strokeOpacity={0.5}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            );
          })}

          {/* Plot border */}
          <rect
            x={plotX}
            y={plotY}
            width={plotW}
            height={plotH}
            fill="none"
            stroke={tokenColor.border}
            strokeWidth={1}
          />

          {/* Axis labels */}
          <text
            x={plotX + plotW / 2}
            y={height - 20}
            textAnchor="middle"
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
          >
            Fan-in → (몇 개 파일이 이걸 import 하나)
          </text>
          <text
            x={0}
            y={0}
            textAnchor="middle"
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            transform={`translate(20, ${plotY + plotH / 2}) rotate(-90)`}
          >
            Fan-out → (이 파일이 몇 개를 import 하나)
          </text>

          {/* Tick labels */}
          {xTickVals.map(v => (
            <text
              key={`xt-${v}`}
              x={plotX + (v / xMax) * plotW}
              y={plotY + plotH + 16}
              textAnchor="middle"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {v}
            </text>
          ))}
          {yTickVals.map(v => (
            <text
              key={`yt-${v}`}
              x={plotX - 8}
              y={plotY + (1 - v / yMax) * plotH + 3}
              textAnchor="end"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {v}
            </text>
          ))}

          {/* Quadrant hint */}
          <text
            x={plotX + plotW - 8}
            y={plotY + 16}
            textAnchor="end"
            fill={tokenColor.accent}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontStyle="italic"
            opacity={0.8}
          >
            hub zone — 인터페이스 감사 후보
          </text>

          {/* Points */}
          {points.map((p, i) => {
            const cx = plotX + (p.fin / xMax) * plotW;
            const cy = plotY + (1 - p.fout / yMax) * plotH;
            const radiusFrac = maxTotal === 0 ? 0 : p.total / maxTotal;
            const r = MIN_R + Math.sqrt(radiusFrac) * (MAX_R - MIN_R);
            const isHovered = hoveredId === p.id;
            const isSelected = ctx.selectedId === p.id;
            const opacity =
              hoveredId !== null && !isHovered ? 0.18 : isHovered ? 1 : 0.6;

            const pointStyle: CSSProperties = {
              cursor: "pointer",
              transition: `opacity 180ms ease-out, transform 180ms ease-out`,
              transform: isHovered ? "scale(1.08)" : "scale(1)",
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "fill-box",
              animation: `hubFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i * STAGGER_MS, 600)}ms`,
            };

            return (
              <g key={p.id} style={pointStyle}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={p.color}
                  opacity={opacity}
                  stroke={isHovered ? tokenColor.text0 : "none"}
                  strokeWidth={isHovered ? 1.2 : 0}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(p.id)}
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 4}
                    fill="none"
                    stroke={tokenColor.accent}
                    strokeWidth={1.5}
                    opacity={0.85}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* Hover label */}
          {hoveredId !== null &&
            (() => {
              const p = points.find(x => x.id === hoveredId);
              if (!p) return null;
              const cx = plotX + (p.fin / xMax) * plotW;
              const cy = plotY + (1 - p.fout / yMax) * plotH;
              const labelX = Math.min(cx + 12, plotX + plotW - 140);
              const labelY = cy + 4;
              return (
                <g pointerEvents="none">
                  <text
                    x={labelX}
                    y={labelY}
                    fill={tokenColor.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.medium}
                  >
                    {p.name}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 14}
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.sans}
                  >
                    {`fan-in ${p.fin} · fan-out ${p.fout} · total ${p.total}`}
                  </text>
                </g>
              );
            })()}

          {/* Legend */}
          <g transform={`translate(${plotX}, ${height - 44})`}>
            <circle cx={6} cy={0} r={4} fill={kindColor.building} opacity={0.6} />
            <text
              x={18}
              y={4}
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
            >
              file
            </text>
            <text
              x={62}
              y={4}
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
            >
              • 크기 = 총 연결 수 · 고립 파일은 숨김
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Produce "nice" integer ticks from 0..max (up to 5 ticks, skipping 0). */
function axisTicks(max: number): number[] {
  const n = 4;
  const step = Math.max(1, Math.ceil(max / n));
  const out: number[] = [];
  for (let i = 1; i <= n; i++) {
    const v = Math.min(max, i * step);
    if (out[out.length - 1] !== v) out.push(v);
  }
  return out;
}

export const HubScoreView = memo(HubScoreViewImpl);
