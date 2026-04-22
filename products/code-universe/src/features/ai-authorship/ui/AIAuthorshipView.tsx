// AIAuthorshipView — per-file AI-authored-% dashboard.
// --------------------------------------------------------------------
// Top: 4 stats — repo-wide AI-authored % / files ≥50% AI / files ≥80%
//   AI / avg ratio. Middle: 12-bucket adoption-curve line chart
//   (aiAuthorshipTrend). Bottom: file grid tinted by AI-authored ratio
//   (white → purple). Right: top-20 most-AI-written files ranked.
// Hover tile → ratio + recent commits. Click → dispatch.selectEntity.
//
// References:
//   - GitHub Copilot telemetry studies (2023, 2024)
//   - JetBrains Developer Ecosystem AI adoption (2024, 2025)
//   - Bird et al. "Taking Flight with Copilot", CACM 2023
// "AI-authorship ratio as a governance-visible metric" — 2026 lens.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  aiAuthorshipRatio,
  aiAuthorshipTrend,
  recentCommits,
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
@keyframes ai-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes ai-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ai-cell  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes ai-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes ai-path  { from { stroke-dashoffset: 1200; } to { stroke-dashoffset: 0; } }
`;

const AI_PURPLE = "#7e4ed6";
const AI_PURPLE_SOFT = "#efe7fa";

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

/** Blend from bg white → AI purple at ratio t. */
function ratioTint(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  return `color-mix(in srgb, ${AI_PURPLE_SOFT} ${(1 - clamped) * 100}%, ${AI_PURPLE} ${clamped * 100}%)`;
}

interface FileRow {
  entity: Entity;
  ratio: number;
  commits: number;
}

interface Aggregate {
  files: FileRow[];
  avg: number;
  ge50: number;
  ge80: number;
  top20: FileRow[];
}

function aggregate(ctx: ViewContextValue): Aggregate | null {
  if (!ctx.tree) return null;
  const files: FileRow[] = [];
  let sum = 0, ge50 = 0, ge80 = 0;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const ratio = aiAuthorshipRatio(e);
    sum += ratio;
    if (ratio >= 0.50) ge50++;
    if (ratio >= 0.80) ge80++;
    files.push({ entity: e, ratio, commits: recentCommits(e) });
  }
  if (files.length === 0) return null;
  const avg = sum / files.length;
  const top20 = [...files].sort((a, b) => b.ratio - a.ratio).slice(0, 20);
  // Grid order: highest ratio first so the purple chunk reads first.
  files.sort((a, b) => b.ratio - a.ratio);
  return { files, avg, ge50, ge80, top20 };
}

function AIAuthorshipViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const data = useMemo(() => aggregate(ctx), [ctx]);
  const trend = useMemo(() => aiAuthorshipTrend(ctx.tree?.rootId ?? null, 12), [ctx.tree?.rootId]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>AI 작성 기록을 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const total = data.files.length;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            AI Authorship · <span style={{ color: AI_PURPLE, fontWeight: font.weight.semibold }}>파일별 AI 기원</span>
          </div>
          <div style={subtitleStyle}>
            commit co-author × style signature 휴리스틱 · {total.toLocaleString()}개 파일
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Copilot telemetry · JetBrains AI adoption<br />
          Bird et al. CACM 2023
        </div>
      </header>

      {/* Hero stats */}
      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="repo AI ratio"
          target={data.avg * 100}
          format={(n) => `${n.toFixed(1)}%`}
          sub="weighted by file count"
          tint={AI_PURPLE}
        />
        <HeroTile
          index={1}
          label="files ≥50% AI"
          target={data.ge50}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.ge50).toFixed(1)}% of files`}
          tint={AI_PURPLE}
        />
        <HeroTile
          index={2}
          label="files ≥80% AI"
          target={data.ge80}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.ge80).toFixed(1)}% — heavy AI`}
          tint={color.danger}
        />
        <HeroTile
          index={3}
          label="avg ratio"
          target={data.avg * 100}
          format={(n) => `${n.toFixed(1)}%`}
          sub="per-file mean"
          tint={color.text0}
        />
      </section>

      {/* Adoption curve */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Adoption curve · 12 buckets</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            oldest → newest · sigmoid growth fit
          </div>
        </div>
        <TrendChart series={trend} />
      </section>

      {/* Grid + ranked list split */}
      <section style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: space[3] }}>
        {/* File grid */}
        <div>
          <div style={sectionHeadRow}>
            <h3 style={sectionHead}>File grid · tinted by AI ratio</h3>
            <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
              white = human · purple = AI
            </div>
          </div>
          <div style={gridStyle}>
            {data.files.map((row, i) => {
              const tint = ratioTint(row.ratio);
              const isHovered = hoveredId === row.entity.id;
              const isSelected = ctx.selectedId === row.entity.id;
              return (
                <button
                  key={row.entity.id}
                  type="button"
                  title={`${row.entity.path} · AI ${Math.round(row.ratio * 100)}% · ${row.commits} recent commits`}
                  onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                  onMouseEnter={() => setHoveredId(row.entity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    ...cellStyle,
                    background: tint,
                    borderColor: isSelected ? color.accent : isHovered ? AI_PURPLE : `${AI_PURPLE}33`,
                    boxShadow: isSelected
                      ? `0 0 0 2px ${color.accent}`
                      : isHovered ? `0 2px 6px ${AI_PURPLE}40` : "none",
                    transform: isHovered ? "scale(1.08)" : "scale(1)",
                    animationDelay: `${Math.min(i * 3, 500)}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Top-20 ranked list */}
        <div>
          <div style={sectionHeadRow}>
            <h3 style={sectionHead}>Top 20 · most AI-written</h3>
            <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
              ratio desc
            </div>
          </div>
          <div style={listStyle}>
            {data.top20.map((row, i) => {
              const isSelected = ctx.selectedId === row.entity.id;
              return (
                <button
                  key={row.entity.id}
                  type="button"
                  onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                  style={{
                    ...rowStyle,
                    background: isSelected ? color.accentSofter : "transparent",
                    animationDelay: `${Math.min(i * STAGGER_MS, 340)}ms`,
                  }}
                >
                  <span style={rankStyle}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowNameStyle}>{row.entity.name}</span>
                    <span style={rowPathStyle}>{row.entity.path}</span>
                  </span>
                  <span style={{ flex: "0 0 80px" }}>
                    <span style={barBaseStyle}>
                      <span style={{
                        ...barFillStyle,
                        width: `${row.ratio * 100}%`,
                        background: AI_PURPLE,
                        animation: `ai-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
                        animationDelay: `${Math.min(i * STAGGER_MS, 340) + 120}ms`,
                      }} />
                    </span>
                  </span>
                  <span style={pctStyle}>{Math.round(row.ratio * 100)}%</span>
                </button>
              );
            })}
          </div>
        </div>
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

function TrendChart({ series }: { series: number[] }) {
  const W = 720;
  const H = 160;
  const PL = 40;
  const PR = 16;
  const PT = 12;
  const PB = 24;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  if (series.length === 0) return null;
  const max = 1; // 0..1
  const pts: Array<{ x: number; y: number; v: number }> = series.map((v, i) => {
    const x = PL + (i / Math.max(1, series.length - 1)) * innerW;
    const y = PT + innerH * (1 - Math.max(0, Math.min(1, v / max)));
    return { x, y, v };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1]!.x} ${PT + innerH} L ${pts[0]!.x} ${PT + innerH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="AI authorship trend">
        {yTicks.map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`yt-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {`${Math.round(t * 100)}%`}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={AI_PURPLE} fillOpacity={0.12} />
        <path
          d={linePath}
          fill="none"
          stroke={AI_PURPLE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={1200}
          style={{ animation: `ai-path 1200ms ${ENTRY_EASE} both` }}
        />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={AI_PURPLE} opacity={0.85} />
        ))}
        {[0, series.length - 1].map(i => {
          const p = pts[i]!;
          return (
            <text key={`xl-${i}`} x={p.x} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
              {i === 0 ? "oldest" : "newest"}
            </text>
          );
        })}
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
  animation: `ai-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
  animation: `ai-tile 460ms ${ENTRY_EASE} both`,
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

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
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
  animation: `ai-cell 360ms ${ENTRY_EASE} both`,
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
  maxHeight: 520,
  overflowY: "auto",
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
  animation: `ai-tile 440ms ${ENTRY_EASE} both`,
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
  color: AI_PURPLE,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 44px",
  textAlign: "right" as const,
  fontWeight: font.weight.semibold,
};

export const AIAuthorshipView = memo(AIAuthorshipViewImpl);
