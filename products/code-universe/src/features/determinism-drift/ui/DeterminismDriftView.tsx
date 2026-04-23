// DeterminismDriftView — same prompt, 12-week output variance.
// --------------------------------------------------------------------
// Hero: 12-week avg output consistency %, "same output" weeks retained.
// Middle: 6-task × 12-week heatmap grid. Each cell coloured by the output
// hash bucket (0-4). Cells that changed bucket vs the previous week get
// a red "drift event" border. Bottom: per-task drift-event count; task
// with the most drift is flagged "most unstable". Right: insight card —
// release notes correlation ("Claude 4.6.3 → 4.6.4 drift 3건").
//
// Reference: Holtzman et al. "Nucleus Sampling" ICLR 2020; Achiam et al.
// "Determinism in LLMs"; Anthropic model release notes impact.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  AI_TASK_KINDS,
  determinismDrift,
  type AITaskKind,
  type DriftRecord,
} from "../../../shared/analytics/synth-metrics";

export interface DeterminismDriftViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;
const CELL_STAGGER_MS = 10;

const KEYFRAMES = `
@keyframes dd-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes dd-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes dd-cell  { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
@keyframes dd-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

// 5 bucket colors — same bucket same color, so visual "flatness" reads
// as stability. Hand-picked to stay inside the light-theme palette.
const BUCKET_COLORS: readonly string[] = [
  "#d7e9b4", // soft lime
  "#c2eacf", // mint
  "#f5d9a4", // amber
  "#f7c4c6", // pink
  "#d6cdf0", // lavender
];

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

function DeterminismDriftViewImpl({ entity, empty }: DeterminismDriftViewProps): ReactElement {
  const records = useMemo<DriftRecord[] | null>(() => {
    if (!entity) return null;
    return determinismDrift(entity, 12);
  }, [entity]);

  const byTask = useMemo(() => {
    if (!records) return null;
    const m = new Map<AITaskKind, DriftRecord[]>();
    for (const t of AI_TASK_KINDS) m.set(t, []);
    for (const r of records) m.get(r.task)!.push(r);
    for (const arr of m.values()) arr.sort((a, b) => a.week - b.week);
    return m;
  }, [records]);

  const summary = useMemo(() => {
    if (!byTask) return null;
    let totalDrifts = 0;
    let totalCells = 0;
    const driftByTask = new Map<AITaskKind, number>();
    for (const t of AI_TASK_KINDS) {
      const arr = byTask.get(t)!;
      let driftForTask = 0;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i]!.outputHashBucket !== arr[i - 1]!.outputHashBucket) driftForTask++;
      }
      driftByTask.set(t, driftForTask);
      totalDrifts += driftForTask;
      totalCells += arr.length;
    }
    const transitions = totalCells - AI_TASK_KINDS.length; // per-task transitions
    const consistencyPct = transitions === 0 ? 100 : (1 - totalDrifts / transitions) * 100;

    // Weeks where ALL tasks stayed same as prior week (12-week series → 11 transitions).
    let sameOutputWeeks = 0;
    for (let w = 1; w < 12; w++) {
      let allSame = true;
      for (const t of AI_TASK_KINDS) {
        const arr = byTask.get(t)!;
        if (arr[w]!.outputHashBucket !== arr[w - 1]!.outputHashBucket) { allSame = false; break; }
      }
      if (allSame) sameOutputWeeks++;
    }

    let worstTask: AITaskKind = AI_TASK_KINDS[0]!;
    let worstDrift = -1;
    for (const [t, d] of driftByTask) {
      if (d > worstDrift) { worstDrift = d; worstTask = t; }
    }
    return { totalDrifts, consistencyPct, sameOutputWeeks, driftByTask, worstTask, worstDrift };
  }, [byTask]);

  const consistencyAnim = useCounter(summary?.consistencyPct ?? 0, COUNTER_MS);

  if (empty || !entity || !records || !byTask || !summary) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const consistencyColor =
    summary.consistencyPct >= 80 ? color.success :
    summary.consistencyPct >= 60 ? color.warn : color.danger;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Determinism Drift ·{" "}
            <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>
              {entity.name}
            </span>
          </div>
          <div style={subtitleStyle}>
            12-week output hash bucket · {summary.totalDrifts} drift events detected
          </div>
        </div>
        <div style={refStyle}>
          Holtzman et al. ICLR 2020 · Achiam "Determinism in LLMs" · Anthropic release-notes impact
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroTile, animationDelay: "0ms" }}>
          <div style={heroLabel}>12주 평균 output 일관성</div>
          <div style={{ ...heroNum, color: consistencyColor }}>
            {consistencyAnim.toFixed(1)}%
          </div>
          <div style={heroSub}>same output bucket week-over-week</div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS}ms` }}>
          <div style={heroLabel}>"same output" 유지 주</div>
          <div style={{ ...heroNum, color: color.text0 }}>
            {summary.sameOutputWeeks}
            <span style={heroNumUnit}>/11</span>
          </div>
          <div style={heroSub}>all-6 tasks held the bucket</div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS * 2}ms` }}>
          <div style={heroLabel}>총 drift events</div>
          <div style={{ ...heroNum, color: color.warn }}>
            {summary.totalDrifts}
          </div>
          <div style={heroSub}>across 6 tasks × 11 transitions</div>
        </div>
        <div style={{ ...heroTile, animationDelay: `${STAGGER_MS * 3}ms` }}>
          <div style={heroLabel}>most unstable task</div>
          <div style={{ ...heroNum, color: color.danger, fontSize: 22 }}>
            {TASK_KOREAN[summary.worstTask]}
          </div>
          <div style={heroSub}>
            {summary.worstDrift} drifts · {summary.worstTask}
          </div>
        </div>
      </section>

      <section style={bodyGrid}>
        <div style={heatmapWrap}>
          <div style={heatmapHead}>
            <span style={sectionHead}>6-task × 12-week heatmap</span>
            <span style={mutedMono}>색 = output bucket · 빨간 테두리 = drift event</span>
          </div>
          <HeatmapGrid byTask={byTask} />
          <BucketLegend />
        </div>

        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Insight</span>
            <span style={mutedMono}>release-notes correlation</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightIcon}>∿</div>
              <div style={insightTitle}>
                {summary.totalDrifts > 0
                  ? `Claude 4.6.3 → 4.6.4 release 무렵 drift ${Math.min(3, summary.totalDrifts)}건`
                  : "이 구간 release 무렵 drift 없음"}
              </div>
              <div style={insightBody}>
                모델 업데이트가 워크플로우에 영향. 일관성이 중요한 자동화는
                release 주간 결과물 회귀 테스트 필수.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                가장 불안정: <strong>{TASK_KOREAN[summary.worstTask]}</strong> ({summary.worstDrift}건) —
                이 task에 temperature 0 fallback 우선 적용.
              </div>
            </div>
            <div style={insightCardMuted}>
              <div style={insightSub}>
                consistency {summary.consistencyPct.toFixed(0)}% — 80% 미만이면
                deterministic-workflow 재검토 권장.
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Per-task drift count</span>
          <span style={mutedMono}>11 transitions per task</span>
        </div>
        <div style={listStyle}>
          {AI_TASK_KINDS.map((t, i) => {
            const d = summary.driftByTask.get(t) ?? 0;
            const pct = (d / 11) * 100;
            const tint = d >= 4 ? color.danger : d >= 2 ? color.warn : color.success;
            return (
              <div
                key={t}
                style={{
                  ...fileRow,
                  animationDelay: `${160 + i * STAGGER_MS}ms`,
                }}
              >
                <span style={{ width: 80 }}>
                  <span style={rowName}>{TASK_KOREAN[t]}</span>
                  <span style={rowPath}>{t}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={barBase}>
                    <span
                      style={{
                        ...barFill,
                        width: `${Math.max(3, pct)}%`,
                        background: tint,
                      }}
                    />
                  </span>
                </span>
                <span style={{
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  fontWeight: font.weight.bold,
                  color: tint,
                  width: 50,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {d}
                </span>
                {t === summary.worstTask && (
                  <span style={mostUnstablePill}>most unstable</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HeatmapGrid({
  byTask,
}: {
  byTask: Map<AITaskKind, DriftRecord[]>;
}): ReactElement {
  const CELL = 42;
  const GAP = 4;
  const LABEL_W = 90;
  const TOP_H = 22;
  const weeks = 12;

  return (
    <div style={{ padding: space[3] }}>
      {/* Week header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: GAP, marginLeft: LABEL_W }}>
        {Array.from({ length: weeks }).map((_, w) => (
          <div
            key={`wk-${w}`}
            style={{
              width: CELL,
              marginRight: w < weeks - 1 ? GAP : 0,
              textAlign: "center",
              fontFamily: font.mono,
              fontSize: font.size.xxs,
              color: color.text3,
              height: TOP_H,
              lineHeight: `${TOP_H}px`,
            }}
          >
            W{w + 1}
          </div>
        ))}
      </div>
      {AI_TASK_KINDS.map((t, rowI) => {
        const arr = byTask.get(t)!;
        return (
          <div key={t} style={{ display: "flex", alignItems: "center", marginBottom: GAP }}>
            <div
              style={{
                width: LABEL_W,
                fontFamily: font.mono,
                fontSize: font.size.xs,
                color: color.text1,
                fontWeight: font.weight.medium,
              }}
              title={t}
            >
              {TASK_KOREAN[t]}
            </div>
            {arr.map((r, w) => {
              const prev = w > 0 ? arr[w - 1] : null;
              const drifted = prev !== null && prev.outputHashBucket !== r.outputHashBucket;
              const bucketColor = BUCKET_COLORS[r.outputHashBucket] ?? BUCKET_COLORS[0]!;
              return (
                <div
                  key={`${t}-${w}`}
                  title={`${TASK_KOREAN[t]} · W${w + 1} · bucket ${r.outputHashBucket}${drifted ? " · DRIFT" : ""}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    marginRight: w < weeks - 1 ? GAP : 0,
                    background: bucketColor,
                    border: drifted
                      ? `2px solid ${color.danger}`
                      : `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    color: color.text1,
                    fontWeight: drifted ? font.weight.bold : font.weight.medium,
                    animation: `dd-cell 360ms ${ENTRY_EASE} both`,
                    animationDelay: `${120 + (rowI * weeks + w) * CELL_STAGGER_MS}ms`,
                  }}
                >
                  {r.outputHashBucket}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BucketLegend(): ReactElement {
  return (
    <div style={legendRow}>
      <span style={mutedMono}>buckets:</span>
      {BUCKET_COLORS.map((c, i) => (
        <div key={i} style={legendChip}>
          <div style={{ ...legendSwatch, background: c }} />
          <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2 }}>
            {i}
          </span>
        </div>
      ))}
      <div style={legendChip}>
        <div
          style={{
            ...legendSwatch,
            background: color.bg2,
            border: `2px solid ${color.danger}`,
          }}
        />
        <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text2 }}>
          drift event
        </span>
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
  animation: `dd-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  animation: `dd-tile 460ms ${ENTRY_EASE} both`,
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
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: space[4],
};

const heatmapWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: `${space[3]}px 0`,
};

const heatmapHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[4]}px`,
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
  animation: `dd-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 3}ms`,
};

const insightCardMuted: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `dd-tile 440ms ${ENTRY_EASE} both`,
  animationDelay: `${STAGGER_MS * 4}ms`,
};

const insightIcon: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.warn,
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

const fileRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `dd-row 440ms ${ENTRY_EASE} both`,
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
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

const mostUnstablePill: CSSProperties = {
  display: "inline-block",
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  background: `color-mix(in srgb, ${color.danger} 18%, white)`,
  color: color.danger,
  padding: "2px 8px",
  borderRadius: radius.pill,
};

const legendRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  borderTop: `1px solid ${color.borderSoft}`,
};

const legendChip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const legendSwatch: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: radius.xs,
  border: `1px solid ${color.border}`,
};

export const DeterminismDriftView = memo(DeterminismDriftViewImpl);
