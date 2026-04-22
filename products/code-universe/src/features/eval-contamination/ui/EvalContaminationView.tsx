// EvalContaminationView — training-data overlap audit.
// --------------------------------------------------------------------
// Hero: estimated training-data overlap %, plus 3 verdict buckets
// (likely-seen / possibly-seen / unseen). Middle: scatter — X = age,
// Y = star count (log), bubble = risk. Danger zone = top-right (old +
// popular). Bottom: ranked list with 4-signal breakdown bars per file.
// Right: insight card — benchmarks overestimate real deployment perf.
//
// Reference: Magar & Schwartz "Data Contamination" EMNLP 2022; Dodge
// et al. "Documenting Large Webtext Corpora" EMNLP 2021; Balloccu et al.
// "Leak, Cheat, Repeat" 2024.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  contaminationAudit,
  type ContaminationRecord,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes ec-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes ec-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ec-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ec-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes ec-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
`;

const PLOT_W = 560;
const PLOT_H = 360;
const PLOT_PAD_L = 56;
const PLOT_PAD_R = 18;
const PLOT_PAD_T = 22;
const PLOT_PAD_B = 44;

function verdictColor(v: ContaminationRecord["verdict"]): string {
  if (v === "likely-seen") return color.danger;
  if (v === "possibly-seen") return color.warn;
  return color.success;
}

function verdictLabel(v: ContaminationRecord["verdict"]): string {
  if (v === "likely-seen") return "likely-seen";
  if (v === "possibly-seen") return "possibly-seen";
  return "unseen";
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

function EvalContaminationViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const records = useMemo<ContaminationRecord[] | null>(() => {
    if (!ctx.tree) return null;
    const r = contaminationAudit(ctx.tree);
    return r.length === 0 ? null : r;
  }, [ctx.tree]);

  const stats = useMemo(() => {
    if (!records) return null;
    const likely = records.filter(r => r.verdict === "likely-seen").length;
    const possibly = records.filter(r => r.verdict === "possibly-seen").length;
    const unseen = records.filter(r => r.verdict === "unseen").length;
    const overlap = records.reduce((s, r) => s + r.risk, 0) / records.length;
    const maxStars = Math.max(1, ...records.map(r => r.signals.starCount));
    const maxAge = Math.max(1, ...records.map(r => r.signals.ageYears));
    return { likely, possibly, unseen, overlap, maxStars, maxAge };
  }, [records]);

  const overlapAnim = useCounter(stats ? stats.overlap * 100 : 0, COUNTER_MS);

  if (!records || !stats) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>Contamination 감사를 수행할 파일이 없습니다.</div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Eval Contamination ·{" "}
            <span style={{ color: color.danger, fontWeight: font.weight.semibold }}>
              training-data overlap
            </span>
          </div>
          <div style={subtitleStyle}>
            public repo × star × age × pattern popularity · {records.length.toLocaleString()}개 파일
          </div>
        </div>
        <div style={refStyle}>
          Magar &amp; Schwartz (EMNLP 2022) · Dodge et al. (EMNLP 2021) · Balloccu et al. 2024
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroTile, animationDelay: "0ms" }}>
          <div style={heroLabel}>Estimated overlap</div>
          <div style={{ ...heroNum, color: color.danger }}>
            {overlapAnim.toFixed(1)}%
          </div>
          <div style={heroSub}>repo-wide training-data exposure</div>
        </div>
        <BucketTile
          index={1}
          count={stats.likely}
          total={records.length}
          label="likely-seen"
          tint={color.danger}
          sub="model은 memorize 가능성 높음"
        />
        <BucketTile
          index={2}
          count={stats.possibly}
          total={records.length}
          label="possibly-seen"
          tint={color.warn}
          sub="공개 or 대중 패턴 부분적"
        />
        <BucketTile
          index={3}
          count={stats.unseen}
          total={records.length}
          label="unseen"
          tint={color.success}
          sub="private + 독자 패턴"
        />
      </section>

      <section style={bodyGrid}>
        <div style={scatterWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Scatter · age × star count</span>
            <span style={mutedMono}>bubble size = risk</span>
          </div>
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            role="img"
            aria-label="Contamination scatter"
            style={{ display: "block" }}
          >
            <rect
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.5}
              y={PLOT_PAD_T}
              width={(PLOT_W - PLOT_PAD_L - PLOT_PAD_R) * 0.5}
              height={(PLOT_H - PLOT_PAD_T - PLOT_PAD_B) * 0.5}
              fill={color.danger}
              opacity={0.08}
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
              contamination 고위험 지대
            </text>

            {[0.25, 0.5, 0.75].map(t => {
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              return (
                <g key={`grid-${t}`}>
                  <line
                    x1={PLOT_PAD_L} y1={y}
                    x2={PLOT_W - PLOT_PAD_R} y2={y}
                    stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.55}
                  />
                  <line
                    x1={x} y1={PLOT_PAD_T}
                    x2={x} y2={PLOT_H - PLOT_PAD_B}
                    stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.55}
                  />
                </g>
              );
            })}

            <rect
              x={PLOT_PAD_L} y={PLOT_PAD_T}
              width={PLOT_W - PLOT_PAD_L - PLOT_PAD_R}
              height={PLOT_H - PLOT_PAD_T - PLOT_PAD_B}
              fill="none"
              stroke={color.border}
            />

            {[0, 0.25, 0.5, 0.75, 1].map(t => {
              const x = PLOT_PAD_L + t * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - t) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const ageLabel = Math.round(t * stats.maxAge);
              const starLog = t === 0 ? 0 : Math.pow(10, t * Math.log10(Math.max(10, stats.maxStars)));
              const starLabel = starLog >= 1000 ? `${Math.round(starLog / 1000)}k` : Math.round(starLog).toString();
              return (
                <g key={`tick-${t}`}>
                  <text
                    x={x}
                    y={PLOT_H - PLOT_PAD_B + 14}
                    textAnchor="middle"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {ageLabel}y
                  </text>
                  <text
                    x={PLOT_PAD_L - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fill={color.text2}
                  >
                    {starLabel}
                  </text>
                </g>
              );
            })}

            <text
              x={PLOT_PAD_L + (PLOT_W - PLOT_PAD_L - PLOT_PAD_R) / 2}
              y={PLOT_H - 6}
              textAnchor="middle"
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fill={color.text1}
              fontWeight={font.weight.medium}
            >
              age (years) →
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
              star count (log) →
            </text>

            {records.map((r, i) => {
              const xNorm = Math.min(1, r.signals.ageYears / Math.max(1, stats.maxAge));
              const starNorm = r.signals.starCount > 0
                ? Math.log10(Math.max(10, r.signals.starCount)) / Math.log10(Math.max(10, stats.maxStars))
                : 0;
              const x = PLOT_PAD_L + xNorm * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - starNorm) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const bubble = 3 + r.risk * 10;
              const isHovered = hoveredId === r.fileId;
              const opacity =
                hoveredId !== null && !isHovered ? 0.16 : isHovered ? 1 : 0.72;
              return (
                <g
                  key={r.fileId}
                  style={{
                    cursor: "pointer",
                    animation: `ec-dot ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${Math.min(i * 4, 600)}ms`,
                  }}
                  onMouseEnter={() => setHoveredId(r.fileId)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(r.fileId)}
                >
                  <circle
                    cx={x} cy={y} r={bubble}
                    fill={verdictColor(r.verdict)}
                    opacity={opacity}
                    stroke={isHovered ? color.text0 : "none"}
                    strokeWidth={isHovered ? 1.2 : 0}
                  />
                </g>
              );
            })}

            {hoveredId !== null && (() => {
              const r = records.find(x => x.fileId === hoveredId);
              if (!r) return null;
              const xNorm = Math.min(1, r.signals.ageYears / Math.max(1, stats.maxAge));
              const starNorm = r.signals.starCount > 0
                ? Math.log10(Math.max(10, r.signals.starCount)) / Math.log10(Math.max(10, stats.maxStars))
                : 0;
              const x = PLOT_PAD_L + xNorm * (PLOT_W - PLOT_PAD_L - PLOT_PAD_R);
              const y = PLOT_PAD_T + (1 - starNorm) * (PLOT_H - PLOT_PAD_T - PLOT_PAD_B);
              const boxW = 220, boxH = 64;
              const bx = Math.min(PLOT_W - boxW - 4, Math.max(4, x + 12));
              const by = Math.min(PLOT_H - boxH - 4, Math.max(4, y - boxH / 2));
              return (
                <g pointerEvents="none">
                  <rect
                    x={bx} y={by} width={boxW} height={boxH}
                    rx={radius.md} ry={radius.md}
                    fill={color.bg1}
                    stroke={color.border}
                  />
                  <text
                    x={bx + 10} y={by + 18}
                    fill={color.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.semibold}
                  >
                    {r.fileName}
                  </text>
                  <text
                    x={bx + 10} y={by + 34}
                    fill={verdictColor(r.verdict)}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fontWeight={font.weight.semibold}
                  >
                    risk {(r.risk * 100).toFixed(0)}% · {verdictLabel(r.verdict)}
                  </text>
                  <text
                    x={bx + 10} y={by + 50}
                    fill={color.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    {r.signals.ageYears}y · {r.signals.starCount.toLocaleString()}★
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>

        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Insight</span>
            <span style={mutedMono}>benchmark caveat</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightIcon}>◈</div>
              <div style={insightTitle}>
                likely-seen: {stats.likely} 파일
              </div>
              <div style={insightBody}>
                모델이 memorize 했을 수 있음 → 평가 시 과대평가 주의.
                실제 배포 성능 ≠ benchmark.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                overlap이 40% 이상이라면 이 repo 기반 평가는 deployment proxy로
                사용하지 말 것.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                최고 위험 신호: 오래된 public repo + 인기 패턴. 최근 작성된
                private logic은 unseen으로 분류됨.
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Top 20 contamination risk</span>
          <span style={mutedMono}>4-signal breakdown · click to select</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, width: 28 }} />
            <span style={{ ...headCell, flex: 2 }}>file</span>
            <span style={{ ...headCell, width: 96 }}>verdict</span>
            <span style={{ ...headCell, flex: 1 }}>publicRepo</span>
            <span style={{ ...headCell, flex: 1 }}>starCount</span>
            <span style={{ ...headCell, flex: 1 }}>ageYears</span>
            <span style={{ ...headCell, flex: 1 }}>popPattern</span>
          </div>
          {records.slice(0, 20).map((r, i) => (
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
                <span style={rowPath}>{(r.risk * 100).toFixed(0)}% risk</span>
              </span>
              <span style={{ width: 96, display: "flex", justifyContent: "flex-end" }}>
                <VerdictPill verdict={r.verdict} />
              </span>
              <SignalBar value={r.signals.publicRepo} tint={color.danger} delay={i} />
              <SignalBar
                value={Math.min(1, r.signals.starCount / Math.max(1, stats.maxStars))}
                tint={color.warn}
                delay={i + 2}
              />
              <SignalBar
                value={Math.min(1, r.signals.ageYears / Math.max(1, stats.maxAge))}
                tint={color.accent}
                delay={i + 4}
              />
              <SignalBar value={r.signals.popularPattern} tint={color.text1} delay={i + 6} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function BucketTile({
  index, count, total, label, tint, sub,
}: {
  index: number;
  count: number;
  total: number;
  label: string;
  tint: string;
  sub: string;
}): ReactElement {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <div style={{ ...heroTile, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={heroLabel}>{label}</div>
      <div style={{ ...heroNum, color: tint }}>
        {count}
        <span style={heroNumUnit}>/{total}</span>
      </div>
      <div style={heroSub} title={sub}>
        {pct.toFixed(0)}% · {sub}
      </div>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: ContaminationRecord["verdict"] }): ReactElement {
  const tint = verdictColor(verdict);
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
        minWidth: 82,
        textAlign: "center",
      }}
    >
      {verdictLabel(verdict)}
    </span>
  );
}

function SignalBar({
  value, tint, delay,
}: {
  value: number;
  tint: string;
  delay: number;
}): ReactElement {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={barBase}>
        <span
          style={{
            ...barFill,
            width: `${Math.max(3, Math.min(1, value) * 100)}%`,
            background: tint,
            animation: `ec-bar 480ms ${ENTRY_EASE} both`,
            animationDelay: `${180 + delay * 8}ms`,
            transformOrigin: "left center",
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
  animation: `ec-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  animation: `ec-tile 460ms ${ENTRY_EASE} both`,
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

const heroNumUnit: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text3,
  marginLeft: 4,
  fontWeight: font.weight.medium,
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
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `ec-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 3}ms`,
};

const insightCardMuted: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `ec-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 4}ms`,
};

const insightIcon: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.danger,
  marginBottom: 2,
};

const insightTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
  marginTop: 2,
};

const insightSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
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
  animation: `ec-row 440ms ${ENTRY_EASE} both`,
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

export const EvalContaminationView = memo(EvalContaminationViewImpl);
