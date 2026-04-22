// BlindSpotView — "what the model doesn't know it doesn't know".
// --------------------------------------------------------------------
// Top: 4 hero tiles — highest blind-spot file, repo average, # in high-
// risk (>0.6), # in critical (>0.8). Middle: scatter — X = blindspot
// score, Y = tokens (size), with a "AI knows least, costs most" danger
// zone labelled top-right. Bottom: top-20 blind-spot files with a 4-
// driver breakdown (proprietary API / novel library / internal DSL /
// domain-specific). Right rail: "what this means" mitigation card.
//
// Reference: Kadavath et al. "Language Models (Mostly) Know What They
// Know" (2022); Liu et al. FSE 2024; novel OOD detection applied to
// code generation.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  blindSpotMap,
  fileTokens,
  type BlindSpotRecord,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes bs-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes bs-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes bs-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes bs-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes bs-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
`;

const PLOT_W = 600;
const PLOT_H = 360;
const PLOT_PAD_L = 56;
const PLOT_PAD_R = 20;
const PLOT_PAD_T = 22;
const PLOT_PAD_B = 44;

function riskColor(score: number): string {
  if (score >= 0.8) return color.danger;
  if (score >= 0.6) return color.warn;
  if (score >= 0.4) return color.accent;
  return color.success;
}

function riskTier(score: number): string {
  if (score >= 0.8) return "CRIT";
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MED";
  return "LOW";
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

interface Row extends BlindSpotRecord {
  entity: Entity;
  tokens: number;
}

function BlindSpotViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!ctx.tree) return null;
    const records = blindSpotMap(ctx.tree);
    if (records.length === 0) return null;
    const rows: Row[] = [];
    for (const r of records) {
      const e = ctx.tree.byId.get(r.fileId);
      if (!e) continue;
      rows.push({ ...r, entity: e, tokens: fileTokens(e) });
    }
    const avg = rows.reduce((a, r) => a + r.score, 0) / rows.length;
    const highCount = rows.filter(r => r.score >= 0.6).length;
    const critCount = rows.filter(r => r.score >= 0.8).length;
    const top = rows[0]!;
    return { rows, avg, highCount, critCount, top };
  }, [ctx.tree]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>Blind-spot 데이터를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const topScore = useCounter(data.top.score * 100, COUNTER_MS);
  const avgScore = useCounter(data.avg * 100, COUNTER_MS);
  const highC = useCounter(data.highCount, COUNTER_MS);
  const critC = useCounter(data.critCount, COUNTER_MS);

  const maxTokens = Math.max(100, ...data.rows.map(r => r.tokens));

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Blind Spot · <span style={{ color: color.warn, fontWeight: font.weight.semibold }}>
              model OOD zones
            </span>
          </div>
          <div style={subtitleStyle}>
            proprietary API × novel lib × internal DSL × domain composite · {data.rows.length}개 파일
          </div>
        </div>
        <div style={refStyle}>
          Kadavath et al. 2022 · Liu FSE 2024<br />
          OOD detection for code
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroTile, animationDelay: "0ms" }}>
          <div style={heroLabel}>top blind-spot</div>
          <div style={{ ...heroNum, color: color.text0, fontSize: 18, fontWeight: font.weight.semibold, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {data.top.fileName}
          </div>
          <div style={{ ...heroSub, color: riskColor(data.top.score) }}>
            {topScore.toFixed(1)}% · {riskTier(data.top.score)}
          </div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS}ms` }}>
          <div style={heroLabel}>avg blind-spot</div>
          <div style={{ ...heroNum, color: riskColor(data.avg) }}>
            {avgScore.toFixed(1)}%
          </div>
          <div style={heroSub}>0 = familiar · 100 = OOD</div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS * 2}ms` }}>
          <div style={heroLabel}>HIGH risk (≥0.6)</div>
          <div style={{ ...heroNum, color: color.warn }}>
            {Math.round(highC)}
          </div>
          <div style={heroSub}>of {data.rows.length} files</div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS * 3}ms` }}>
          <div style={heroLabel}>CRITICAL (≥0.8)</div>
          <div style={{ ...heroNum, color: color.danger }}>
            {Math.round(critC)}
          </div>
          <div style={heroSub}>hallucination risk</div>
        </div>
      </section>

      <section style={bodyGrid}>
        {/* Scatter */}
        <div style={scatterWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Blind-spot × tokens</span>
            <span style={mutedMono}>dot = file · top-right = danger</span>
          </div>
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            role="img"
            aria-label="Blind-spot scatter"
            style={{ display: "block" }}
          >
            {/* Danger zone */}
            <rect
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.6}
              y={PLOT_PAD_T}
              width={(PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.4}
              height={(PLOT_H - PLOT_PAD_T - PLOT_PAD_B) * 0.4}
              fill={color.danger}
              opacity={0.07}
            />
            <text
              x={PLOT_W - PLOT_PAD_R - 8}
              y={PLOT_PAD_T + 16}
              textAnchor="end"
              fill={color.danger}
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fontWeight={font.weight.semibold}
              opacity={0.9}
            >
              AI knows least, costs most
            </text>

            {/* Grid */}
            {[0.25, 0.5, 0.75].map(t => {
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              return (
                <g key={`g-${t}`}>
                  <line x1={PLOT_PAD_L} y1={y} x2={PLOT_W - PLOT_PAD_R} y2={y}
                    stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.55} />
                  <line x1={x} y1={PLOT_PAD_T} x2={x} y2={PLOT_H - PLOT_PAD_B}
                    stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.55} />
                </g>
              );
            })}

            {/* Border */}
            <rect
              x={PLOT_PAD_L} y={PLOT_PAD_T}
              width={PLOT_W - PLOT_PAD_L - PLOT_PAD_R}
              height={PLOT_H - PLOT_PAD_T - PLOT_PAD_B}
              fill="none" stroke={color.border}
            />

            {/* Tick labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              return (
                <g key={`tk-${t}`}>
                  <text x={x} y={PLOT_H - PLOT_PAD_B + 14} textAnchor="middle"
                    fontSize={font.size.xxs} fontFamily={font.mono} fill={color.text2}>
                    {t.toFixed(2)}
                  </text>
                  <text x={PLOT_PAD_L - 8} y={y + 3} textAnchor="end"
                    fontSize={font.size.xxs} fontFamily={font.mono} fill={color.text2}>
                    {t === 0 ? "0" : `${Math.round(maxTokens * t / 1000)}K`}
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) / 2}
              y={PLOT_H - 6}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
            >
              blind-spot score →
            </text>
            <text
              x={0} y={0}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
              transform={`translate(14, ${PLOT_PAD_T + (PLOT_H - PLOT_PAD_T - PLOT_PAD_B) / 2}) rotate(-90)`}
            >
              tokens →
            </text>

            {/* Dots */}
            {data.rows.map((r, i) => {
              const innerW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
              const innerH = PLOT_H - PLOT_PAD_T - PLOT_PAD_B;
              const x = PLOT_PAD_L + r.score * innerW;
              const y = PLOT_PAD_T + (1 - Math.min(1, r.tokens / maxTokens)) * innerH;
              const bubble = 3 + Math.sqrt(Math.min(1, r.tokens / maxTokens)) * 10;
              const isHovered = hoveredId === r.fileId;
              const opacity = hoveredId !== null && !isHovered ? 0.16 : isHovered ? 1 : 0.72;
              return (
                <g
                  key={r.fileId}
                  style={{
                    cursor: "pointer",
                    animation: `bs-dot ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * 4, 600)}ms`,
                  }}
                  onMouseEnter={() => setHoveredId(r.fileId)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(r.fileId)}
                >
                  <circle
                    cx={x} cy={y} r={bubble}
                    fill={riskColor(r.score)}
                    opacity={opacity}
                    stroke={isHovered ? color.text0 : "none"}
                    strokeWidth={isHovered ? 1.2 : 0}
                  />
                </g>
              );
            })}

            {/* Tooltip */}
            {hoveredId !== null && (() => {
              const r = data.rows.find(x => x.fileId === hoveredId);
              if (!r) return null;
              const innerW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
              const innerH = PLOT_H - PLOT_PAD_T - PLOT_PAD_B;
              const x = PLOT_PAD_L + r.score * innerW;
              const y = PLOT_PAD_T + (1 - Math.min(1, r.tokens / maxTokens)) * innerH;
              const boxW = 220, boxH = 62;
              const bx = Math.min(PLOT_W - boxW - 4, Math.max(4, x + 12));
              const by = Math.min(PLOT_H - boxH - 4, Math.max(4, y - boxH / 2));
              return (
                <g pointerEvents="none">
                  <rect x={bx} y={by} width={boxW} height={boxH}
                    rx={radius.md} ry={radius.md}
                    fill={color.bg1} stroke={color.border} />
                  <text x={bx + 10} y={by + 16}
                    fill={color.text0} fontSize={font.size.sm}
                    fontFamily={font.sans} fontWeight={font.weight.semibold}>
                    {r.fileName}
                  </text>
                  <text x={bx + 10} y={by + 32}
                    fill={riskColor(r.score)} fontSize={font.size.xxs}
                    fontFamily={font.mono} fontWeight={font.weight.semibold}>
                    blind-spot {(r.score * 100).toFixed(1)}% · {riskTier(r.score)}
                  </text>
                  <text x={bx + 10} y={by + 48}
                    fill={color.text2} fontSize={font.size.xxs} fontFamily={font.mono}>
                    {(r.tokens / 1000).toFixed(1)}K tokens
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Sidebar */}
        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>What this means</span>
            <span style={mutedMono}>action</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>○</span>
                <span style={insightTitle}>human review 우선</span>
              </div>
              <div style={insightBody}>
                blind-spot 파일은 에이전트가 가장 confabulate하기 쉬운 지역.
                코드 생성 후 반드시 사람 검토가 필요하다.
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>◆</span>
                <span style={insightTitle}>context injection</span>
              </div>
              <div style={insightBody}>
                proprietary API / internal DSL은 system prompt에 정의를 주입해 OOD를 완화하라.
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>⚠</span>
                <span style={insightTitle}>novel library 위험</span>
              </div>
              <div style={insightBody}>
                2024 이후 릴리스된 lib에 대해 모델은 환각 가능성이 높다. 문서 스니펫을 RAG로 동봉할 것.
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Top 20 blind-spot files</span>
          <span style={mutedMono}>4-driver breakdown · hover for why</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, width: 28 }} />
            <span style={{ ...headCell, flex: 2 }}>file</span>
            <span style={{ ...headCell, width: 64 }}>score</span>
            <span style={{ ...headCell, flex: 1 }}>proprietary API</span>
            <span style={{ ...headCell, flex: 1 }}>novel lib</span>
            <span style={{ ...headCell, flex: 1 }}>internal DSL</span>
            <span style={{ ...headCell, flex: 1 }}>domain</span>
          </div>
          {data.rows.slice(0, 20).map((r, i) => (
            <button
              key={r.fileId}
              type="button"
              onClick={() => ctx.dispatch.selectEntity(r.fileId)}
              style={{
                ...fileRow,
                animationDelay: `${160 + Math.min(i, 20) * STAGGER_MS}ms`,
              }}
            >
              <span style={{ ...rowRank, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={rowName}>{r.fileName}</span>
                <span style={rowPath}>{r.entity.path}</span>
              </span>
              <span style={{ width: 64, display: "flex", justifyContent: "flex-end" }}>
                <ScorePill score={r.score} />
              </span>
              <DriverBar value={r.drivers.proprietaryApi} tint={color.danger} delay={i}
                title="독점 API — 공개 데이터에 없음" onHover={setHoveredDriver} id={`pa-${r.fileId}`} active={hoveredDriver === `pa-${r.fileId}`} />
              <DriverBar value={r.drivers.novelLibrary} tint={color.warn} delay={i + 2}
                title="최근 릴리스된 lib — 학습 컷오프 이후" onHover={setHoveredDriver} id={`nl-${r.fileId}`} active={hoveredDriver === `nl-${r.fileId}`} />
              <DriverBar value={r.drivers.internalDsl} tint={color.accent} delay={i + 4}
                title="내부 DSL — 외부 문서 없음" onHover={setHoveredDriver} id={`id-${r.fileId}`} active={hoveredDriver === `id-${r.fileId}`} />
              <DriverBar value={r.drivers.domainSpecific} tint={color.text1} delay={i + 6}
                title="도메인 특수 용어 / 비즈니스 규칙" onHover={setHoveredDriver} id={`ds-${r.fileId}`} active={hoveredDriver === `ds-${r.fileId}`} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScorePill({ score }: { score: number }): ReactElement {
  const tint = riskColor(score);
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        background: `color-mix(in srgb, ${tint} 18%, white)`,
        color: tint,
        padding: "2px 8px",
        borderRadius: radius.pill,
        minWidth: 46,
        textAlign: "center",
      }}
    >
      {(score * 100).toFixed(0)}
    </span>
  );
}

function DriverBar({
  value, tint, delay, title, onHover, id, active,
}: {
  value: number;
  tint: string;
  delay: number;
  title: string;
  onHover: (id: string | null) => void;
  id: string;
  active: boolean;
}): ReactElement {
  return (
    <span
      style={{ flex: 1, minWidth: 0 }}
      title={title}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
    >
      <span style={barBase}>
        <span
          style={{
            ...barFill,
            width: `${Math.max(3, value * 100)}%`,
            background: tint,
            animation: `bs-bar 540ms ${ENTRY_EASE} both`,
            animationDelay: `${180 + delay * 8}ms`,
            transformOrigin: "left center",
            opacity: active ? 1 : 0.9,
          }}
        />
      </span>
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
  animation: `bs-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const refStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const heroRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const heroTile: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minHeight: 108,
  animation: `bs-tile 460ms ${ENTRY_EASE} both`,
};

const heroLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroNum: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 32,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
  marginTop: 2,
};

const heroSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${PLOT_W + 32}px 1fr`,
  gap: space[4],
};

const scatterWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[1]}px`,
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const mutedMono: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const sidebar: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  minWidth: 240,
};

const sidebarHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const sidebarBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
};

const insightCard: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `bs-tile 440ms ${ENTRY_EASE} both`,
};

const insightHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const insightIcon: CSSProperties = {
  width: 20, height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.accent,
};

const insightTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.5,
};

const listSection: CSSProperties = {
  marginTop: space[5],
};

const listSectionHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const listHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
};

const headCell: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const fileRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `bs-row 440ms ${ENTRY_EASE} both`,
};

const rowRank: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barBase: CSSProperties = {
  display: "block",
  position: "relative",
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const barFill: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: radius.pill,
};

export const BlindSpotView = memo(BlindSpotViewImpl);
