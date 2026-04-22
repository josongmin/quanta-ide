// FileGaugeView — Sonar-style per-file health dashboard.
// --------------------------------------------------------------------
// Reference: SonarSource "File detail" page.
// 10 metric tiles laid out as a responsive grid. Each tile:
//   hero number + sub-label + mini horizontal bar with a threshold
//   marker (vertical line). Colours follow the standard Sonar gates:
//   green below the threshold, amber inside the warning band, red
//   above the alert band. The goal is that a reviewer can scan the
//   dashboard in <5 seconds and know which two metrics to worry
//   about without opening a single other panel.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  bugProbability,
  cbo,
  cognitiveComplexity,
  complexity,
  coverage,
  churn,
  duplicateCluster,
  lcom,
  maintainabilityIndex,
  mutationScore,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

interface Tile {
  key: string;
  label: string;
  hero: string;
  sub: string;
  /** 0..1 ratio of current value against the bar max. */
  ratio: number;
  /** 0..1 position of the green/amber threshold marker. */
  threshold: number;
  /** Direction higher values are better (MI is "higher=better", CC is "lower=better"). */
  betterWhen: "high" | "low";
  /** Pass/warn/fail status driving the hero color + bar fill. */
  status: "pass" | "warn" | "fail";
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `
@keyframes fg-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes fg-tile {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

// Status → hero + bar color.
function statusColor(s: Tile["status"]): string {
  if (s === "pass") return color.success;
  if (s === "warn") return color.warn;
  return color.danger;
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function computeTiles(entity: Entity, edges?: ReadonlyArray<{ from: string; to: string }>): Tile[] {
  const mi = maintainabilityIndex(entity);              // 0..100 higher = better
  const cc = complexity(entity);                        // 0..1 normalised cyclomatic
  const cogC = cognitiveComplexity(entity);             // 0..1
  const coup = cbo(entity, edges);                      // 0..1
  const cohesion = lcom(entity);                        // 0..1 higher = worse
  const cov = coverage(entity);                          // 0..1 higher = better
  const ch = churn(entity);                             // 0..1
  const bug = bugProbability(entity, edges);            // 0..1
  const dup = duplicateCluster(entity);                 // 0 = none
  const mut = mutationScore(entity);                    // 0..1 higher = better

  const tiles: Tile[] = [
    {
      key: "mi",
      label: "Maintainability Index",
      hero: mi.toFixed(0),
      sub: "Oman & Hagemeister · target ≥ 70",
      ratio: mi / 100,
      threshold: 0.70,
      betterWhen: "high",
      status: mi >= 70 ? "pass" : mi >= 50 ? "warn" : "fail",
    },
    {
      key: "cc",
      label: "Cyclomatic CC",
      hero: Math.round(cc * 30).toString(),
      sub: "McCabe 1976 · ≤ 10 권장",
      ratio: Math.min(1, (cc * 30) / 30),
      threshold: 10 / 30,
      betterWhen: "low",
      status: cc * 30 <= 10 ? "pass" : cc * 30 <= 20 ? "warn" : "fail",
    },
    {
      key: "cogc",
      label: "Cognitive",
      hero: Math.round(cogC * 40).toString(),
      sub: "SonarQube Campbell 2018 · ≤ 15",
      ratio: cogC,
      threshold: 15 / 40,
      betterWhen: "low",
      status: cogC * 40 <= 15 ? "pass" : cogC * 40 <= 30 ? "warn" : "fail",
    },
    {
      key: "cbo",
      label: "CBO",
      hero: Math.round(coup * 25).toString(),
      sub: "Chidamber & Kemerer 1994 · ≤ 14",
      ratio: coup,
      threshold: 14 / 25,
      betterWhen: "low",
      status: coup * 25 <= 14 ? "pass" : coup * 25 <= 20 ? "warn" : "fail",
    },
    {
      key: "lcom",
      label: "LCOM",
      hero: cohesion.toFixed(2),
      sub: "Cohesion — lower = better",
      ratio: cohesion,
      threshold: 0.5,
      betterWhen: "low",
      status: cohesion <= 0.5 ? "pass" : cohesion <= 0.75 ? "warn" : "fail",
    },
    {
      key: "cov",
      label: "Coverage",
      hero: pct(cov),
      sub: "Sonar gate · ≥ 80%",
      ratio: cov,
      threshold: 0.80,
      betterWhen: "high",
      status: cov >= 0.80 ? "pass" : cov >= 0.60 ? "warn" : "fail",
    },
    {
      key: "churn",
      label: "Churn",
      hero: pct(ch),
      sub: "last 90d normalised",
      ratio: ch,
      threshold: 0.50,
      betterWhen: "low",
      status: ch <= 0.40 ? "pass" : ch <= 0.70 ? "warn" : "fail",
    },
    {
      key: "bug",
      label: "Bug Risk",
      hero: pct(bug),
      sub: "Zimmermann-Nagappan · lower = safer",
      ratio: bug,
      threshold: 0.35,
      betterWhen: "low",
      status: bug <= 0.30 ? "pass" : bug <= 0.55 ? "warn" : "fail",
    },
    {
      key: "dup",
      label: "Duplication",
      hero: dup === 0 ? "none" : `C#${dup}`,
      sub: dup === 0 ? "no twin clusters detected" : "member of duplicate cluster",
      ratio: dup === 0 ? 0 : 1,
      threshold: 0.25,
      betterWhen: "low",
      status: dup === 0 ? "pass" : "warn",
    },
    {
      key: "mut",
      label: "Mutation",
      hero: pct(mut),
      sub: "PIT / Stryker · target ≥ 60%",
      ratio: mut,
      threshold: 0.60,
      betterWhen: "high",
      status: mut >= 0.60 ? "pass" : mut >= 0.40 ? "warn" : "fail",
    },
  ];
  return tiles;
}

function FileGaugeViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const tiles = useMemo(() => {
    if (!entity) return [];
    return computeTiles(entity, ctx.graph?.fileEdges);
  }, [entity, ctx.graph?.fileEdges]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const failing = tiles.filter(t => t.status === "fail").length;
  const warning = tiles.filter(t => t.status === "warn").length;
  const loc = entity.metrics?.loc ?? "—";

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            FileGauge · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {entity.path} · {loc} LoC · {tiles.length} metrics · {failing} fail · {warning} warn
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          SonarSource file-detail
        </div>
      </header>

      <div style={gridStyle}>
        {tiles.map((t, i) => (
          <TileCard key={t.key} tile={t} index={i} />
        ))}
      </div>
    </div>
  );
}

function TileCard({ tile, index }: { tile: Tile; index: number }): ReactElement {
  const hue = statusColor(tile.status);
  return (
    <div
      style={{
        ...tileStyle,
        animationDelay: `${60 + index * 18}ms`,
        borderColor: tile.status === "fail" ? color.danger : color.border,
      }}
    >
      <div style={tileHeadStyle}>
        <span style={labelStyle}>{tile.label}</span>
        <span style={{ ...statusDotStyle, background: hue }} />
      </div>
      <div style={{ ...heroStyle, color: hue }}>{tile.hero}</div>
      <div style={meterWrapStyle}>
        <div style={meterBaseStyle}>
          <div
            style={{
              ...meterFillStyle,
              width: `${Math.max(2, Math.min(100, tile.ratio * 100))}%`,
              background: hue,
            }}
          />
          {/* Threshold marker */}
          <div
            style={{
              ...thresholdMarkerStyle,
              left: `${Math.max(0, Math.min(100, tile.threshold * 100))}%`,
            }}
            title="threshold"
          />
        </div>
      </div>
      <div style={subLabelStyle}>{tile.sub}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[5]}px ${space[6]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `fg-enter 520ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  marginBottom: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: space[3],
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `fg-tile 460ms ${ENTRY_EASE} both`,
  transition: `border-color ${transition.base}`,
};

const tileHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const labelStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const statusDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: radius.pill,
};

const heroStyle: CSSProperties = {
  fontSize: 28,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  marginTop: 2,
};

const meterWrapStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
};

const meterBaseStyle: CSSProperties = {
  position: "relative",
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const meterFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  transition: `width ${transition.base}`,
};

const thresholdMarkerStyle: CSSProperties = {
  position: "absolute",
  top: -2,
  width: 2,
  height: 10,
  background: color.text1,
  opacity: 0.6,
  transform: "translateX(-1px)",
};

const subLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

export const FileGaugeView = memo(FileGaugeViewImpl);
