// PackageInstabilityView — Robert C. Martin's Instability × Abstractness
// plot, annotated with the Main Sequence diagonal and the two failure
// zones (Pain / Uselessness).
// --------------------------------------------------------------------
// References:
//   - Robert C. Martin, "Design Principles and Design Patterns" (2000)
//     — the original I/A metric pair and the "zone of pain / zone of
//     uselessness" dichotomy.
//   - Robert C. Martin, "Clean Architecture" (2017), ch. on package
//     stability metrics.
//
// What it shows:
//   - X = Instability I = Ce / (Ca + Ce).
//   - Y = Abstractness A = Na / Nc.
//   - The dashed diagonal from (0,1) to (1,0) is the "Main Sequence".
//   - Selected package = large dot with label; siblings = small dots.
//   - Right panel: metrics breakdown for the selected package.
//
// Interactions:
//   - Hover a sibling dot to surface its metrics in the side panel.
//   - Click a dot to dispatch selectEntity.

import {
  memo,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  mainSequenceDistance,
  packageAbstractness,
  packageInstability,
} from "../../../shared/analytics/synth-metrics";

// ── Animation tokens ──────────────────────────────────────────────────
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const HOVER_MS = 180;

const KEYFRAMES = `
@keyframes piFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes piDotIn {
  from { opacity: 0; transform: scale(0.3); }
  to   { opacity: 1; transform: scale(1); }
}
`;

// ── Layout constants ─────────────────────────────────────────────────
const PANEL_W = 280;
const HEADER_H = 92;
const PLOT_PAD = { l: 64, r: 32, t: 32, b: 56 };
const TICK_COUNT = 4;
const TICK_LEN = 5;
const DOT_R_SIBLING = 5;
const DOT_R_SELECTED = 10;

interface Point {
  id: string;
  name: string;
  ca: number;
  ce: number;
  i: number;
  a: number;
  d: number;
  isSelected: boolean;
}

export interface PackageInstabilityViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

function PackageInstabilityViewImpl({
  ctx,
  entity,
  empty,
}: PackageInstabilityViewProps): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const points = useMemo<Point[]>(() => {
    if (!entity || !ctx.tree) return [];
    // Prefer siblings via parent, fallback to all package-like entities.
    const tree = ctx.tree;
    let siblings: Entity[] = [];
    if (entity.parentId) {
      const kids = tree.childrenOf(entity.parentId);
      siblings = kids.filter(
        e => e.kind === "street" || e.kind === "galaxy",
      );
    }
    if (siblings.length <= 1) {
      siblings = Array.from(tree.byId.values()).filter(
        e => e.kind === "street" || e.kind === "galaxy",
      );
    }
    // Make sure selected entity is in the list.
    if (!siblings.some(e => e.id === entity.id)) siblings.push(entity);

    const out: Point[] = siblings.map(e => {
      const { ca, ce, instability } = packageInstability(
        e,
        tree,
        ctx.graph?.fileEdges,
      );
      const a = packageAbstractness(e);
      return {
        id: e.id,
        name: e.name,
        ca,
        ce,
        i: clamp01(instability),
        a: clamp01(a),
        d: mainSequenceDistance(a, instability),
        isSelected: e.id === entity.id,
      };
    });
    // Selected last so it paints on top.
    out.sort((a, b) => Number(a.isSelected) - Number(b.isSelected));
    return out;
  }, [entity, ctx.tree, ctx.graph]);

  const selectedPoint = useMemo(
    () => points.find(p => p.isSelected) ?? null,
    [points],
  );
  const hoveredPoint = useMemo(
    () => (hoveredId ? points.find(p => p.id === hoveredId) ?? null : null),
    [hoveredId, points],
  );
  const focus = hoveredPoint ?? selectedPoint;

  if (empty || !entity) {
    return (
      <div style={rootContainer(width, height)}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStateStyle}>폴더/패키지를 선택하세요.</div>
      </div>
    );
  }

  const plotW = Math.max(120, width - PANEL_W - PLOT_PAD.l - PLOT_PAD.r);
  const plotH = Math.max(120, height - HEADER_H - PLOT_PAD.t - PLOT_PAD.b);
  const plotX = PLOT_PAD.l;
  const plotY = HEADER_H + PLOT_PAD.t;

  const toX = (i: number) => plotX + i * plotW;
  const toY = (a: number) => plotY + (1 - a) * plotH;

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, k) => k / TICK_COUNT);

  return (
    <div style={rootContainer(width, height)}>
      <style>{KEYFRAMES}</style>
      <Header entity={entity} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: HEADER_H,
          width: width - PANEL_W,
          height: height - HEADER_H,
          animation: `piFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
        }}
      >
        <svg
          width={width - PANEL_W}
          height={height - HEADER_H}
          viewBox={`0 0 ${width - PANEL_W} ${height - HEADER_H}`}
          style={{ display: "block" }}
          role="img"
          aria-label="Instability × Abstractness plot"
        >
          {/* Plot area background */}
          <rect
            x={plotX}
            y={plotY - HEADER_H}
            width={plotW}
            height={plotH}
            fill={tokenColor.bg2}
            stroke={tokenColor.border}
            strokeWidth={1}
            transform={`translate(0, ${HEADER_H})`}
          />

          {/* Zone of Pain — bottom-left (low A, low I) */}
          <rect
            x={plotX}
            y={plotY - HEADER_H + plotH * 0.7}
            width={plotW * 0.3}
            height={plotH * 0.3}
            fill="rgba(229, 72, 77, 0.06)"
            transform={`translate(0, ${HEADER_H})`}
          />
          {/* Zone of Uselessness — top-right (high A, high I) */}
          <rect
            x={plotX + plotW * 0.7}
            y={plotY - HEADER_H}
            width={plotW * 0.3}
            height={plotH * 0.3}
            fill="rgba(224, 147, 33, 0.06)"
            transform={`translate(0, ${HEADER_H})`}
          />

          <g transform={`translate(0, ${HEADER_H})`}>
            {/* Main sequence diagonal A + I = 1 */}
            <line
              x1={toX(0) - 0}
              y1={toY(1) - HEADER_H}
              x2={toX(1) - 0}
              y2={toY(0) - HEADER_H}
              stroke={tokenColor.accent}
              strokeWidth={1.2}
              strokeDasharray="6 5"
              opacity={0.55}
            />

            {/* Axes ticks — X */}
            {ticks.map(t => (
              <g key={`x-${t}`}>
                <line
                  x1={toX(t)}
                  x2={toX(t)}
                  y1={plotY + plotH - HEADER_H}
                  y2={plotY + plotH - HEADER_H + TICK_LEN}
                  stroke={tokenColor.border}
                />
                <text
                  x={toX(t)}
                  y={plotY + plotH - HEADER_H + TICK_LEN + 12}
                  textAnchor="middle"
                  fontSize={font.size.xxs}
                  fill={tokenColor.text2}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t.toFixed(2)}
                </text>
              </g>
            ))}
            {/* Axes ticks — Y */}
            {ticks.map(t => (
              <g key={`y-${t}`}>
                <line
                  x1={plotX - TICK_LEN}
                  x2={plotX}
                  y1={toY(t) - HEADER_H}
                  y2={toY(t) - HEADER_H}
                  stroke={tokenColor.border}
                />
                <text
                  x={plotX - TICK_LEN - 4}
                  y={toY(t) - HEADER_H + 3}
                  textAnchor="end"
                  fontSize={font.size.xxs}
                  fill={tokenColor.text2}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {t.toFixed(2)}
                </text>
              </g>
            ))}

            {/* Zone labels */}
            <text
              x={plotX + 8}
              y={plotY + plotH - 10 - HEADER_H}
              fontSize={font.size.xs}
              fill={tokenColor.danger}
              fontStyle="italic"
              opacity={0.8}
            >
              Zone of Pain
            </text>
            <text
              x={plotX + plotW - 8}
              y={plotY + 18 - HEADER_H}
              textAnchor="end"
              fontSize={font.size.xs}
              fill={tokenColor.warn}
              fontStyle="italic"
              opacity={0.85}
            >
              Zone of Uselessness
            </text>

            {/* Axis labels */}
            <text
              x={plotX + plotW / 2}
              y={plotY + plotH - HEADER_H + 44}
              textAnchor="middle"
              fontSize={font.size.sm}
              fill={tokenColor.text2}
            >
              Instability (I = Ce / (Ca + Ce))
            </text>
            <text
              x={0}
              y={0}
              textAnchor="middle"
              fontSize={font.size.sm}
              fill={tokenColor.text2}
              transform={`translate(16, ${plotY + plotH / 2 - HEADER_H}) rotate(-90)`}
            >
              Abstractness (A)
            </text>

            {/* Points */}
            {points.map((p, idx) => {
              const cx = toX(p.i);
              const cy = toY(p.a) - HEADER_H;
              const isHovered = hoveredId === p.id;
              const dimmed = hoveredId !== null && !isHovered && !p.isSelected;
              const r = p.isSelected ? DOT_R_SELECTED : DOT_R_SIBLING;
              const fill = p.isSelected
                ? tokenColor.accent
                : pointFillByDistance(p.d);
              return (
                <g
                  key={p.id}
                  style={{
                    animation: `piDotIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(idx * STAGGER_MS, 440)}ms`,
                    opacity: dimmed ? 0.3 : 1,
                    transition: `opacity ${HOVER_MS}ms ease-out`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e: MouseEvent<SVGGElement>) => {
                    e.stopPropagation();
                    ctx.dispatch.selectEntity(p.id);
                  }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={fill}
                    stroke={p.isSelected ? tokenColor.text0 : "rgba(10,10,10,0.25)"}
                    strokeWidth={p.isSelected ? 1.6 : 0.8}
                  />
                  {p.isSelected && (
                    <text
                      x={cx + r + 6}
                      y={cy + 4}
                      fontSize={font.size.sm}
                      fill={tokenColor.text0}
                      fontWeight={font.weight.semibold}
                    >
                      {p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <SidePanel width={PANEL_W} focus={focus} selected={selectedPoint} />
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

function Header({ entity }: { entity: Entity }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: `${space[5]}px ${space[6]}px ${space[3]}px`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: font.size.xxl,
          fontWeight: font.weight.bold,
          letterSpacing: font.letter.tight,
          color: tokenColor.text0,
        }}
      >
        Package Instability
      </div>
      <div
        style={{
          fontSize: font.size.xs,
          color: tokenColor.text2,
          marginTop: 4,
        }}
      >
        <span style={{ fontWeight: font.weight.semibold, color: tokenColor.text1 }}>
          {entity.name}
        </span>
        <span> · Martin I/A · main sequence distance</span>
      </div>
    </div>
  );
}

function SidePanel({
  width,
  focus,
  selected,
}: {
  width: number;
  focus: Point | null;
  selected: Point | null;
}): ReactElement {
  const p = focus ?? selected;
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: HEADER_H,
        width,
        bottom: 0,
        borderLeft: `1px solid ${tokenColor.border}`,
        background: tokenColor.bg2,
        padding: `${space[5]}px ${space[6]}px`,
        boxSizing: "border-box",
        fontFamily: font.sans,
        animation: `piFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
        animationDelay: "120ms",
      }}
    >
      <div
        style={{
          fontSize: font.size.xxs,
          textTransform: "uppercase",
          letterSpacing: font.letter.wide,
          color: tokenColor.text2,
        }}
      >
        {p?.isSelected ?? true ? "Selected package" : "Hovered package"}
      </div>
      <div
        style={{
          fontSize: font.size.xl,
          fontWeight: font.weight.semibold,
          color: tokenColor.text0,
          marginTop: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {p?.name ?? "—"}
      </div>
      <div
        style={{
          marginTop: space[5],
          display: "grid",
          gridTemplateColumns: "1fr auto",
          rowGap: 8,
          fontSize: font.size.sm,
          color: tokenColor.text1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <MetricRow label="Ca (afferent)" value={p ? String(p.ca) : "—"} />
        <MetricRow label="Ce (efferent)" value={p ? String(p.ce) : "—"} />
        <MetricRow
          label="I = Ce / (Ca + Ce)"
          value={p ? p.i.toFixed(2) : "—"}
        />
        <MetricRow label="A (abstractness)" value={p ? p.a.toFixed(2) : "—"} />
        <MetricRow
          label="|A + I − 1|"
          value={p ? p.d.toFixed(2) : "—"}
          tone={
            p === null
              ? "neutral"
              : p.d <= 0.2
              ? "good"
              : p.d <= 0.45
              ? "warn"
              : "bad"
          }
        />
      </div>

      <div
        style={{
          marginTop: space[6],
          padding: `${space[3]}px`,
          borderRadius: radiusToken.md,
          background: tokenColor.bg0,
          border: `1px solid ${tokenColor.border}`,
          fontSize: font.size.xs,
          color: tokenColor.text2,
          lineHeight: 1.55,
        }}
      >
        Main sequence = the diagonal A + I = 1. Packages on the line
        balance abstract / stable correctly. Bottom-left = rigid concrete
        (Pain), top-right = abstract + unused (Uselessness).
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}): ReactElement {
  const color =
    tone === "good"
      ? tokenColor.success
      : tone === "warn"
      ? tokenColor.warn
      : tone === "bad"
      ? tokenColor.danger
      : tokenColor.text0;
  return (
    <>
      <div style={{ color: tokenColor.text2 }}>{label}</div>
      <div style={{ color, fontWeight: font.weight.semibold, textAlign: "right" }}>
        {value}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Colour a sibling dot by distance from the main sequence: closer =
 *  healthy green, further = danger red. */
function pointFillByDistance(d: number): string {
  if (d <= 0.15) return tokenColor.success;
  if (d <= 0.3) return "#8dd6a8";
  if (d <= 0.45) return tokenColor.warn;
  return tokenColor.danger;
}

// ── Shared styles ─────────────────────────────────────────────────────

function rootContainer(w: number, h: number): CSSProperties {
  return {
    position: "relative",
    width: w,
    height: h,
    background: tokenColor.bg0,
    fontFamily: font.sans,
    color: tokenColor.text0,
    overflow: "hidden",
  };
}

const emptyStateStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: tokenColor.text3,
  fontSize: font.size.md,
  fontFamily: font.sans,
};

export const PackageInstabilityView = memo(PackageInstabilityViewImpl);
