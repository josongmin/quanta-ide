// CKMatrixView — Chidamber & Kemerer CBO × LCOM scatter.
// --------------------------------------------------------------------
// X axis = CBO (Coupling Between Objects), 0..1.
// Y axis = LCOM (Lack of Cohesion of Methods), 0..1.
// Circle radius  ∝ sqrt(LoC).
// Colour          = kindColor[entity.kind].
//
// Risk quadrants: the plot is split into four tinted zones.
//   ▸ High CBO × High LCOM → "God Object Zone" (tinted danger).
//   ▸ Low  CBO × High LCOM → "Incohesive".
//   ▸ High CBO × Low  LCOM → "Over-coupled".
//   ▸ Low  CBO × Low  LCOM → "Cohesive & Decoupled" (success tint).
//
// Reference: Chidamber & Kemerer, "A Metrics Suite for Object-Oriented
// Design", IEEE TSE 1994.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  kindColor,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { cbo, lcom } from "../../../shared/analytics/synth-metrics";

export interface CKMatrixViewProps {
  ctx: ViewContextValue;
}

const PAD_LEFT = 76;
const PAD_RIGHT = 40;
const PAD_TOP = 64;
const PAD_BOTTOM = 68;

const MIN_R = 4;
const MAX_R = 26;

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes ckFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface Dot {
  id: string;
  name: string;
  path: string;
  kind: Entity["kind"];
  x: number; // CBO 0..1
  y: number; // LCOM 0..1
  r: number; // radius px
  loc: number;
  color: string;
}

function CKMatrixViewImpl({ ctx }: CKMatrixViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM);

  const dots = useMemo<Dot[]>(() => {
    if (!ctx.tree) return [];
    const edges = ctx.graph?.fileEdges;
    let maxLoc = 1;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const loc = e.metrics?.loc ?? 0;
      if (loc > maxLoc) maxLoc = loc;
    }
    const out: Dot[] = [];
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
        x: cbo(e, edges),
        y: lcom(e),
        r,
        loc,
        color: kindColor[e.kind],
      });
    }
    out.sort((a, b) => b.r - a.r);
    return out;
  }, [ctx.tree, ctx.graph?.fileEdges]);

  const isEmpty = dots.length === 0;

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
        로딩 중
      </div>
    );
  }

  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const rootStyle: CSSProperties = {
    animation: `ckFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center center",
  };

  const midX = plotX + plotW / 2;
  const midY = plotY + plotH / 2;

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <style>{KEYFRAMES}</style>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent" }}
        role="img"
        aria-label="CK Matrix — coupling × cohesion"
      >
        <g style={rootStyle}>
          {/* Title */}
          <text
            x={PAD_LEFT}
            y={28}
            fill={tokenColor.text0}
            fontSize={font.size.display}
            fontFamily={font.sans}
            fontWeight={font.weight.semibold}
            letterSpacing={font.letter.tight}
          >
            CK Matrix
          </text>
          <text
            x={PAD_LEFT}
            y={48}
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
          >
            CBO × LCOM — Chidamber & Kemerer, IEEE TSE 1994
          </text>

          {/* Quadrant tints */}
          <rect
            x={midX}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.danger}
            opacity={0.07}
          />
          <rect
            x={plotX}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.warn}
            opacity={0.05}
          />
          <rect
            x={midX}
            y={midY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.warn}
            opacity={0.05}
          />
          <rect
            x={plotX}
            y={midY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.success}
            opacity={0.07}
          />

          {/* Mid grid crosshair */}
          <line
            x1={midX}
            y1={plotY}
            x2={midX}
            y2={plotY + plotH}
            stroke={tokenColor.borderStrong}
            strokeDasharray="2 3"
            strokeWidth={1}
          />
          <line
            x1={plotX}
            y1={midY}
            x2={plotX + plotW}
            y2={midY}
            stroke={tokenColor.borderStrong}
            strokeDasharray="2 3"
            strokeWidth={1}
          />

          {/* Fine grid */}
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
                strokeOpacity={0.45}
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
                strokeOpacity={0.45}
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

          {/* Quadrant labels */}
          <text
            x={midX + 10}
            y={plotY + 18}
            fill={tokenColor.danger}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            opacity={0.85}
          >
            God Object Zone
          </text>
          <text
            x={plotX + plotW - 8}
            y={plotY + plotH - 10}
            textAnchor="end"
            fill={tokenColor.text2}
            fontSize={font.size.xxs}
            fontFamily={font.sans}
            fontStyle="italic"
          >
            Over-coupled
          </text>
          <text
            x={plotX + 10}
            y={plotY + 18}
            fill={tokenColor.text2}
            fontSize={font.size.xxs}
            fontFamily={font.sans}
            fontStyle="italic"
          >
            Incohesive
          </text>
          <text
            x={plotX + 10}
            y={plotY + plotH - 10}
            fill={tokenColor.success}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            opacity={0.85}
          >
            Cohesive & Decoupled
          </text>

          {/* Axis labels */}
          <text
            x={plotX + plotW / 2}
            y={height - 26}
            textAnchor="middle"
            fill={tokenColor.text1}
            fontSize={font.size.sm}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
          >
            CBO → Coupling Between Objects
          </text>
          <text
            x={0}
            y={0}
            textAnchor="middle"
            fill={tokenColor.text1}
            fontSize={font.size.sm}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            transform={`translate(22, ${plotY + plotH / 2}) rotate(-90)`}
          >
            LCOM → Lack of Cohesion
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
              fontFamily={font.mono}
            >
              {t.toFixed(2)}
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
              fontFamily={font.mono}
            >
              {t.toFixed(2)}
            </text>
          ))}

          {/* Dots */}
          {dots.map((d, i) => {
            const cx = plotX + d.x * plotW;
            const cy = plotY + (1 - d.y) * plotH;
            const isHovered = hoveredId === d.id;
            const isSelected = ctx.selectedId === d.id;
            const opacity =
              hoveredId !== null && !isHovered ? 0.18 : isHovered ? 1 : 0.6;

            const dotStyle: CSSProperties = {
              cursor: "pointer",
              transition: `opacity 180ms ease-out, transform 180ms ease-out`,
              transform: isHovered ? "scale(1.08)" : "scale(1)",
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "fill-box",
              animation: `ckFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i * STAGGER_MS, 600)}ms`,
            };

            return (
              <g key={d.id} style={dotStyle}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={d.r}
                  fill={d.color}
                  opacity={opacity}
                  stroke={isHovered ? tokenColor.text0 : "none"}
                  strokeWidth={isHovered ? 1.2 : 0}
                  onMouseEnter={() => setHoveredId(d.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(d.id)}
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={d.r + 4}
                    fill="none"
                    stroke={tokenColor.accent}
                    strokeWidth={1.5}
                    opacity={0.9}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* Hover label */}
          {hoveredId !== null &&
            (() => {
              const d = dots.find(x => x.id === hoveredId);
              if (!d) return null;
              const cx = plotX + d.x * plotW;
              const cy = plotY + (1 - d.y) * plotH;
              const labelX = Math.min(cx + d.r + 6, plotX + plotW - 180);
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
                    {d.name}
                  </text>
                  <text
                    x={labelX}
                    y={labelY + 14}
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    {`CBO ${d.x.toFixed(2)} · LCOM ${d.y.toFixed(2)} · ${d.loc} LoC`}
                  </text>
                </g>
              );
            })()}

          {/* Legend */}
          <g transform={`translate(${plotX}, ${height - 46})`}>
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
              · 크기 = LoC · 상단·우측 사분면 = 리팩터 1순위
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export const CKMatrixView = memo(CKMatrixViewImpl);
