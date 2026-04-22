// DevExHealthView — developer experience + CI health dashboard.
// --------------------------------------------------------------------
// Hero tile grid (6): Local Build · CI min/commit · CI Queue · Flaky
// Tests · Test Suite · PR Wait (P50/P95). Each tile thresholded
// green/warn/danger and carries a 12-week trend sparkline (seeded
// random walk). Footer card: weekly commits / builds / failures with
// a build-success-rate gauge.
//
// Reference: DORA State of DevOps; Accelerate (Forsgren/Humble/Kim
// 2018); SPACE framework (Forsgren/Storey/Maddila/Zimmermann/Houck/
// Butler, CACM 2021).

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  devExMetrics,
  hashId,
  mulberry32,
  type DevExMetrics,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 20;
const COUNTER_MS = 640;
const SPARK_WEEKS = 12;

type Band = "green" | "warn" | "danger";
const BAND_TINT: Record<Band, string> = {
  green:  color.success,
  warn:   color.warn,
  danger: color.danger,
};
const BAND_LABEL: Record<Band, string> = {
  green:  "Healthy",
  warn:   "Watch",
  danger: "At risk",
};

const KEYFRAMES = `
@keyframes dx-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dx-tile  { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes dx-spark { from { stroke-dashoffset: var(--dx-spark-len); } to { stroke-dashoffset: 0; } }
@keyframes dx-gauge { from { stroke-dashoffset: var(--dx-gauge-len); } to { stroke-dashoffset: var(--dx-gauge-off); } }
`;

interface HeroMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  format: (n: number) => string;
  band: Band;
  sparkline: number[];
  sparkInvert: boolean;
}

/** Seeded 12-point weekly walk. */
function weeklySpark(name: string, rootId: string | null, baseline: number, jitter: number): number[] {
  const rid = rootId ?? "root";
  const out: number[] = [];
  let prev = baseline;
  for (let w = 0; w < SPARK_WEEKS; w++) {
    const rng = mulberry32(hashId(`${rid}:${name}:${w}`));
    const drift = (rng() - 0.5) * jitter;
    prev = Math.max(0, prev * 0.7 + baseline * 0.3 + drift);
    out.push(prev);
  }
  return out;
}

/** Band helpers per metric. */
function localBuildBand(s: number): Band { return s < 60 ? "green" : s < 180 ? "warn" : "danger"; }
function ciMinBand(m: number): Band     { return m < 6 ? "green" : m < 12 ? "warn" : "danger"; }
function queueBand(m: number): Band     { return m < 5 ? "green" : m < 15 ? "warn" : "danger"; }
function flakyBand(n: number): Band     { return n === 0 ? "green" : n < 5 ? "warn" : "danger"; }
function suiteBand(s: number): Band     { return s < 120 ? "green" : s < 300 ? "warn" : "danger"; }
function prWaitBand(h: number): Band    { return h < 24 ? "green" : h < 72 ? "warn" : "danger"; }

function buildMetrics(dx: DevExMetrics, rootId: string | null): HeroMetric[] {
  return [
    {
      key: "local",
      label: "Local Build",
      value: dx.localBuildSeconds,
      unit: "s",
      format: n => n.toFixed(0),
      band: localBuildBand(dx.localBuildSeconds),
      sparkline: weeklySpark("local", rootId, dx.localBuildSeconds, dx.localBuildSeconds * 0.35),
      sparkInvert: true,
    },
    {
      key: "ci-min",
      label: "CI min / commit",
      value: dx.ciMinutesPerCommit,
      unit: "min",
      format: n => n.toFixed(1),
      band: ciMinBand(dx.ciMinutesPerCommit),
      sparkline: weeklySpark("ci-min", rootId, dx.ciMinutesPerCommit, dx.ciMinutesPerCommit * 0.4),
      sparkInvert: true,
    },
    {
      key: "queue",
      label: "CI Queue",
      value: dx.ciQueueMinutes,
      unit: "min",
      format: n => n.toFixed(1),
      band: queueBand(dx.ciQueueMinutes),
      sparkline: weeklySpark("queue", rootId, dx.ciQueueMinutes, 3),
      sparkInvert: true,
    },
    {
      key: "flaky",
      label: "Flaky Tests",
      value: dx.flakyTestCount,
      unit: "",
      format: n => Math.round(n).toString(),
      band: flakyBand(dx.flakyTestCount),
      sparkline: weeklySpark("flaky", rootId, Math.max(1, dx.flakyTestCount), 3),
      sparkInvert: true,
    },
    {
      key: "suite",
      label: "Test Suite",
      value: dx.testSuiteSeconds,
      unit: "s",
      format: n => n.toFixed(0),
      band: suiteBand(dx.testSuiteSeconds),
      sparkline: weeklySpark("suite", rootId, dx.testSuiteSeconds, dx.testSuiteSeconds * 0.25),
      sparkInvert: true,
    },
    {
      key: "pr-wait",
      label: "PR Wait P50 / P95",
      value: dx.prWaitHoursP50,
      unit: `h · p95 ${dx.prWaitHoursP95.toFixed(0)}h`,
      format: n => n.toFixed(1),
      band: prWaitBand(dx.prWaitHoursP50),
      sparkline: weeklySpark("pr-wait", rootId, dx.prWaitHoursP50, dx.prWaitHoursP50 * 0.5),
      sparkInvert: true,
    },
  ];
}

/** rAF counter 0 → target (ease-out cubic). */
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

function DevExHealthViewImpl({ ctx }: Props): ReactElement | null {
  const rootId = ctx.tree?.rootId ?? null;
  const dx = useMemo(() => devExMetrics(rootId), [rootId]);
  const metrics = useMemo(() => buildMetrics(dx, rootId), [dx, rootId]);

  const successRate = dx.weeklyBuilds === 0
    ? 1
    : Math.max(0, 1 - dx.weeklyFailedBuilds / dx.weeklyBuilds);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: color.text0, letterSpacing: font.letter.tight }}>
            DevEx Health
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            Build · CI · PR wait · Flaky — DORA · SPACE (Forsgren et al. 2021)
          </div>
        </div>
      </header>

      <div style={gridStyle}>
        {metrics.map((m, i) => (
          <HeroTile key={m.key} metric={m} index={i} />
        ))}
      </div>

      <ThisWeekCard dx={dx} successRate={successRate} index={metrics.length} />

      <div style={{ marginTop: space[3], fontSize: font.size.xxs, color: color.text3 }}>
        12-week sparklines · thresholds: DORA elite · SPACE satisfaction proxy.
      </div>
    </div>
  );
}

function HeroTile({ metric, index }: { metric: HeroMetric; index: number }): ReactElement {
  const animated = useCounter(metric.value, COUNTER_MS);
  const accent = BAND_TINT[metric.band];

  const svgW = 320;
  const svgH = 60;
  const data = metric.sparkline;
  const max = Math.max(1e-6, ...data);
  const min = Math.min(...data);
  const range = Math.max(1e-6, max - min);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * svgW;
    const y = svgH - ((v - min) / range) * (svgH - 8) - 4;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const sparkLen = Math.max(200, data.length * 40);

  return (
    <div
      style={{
        ...heroTileStyle,
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      <svg
        width="100%"
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
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
          style={{
            ["--dx-spark-len" as string]: sparkLen,
            strokeDasharray: sparkLen,
            animation: `dx-spark 720ms ${ENTRY_EASE} ${index * STAGGER_MS + 140}ms both`,
          } as CSSProperties}
        />
      </svg>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: space[2] }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontSize: font.size.xs, color: color.text2, letterSpacing: font.letter.ultra,
            textTransform: "uppercase", fontWeight: font.weight.semibold,
          }}>
            {metric.label}
          </span>
          <BandBadge band={metric.band} />
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: space[2], marginTop: space[1] }}>
          <span style={{
            fontSize: 44, lineHeight: 1,
            fontFamily: font.sans,
            fontWeight: font.weight.bold,
            color: color.text0,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: font.letter.tight,
          }}>
            {metric.format(animated)}
          </span>
          {metric.unit && (
            <span style={{ fontSize: font.size.sm, color: color.text2, fontWeight: font.weight.medium }}>
              {metric.unit}
            </span>
          )}
        </div>

        <div style={{ fontSize: font.size.xxs, color: color.text3, fontVariantNumeric: "tabular-nums" }}>
          12w trend{metric.sparkInvert ? " · lower = better" : " · higher = better"}
        </div>
      </div>
    </div>
  );
}

function BandBadge({ band }: { band: Band }): ReactElement {
  const c = BAND_TINT[band];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: `2px ${space[2]}px`,
      borderRadius: radius.pill,
      background: `${c}1a`,
      color: c,
      border: `1px solid ${c}40`,
      fontSize: font.size.xxs,
      fontWeight: font.weight.semibold,
      letterSpacing: font.letter.wide,
      textTransform: "uppercase",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
      {BAND_LABEL[band]}
    </span>
  );
}

function ThisWeekCard({ dx, successRate, index }: { dx: DevExMetrics; successRate: number; index: number }): ReactElement {
  const commitsAnim = useCounter(dx.weeklyCommits, COUNTER_MS);
  const buildsAnim = useCounter(dx.weeklyBuilds, COUNTER_MS);
  const failsAnim = useCounter(dx.weeklyFailedBuilds, COUNTER_MS);
  const successAnim = useCounter(successRate * 100, COUNTER_MS);

  const gaugeSize = 96;
  const gaugeStroke = 8;
  const gaugeR = (gaugeSize - gaugeStroke) / 2;
  const gaugeCircum = 2 * Math.PI * gaugeR;
  // Half-circle gauge (track starts at left-middle arc).
  const gaugeOff = gaugeCircum * (1 - successRate);
  const gaugeTint =
    successRate >= 0.95 ? color.success :
    successRate >= 0.85 ? color.warn :
    color.danger;

  return (
    <div style={{ ...weekCardStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
        <span style={{
          fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra,
          textTransform: "uppercase", fontWeight: font.weight.semibold,
        }}>
          This week
        </span>
        <div style={{ display: "flex", gap: space[6], alignItems: "flex-end", marginTop: space[2] }}>
          <Stat label="commits"        value={commitsAnim.toFixed(0)} tint={color.text0} />
          <Stat label="builds"         value={buildsAnim.toFixed(0)}  tint={color.text0} />
          <Stat label="failed"         value={failsAnim.toFixed(0)}   tint={dx.weeklyFailedBuilds > 0 ? color.danger : color.success} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[4] }}>
        <div style={{ position: "relative", width: gaugeSize, height: gaugeSize }}>
          <svg width={gaugeSize} height={gaugeSize} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={gaugeSize / 2}
              cy={gaugeSize / 2}
              r={gaugeR}
              fill="none"
              stroke={color.bg3}
              strokeWidth={gaugeStroke}
            />
            <circle
              cx={gaugeSize / 2}
              cy={gaugeSize / 2}
              r={gaugeR}
              fill="none"
              stroke={gaugeTint}
              strokeWidth={gaugeStroke}
              strokeLinecap="round"
              style={{
                strokeDasharray: gaugeCircum,
                ["--dx-gauge-len" as string]: gaugeCircum,
                ["--dx-gauge-off" as string]: gaugeOff,
                strokeDashoffset: gaugeOff,
                animation: `dx-gauge 720ms ${ENTRY_EASE} both`,
              } as CSSProperties}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              fontSize: 22, fontWeight: font.weight.bold,
              color: gaugeTint,
              fontFamily: font.mono, fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}>
              {successAnim.toFixed(0)}%
            </span>
            <span style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 2 }}>
              success
            </span>
          </div>
        </div>
        <div style={{ fontSize: font.size.xs, color: color.text2, maxWidth: 200 }}>
          build success rate — {dx.weeklyFailedBuilds} failed of {dx.weeklyBuilds}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 72 }}>
      <span style={{
        fontSize: 26,
        fontFamily: font.mono,
        fontWeight: font.weight.bold,
        color: tint,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
      <span style={{
        fontSize: font.size.xxs, color: color.text2, marginTop: 4,
        textTransform: "uppercase", letterSpacing: font.letter.ultra,
        fontWeight: font.weight.medium,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `dx-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const headerStyle: CSSProperties = {
  marginBottom: space[4],
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gridAutoRows: "minmax(168px, auto)",
  gap: space[3],
};

const heroTileStyle: CSSProperties = {
  position: "relative",
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
  animation: `dx-tile ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  transition: `border-color ${transition.base}`,
};

const weekCardStyle: CSSProperties = {
  marginTop: space[4],
  padding: `${space[4]}px ${space[5]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: space[5],
  flexWrap: "wrap",
  animation: `dx-tile ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};

export const DevExHealthView = memo(DevExHealthViewImpl);
