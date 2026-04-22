// PackageEvolutionView — multi-panel temporal view of a package.
// --------------------------------------------------------------------
// References:
//   - Riva, "Software Cartography — A Visual Approach to Software
//     Architecture" (2004) — the idea of aligning multiple evolution
//     signals on a shared time axis as a cartographic "map" of the
//     project's history.
//   - Lungu, Lanza & Nierstrasz, "Evolutionary and Collaborative
//     Software Architecture Recovery", MSR 2007.
//
// Layout — three stacked panels share one X axis (time):
//   [1] LoC growth line (12 months)
//   [2] Weekly churn dual-bar (adds green ↑, deletes red ↓ — diverging)
//   [3] Team size — active authors per month (area chart)
//
// Interaction:
//   - Hover anywhere in the plot area → vertical crosshair syncs across
//     the three panels + a shared tooltip reports values.

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
  packageChurnHistory,
  packageLocHistory,
  packageTeamHistory,
} from "../../../shared/analytics/synth-metrics";

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const PANEL_STAGGER_MS = 90;
const HOVER_MS = 180;

const KEYFRAMES = `
@keyframes peFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes pePanelIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const HEADER_H = 92;
const PLOT_PAD = { l: 60, r: 24, t: 16, b: 30 };
const GAP = 10;
const N_MONTHS = 12;
const N_WEEKS = 26;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface PackageEvolutionViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

function PackageEvolutionViewImpl({
  ctx,
  entity,
  empty,
}: PackageEvolutionViewProps): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  // Hover state — one shared normalized 0..1 position (across time).
  const [hoverT, setHoverT] = useState<number | null>(null);

  const series = useMemo(() => {
    if (!entity) return null;
    const loc = packageLocHistory(entity, N_MONTHS);
    const churn = packageChurnHistory(entity, N_WEEKS);
    const team = packageTeamHistory(entity, N_MONTHS);
    return { loc, churn, team };
  }, [entity]);

  if (empty || !entity || !series) {
    return (
      <div style={rootContainer(width, height)}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStateStyle}>폴더/패키지를 선택하세요.</div>
      </div>
    );
  }

  // Total plot area (below header).
  const plotAreaY = HEADER_H;
  const plotAreaH = Math.max(200, height - HEADER_H - space[4]);

  // Three equal-ish panels.
  const panelH = Math.floor((plotAreaH - GAP * 2 - space[4]) / 3);
  const panels = [
    { y: plotAreaY + space[2], h: panelH },
    { y: plotAreaY + space[2] + panelH + GAP, h: panelH },
    { y: plotAreaY + space[2] + (panelH + GAP) * 2, h: panelH },
  ] as const;

  const monthLabels = buildMonthLabels(N_MONTHS);

  return (
    <div style={rootContainer(width, height)}>
      <style>{KEYFRAMES}</style>
      <Header entity={entity} />

      {/* Panel 1 — LoC growth */}
      <LoCPanel
        x={0}
        y={panels[0].y}
        w={width}
        h={panels[0].h}
        values={series.loc}
        labels={monthLabels}
        hoverT={hoverT}
        onHover={setHoverT}
        delayMs={0}
      />

      {/* Panel 2 — weekly churn */}
      <ChurnPanel
        x={0}
        y={panels[1].y}
        w={width}
        h={panels[1].h}
        weeks={series.churn}
        hoverT={hoverT}
        onHover={setHoverT}
        delayMs={PANEL_STAGGER_MS}
      />

      {/* Panel 3 — team size */}
      <TeamPanel
        x={0}
        y={panels[2].y}
        w={width}
        h={panels[2].h}
        values={series.team}
        labels={monthLabels}
        hoverT={hoverT}
        onHover={setHoverT}
        delayMs={PANEL_STAGGER_MS * 2}
      />
    </div>
  );
}

// ── Panels ────────────────────────────────────────────────────────────

interface PanelGeom {
  x: number;
  y: number;
  w: number;
  h: number;
}

function plotRect(p: PanelGeom): { x: number; y: number; w: number; h: number } {
  return {
    x: p.x + PLOT_PAD.l,
    y: p.y + PLOT_PAD.t,
    w: Math.max(16, p.w - PLOT_PAD.l - PLOT_PAD.r),
    h: Math.max(16, p.h - PLOT_PAD.t - PLOT_PAD.b),
  };
}

function panelWrapStyle(
  p: PanelGeom,
  delayMs: number,
): CSSProperties {
  return {
    position: "absolute",
    left: p.x + space[4],
    top: p.y,
    width: p.w - space[4] * 2,
    height: p.h,
    background: tokenColor.bg2,
    border: `1px solid ${tokenColor.border}`,
    borderRadius: radiusToken.md,
    overflow: "hidden",
    animation: `pePanelIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    animationDelay: `${delayMs}ms`,
  };
}

function PanelTitle({ title, right }: { title: string; right?: string }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 6,
        left: 12,
        right: 12,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          color: tokenColor.text0,
        }}
      >
        {title}
      </div>
      {right && (
        <div
          style={{
            fontSize: font.size.xxs,
            color: tokenColor.text2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {right}
        </div>
      )}
    </div>
  );
}

function LoCPanel({
  x, y, w, h, values, labels, hoverT, onHover, delayMs,
}: PanelGeom & {
  values: readonly number[];
  labels: readonly string[];
  hoverT: number | null;
  onHover: (t: number | null) => void;
  delayMs: number;
}): ReactElement {
  const panel: PanelGeom = { x, y, w: w, h };
  const rect = plotRect({ x: 0, y: 0, w: w - space[4] * 2, h });
  const innerW = rect.w;
  const innerH = rect.h;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const toX = (i: number) => rect.x + (values.length <= 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const toY = (v: number) => rect.y + innerH - ((v - min) / range) * innerH;

  const points = values.map((v, i) => ({ x: toX(i), y: toY(v), v }));
  const pathD = smoothPath(points.map(p => [p.x, p.y] as const));

  // Area under curve.
  const areaD = `${pathD} L${points[points.length - 1]!.x},${rect.y + innerH} L${points[0]!.x},${rect.y + innerH} Z`;

  const hoverIdx =
    hoverT === null ? null : Math.round(clamp01(hoverT) * (values.length - 1));
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={panelWrapStyle(panel, delayMs)}>
      <PanelTitle
        title="LoC growth · 12mo"
        right={`${formatNum(min)} → ${formatNum(max)}`}
      />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${innerW + PLOT_PAD.l + PLOT_PAD.r} ${h}`}
        onMouseMove={e => handleSvgHover(e, rect, values.length, onHover)}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="pe-loc-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={tokenColor.accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={tokenColor.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#pe-loc-grad)" />
        <path
          d={pathD}
          fill="none"
          stroke={tokenColor.accent}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* X labels — sparse */}
        {labels.map((m, i) => {
          if (i % 2 !== 0 && i !== labels.length - 1) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={toX(i)}
              y={rect.y + innerH + 14}
              textAnchor="middle"
              fontSize={font.size.xxs}
              fill={tokenColor.text2}
            >
              {m}
            </text>
          );
        })}
        {hoverPoint && (
          <>
            <Crosshair x={hoverPoint.x} top={rect.y} bottom={rect.y + innerH} />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r={3.5}
              fill={tokenColor.accent}
              stroke={tokenColor.bg0}
              strokeWidth={1.2}
            />
            <HoverBadge
              x={hoverPoint.x}
              y={rect.y + 6}
              label={`${formatNum(hoverPoint.v)} LoC · ${labels[hoverIdx!] ?? ""}`}
              svgWidth={innerW + PLOT_PAD.l + PLOT_PAD.r}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function ChurnPanel({
  x, y, w, h, weeks, hoverT, onHover, delayMs,
}: PanelGeom & {
  weeks: readonly { add: number; del: number }[];
  hoverT: number | null;
  onHover: (t: number | null) => void;
  delayMs: number;
}): ReactElement {
  const panel: PanelGeom = { x, y, w, h };
  const rect = plotRect({ x: 0, y: 0, w: w - space[4] * 2, h });
  const innerW = rect.w;
  const innerH = rect.h;

  const mid = rect.y + innerH / 2;
  const maxMag = Math.max(1, ...weeks.map(v => Math.max(v.add, v.del)));

  const barW = (innerW / weeks.length) * 0.7;
  const step = innerW / weeks.length;

  const toAddH = (a: number) => (a / maxMag) * (innerH / 2);
  const toDelH = (d: number) => (d / maxMag) * (innerH / 2);

  const hoverIdx =
    hoverT === null
      ? null
      : Math.min(weeks.length - 1, Math.max(0, Math.round(clamp01(hoverT) * (weeks.length - 1))));
  const hw = hoverIdx !== null ? weeks[hoverIdx]! : null;

  return (
    <div style={panelWrapStyle(panel, delayMs)}>
      <PanelTitle
        title="Weekly churn · 26wk"
        right={`+/- max ${formatNum(maxMag)}`}
      />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${innerW + PLOT_PAD.l + PLOT_PAD.r} ${h}`}
        onMouseMove={e => handleSvgHover(e, rect, weeks.length, onHover)}
        onMouseLeave={() => onHover(null)}
      >
        {/* Midline */}
        <line
          x1={rect.x}
          x2={rect.x + innerW}
          y1={mid}
          y2={mid}
          stroke={tokenColor.borderSoft}
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        {weeks.map((wk, i) => {
          const cx = rect.x + step * i + step / 2;
          const addH = toAddH(wk.add);
          const delH = toDelH(wk.del);
          const isHovered = hoverIdx === i;
          return (
            <g key={`wk-${i}`}>
              <rect
                x={cx - barW / 2}
                y={mid - addH}
                width={barW}
                height={addH}
                fill={tokenColor.success}
                opacity={isHovered ? 1 : 0.85}
                rx={1}
              />
              <rect
                x={cx - barW / 2}
                y={mid}
                width={barW}
                height={delH}
                fill={tokenColor.danger}
                opacity={isHovered ? 1 : 0.8}
                rx={1}
              />
            </g>
          );
        })}
        {hoverIdx !== null && hw && (
          <>
            <Crosshair
              x={rect.x + step * hoverIdx + step / 2}
              top={rect.y}
              bottom={rect.y + innerH}
            />
            <HoverBadge
              x={rect.x + step * hoverIdx + step / 2}
              y={rect.y + 6}
              label={`+${formatNum(hw.add)} / -${formatNum(hw.del)}`}
              svgWidth={innerW + PLOT_PAD.l + PLOT_PAD.r}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function TeamPanel({
  x, y, w, h, values, labels, hoverT, onHover, delayMs,
}: PanelGeom & {
  values: readonly number[];
  labels: readonly string[];
  hoverT: number | null;
  onHover: (t: number | null) => void;
  delayMs: number;
}): ReactElement {
  const panel: PanelGeom = { x, y, w, h };
  const rect = plotRect({ x: 0, y: 0, w: w - space[4] * 2, h });
  const innerW = rect.w;
  const innerH = rect.h;

  const max = Math.max(1, ...values);
  const toX = (i: number) => rect.x + (values.length <= 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
  const toY = (v: number) => rect.y + innerH - (v / max) * innerH;

  const points = values.map((v, i) => ({ x: toX(i), y: toY(v), v }));
  const line = smoothPath(points.map(p => [p.x, p.y] as const));
  const area = `${line} L${points[points.length - 1]!.x},${rect.y + innerH} L${points[0]!.x},${rect.y + innerH} Z`;

  const hoverIdx =
    hoverT === null ? null : Math.round(clamp01(hoverT) * (values.length - 1));
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={panelWrapStyle(panel, delayMs)}>
      <PanelTitle
        title="Team size · active authors/month"
        right={`peak ${max}`}
      />
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${innerW + PLOT_PAD.l + PLOT_PAD.r} ${h}`}
        onMouseMove={e => handleSvgHover(e, rect, values.length, onHover)}
        onMouseLeave={() => onHover(null)}
      >
        <defs>
          <linearGradient id="pe-team-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7e4ed6" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#7e4ed6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pe-team-grad)" />
        <path
          d={line}
          fill="none"
          stroke="#7e4ed6"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {labels.map((m, i) => {
          if (i % 2 !== 0 && i !== labels.length - 1) return null;
          return (
            <text
              key={`tm-${i}`}
              x={toX(i)}
              y={rect.y + innerH + 14}
              textAnchor="middle"
              fontSize={font.size.xxs}
              fill={tokenColor.text2}
            >
              {m}
            </text>
          );
        })}
        {hoverPoint && (
          <>
            <Crosshair x={hoverPoint.x} top={rect.y} bottom={rect.y + innerH} />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r={3.5}
              fill="#7e4ed6"
              stroke={tokenColor.bg0}
              strokeWidth={1.2}
            />
            <HoverBadge
              x={hoverPoint.x}
              y={rect.y + 6}
              label={`${hoverPoint.v} authors · ${labels[hoverIdx!] ?? ""}`}
              svgWidth={innerW + PLOT_PAD.l + PLOT_PAD.r}
            />
          </>
        )}
      </svg>
    </div>
  );
}

// ── Shared sub-UI ─────────────────────────────────────────────────────

function Crosshair({
  x, top, bottom,
}: { x: number; top: number; bottom: number }): ReactElement {
  return (
    <line
      x1={x}
      x2={x}
      y1={top}
      y2={bottom}
      stroke={tokenColor.text1}
      strokeDasharray="2 3"
      strokeWidth={1}
      opacity={0.45}
      style={{ transition: `opacity ${HOVER_MS}ms ease-out` }}
    />
  );
}

function HoverBadge({
  x, y, label, svgWidth,
}: { x: number; y: number; label: string; svgWidth: number }): ReactElement {
  const W = Math.min(220, Math.max(96, label.length * 6.2 + 16));
  const H = 20;
  const bx = Math.max(4, Math.min(svgWidth - W - 4, x - W / 2));
  return (
    <g transform={`translate(${bx}, ${y})`} pointerEvents="none">
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={3}
        fill={tokenColor.bg0}
        stroke={tokenColor.border}
      />
      <text
        x={W / 2}
        y={13}
        textAnchor="middle"
        fontSize={font.size.xxs}
        fill={tokenColor.text0}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {label}
      </text>
    </g>
  );
}

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
        Package Evolution
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
        <span> · LoC × weekly churn × monthly team</span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function handleSvgHover(
  e: MouseEvent<SVGSVGElement>,
  rect: { x: number; w: number },
  n: number,
  onHover: (t: number | null) => void,
): void {
  const svg = e.currentTarget;
  const svgRect = svg.getBoundingClientRect();
  // Convert client x → viewBox x.
  const viewBoxWidth = svg.viewBox.baseVal.width || svgRect.width;
  const px = ((e.clientX - svgRect.left) / svgRect.width) * viewBoxWidth;
  if (px < rect.x || px > rect.x + rect.w || n <= 0) {
    onHover(null);
    return;
  }
  const t = clamp01((px - rect.x) / rect.w);
  onHover(t);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothPath(points: readonly (readonly [number, number])[]): string {
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

function buildMonthLabels(n: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(MONTHS[d.getMonth()]!);
  }
  return out;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
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
    animation: `peFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

export const PackageEvolutionView = memo(PackageEvolutionViewImpl);
