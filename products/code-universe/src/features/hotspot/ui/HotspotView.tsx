// HotspotView — churn × complexity bubble scatter.
// --------------------------------------------------------------------
// Each file is a bubble: X = churn (0..100%), Y = complexity (0..100%),
// radius = sqrt(LoC). The top-right quadrant is the "hot" zone (high
// churn + high complexity → refactor candidates). Bubbles are coloured
// by `kindColor` (file hue), semi-transparent; hover pops one to full
// opacity and reveals a filename label. The currently-selected file
// gets a blue accent ring.
//
// Rendered as inline SVG. All animation is CSS keyframe driven so the
// DOM stays quiet after mount.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  kindColor,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { churn, complexity } from "../../../shared/analytics/synth-metrics";

export interface HotspotViewProps {
  ctx: ViewContextValue;
}

// ── Layout constants ──────────────────────────────────────────────────
const PAD_LEFT = 72;
const PAD_RIGHT = 40;
const PAD_TOP = 56;
const PAD_BOTTOM = 64;

const MIN_R = 4;
const MAX_R = 26;

// Cubic-bezier spec'd for 2026 fade-in + micro-scale.
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;
const STAGGER_MS = 18;

// ── Inline keyframes — hoisted once per module load. ─────────────────
const KEYFRAMES = `
@keyframes hotspotFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface Bubble {
  id: string;
  name: string;
  path: string;
  kind: Entity["kind"];
  x: number; // churn 0..1
  y: number; // complexity 0..1
  r: number; // radius px
  loc: number;
  color: string;
}

function HotspotViewImpl({ ctx }: HotspotViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);

  const bubbles = useMemo<Bubble[]>(() => {
    if (!ctx.tree) return [];
    const out: Bubble[] = [];
    let maxLoc = 1;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const loc = e.metrics?.loc ?? 0;
      if (loc > maxLoc) maxLoc = loc;
    }
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const loc = e.metrics?.loc ?? 0;
      const locNorm = Math.sqrt(loc / maxLoc);
      const r = MIN_R + locNorm * (MAX_R - MIN_R);
      out.push({
        id: e.id,
        name: e.name,
        path: e.path,
        kind: e.kind,
        x: churn(e),
        y: complexity(e),
        r,
        loc,
        color: kindColor[e.kind],
      });
    }
    // Sort by radius desc so small bubbles land on top.
    out.sort((a, b) => b.r - a.r);
    return out;
  }, [ctx.tree]);

  const isEmpty = bubbles.length === 0;

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

  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const rootStyle: CSSProperties = {
    animation: `hotspotFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center center",
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        padding: 0,
        boxSizing: "border-box",
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
        aria-label="Hotspot — churn × complexity"
      >
        <g style={rootStyle}>
          {/* Title */}
          <text
            x={PAD_LEFT}
            y={28}
            fill={tokenColor.text0}
            fontSize={font.size.xxl}
            fontFamily={font.sans}
            fontWeight={font.weight.bold}
          >
            Hotspot
          </text>
          <text
            x={PAD_LEFT}
            y={46}
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
          >
            변경 빈도 × 복잡도 — 우상단이 리팩터 1순위
          </text>

          {/* Hot-zone tint (top-right quadrant) */}
          <rect
            x={plotX + plotW / 2}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.danger}
            opacity={0.05}
          />

          {/* Grid */}
          {yTicks.map(t => {
            const y = plotY + (1 - t) * plotH;
            return (
              <line
                key={`gy-${t}`}
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
          {xTicks.map(t => {
            const x = plotX + t * plotW;
            return (
              <line
                key={`gx-${t}`}
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
            Churn → (90일 변경 빈도)
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
            Complexity → (순환 복잡도)
          </text>

          {/* Tick labels */}
          {xTicks.map(t => (
            <text
              key={`xt-${t}`}
              x={plotX + t * plotW}
              y={plotY + plotH + 16}
              textAnchor="middle"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
            >
              {`${Math.round(t * 100)}%`}
            </text>
          ))}
          {yTicks.map(t => (
            <text
              key={`yt-${t}`}
              x={plotX - 8}
              y={plotY + (1 - t) * plotH + 3}
              textAnchor="end"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
            >
              {`${Math.round(t * 100)}%`}
            </text>
          ))}

          {/* Quadrant hint label */}
          <text
            x={plotX + plotW - 8}
            y={plotY + 16}
            textAnchor="end"
            fill={tokenColor.danger}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontStyle="italic"
            opacity={0.7}
          >
            hot zone — 테크부채 1번 후보
          </text>

          {/* Bubbles */}
          {bubbles.map((b, i) => {
            const cx = plotX + b.x * plotW;
            const cy = plotY + (1 - b.y) * plotH;
            const isHovered = hoveredId === b.id;
            const isSelected = ctx.selectedId === b.id;
            const opacity =
              hoveredId !== null && !isHovered ? 0.18 : isHovered ? 1 : 0.55;

            const bubbleStyle: CSSProperties = {
              cursor: "pointer",
              transition: `opacity 180ms ease-out, transform 180ms ease-out`,
              transform: isHovered ? "scale(1.08)" : "scale(1)",
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "fill-box",
              animation: `hotspotFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i * STAGGER_MS, 600)}ms`,
            };

            return (
              <g key={b.id} style={bubbleStyle}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={b.r}
                  fill={b.color}
                  opacity={opacity}
                  stroke={isHovered ? tokenColor.text0 : "none"}
                  strokeWidth={isHovered ? 1.2 : 0}
                  onMouseEnter={() => setHoveredId(b.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(b.id)}
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={b.r + 4}
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

          {/* Hover filename label */}
          {hoveredId !== null &&
            (() => {
              const b = bubbles.find(x => x.id === hoveredId);
              if (!b) return null;
              const cx = plotX + b.x * plotW;
              const cy = plotY + (1 - b.y) * plotH;
              const labelX = Math.min(cx + b.r + 6, plotX + plotW - 120);
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
                    {b.name}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 14}
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.sans}
                  >
                    {`churn ${Math.round(b.x * 100)}% · cx ${Math.round(b.y * 100)}% · ${b.loc} LoC`}
                  </text>
                </g>
              );
            })()}

          {/* Legend */}
          <g transform={`translate(${plotX}, ${height - 44})`}>
            <circle cx={6} cy={0} r={4} fill={kindColor.building} opacity={0.55} />
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
              • 크기 = LoC · 투명도 = idle / hover
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export const HotspotView = memo(HotspotViewImpl);
