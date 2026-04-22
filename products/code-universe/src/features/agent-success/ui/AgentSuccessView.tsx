// AgentSuccessView — per-file autonomous-agent success probability.
// --------------------------------------------------------------------
// Top: 6-task chip row. Click swaps the probability axis. Hero: repo-
//   wide avg success probability + interpretation band (<40% human-only
//   / 40-70% review needed / >70% autonomous-safe). Middle: file grid
//   tinted by probability (red <30% / amber 30-60% / green-amber 60-80%
//   / green >80%). Bottom: 2D scatter — X = complexity, Y = probability
//   showing the negative correlation. Right: top-10 "too hard for agent"
//   and top-10 "agent-safe" files.
//
// References:
//   - Jimenez et al. "SWE-bench: Can Language Models Resolve Real-World
//     GitHub Issues?" ICLR 2024
//   - METR "Measuring AI Ability to Complete Long Tasks" (2024)
// Composite: coverage × size × complexity × AI-friendliness.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  agentSuccessProbability,
  AI_TASK_KINDS,
  complexity,
  type AITaskKind,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;
const COUNTER_MS = 640;
const BAR_MS = 900;

const KEYFRAMES = `
@keyframes as-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes as-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes as-cell  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes as-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes as-dot   { from { opacity: 0; transform: scale(0.5); } to { opacity: 0.65; transform: scale(1); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

// Tier thresholds for the probability colour ramp.
function probColor(p: number): { soft: string; strong: string } {
  if (p < 0.30) return { soft: "#f7c4c6", strong: color.danger };
  if (p < 0.60) return { soft: "#f5d9a4", strong: color.warn };
  if (p < 0.80) return { soft: "#d7e9b4", strong: "#7db843" };
  return { soft: "#c2eacf", strong: color.success };
}

// ── helpers ──────────────────────────────────────────────────────────

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

interface FileRow {
  entity: Entity;
  prob: number;
  cx: number;
}

interface Aggregate {
  files: FileRow[];
  avg: number;
  tooHard: FileRow[];
  safe: FileRow[];
}

function aggregate(ctx: ViewContextValue, task: AITaskKind): Aggregate | null {
  if (!ctx.tree) return null;
  const files: FileRow[] = [];
  let sum = 0;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const prob = agentSuccessProbability(e, task);
    const cx = complexity(e);
    sum += prob;
    files.push({ entity: e, prob, cx });
  }
  if (files.length === 0) return null;
  const avg = sum / files.length;
  const sorted = [...files].sort((a, b) => a.prob - b.prob);
  const tooHard = sorted.slice(0, 10);
  const safe = sorted.slice(-10).reverse();
  // Grid order: highest probability first so "safe" side reads first.
  files.sort((a, b) => b.prob - a.prob);
  return { files, avg, tooHard, safe };
}

function AgentSuccessViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [task, setTask] = useState<AITaskKind>("explain");
  const data = useMemo(() => aggregate(ctx, task), [ctx, task]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>에이전트 성공 확률을 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const band =
    data.avg >= 0.70
      ? { label: "autonomous-safe", color: color.success, copy: "대부분의 파일에 AI 에이전트 자율 실행 가능" }
      : data.avg >= 0.40
      ? { label: "review needed",   color: color.warn,    copy: "사람 리뷰 필수. 자율 실행은 한정된 파일만." }
      : { label: "human required",  color: color.danger,  copy: "현재 작업 난이도에선 사람 개입 필수." };

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Agent Success · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>per-file × task</span>
          </div>
          <div style={subtitleStyle}>
            coverage × size × complexity × friendliness composite · {data.files.length.toLocaleString()}개 파일
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Jimenez et al. SWE-bench ICLR 2024<br />
          METR long-task horizons 2024
        </div>
      </header>

      {/* Task chip row */}
      <section style={chipRowStyle}>
        <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, marginRight: space[2] }}>
          task
        </span>
        {AI_TASK_KINDS.map(k => {
          const active = k === task;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTask(k)}
              style={{
                ...chipStyle,
                background: active ? color.accentSoft : color.bg1,
                borderColor: active ? color.accentBorder : color.border,
                color: active ? color.accent : color.text1,
                fontWeight: active ? font.weight.semibold : font.weight.medium,
              }}
            >
              {TASK_KOREAN[k]}
            </button>
          );
        })}
      </section>

      {/* Hero + band */}
      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="avg success probability"
          target={data.avg * 100}
          format={(n) => `${n.toFixed(1)}%`}
          sub={`task · ${TASK_KOREAN[task]}`}
          tint={band.color}
        />
        <div style={{ ...heroTileStyle, animationDelay: `${STAGGER_MS}ms`, gridColumn: "span 2", minHeight: 108 }}>
          <div style={heroLabelStyle}>expected completion rate</div>
          <div style={{ display: "flex", alignItems: "center", gap: space[3], marginTop: 4 }}>
            <div style={{
              padding: `6px 12px`,
              background: `${band.color}18`,
              color: band.color,
              borderRadius: radius.pill,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.wide,
              textTransform: "uppercase",
              fontFamily: font.mono,
            }}>
              {band.label}
            </div>
            <span style={{ fontSize: font.size.sm, color: color.text1 }}>{band.copy}</span>
          </div>
          <div style={{ display: "flex", gap: space[3], marginTop: space[3], fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            <span>&lt;40% human-required</span>
            <span>40-70% review needed</span>
            <span>&gt;70% autonomous-safe</span>
          </div>
        </div>
        <HeroTile
          index={3}
          label="agent-safe files (≥70%)"
          target={data.files.filter(f => f.prob >= 0.7).length}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`of ${data.files.length} files`}
          tint={color.success}
        />
      </section>

      {/* Grid + ranked lists (split) */}
      <section style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: space[3] }}>
        <div>
          <div style={sectionHeadRow}>
            <h3 style={sectionHead}>File grid · tinted by probability</h3>
            <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
              red &lt;30% · amber &lt;60% · green ≥80%
            </div>
          </div>
          <div style={gridStyle}>
            {data.files.map((row, i) => {
              const pc = probColor(row.prob);
              const isHovered = hoveredId === row.entity.id;
              const isSelected = ctx.selectedId === row.entity.id;
              return (
                <button
                  key={row.entity.id}
                  type="button"
                  title={`${row.entity.path} · P(${TASK_KOREAN[task]}) = ${Math.round(row.prob * 100)}%`}
                  onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                  onMouseEnter={() => setHoveredId(row.entity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    ...cellStyle,
                    background: pc.soft,
                    borderColor: isSelected ? color.accent : isHovered ? pc.strong : `${pc.strong}33`,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${color.accent}`
                      : isHovered ? `0 2px 6px ${pc.strong}44` : "none",
                    transform: isHovered ? "scale(1.08)" : "scale(1)",
                    animationDelay: `${Math.min(i * 3, 500)}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <RankedList
            title="Too hard for agent"
            subtitle="lowest probability"
            rows={data.tooHard}
            ctx={ctx}
            danger
          />
          <RankedList
            title="Agent-safe"
            subtitle="highest probability"
            rows={data.safe}
            ctx={ctx}
          />
        </div>
      </section>

      {/* Scatter: complexity × probability */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Complexity × probability</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            negative correlation · hot zone = bottom-right
          </div>
        </div>
        <Scatter files={data.files} />
      </section>
    </div>
  );
}

function HeroTile({
  index, label, target, format, sub, tint,
}: {
  index: number; label: string; target: number;
  format: (n: number) => string; sub: string; tint: string;
}): ReactElement {
  const v = useCounter(target, COUNTER_MS);
  return (
    <div style={{ ...heroTileStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroNumStyle, color: tint }}>{format(v)}</div>
      <div style={heroSubStyle} title={sub}>{sub}</div>
    </div>
  );
}

function RankedList({
  title, subtitle, rows, ctx, danger,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ entity: Entity; prob: number }>;
  ctx: ViewContextValue;
  danger?: boolean;
}) {
  return (
    <div>
      <div style={sectionHeadRow}>
        <h3 style={sectionHead}>{title}</h3>
        <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
          {subtitle}
        </div>
      </div>
      <div style={listStyle}>
        {rows.map((row, i) => {
          const pc = probColor(row.prob);
          const isSelected = ctx.selectedId === row.entity.id;
          return (
            <button
              key={row.entity.id}
              type="button"
              onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
              style={{
                ...rowStyle,
                background: isSelected ? color.accentSofter : "transparent",
                animationDelay: `${Math.min(i * STAGGER_MS, 240)}ms`,
              }}
            >
              <span style={rankStyle}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={rowNameStyle}>{row.entity.name}</span>
                <span style={rowPathStyle}>{row.entity.path}</span>
              </span>
              <span style={{ flex: "0 0 56px" }}>
                <span style={barBaseStyle}>
                  <span style={{
                    ...barFillStyle,
                    width: `${row.prob * 100}%`,
                    background: pc.strong,
                    animation: `as-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * STAGGER_MS, 240) + 120}ms`,
                  }} />
                </span>
              </span>
              <span style={{
                ...pctStyle,
                color: danger ? color.danger : pc.strong,
              }}>
                {Math.round(row.prob * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Scatter({ files }: { files: Array<{ entity: Entity; prob: number; cx: number }> }) {
  const W = 720;
  const H = 220;
  const PL = 56;
  const PR = 16;
  const PT = 12;
  const PB = 32;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="complexity vs probability">
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1.0].map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`y-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {`${Math.round(t * 100)}%`}
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
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          );
        })}
        {/* hot zone (bottom-right) */}
        <rect
          x={PL + innerW / 2}
          y={PT + innerH / 2}
          width={innerW / 2}
          height={innerH / 2}
          fill={color.danger}
          opacity={0.05}
        />
        {/* dots */}
        {files.map((f, i) => {
          const pc = probColor(f.prob);
          const x = PL + f.cx * innerW;
          const y = PT + innerH * (1 - f.prob);
          return (
            <circle
              key={f.entity.id}
              cx={x} cy={y} r={4}
              fill={pc.strong}
              opacity={0.65}
              style={{
                animation: `as-dot 520ms ${ENTRY_EASE} both`,
                animationDelay: `${Math.min(i * 3, 500)}ms`,
              }}
            />
          );
        })}
        {/* axis labels */}
        <text
          x={PL + innerW / 2} y={H - 4}
          textAnchor="middle" fontSize={font.size.xxs}
          fill={color.text2} fontFamily={font.sans}
        >
          complexity →
        </text>
        <text
          x={0} y={0}
          textAnchor="middle" fontSize={font.size.xxs}
          fill={color.text2} fontFamily={font.sans}
          transform={`translate(16, ${PT + innerH / 2}) rotate(-90)`}
        >
          probability →
        </text>
        <text
          x={PL + innerW - 4} y={PT + innerH - 6}
          textAnchor="end" fontSize={font.size.xxs}
          fill={color.danger} fontFamily={font.sans} fontStyle="italic" opacity={0.7}
        >
          hot zone — agent-fails
        </text>
      </svg>
    </div>
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
  animation: `as-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const chipRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[1],
  flexWrap: "wrap",
  marginBottom: space[5],
};

const chipStyle: CSSProperties = {
  padding: `6px 12px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
  cursor: "pointer",
  transition: `all ${transition.base}`,
  fontFamily: font.sans,
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
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
  animation: `as-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroNumStyle: CSSProperties = {
  fontSize: 38,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
  marginTop: 2,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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

const gridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const cellStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: radius.sm,
  border: "1px solid transparent",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
  transition: `transform ${transition.base}, border-color ${transition.base}, box-shadow ${transition.base}`,
  animation: `as-cell 360ms ${ENTRY_EASE} both`,
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
  padding: `${space[2]}px ${space[3]}px`,
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `as-tile 440ms ${ENTRY_EASE} both`,
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

const barBaseStyle: CSSProperties = {
  display: "block",
  position: "relative",
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const barFillStyle: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: radius.pill,
  transformOrigin: "left center",
};

const pctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 40px",
  textAlign: "right" as const,
  fontWeight: font.weight.semibold,
};

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

export const AgentSuccessView = memo(AgentSuccessViewImpl);
