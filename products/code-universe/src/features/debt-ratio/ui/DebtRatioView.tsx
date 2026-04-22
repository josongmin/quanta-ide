// DebtRatioView — Sonar SQALE Technical Debt Ratio dashboard.
// Hero: big ratio % + A-E rating ring.
// Below: debt hours stacked bar segmented by tier (Excellent/OK/Risk/Critical).
// Right: worst-20 offenders.

import { memo, useMemo, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  debtHours,
  debtRatio,
  devCostHours,
  maintainabilityRating,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

type Rating = "A" | "B" | "C" | "D" | "E";

interface FileDebt {
  entity: Entity;
  hours: number;
  ratio: number;
  rating: Rating;
}

const TIERS: Array<{ key: Rating; label: string; max: number; tint: string; desc: string }> = [
  { key: "A", label: "Excellent", max: 5,   tint: color.success, desc: "≤ 5%" },
  { key: "B", label: "Good",      max: 10,  tint: "#7db843",     desc: "5-10%" },
  { key: "C", label: "Risk",      max: 20,  tint: color.warn,    desc: "10-20%" },
  { key: "D", label: "Critical",  max: 50,  tint: "#e06a21",     desc: "20-50%" },
  { key: "E", label: "Blocker",   max: 101, tint: color.danger,  desc: "> 50%" },
];

const KEYFRAMES = `
@keyframes dr-enter { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
@keyframes dr-ring  { from { stroke-dashoffset: var(--circ); } to { stroke-dashoffset: var(--offset); } }
@keyframes dr-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

function collect(ctx: ViewContextValue) {
  if (!ctx.tree) return null;
  const rows: FileDebt[] = [];
  let debtSum = 0;
  let devSum = 0;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const h = debtHours(e);
    const r = debtRatio(e);
    const dev = devCostHours(e);
    debtSum += h;
    devSum += dev;
    rows.push({ entity: e, hours: h, ratio: r, rating: maintainabilityRating(r) });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => b.hours - a.hours);
  const overallRatio = devSum === 0 ? 0 : debtSum / devSum;
  const overallRating = maintainabilityRating(overallRatio);
  // Tier distribution.
  const byTier: Record<Rating, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const r of rows) byTier[r.rating]++;
  return {
    rows,
    debtSum,
    devSum,
    overallRatio,
    overallRating,
    byTier,
    fileCount: rows.length,
  };
}

function DebtRatioViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => collect(ctx), [ctx]);

  if (!data) {
    return <div style={emptyStyle}><div style={{ fontSize: font.size.md, color: color.text2 }}>부채 데이터 없음</div></div>;
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={{ marginBottom: space[5] }}>
        <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Technical Debt Ratio</div>
        <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
          SonarSource SQALE · 파일 {data.fileCount}개 집계
        </div>
      </header>

      <div style={topStyle}>
        <HeroRing ratio={data.overallRatio} rating={data.overallRating} />
        <div style={statsCol}>
          <Stat label="Debt" value={formatDuration(data.debtSum)} sub={`${Math.round(data.debtSum)}h`} tint={color.warn} />
          <Stat label="Dev cost (est.)" value={formatDuration(data.devSum)} sub="0.06d per LoC" tint={color.text2} />
          <Stat label="Files at D/E" value={`${data.byTier.D + data.byTier.E}`} sub={`${Math.round(((data.byTier.D + data.byTier.E) / data.fileCount) * 100)}%`} tint={color.danger} />
        </div>
      </div>

      <section style={{ marginTop: space[6] }}>
        <h3 style={sectionHead}>분포</h3>
        <TierBar byTier={data.byTier} fileCount={data.fileCount} />
      </section>

      <section style={{ marginTop: space[6] }}>
        <h3 style={sectionHead}>상위 20 파일 · 부채 시간 순</h3>
        <div style={listStyle}>
          {data.rows.slice(0, 20).map((r, i) => (
            <FileRow key={r.entity.id} row={r} index={i} onFocus={() => ctx.dispatch.selectEntity(r.entity.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroRing({ ratio, rating }: { ratio: number; rating: Rating }) {
  const R = 66;
  const circ = 2 * Math.PI * R;
  const pct = Math.min(1, ratio * 2); // render up to 50% as a full ring
  const offset = circ * (1 - pct);
  const tint = TIERS.find(t => t.key === rating)!.tint;

  return (
    <div style={ringWrap}>
      <svg width={170} height={170} viewBox="-85 -85 170 170">
        <circle cx={0} cy={0} r={R} fill="none" stroke={color.bg3} strokeWidth={10} />
        <circle
          cx={0} cy={0} r={R} fill="none"
          stroke={tint} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          style={{
            ["--circ" as string]: circ.toString(),
            ["--offset" as string]: offset.toString(),
            animation: `dr-ring 900ms cubic-bezier(0.22, 1, 0.28, 1) both`,
          }}
          transform="rotate(-90)"
        />
        <text x={0} y={-2} textAnchor="middle" fontFamily={font.mono} fontSize={30} fontWeight={font.weight.bold} fill={color.text0} style={{ fontVariantNumeric: "tabular-nums" }}>
          {(ratio * 100).toFixed(1)}
        </text>
        <text x={0} y={16} textAnchor="middle" fontFamily={font.sans} fontSize={11} fill={color.text2}>
          %
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[2] }}>
        <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
          Sonar Rating
        </div>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          background: tint, color: "#ffffff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: font.mono, fontSize: 28, fontWeight: font.weight.bold,
          boxShadow: `0 6px 14px ${tint}33`,
        }}>
          {rating}
        </div>
        <div style={{ fontSize: font.size.xxs, color: color.text2 }}>
          {TIERS.find(t => t.key === rating)!.desc}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: string }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: font.size.xxl, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: font.size.xxs, color: color.text3 }}>{sub}</div>
    </div>
  );
}

function TierBar({ byTier, fileCount }: { byTier: Record<Rating, number>; fileCount: number }) {
  return (
    <div style={{ background: color.bg1, border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[4] }}>
      <div style={{ display: "flex", height: 14, borderRadius: radius.pill, overflow: "hidden" }}>
        {TIERS.map((t, i) => {
          const n = byTier[t.key];
          if (n === 0) return null;
          const pct = (n / fileCount) * 100;
          return (
            <div key={t.key} style={{
              width: `${pct}%`,
              background: t.tint,
              transformOrigin: "left center",
              animation: `dr-bar 620ms cubic-bezier(0.22, 1, 0.28, 1) both`,
              animationDelay: `${i * 60}ms`,
            }} title={`${t.label} · ${n}개`} />
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: space[3], gap: space[3], fontSize: font.size.xs, flexWrap: "wrap" }}>
        {TIERS.map(t => (
          <span key={t.key} style={{ display: "flex", alignItems: "center", gap: space[1], color: color.text1 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: t.tint }} />
            <strong style={{ color: color.text0 }}>{t.key}</strong>
            <span style={{ color: color.text2 }}>{t.desc}</span>
            <span style={{ fontFamily: font.mono, color: color.text3, fontVariantNumeric: "tabular-nums" }}>{byTier[t.key]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function FileRow({ row, index, onFocus }: { row: FileDebt; index: number; onFocus: () => void }) {
  const tint = TIERS.find(t => t.key === row.rating)!.tint;
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{ ...rowStyle, animationDelay: `${Math.min(index, 20) * 14}ms` }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: "50%",
        background: tint, color: "#ffffff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.bold,
        flexShrink: 0,
      }}>
        {row.rating}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.medium, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.entity.name}
        </span>
        <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.entity.path}
        </span>
      </span>
      <span style={{
        fontFamily: font.mono,
        fontSize: font.size.xs,
        color: color.text1,
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}>
        {row.hours.toFixed(1)}h · {(row.ratio * 100).toFixed(1)}%
      </span>
    </button>
  );
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 8;
  if (days < 30) return `${days.toFixed(1)}d`;
  const months = days / 22;
  return `${months.toFixed(1)}mo`;
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "dr-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const topStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "420px 1fr",
  gap: space[4],
};

const ringWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[4],
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const statsCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: space[3],
};

const statCard: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const sectionHead: CSSProperties = {
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
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.border}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "dr-enter 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const DebtRatioView = memo(DebtRatioViewImpl);
