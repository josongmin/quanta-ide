// MutationScoreView — repo-wide mutation testing dashboard.
// Top: hero ring gauge for overall mutation score + coverage gap.
// Middle: per-file ranked list, sorted by survived mutants.
// Right-side bars: killed vs survived totals.
//
// Reference: PIT Mutation Testing ("gold standard test coverage"),
// Stryker for JS/TS.

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  coverage as covFn,
  killedMutants,
  mutationScore,
  survivedMutants,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

interface Row {
  entity: Entity;
  score: number;
  cov: number;
  killed: number;
  survived: number;
  gap: number;
}

const KEYFRAMES = `
@keyframes ms-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes ms-sweep { from { stroke-dashoffset: var(--circ); } to { stroke-dashoffset: var(--offset); } }
@keyframes ms-bar-in { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

function buildRows(ctx: ViewContextValue): Row[] {
  if (!ctx.tree) return [];
  const out: Row[] = [];
  for (const entity of ctx.tree.byId.values()) {
    if (entity.kind !== "building") continue;
    if (/\.test\.|\.spec\.|__tests__/.test(entity.path)) continue;
    const killed = killedMutants(entity);
    const survived = survivedMutants(entity);
    if (killed + survived === 0) continue;
    const score = mutationScore(entity);
    const cov = covFn(entity);
    out.push({
      entity, score, cov, killed, survived,
      gap: Math.max(0, cov - score),
    });
  }
  out.sort((a, b) => b.survived - a.survived);
  return out.slice(0, 40);
}

function MutationScoreViewImpl({ ctx }: Props): ReactElement {
  const rows = useMemo(() => buildRows(ctx), [ctx]);
  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    let killed = 0, survived = 0, cov = 0, score = 0;
    for (const r of rows) {
      killed += r.killed;
      survived += r.survived;
      cov += r.cov;
      score += r.score;
    }
    return {
      killed,
      survived,
      coverage: cov / rows.length,
      score: score / rows.length,
      total: killed + survived,
    };
  }, [rows]);

  if (!summary) {
    return <div style={emptyStyle}><div style={{ fontSize: font.size.md, color: color.text2 }}>뮤테이션 데이터 없음</div></div>;
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={{ marginBottom: space[5] }}>
        <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
          Mutation Score
        </div>
        <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
          파일 {rows.length}개 샘플 · {summary.killed + summary.survived}개 돌연변이 평가
        </div>
      </header>

      <div style={topStyle}>
        <HeroGauge score={summary.score} coverage={summary.coverage} />
        <KillTable killed={summary.killed} survived={summary.survived} />
      </div>

      <section style={{ marginTop: space[6] }}>
        <h3 style={{ ...sectionHeadStyle }}>Survived mutants · 상위 {rows.length}</h3>
        <div style={listStyle}>
          {rows.map((r, i) => (
            <FileRow key={r.entity.id} row={r} index={i} onFocus={() => ctx.dispatch.selectEntity(r.entity.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroGauge({ score, coverage }: { score: number; coverage: number }) {
  const R = 58;
  const circ = 2 * Math.PI * R;
  const scoreOffset = circ * (1 - score);
  const covOffset = circ * (1 - coverage);
  const tint = score >= 0.75 ? color.success : score >= 0.5 ? color.warn : color.danger;

  return (
    <div style={gaugeWrap}>
      <svg width={160} height={160} viewBox="-80 -80 160 160">
        <circle cx={0} cy={0} r={R} fill="none" stroke={color.bg3} strokeWidth={8} />
        <circle
          cx={0} cy={0} r={R} fill="none"
          stroke={color.accent} strokeOpacity={0.35} strokeWidth={2}
          strokeDasharray={`${circ}`}
          strokeDashoffset={covOffset}
          transform="rotate(-90)"
        />
        <circle
          cx={0} cy={0} r={R} fill="none"
          stroke={tint} strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={scoreOffset}
          style={{
            ["--circ" as string]: circ.toString(),
            ["--offset" as string]: scoreOffset.toString(),
            animation: `ms-sweep 900ms cubic-bezier(0.22, 1, 0.28, 1) both`,
          }}
          transform="rotate(-90)"
        />
        <text x={0} y={-6} textAnchor="middle" fontFamily={font.mono} fontSize={26} fontWeight={font.weight.bold} fill={color.text0}>
          {Math.round(score * 100)}
        </text>
        <text x={0} y={14} textAnchor="middle" fontFamily={font.sans} fontSize={10} fill={color.text2} letterSpacing="0.1em">
          MUTATION SCORE
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: space[1], fontSize: font.size.xs }}>
        <LegendRow tint={tint} label="Mutation Score" value={`${Math.round(score * 100)}%`} />
        <LegendRow tint={color.accent} label="Line Coverage" value={`${Math.round(coverage * 100)}%`} />
        <LegendRow tint={color.text2} label="Gap (coverage − score)" value={`${Math.round((coverage - score) * 100)}%`} />
      </div>
    </div>
  );
}

function LegendRow({ tint, label, value }: { tint: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: tint, flexShrink: 0 }} />
      <span style={{ color: color.text2 }}>{label}</span>
      <span style={{ marginLeft: "auto", color: color.text0, fontFamily: font.mono, fontVariantNumeric: "tabular-nums", fontWeight: font.weight.semibold }}>
        {value}
      </span>
    </div>
  );
}

function KillTable({ killed, survived }: { killed: number; survived: number }) {
  const total = killed + survived;
  const killPct = total === 0 ? 0 : (killed / total) * 100;
  const survPct = 100 - killPct;
  return (
    <div style={killTableStyle}>
      <StatLine label="Killed" count={killed} pct={killPct} tint={color.success} delay={140} />
      <StatLine label="Survived" count={survived} pct={survPct} tint={color.danger} delay={200} />
    </div>
  );
}

function StatLine({ label, count, pct, tint, delay }: { label: string; count: number; pct: number; tint: string; delay: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 56px", alignItems: "center", gap: space[2] }}>
      <span style={{ fontSize: font.size.xs, color: color.text1, fontWeight: font.weight.medium }}>{label}</span>
      <div style={{ height: 8, background: color.bg3, borderRadius: radius.pill, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: tint,
          borderRadius: radius.pill,
          transformOrigin: "left center",
          animation: `ms-bar-in 620ms cubic-bezier(0.22, 1, 0.28, 1) both`,
          animationDelay: `${delay}ms`,
        }} />
      </div>
      <span style={{ fontFamily: font.mono, fontSize: font.size.sm, color: color.text0, fontVariantNumeric: "tabular-nums", fontWeight: font.weight.semibold, textAlign: "right" }}>
        {count}
      </span>
    </div>
  );
}

function FileRow({ row, index, onFocus }: { row: Row; index: number; onFocus: () => void }) {
  const tint = row.score >= 0.75 ? color.success : row.score >= 0.5 ? color.warn : color.danger;
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{
        ...rowStyle,
        animationDelay: `${Math.min(index, 40) * 14}ms`,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: font.size.sm, fontWeight: font.weight.medium, color: color.text0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {row.entity.name}
        </span>
        <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {row.entity.path}
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: space[3], flexShrink: 0 }}>
        <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ color: color.danger }}>{row.survived}</span> survived · <span style={{ color: color.success }}>{row.killed}</span> killed
        </span>
        <span style={{
          minWidth: 48,
          padding: `${space[1]}px ${space[2]}px`,
          borderRadius: radius.sm,
          background: `${tint}22`,
          color: tint,
          fontFamily: font.mono,
          fontSize: font.size.xs,
          fontWeight: font.weight.semibold,
          textAlign: "center",
        }}>
          {Math.round(row.score * 100)}
        </span>
      </span>
    </button>
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
  animation: "ms-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const topStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: space[4],
  alignItems: "stretch",
};

const gaugeWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[4],
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const killTableStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  justifyContent: "center",
};

const sectionHeadStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  marginBottom: space[3],
  fontWeight: font.weight.semibold,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "ms-enter 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const MutationScoreView = memo(MutationScoreViewImpl);
