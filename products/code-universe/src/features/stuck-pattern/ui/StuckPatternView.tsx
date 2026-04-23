// StuckPatternView — agent oscillation / repeat-error detection.
// --------------------------------------------------------------------
// Top: 4-kind counter — same-error / oscillation / tool-loop /
// assertion-thrash. Middle: ranked list of worst stuck sessions (task,
// pattern badge, repeat count, duration, last-action snippet, escape
// verdict chip). Bottom: pattern-distribution donut + escape-route pie
// so the reader sees how sessions historically ended. Right: mitigation
// card with a tool-loop-specific suggestion.
//
// Reference: Valmeekam "Can LLMs Really Plan?" 2024; Kapoor et al. "AI
// Agent Failure Modes" 2024; stuck-pattern detection as emerging
// agent-reliability research (2025-26).

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  stuckPatterns,
  type StuckSession,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes sp-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sp-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sp-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sp-donut { from { stroke-dasharray: 0 1000; } to { /* dasharray overridden per slice */ } }
`;

type Pattern = StuckSession["patternKind"];
type Escape = StuckSession["escapedBy"];

const PATTERN_LABEL: Record<Pattern, string> = {
  "same-error": "same-error",
  oscillation: "oscillation",
  "tool-loop": "tool-loop",
  "assertion-thrash": "assertion-thrash",
};

const PATTERN_COLOR: Record<Pattern, string> = {
  "same-error": color.danger,
  oscillation: color.warn,
  "tool-loop": color.accent,
  "assertion-thrash": "#7e4ed6",
};

const ESCAPE_COLOR: Record<Escape, string> = {
  "human-intervention": color.accent,
  timeout: color.warn,
  recovery: color.success,
  "still-stuck": color.danger,
};

const ESCAPE_LABEL: Record<Escape, string> = {
  "human-intervention": "human-intervention",
  timeout: "timeout",
  recovery: "recovery",
  "still-stuck": "still-stuck",
};

function fmtDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rs = sec % 60;
  return `${min}m${rs > 0 ? ` ${rs}s` : ""}`;
}

function StuckPatternViewImpl({ ctx }: Props): ReactElement | null {
  const [filter, setFilter] = useState<Pattern | "all">("all");

  const sessions = useMemo<StuckSession[] | null>(() => {
    if (!ctx.tree) return null;
    const s = stuckPatterns(ctx.tree);
    return s.length === 0 ? null : s;
  }, [ctx.tree]);

  const summary = useMemo(() => {
    if (!sessions) return null;
    const patternCount: Record<Pattern, number> = {
      "same-error": 0, oscillation: 0, "tool-loop": 0, "assertion-thrash": 0,
    };
    const escapeCount: Record<Escape, number> = {
      "human-intervention": 0, timeout: 0, recovery: 0, "still-stuck": 0,
    };
    for (const s of sessions) {
      patternCount[s.patternKind]++;
      escapeCount[s.escapedBy]++;
    }
    let worstPattern: Pattern = "same-error";
    let worstN = -1;
    for (const [k, v] of Object.entries(patternCount) as Array<[Pattern, number]>) {
      if (v > worstN) { worstN = v; worstPattern = k; }
    }
    return { patternCount, escapeCount, worstPattern, worstN };
  }, [sessions]);

  if (!sessions || !summary) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>Stuck session 기록이 없습니다.</div>
      </div>
    );
  }

  const filtered = filter === "all" ? sessions : sessions.filter(s => s.patternKind === filter);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Stuck Pattern ·{" "}
            <span style={{ color: color.danger, fontWeight: font.weight.semibold }}>
              agent isolation
            </span>
          </div>
          <div style={subtitleStyle}>
            4-pattern 분류 × repeat count × escape verdict · {sessions.length} sessions
          </div>
        </div>
        <div style={refStyle}>
          Valmeekam "Can LLMs Really Plan?" 2024 · Kapoor AI Agent Failure 2024
        </div>
      </header>

      {/* 4-kind counter */}
      <section style={counterRow}>
        {(Object.keys(PATTERN_LABEL) as Pattern[]).map((p, i) => {
          const active = filter === p;
          const count = summary.patternCount[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => setFilter(active ? "all" : p)}
              style={{
                ...counterTile,
                background: active ? color.accentSofter : color.bg1,
                borderColor: active ? color.accentBorder : color.border,
                animationDelay: `${i * STAGGER_MS}ms`,
              }}
            >
              <div style={counterLabel}>{PATTERN_LABEL[p]}</div>
              <div style={{ ...counterNum, color: PATTERN_COLOR[p] }}>{count}</div>
              <div style={counterSub}>
                {summary.worstPattern === p ? "most frequent" : "sessions"}
              </div>
            </button>
          );
        })}
      </section>

      {/* Session table + mitigation card */}
      <section style={bodyGrid}>
        <div style={tableWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Worst stuck sessions</span>
            <span style={mutedMono}>
              {filter === "all" ? `${filtered.length} sessions` : `filter: ${filter}`}
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  style={clearFilterBtn}
                >
                  clear
                </button>
              )}
            </span>
          </div>
          <div style={listStyle}>
            <div style={listHeader}>
              <span style={{ ...headCell, flex: 2 }}>task</span>
              <span style={{ ...headCell, width: 112 }}>pattern</span>
              <span style={{ ...headCell, width: 48, textAlign: "right" }}>repeat</span>
              <span style={{ ...headCell, width: 66, textAlign: "right" }}>duration</span>
              <span style={{ ...headCell, flex: 2 }}>last action</span>
              <span style={{ ...headCell, width: 140 }}>escape</span>
            </div>
            {filtered.slice(0, 14).map((s, i) => (
              <div
                key={s.id}
                style={{
                  ...fileRow,
                  animationDelay: `${160 + i * STAGGER_MS}ms`,
                }}
              >
                <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={rowName}>{s.taskLabel}</span>
                  <span style={rowPath}>{s.targetFileName}</span>
                </span>
                <span style={{ width: 112, display: "flex", justifyContent: "flex-start" }}>
                  <PatternPill pattern={s.patternKind} />
                </span>
                <span style={{ ...cellNum, width: 48 }}>{s.repeatCount}×</span>
                <span style={{ ...cellNum, width: 66 }}>{fmtDuration(s.durationMs)}</span>
                <span style={{ flex: 2, minWidth: 0 }}>
                  <span style={lastActionStyle} title={s.lastAction}>
                    {s.lastAction}
                  </span>
                </span>
                <span style={{ width: 140, display: "flex", justifyContent: "flex-end" }}>
                  <EscapePill escape={s.escapedBy} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Mitigation</span>
            <span style={mutedMono}>pattern-specific rules</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightIcon}>⊗</div>
              <div style={insightTitle}>
                tool-loop 빈도: {summary.patternCount["tool-loop"]}
              </div>
              <div style={insightBody}>
                system prompt에 "avoid alternating bash/read_file" 추가 고려.
                같은 툴을 3연속 호출하면 루프 가드 발동.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                <strong>same-error × {summary.patternCount["same-error"]}건</strong> — 동일
                에러 3회 이상 시 자동 human-intervention 요청.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                <strong>still-stuck {summary.escapeCount["still-stuck"]}건</strong> — 이 세션들은
                escape 실패. 자동 rollback + manual 재지시 필요.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                automated rule 제안: 5분 · 5회 repeat 초과 시 stop &amp; summarise.
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* Donut + pie */}
      <section style={chartsRow}>
        <div style={chartCard}>
          <div style={scatterHead}>
            <span style={sectionHead}>Pattern distribution</span>
            <span style={mutedMono}>{sessions.length} sessions</span>
          </div>
          <DonutChart
            data={Object.entries(summary.patternCount).map(([k, v]) => ({
              key: k,
              label: PATTERN_LABEL[k as Pattern],
              value: v,
              color: PATTERN_COLOR[k as Pattern],
            }))}
            total={sessions.length}
          />
        </div>
        <div style={chartCard}>
          <div style={scatterHead}>
            <span style={sectionHead}>Escape route</span>
            <span style={mutedMono}>how sessions ended</span>
          </div>
          <DonutChart
            data={Object.entries(summary.escapeCount).map(([k, v]) => ({
              key: k,
              label: ESCAPE_LABEL[k as Escape],
              value: v,
              color: ESCAPE_COLOR[k as Escape],
            }))}
            total={sessions.length}
            solid
          />
        </div>
      </section>
    </div>
  );
}

function PatternPill({ pattern }: { pattern: Pattern }): ReactElement {
  const tint = PATTERN_COLOR[pattern];
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
        minWidth: 98,
        textAlign: "center",
      }}
    >
      {PATTERN_LABEL[pattern]}
    </span>
  );
}

function EscapePill({ escape }: { escape: Escape }): ReactElement {
  const tint = ESCAPE_COLOR[escape];
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
        minWidth: 126,
        textAlign: "center",
      }}
    >
      {ESCAPE_LABEL[escape]}
    </span>
  );
}

function DonutChart({
  data, total, solid,
}: {
  data: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
  solid?: boolean;
}): ReactElement {
  const SIZE = 180;
  const R = SIZE / 2 - 8;
  const THICKNESS = solid ? R : 20;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const circumference = 2 * Math.PI * R;
  let cumul = 0;

  return (
    <div style={{ display: "flex", gap: space[4], alignItems: "center", padding: space[3] }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="distribution">
        {data.map((d, i) => {
          if (d.value === 0 || total === 0) return null;
          const frac = d.value / total;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const rot = (cumul / total) * 360 - 90;
          cumul += d.value;
          if (solid) {
            // Simulate a pie with a thick stroke by using R/2 center.
            const innerR = R / 2;
            return (
              <circle
                key={d.key}
                cx={cx} cy={cy} r={innerR}
                fill="none"
                stroke={d.color}
                strokeWidth={R}
                strokeDasharray={`${frac * (2 * Math.PI * innerR)} ${(2 * Math.PI * innerR) - frac * (2 * Math.PI * innerR)}`}
                transform={`rotate(${rot} ${cx} ${cy})`}
                style={{
                  animation: `sp-donut 720ms ${ENTRY_EASE} both`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            );
          }
          return (
            <circle
              key={d.key}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={d.color}
              strokeWidth={THICKNESS}
              strokeDasharray={`${dash} ${gap}`}
              transform={`rotate(${rot} ${cx} ${cy})`}
              strokeLinecap="butt"
              style={{
                animation: `sp-donut 720ms ${ENTRY_EASE} both`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          );
        })}
        {!solid && (
          <text
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={font.mono}
            fontSize={font.size.display}
            fontWeight={font.weight.bold}
            fill={color.text0}
          >
            {total}
          </text>
        )}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.map(d => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: radius.xs,
                background: d.color,
              }}
            />
            <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text1, minWidth: 128 }}>
              {d.label}
            </span>
            <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
              {d.value} ({total === 0 ? 0 : Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
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
  animation: `sp-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const counterRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const counterTile: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minHeight: 108,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  animation: `sp-tile 460ms ${ENTRY_EASE} both`,
  transition: `background ${transition.base}, border-color ${transition.base}`,
};

const counterLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const counterNum: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 32,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
  marginTop: 2,
};

const counterSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  gap: space[4],
  marginBottom: space[5],
};

const tableWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const clearFilterBtn: CSSProperties = {
  padding: `1px 6px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.bg2,
  color: color.text2,
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  cursor: "pointer",
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
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `sp-row 440ms ${ENTRY_EASE} both`,
};

const cellNum: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
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

const lastActionStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
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
  animation: `sp-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 3}ms`,
};

const insightCardMuted: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `sp-tile 440ms ${ENTRY_EASE} both`,
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

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

const insightSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.4,
};

const chartsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: space[4],
};

const chartCard: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

export const StuckPatternView = memo(StuckPatternViewImpl);
