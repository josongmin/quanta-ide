// DoraMetricsView — four-quadrant executive dashboard.
// --------------------------------------------------------------------
// Quadrants: Deploy Frequency · Lead Time · MTTR · Change Failure Rate.
// Each quadrant shows a large counter (animated 0→target), a unit
// suffix, a tier badge (Elite/High/Medium/Low), and a 90-day sparkline
// behind the number that draws in via strokeDasharray animation.
//
// Tier colors:
//   Elite  — success
//   High   — accent
//   Medium — warn
//   Low    — danger
//
// Reference: Forsgren / Humble / Kim, Accelerate (2018) + DORA State of
// DevOps.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  doraMetrics,
  hashId,
  mulberry32,
} from "../../../shared/analytics/synth-metrics";

export interface DoraMetricsViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 20;
const COUNTER_MS = 640;
const SPARK_DRAW_MS = 720;

const SPARK_DAYS = 90;

const KEYFRAMES = `
@keyframes doraFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes doraTileIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sparkDraw {
  from { stroke-dashoffset: var(--spark-len); }
  to   { stroke-dashoffset: 0; }
}
`;

type Tier = "elite" | "high" | "medium" | "low";

interface Quadrant {
  id: "deploy" | "lead" | "mttr" | "fail";
  label: string;
  value: number;
  unit: string;
  format: (n: number) => string;
  tier: Tier;
  sparkline: readonly number[];
  sparkInvert?: boolean; // if true, lower sparkline = better (for error charts)
}

const TIER_LABEL: Record<Tier, string> = {
  elite: "Elite",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function tierColor(tier: Tier): string {
  switch (tier) {
    case "elite":
      return tokenColor.success;
    case "high":
      return tokenColor.accent;
    case "medium":
      return tokenColor.warn;
    case "low":
      return tokenColor.danger;
  }
}

function tierBadgeStyle(tier: Tier): CSSProperties {
  const c = tierColor(tier);
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: `2px ${space[2]}px`,
    borderRadius: radiusToken.pill,
    background: `${c}1a`, // ~10% alpha
    color: c,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    letterSpacing: font.letter.wide,
    textTransform: "uppercase",
    border: `1px solid ${c}40`,
  };
}

/** Per-quadrant tier shortcut. */
function deployTier(n: number): Tier {
  if (n > 5) return "elite";
  if (n > 1.5) return "high";
  if (n > 0.4) return "medium";
  return "low";
}
function leadTier(h: number): Tier {
  if (h < 24) return "elite";
  if (h < 72) return "high";
  if (h < 168) return "medium";
  return "low";
}
function mttrTier(h: number): Tier {
  if (h < 2) return "elite";
  if (h < 6) return "high";
  if (h < 12) return "medium";
  return "low";
}
function failTier(p: number): Tier {
  if (p < 0.1) return "elite";
  if (p < 0.2) return "high";
  if (p < 0.3) return "medium";
  return "low";
}

/** Mulberry32-seeded 90-day sparkline with a gentle trend + noise. */
function sparkSeries(seedStr: string, baseline: number, jitter: number): number[] {
  const rng = mulberry32(hashId(seedStr));
  const arr: number[] = [];
  let prev = baseline;
  for (let i = 0; i < SPARK_DAYS; i++) {
    const drift = (rng() - 0.5) * jitter;
    prev = Math.max(0, prev * 0.7 + baseline * 0.3 + drift);
    arr.push(prev);
  }
  return arr;
}

/** rAF interpolated counter 0→target, ease-out cubic. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function DoraMetricsViewImpl({ ctx }: DoraMetricsViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rootId = ctx.tree?.rootId ?? null;

  const { dora, quadrants } = useMemo(() => {
    const d = doraMetrics(rootId);
    const rid = rootId ?? "root";
    const quadrants: Quadrant[] = [
      {
        id: "deploy",
        label: "Deploy Frequency",
        value: d.deploysPerDay,
        unit: "/day",
        format: n => n.toFixed(1),
        tier: deployTier(d.deploysPerDay),
        sparkline: sparkSeries(
          `${rid}:deploy:${SPARK_DAYS}`,
          d.deploysPerDay,
          d.deploysPerDay * 0.6,
        ),
      },
      {
        id: "lead",
        label: "Lead Time",
        value: d.leadTimeHours,
        unit: d.leadTimeHours >= 24 ? "days" : "hours",
        format: n =>
          d.leadTimeHours >= 24 ? (n / 24).toFixed(1) : n.toFixed(0),
        tier: leadTier(d.leadTimeHours),
        sparkline: sparkSeries(
          `${rid}:lead:${SPARK_DAYS}`,
          d.leadTimeHours,
          d.leadTimeHours * 0.5,
        ),
        sparkInvert: true,
      },
      {
        id: "mttr",
        label: "MTTR",
        value: d.mttrHours,
        unit: "hours",
        format: n => n.toFixed(1),
        tier: mttrTier(d.mttrHours),
        sparkline: sparkSeries(
          `${rid}:mttr:${SPARK_DAYS}`,
          d.mttrHours,
          d.mttrHours * 0.7,
        ),
        sparkInvert: true,
      },
      {
        id: "fail",
        label: "Change Failure Rate",
        value: d.changeFailRate,
        unit: "%",
        format: n => (n * 100).toFixed(1),
        tier: failTier(d.changeFailRate),
        sparkline: sparkSeries(
          `${rid}:fail:${SPARK_DAYS}`,
          d.changeFailRate,
          0.1,
        ),
        sparkInvert: true,
      },
    ];
    return { dora: d, quadrants };
  }, [rootId]);

  const rootStyle: CSSProperties = {
    animation: `doraFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  const tierVerdict: Record<Tier, string> = {
    elite: "팀 티어: Elite — top 10% 수준",
    high: "팀 티어: High — 상위 30% 수준",
    medium: "팀 티어: Medium — 평균 수준",
    low: "팀 티어: Low — 개선 필요",
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            DORA Metrics
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            Deploy · Lead · MTTR · Change-Fail — Forsgren / Humble / Kim 2018
          </div>
        </div>

        {/* Quadrant grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridAutoRows: "minmax(190px, auto)",
            gap: space[3],
          }}
        >
          {quadrants.map((q, i) => (
            <QuadrantTile key={q.id} quadrant={q} index={i} />
          ))}
        </div>

        {/* Verdict line */}
        <div
          style={{
            marginTop: space[4],
            padding: `${space[3]}px ${space[4]}px`,
            borderRadius: radiusToken.md,
            background: `${tierColor(dora.tier)}14`,
            border: `1px solid ${tierColor(dora.tier)}40`,
            fontSize: font.size.md,
            fontWeight: font.weight.semibold,
            color: tierColor(dora.tier),
            display: "flex",
            alignItems: "center",
            gap: space[3],
            animation: `doraTileIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${quadrants.length * STAGGER_MS + 60}ms`,
          }}
        >
          <div style={tierBadgeStyle(dora.tier)}>{TIER_LABEL[dora.tier]}</div>
          <div>{tierVerdict[dora.tier]}</div>
        </div>

        <div
          style={{
            marginTop: space[3],
            fontSize: font.size.xxs,
            color: tokenColor.text3,
          }}
        >
          90-day sparklines synthesized — replace with pipeline telemetry when available.
        </div>
      </div>
    </div>
  );
}

interface QuadrantTileProps {
  quadrant: Quadrant;
  index: number;
}

function QuadrantTile({ quadrant, index }: QuadrantTileProps): ReactElement {
  const counter = useCounter(quadrant.value, COUNTER_MS);
  const accent = tierColor(quadrant.tier);

  // Sparkline geometry.
  const svgW = 320;
  const svgH = 72;
  const data = quadrant.sparkline;
  const max = Math.max(1e-6, ...data);
  const min = Math.min(...data);
  const range = Math.max(1e-6, max - min);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * svgW;
    const y = svgH - ((v - min) / range) * (svgH - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  // Approx path length for stroke-dash animation — diagonal bound.
  const sparkLen = Math.max(200, data.length * 4);

  return (
    <div
      style={{
        position: "relative",
        padding: space[4],
        background: tokenColor.bg1,
        border: `1px solid ${tokenColor.border}`,
        borderRadius: radiusToken.lg,
        overflow: "hidden",
        animation: `doraTileIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      {/* Sparkline behind the number */}
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          left: 0,
          opacity: 0.22,
          pointerEvents: "none",
        }}
        aria-hidden
      >
        <path
          d={path}
          fill="none"
          stroke={accent}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            {
              "--spark-len": sparkLen,
              strokeDasharray: sparkLen,
              animation: `sparkDraw ${SPARK_DRAW_MS}ms ${ENTRY_EASE} ${
                index * STAGGER_MS + 120
              }ms both`,
            } as CSSProperties
          }
        />
      </svg>

      {/* Foreground */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: space[2] }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              textTransform: "uppercase",
              letterSpacing: font.letter.ultra,
              fontWeight: font.weight.medium,
            }}
          >
            {quadrant.label}
          </div>
          <div style={tierBadgeStyle(quadrant.tier)}>{TIER_LABEL[quadrant.tier]}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: space[2],
            marginTop: space[1],
          }}
        >
          <div
            style={{
              fontSize: 56,
              lineHeight: 1,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {quadrant.format(counter)}
          </div>
          <div
            style={{
              fontSize: font.size.md,
              color: tokenColor.text2,
              fontWeight: font.weight.medium,
            }}
          >
            {quadrant.unit}
          </div>
        </div>

        <div
          style={{
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          90d trend{quadrant.sparkInvert ? " · lower = better" : " · higher = better"}
        </div>
      </div>
    </div>
  );
}

export const DoraMetricsView = memo(DoraMetricsViewImpl);
