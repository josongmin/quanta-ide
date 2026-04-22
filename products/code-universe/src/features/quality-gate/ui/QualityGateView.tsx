// QualityGateView — Sonar-style pass/fail dashboard.
// Six tiles: Reliability / Security / Maintainability (ratings A-E),
// Coverage / Duplication / Debt Ratio (percentage gates). Big overall
// verdict banner at top (Passed / Failed) with the failing-check count.
//
// Reference: SonarSource Quality Gate docs (Standard Experience).

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  complexity,
  coverage as covFn,
  debtHours,
  devCostHours,
  duplicateCluster,
  maintainabilityRating,
  reliabilityRating,
  securityRating,
  synthVulnerabilities,
  type VulnSeverity,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type Rating = "A" | "B" | "C" | "D" | "E";

interface Gate {
  metric: string;
  label: string;
  value: string;
  numeric: number;
  threshold: number;
  pass: boolean;
  tier: "rating" | "percent" | "hours";
  rating?: Rating;
  detail: string;
}

const RATING_COLOR: Record<Rating, string> = {
  A: "#22a06b",  // mapped to color.success
  B: "#7db843",
  C: "#e09321",  // color.warn
  D: "#e06a21",
  E: "#e5484d",  // color.danger
};

const KEYFRAMES = `
@keyframes qg-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes qg-count { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
`;

function aggregate(ctx: ViewContextValue): { gates: Gate[]; overall: "passed" | "failed"; failCount: number } | null {
  if (!ctx.tree) return null;
  const files: Entity[] = [];
  for (const e of ctx.tree.byId.values()) if (e.kind === "building") files.push(e);
  if (files.length === 0) return null;

  // Coverage (mean).
  let covTotal = 0;
  let dupHits = 0;
  let debtSum = 0;
  let devSum = 0;
  const bugsBySeverity = { blocker: 0, critical: 0, major: 0, minor: 0 };
  const vulnsBySeverity: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const f of files) {
    covTotal += covFn(f);
    if (duplicateCluster(f) > 0) dupHits++;
    debtSum += debtHours(f);
    devSum += devCostHours(f);
    // Bugs: map bug-prediction into severity buckets.
    const cx = complexity(f);
    if (cx > 0.85) bugsBySeverity.critical++;
    else if (cx > 0.70) bugsBySeverity.major++;
    else if (cx > 0.55) bugsBySeverity.minor++;
    // Vulnerabilities:
    for (const v of synthVulnerabilities(f)) {
      vulnsBySeverity[v.severity]++;
    }
  }

  const covPct = (covTotal / files.length) * 100;
  const dupPct = (dupHits / files.length) * 100;
  const ratio = devSum === 0 ? 0 : debtSum / devSum;
  const miRating = maintainabilityRating(ratio);
  const relRating = reliabilityRating(bugsBySeverity);
  const secRating = securityRating(vulnsBySeverity);

  const gates: Gate[] = [
    {
      metric: "reliability",
      label: "Reliability",
      value: relRating,
      numeric: "ABCDE".indexOf(relRating),
      threshold: "ABCDE".indexOf("A"),
      pass: relRating === "A",
      tier: "rating",
      rating: relRating,
      detail: `${bugsBySeverity.critical} critical · ${bugsBySeverity.major} major · ${bugsBySeverity.minor} minor`,
    },
    {
      metric: "security",
      label: "Security",
      value: secRating,
      numeric: "ABCDE".indexOf(secRating),
      threshold: "ABCDE".indexOf("A"),
      pass: secRating === "A",
      tier: "rating",
      rating: secRating,
      detail: `${vulnsBySeverity.critical} critical · ${vulnsBySeverity.high} high · ${vulnsBySeverity.medium} medium · ${vulnsBySeverity.low} low`,
    },
    {
      metric: "maintainability",
      label: "Maintainability",
      value: miRating,
      numeric: "ABCDE".indexOf(miRating),
      threshold: "ABCDE".indexOf("A"),
      pass: miRating === "A",
      tier: "rating",
      rating: miRating,
      detail: `debt ratio ${(ratio * 100).toFixed(1)}% · ${Math.round(debtSum)}h remediation`,
    },
    {
      metric: "coverage",
      label: "Coverage",
      value: `${covPct.toFixed(1)}%`,
      numeric: covPct,
      threshold: 80,
      pass: covPct >= 80,
      tier: "percent",
      detail: "Sonar default gate: ≥ 80% on new code",
    },
    {
      metric: "duplication",
      label: "Duplication",
      value: `${dupPct.toFixed(1)}%`,
      numeric: dupPct,
      threshold: 3,
      pass: dupPct <= 3,
      tier: "percent",
      detail: "Sonar default gate: ≤ 3% on new code",
    },
    {
      metric: "debt-ratio",
      label: "Debt Ratio",
      value: `${(ratio * 100).toFixed(1)}%`,
      numeric: ratio * 100,
      threshold: 5,
      pass: ratio <= 0.05,
      tier: "percent",
      detail: "SQALE Technical Debt Ratio · ≤ 5% = A",
    },
  ];

  const failCount = gates.filter(g => !g.pass).length;
  return { gates, overall: failCount === 0 ? "passed" : "failed", failCount };
}

function QualityGateViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => aggregate(ctx), [ctx]);

  if (!data) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>데이터가 준비되지 않았습니다.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <Verdict overall={data.overall} failCount={data.failCount} total={data.gates.length} />
      <div style={gridStyle}>
        {data.gates.map((g, i) => (
          <GateTile key={g.metric} gate={g} index={i} />
        ))}
      </div>
      <Footer />
    </div>
  );
}

function Verdict({ overall, failCount, total }: { overall: "passed" | "failed"; failCount: number; total: number }) {
  const tint = overall === "passed" ? color.success : color.danger;
  return (
    <header style={verdictWrap}>
      <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: tint, boxShadow: `0 0 0 4px ${tint}22`,
        }} />
        <div>
          <div style={{ fontSize: font.size.xxl, fontWeight: font.weight.semibold, color: color.text0, letterSpacing: font.letter.tight }}>
            Quality Gate · <span style={{ color: tint }}>{overall === "passed" ? "Passed" : "Failed"}</span>
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text2, marginTop: 2 }}>
            {overall === "passed"
              ? `${total}개 조건 모두 통과 — 릴리즈 게이트 OK`
              : `${failCount}/${total}개 조건 실패 · 배포 전 수정 권장`}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
        SonarSource Standard Gate
      </div>
    </header>
  );
}

function GateTile({ gate, index }: { gate: Gate; index: number }) {
  const isRating = gate.tier === "rating";
  const ratingColor = gate.rating ? RATING_COLOR[gate.rating] : color.text1;
  const passColor = gate.pass ? color.success : color.danger;

  return (
    <div
      style={{
        ...tileStyle,
        borderColor: gate.pass ? color.border : color.danger,
        animationDelay: `${index * 18}ms`,
      }}
    >
      <div style={tileHeadStyle}>
        <span style={{ fontSize: font.size.xs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
          {gate.label}
        </span>
        <span style={{ fontSize: font.size.xxs, color: gate.pass ? color.success : color.danger, fontWeight: font.weight.semibold }}>
          {gate.pass ? "PASS" : "FAIL"}
        </span>
      </div>
      {isRating ? (
        <div style={ratingBlockStyle}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%",
            background: ratingColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffffff",
            fontFamily: font.mono,
            fontSize: 34, fontWeight: font.weight.bold,
            letterSpacing: -1,
            boxShadow: `0 6px 14px ${ratingColor}33`,
          }}>
            {gate.value}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: font.size.xs, color: color.text1, lineHeight: 1.5 }}>{gate.detail}</div>
          </div>
        </div>
      ) : (
        <div style={percentBlockStyle}>
          <div style={{
            fontSize: 34,
            fontFamily: font.mono,
            fontWeight: font.weight.bold,
            color: passColor,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -0.5,
          }}>
            {gate.value}
          </div>
          <div style={{ flex: 1 }}>
            <div style={meterBaseStyle}>
              <div style={{
                ...meterFillStyle,
                width: `${gate.metric === "coverage" ? gate.numeric : (gate.numeric / (gate.metric === "debt-ratio" ? 30 : 15)) * 100}%`,
                background: passColor,
              }} />
            </div>
            <div style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 4 }}>{gate.detail}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <div style={{
      marginTop: space[5],
      fontSize: font.size.xxs, color: color.text3,
      display: "flex", gap: space[4], flexWrap: "wrap",
      padding: `${space[3]}px ${space[4]}px`,
      background: color.bg2,
      borderRadius: radius.md,
      border: `1px solid ${color.border}`,
    }}>
      <span><strong style={{ color: color.text1 }}>A</strong> debt ≤ 5%</span>
      <span><strong style={{ color: color.text1 }}>B</strong> 5-10%</span>
      <span><strong style={{ color: color.text1 }}>C</strong> 10-20%</span>
      <span><strong style={{ color: color.text1 }}>D</strong> 20-50%</span>
      <span><strong style={{ color: color.text1 }}>E</strong> {">"} 50%</span>
      <span style={{ marginLeft: "auto" }}>Sonar SQALE · A-E 은 outstanding remediation cost 비율 기준.</span>
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
  animation: "qg-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const verdictWrap: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: `${space[4]}px ${space[5]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  marginBottom: space[5],
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: space[3],
};

const tileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: `${space[4]}px ${space[4]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: "qg-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  transition: `border-color ${transition.base}`,
};

const tileHeadStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const ratingBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[4],
};

const percentBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[4],
};

const meterBaseStyle: CSSProperties = {
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

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const QualityGateView = memo(QualityGateViewImpl);
