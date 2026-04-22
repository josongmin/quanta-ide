// ContextRotView — per-file "Lost in the Middle" decay map.
// --------------------------------------------------------------------
// Top: 3-column hero tiles (atFront / atMiddle / atEnd) showing average
// performance across the repo for each slot.
// Middle: scatter plot where X = rotScore (max − min across positions)
// and Y = tokens. Files in the top-right corner have HIGH rot AND HIGH
// tokens — those WILL get lost in any long-context prompt.
// Bottom: ranked list of the worst rot files. Each row renders a tiny
// 3-dot front/middle/end strip tinted by local performance and a
// "recommended position" chip driven by the max of atFront / atEnd.
// Right: insight rail with the single headline number (average middle
// drop) and an educational explainer.
//
// Reference: Liu et al. "Lost in the Middle: How Language Models Use
// Long Contexts" TACL 2023; Kamradt "Needle in a Haystack" 2023;
// "Ruler" long-context benchmark 2024.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  contextRotScore,
  fileTokens,
  type ContextRot,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes crot-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes crot-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes crot-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes crot-dot   { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
`;

interface FileRow {
  entity: Entity;
  tokens: number;
  rot: ContextRot;
}

interface Aggregate {
  rows: FileRow[];
  avgFront: number;
  avgMiddle: number;
  avgEnd: number;
  avgDrop: number;
  maxTokens: number;
  maxRot: number;
  worst: FileRow[];
}

function aggregate(ctx: ViewContextValue): Aggregate | null {
  if (!ctx.tree) return null;
  const rows: FileRow[] = [];
  let sumF = 0, sumM = 0, sumE = 0;
  let maxTokens = 0, maxRot = 0;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const rot = contextRotScore(e);
    const tokens = fileTokens(e);
    sumF += rot.atFront; sumM += rot.atMiddle; sumE += rot.atEnd;
    if (tokens > maxTokens) maxTokens = tokens;
    if (rot.rotScore > maxRot) maxRot = rot.rotScore;
    rows.push({ entity: e, tokens, rot });
  }
  if (rows.length === 0) return null;
  const n = rows.length;
  const avgFront = sumF / n;
  const avgMiddle = sumM / n;
  const avgEnd = sumE / n;
  const avgDrop = Math.max(avgFront, avgEnd) - avgMiddle;
  const worst = [...rows]
    .sort((a, b) => (b.rot.rotScore * b.tokens) - (a.rot.rotScore * a.tokens))
    .slice(0, 12);
  return { rows, avgFront, avgMiddle, avgEnd, avgDrop, maxTokens, maxRot, worst };
}

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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function perfTint(v: number): string {
  if (v >= 0.80) return color.success;
  if (v >= 0.65) return "#7db843";
  if (v >= 0.50) return color.warn;
  return color.danger;
}

function ContextRotViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => aggregate(ctx), [ctx]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>context rot을 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Context Rot · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>lost in the middle</span>
          </div>
          <div style={subtitleStyle}>
            position-bias decay × {data.rows.length.toLocaleString()}개 파일 · U-shape 감쇠 모델링
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Liu et al. Lost in the Middle TACL 2023<br />
          Kamradt NIAH 2023 · Ruler 2024
        </div>
      </header>

      {/* Hero — 3 position tiles */}
      <section style={heroGridStyle}>
        <PositionTile index={0} label="atFront" target={data.avgFront * 100} tint={perfTint(data.avgFront)} sub="프롬프트 시작부" />
        <PositionTile index={1} label="atMiddle" target={data.avgMiddle * 100} tint={perfTint(data.avgMiddle)} sub="중간 (감쇠 구간)" />
        <PositionTile index={2} label="atEnd" target={data.avgEnd * 100} tint={perfTint(data.avgEnd)} sub="프롬프트 끝부" />
      </section>

      {/* Scatter + right insight */}
      <section style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: space[3] }}>
        <div>
          <div style={sectionHeadRow}>
            <h3 style={sectionHead}>Rot × Tokens scatter</h3>
            <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
              danger zone = top-right
            </div>
          </div>
          <Scatter
            rows={data.rows}
            maxTokens={data.maxTokens}
            maxRot={data.maxRot}
            selectedId={ctx.selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={(id) => ctx.dispatch.selectEntity(id)}
          />
        </div>
        <aside style={insightStyle}>
          <div style={insightLabelStyle}>insight</div>
          <div style={{ fontSize: font.size.lg, color: color.text0, fontWeight: font.weight.semibold, marginTop: 4 }}>
            avg middle-drop
          </div>
          <div style={{ fontSize: 42, fontFamily: font.mono, fontWeight: font.weight.bold, color: perfTint(1 - data.avgDrop), lineHeight: 1, marginTop: 2, letterSpacing: -0.6 }}>
            {(data.avgDrop * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text1, marginTop: space[2], lineHeight: 1.55 }}>
            파일이 중간에 있을 때 평균적으로 <strong>{(data.avgDrop * 100).toFixed(0)}%</strong>의 AI 주의가 사라집니다.
            long-context에 스태킹할 땐 중요한 파일을 <strong>앞</strong>이나 <strong>뒤</strong>에 배치하세요.
          </div>
          <div style={{ height: 1, background: color.border, margin: `${space[3]}px 0` }} />
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, lineHeight: 1.6 }}>
            Liu et al. 2023 · long-context LLMs show U-shape attention decay — early &amp; late positions retain accuracy, mid positions drop.
          </div>
        </aside>
      </section>

      {/* Ranked list — worst rot files */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Worst rot · token-weighted</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            rotScore × tokens
          </div>
        </div>
        <div style={listStyle}>
          {data.worst.map((r, i) => (
            <WorstRow key={r.entity.id} row={r} index={i} selected={ctx.selectedId === r.entity.id}
              onSelect={() => ctx.dispatch.selectEntity(r.entity.id)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PositionTile({
  index, label, target, tint, sub,
}: { index: number; label: string; target: number; tint: string; sub: string }): ReactElement {
  const v = useCounter(target, COUNTER_MS);
  return (
    <div style={{ ...heroTileStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ fontSize: 42, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, marginTop: 2, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
        {v.toFixed(1)}%
      </div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

function Scatter({
  rows, maxTokens, maxRot, selectedId, hoveredId, onHover, onSelect,
}: {
  rows: FileRow[];
  maxTokens: number;
  maxRot: number;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}): ReactElement {
  const W = 720;
  const H = 260;
  const PL = 60; const PR = 16; const PT = 12; const PB = 36;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const rMax = Math.max(0.0001, maxRot);
  const tMax = Math.max(1, maxTokens);

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="rot vs tokens scatter">
        {/* danger-zone tint (top-right) */}
        <rect x={PL + innerW / 2} y={PT} width={innerW / 2} height={innerH / 2} fill={color.danger} opacity={0.05} />
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`y-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {fmtTokens(tMax * t)}
              </text>
            </g>
          );
        })}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const x = PL + innerW * t;
          return (
            <g key={`x-${t}`}>
              <line x1={x} y1={PT} x2={x} y2={PT + innerH} stroke={color.border} strokeDasharray="3 4" />
              <text x={x} y={PT + innerH + 14} textAnchor="middle" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {(rMax * t * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* dots */}
        {rows.map((r, i) => {
          const x = PL + (r.rot.rotScore / rMax) * innerW;
          const y = PT + innerH * (1 - Math.min(1, r.tokens / tMax));
          const hov = hoveredId === r.entity.id;
          const sel = selectedId === r.entity.id;
          const radiusR = 3 + Math.sqrt(r.tokens / tMax) * 5;
          const tint = r.rot.rotScore >= rMax * 0.5 && r.tokens >= tMax * 0.5 ? color.danger : color.accent;
          return (
            <circle
              key={r.entity.id}
              cx={x} cy={y} r={hov ? radiusR + 1.5 : radiusR}
              fill={tint}
              opacity={hoveredId !== null && !hov ? 0.18 : hov ? 0.95 : 0.6}
              stroke={sel ? color.accent : "none"}
              strokeWidth={sel ? 1.5 : 0}
              onMouseEnter={() => onHover(r.entity.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(r.entity.id)}
              style={{
                cursor: "pointer",
                animation: `crot-dot 520ms ${ENTRY_EASE} both`,
                animationDelay: `${Math.min(i * 3, 400)}ms`,
                transition: `opacity 160ms, r 160ms`,
              }}
            />
          );
        })}

        {/* axis labels */}
        <text x={PL + innerW / 2} y={H - 4} textAnchor="middle" fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}>
          rotScore (max − min) →
        </text>
        <text x={0} y={0} textAnchor="middle" fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}
          transform={`translate(16, ${PT + innerH / 2}) rotate(-90)`}>
          tokens →
        </text>
        <text x={PL + innerW - 4} y={PT + 14} textAnchor="end" fontSize={font.size.xxs} fill={color.danger} fontStyle="italic" fontFamily={font.sans} opacity={0.75}>
          danger — will be lost
        </text>
      </svg>
    </div>
  );
}

function WorstRow({
  row, index, selected, onSelect,
}: { row: FileRow; index: number; selected: boolean; onSelect: () => void }): ReactElement {
  const { rot } = row;
  const recommended = rot.recommendedPos;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...rowStyle,
        background: selected ? color.accentSofter : "transparent",
        animationDelay: `${Math.min(index * STAGGER_MS, 260)}ms`,
      }}
    >
      <span style={rankStyle}>{String(index + 1).padStart(2, "0")}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={rowNameStyle}>{row.entity.name}</span>
        <span style={rowPathStyle}>{row.entity.path}</span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, flex: "0 0 auto" }}>
        <PosDot label="F" v={rot.atFront} />
        <PosDot label="M" v={rot.atMiddle} />
        <PosDot label="E" v={rot.atEnd} />
      </span>
      <span style={{
        padding: `2px ${space[2]}px`,
        borderRadius: radius.pill,
        background: `${color.accent}18`,
        color: color.accent,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        fontFamily: font.mono,
        textTransform: "uppercase",
        letterSpacing: font.letter.wide,
        flex: "0 0 auto",
      }}>
        put at {recommended}
      </span>
      <span style={{
        fontFamily: font.mono,
        fontSize: font.size.xs,
        fontVariantNumeric: "tabular-nums",
        color: color.danger,
        fontWeight: font.weight.semibold,
        flex: "0 0 56px",
        textAlign: "right",
      }}>
        {(rot.rotScore * 100).toFixed(0)}%
      </span>
    </button>
  );
}

function PosDot({ label, v }: { label: string; v: number }): ReactElement {
  const tint = perfTint(v);
  return (
    <span style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1,
      width: 16,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%",
        background: tint, opacity: 0.85,
      }} />
      <span style={{ fontSize: 8, fontFamily: font.mono, color: color.text3 }}>{label}</span>
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `crot-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
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

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: space[3],
  marginBottom: space[5],
};

const heroTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `crot-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
};

const sectionStyle: CSSProperties = {
  marginTop: space[5],
};

const sectionHeadRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

const insightStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `crot-tile 460ms ${ENTRY_EASE} both`,
  animationDelay: "120ms",
};

const insightLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
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
  padding: `${space[2]}px ${space[3]}px`,
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `crot-row 440ms ${ENTRY_EASE} both`,
};

const rankStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  width: 20,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const rowNameStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowPathStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const ContextRotView = memo(ContextRotViewImpl);
