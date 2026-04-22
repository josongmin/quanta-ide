// BlastRadiusAgentView — intended vs actual scope audit per task.
// --------------------------------------------------------------------
// Reference: Anthropic Computer Use guardrails (2024); OWASP
// LLM06:2025 (Excessive Agency); NIST AI RMF. For each of the 6 task
// types applied to the selected file, surface "did the agent stay in
// scope?". Produces a worst-offender callout, side-by-side
// intended/actual bars with overreach highlighted in danger tint, and
// a containment score (0..100 — lower overreach = higher score).

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  agentBlastRadius,
  type AgentBlast,
  type AITaskKind,
} from "../../../shared/analytics/synth-metrics";

export interface BlastRadiusAgentViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes brFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes brRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes brBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

/** rAF interpolated counter 0→target, ease-out cubic. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
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

function BlastRadiusAgentViewImpl({
  ctx,
  entity,
  empty,
}: BlastRadiusAgentViewProps): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rows = useMemo<AgentBlast[] | null>(() => {
    if (!entity || !ctx.tree) return null;
    return agentBlastRadius(entity, ctx.tree);
  }, [entity, ctx.tree]);

  const worst = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    let best: AgentBlast | null = null;
    for (const r of rows) {
      if (!best || r.overreachPct > best.overreachPct) best = r;
    }
    return best;
  }, [rows]);

  const containment = useMemo(() => {
    if (!rows || rows.length === 0) return 0;
    // Mean containment: 1 - clamp(overreach/max(intended,1)), averaged across tasks.
    let sum = 0;
    for (const r of rows) {
      const denom = Math.max(1, r.intendedFiles);
      const pen = Math.min(1, r.overreach / denom);
      sum += 1 - pen;
    }
    return Math.round((sum / rows.length) * 100);
  }, [rows]);

  const containmentAnim = useCounter(containment, COUNTER_MS);

  if (empty || !entity || !rows) {
    return (
      <div
        style={{
          width,
          height,
          background: color.bg0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          fontFamily: font.sans,
        }}
      >
        <style>{KEYFRAMES}</style>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>
          파일을 선택하세요.
        </div>
        <div style={{ fontSize: font.size.xs, color: color.text3 }}>
          의도된 scope 와 실제 편집된 파일 범위의 차이를 감사합니다.
        </div>
      </div>
    );
  }

  const maxFiles = Math.max(
    1,
    ...rows.map(r => Math.max(r.intendedFiles, r.actualFiles)),
  );

  const containmentColor =
    containment >= 85 ? color.success :
    containment >= 70 ? "#7db843" :
    containment >= 55 ? color.warn :
    containment >= 40 ? "#e06a21" : color.danger;

  return (
    <div
      style={{
        width,
        height,
        background: color.bg0,
        fontFamily: font.sans,
        color: color.text0,
        overflowY: "auto",
        boxSizing: "border-box",
        padding: `${space[5]}px ${space[6]}px`,
        animation: `brFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={{ marginBottom: space[4] }}>
        <div
          style={{
            fontSize: font.size.display,
            fontWeight: font.weight.semibold,
            letterSpacing: font.letter.tight,
          }}
        >
          Blast Radius (Agent)
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            marginTop: 2,
          }}
        >
          에이전트 scope 감사 — Anthropic Computer Use guardrails · OWASP LLM06:2025 · NIST AI RMF
        </div>
        <div
          style={{
            fontSize: font.size.xxs,
            color: color.text3,
            marginTop: 2,
            fontFamily: font.mono,
          }}
        >
          target: {entity.name}
        </div>
      </div>

      {/* Worst offender */}
      <div
        style={{
          ...panelStyle,
          background: worst && worst.overreach > 0 ? `${color.danger}0d` : color.bg1,
          border: `1px solid ${worst && worst.overreach > 0 ? color.danger + "40" : color.border}`,
          padding: `${space[4]}px ${space[5]}px`,
          animation: `brRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS}ms`,
        }}
      >
        <div style={panelLabelStyle}>Worst offender</div>
        {worst && worst.overreach > 0 ? (
          <div style={{ marginTop: space[2] }}>
            <div
              style={{
                fontSize: font.size.md,
                color: color.text0,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: color.danger }}>{TASK_KOREAN[worst.task]}</strong>
              {" "}— intended <span style={monoSpan}>{worst.intendedFiles}</span> files,
              actual <span style={monoSpan}>{worst.actualFiles}</span> files (+
              <span style={{ ...monoSpan, color: color.danger }}>
                {worst.overreach}
              </span>{" "}
              out of scope)
            </div>
            <div
              style={{
                marginTop: space[2],
                fontSize: font.size.xxs,
                color: color.text3,
                fontFamily: font.mono,
              }}
            >
              overreach {Math.round(worst.overreachPct * 100)}% · files:{" "}
              {worst.outOfScope.join(" · ") || "(none)"}
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: space[2],
              fontSize: font.size.md,
              color: color.success,
            }}
          >
            모든 태스크가 intended scope 내에서 종료되었습니다.
          </div>
        )}
      </div>

      {/* Side-by-side bar chart */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          animation: `brRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 2}ms`,
        }}
      >
        <div style={panelLabelStyle}>Intended vs actual — per task</div>
        <div
          style={{
            marginTop: space[3],
            display: "flex",
            flexDirection: "column",
            gap: space[3],
          }}
        >
          {rows.map((r, i) => {
            const intPct = (r.intendedFiles / maxFiles) * 100;
            const actPct = (r.actualFiles / maxFiles) * 100;
            const overreach = Math.max(0, r.actualFiles - r.intendedFiles);
            const overPct = (overreach / maxFiles) * 100;
            return (
              <div key={r.task}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: font.size.sm,
                      color: color.text0,
                      fontWeight: font.weight.medium,
                    }}
                  >
                    {TASK_KOREAN[r.task]}
                  </span>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: font.size.xxs,
                      color: r.overreach > 0 ? color.danger : color.text3,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {r.intendedFiles} → {r.actualFiles}
                    {r.overreach > 0 ? ` (+${r.overreach})` : ""}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: space[2],
                  }}
                >
                  {/* Left: intended */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row-reverse",
                      alignItems: "center",
                      gap: space[2],
                    }}
                  >
                    <span
                      style={{
                        width: "100%",
                        height: 10,
                        background: color.bg3,
                        borderRadius: radius.pill,
                        overflow: "hidden",
                        display: "block",
                        position: "relative",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          position: "absolute",
                          top: 0,
                          right: 0,
                          height: "100%",
                          width: `${Math.max(2, intPct)}%`,
                          background: color.accent,
                          opacity: 0.85,
                          transformOrigin: "100% 50%",
                          animation: `brBarGrow 540ms ${ENTRY_EASE} both`,
                          animationDelay: `${STAGGER_MS * 2 + i * 30}ms`,
                        }}
                      />
                    </span>
                    <span style={sideLabelStyle}>intended</span>
                  </div>
                  {/* Right: actual (with overreach highlight) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: space[2],
                    }}
                  >
                    <span
                      style={{
                        width: "100%",
                        height: 10,
                        background: color.bg3,
                        borderRadius: radius.pill,
                        overflow: "hidden",
                        display: "block",
                        position: "relative",
                      }}
                    >
                      {/* Base actual bar (kindStreet = green) */}
                      <span
                        style={{
                          display: "block",
                          position: "absolute",
                          top: 0,
                          left: 0,
                          height: "100%",
                          width: `${Math.max(2, actPct - overPct)}%`,
                          background: color.success,
                          opacity: 0.85,
                          transformOrigin: "0 50%",
                          animation: `brBarGrow 540ms ${ENTRY_EASE} both`,
                          animationDelay: `${STAGGER_MS * 2 + i * 30 + 40}ms`,
                        }}
                      />
                      {/* Overreach segment */}
                      {overreach > 0 && (
                        <span
                          style={{
                            display: "block",
                            position: "absolute",
                            top: 0,
                            left: `${actPct - overPct}%`,
                            height: "100%",
                            width: `${Math.max(2, overPct)}%`,
                            background: color.danger,
                            opacity: 0.9,
                            transformOrigin: "0 50%",
                            animation: `brBarGrow 540ms ${ENTRY_EASE} both`,
                            animationDelay: `${STAGGER_MS * 2 + i * 30 + 80}ms`,
                          }}
                        />
                      )}
                    </span>
                    <span style={sideLabelStyle}>actual</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: space[3],
            fontSize: font.size.xxs,
            color: color.text3,
            fontFamily: font.mono,
          }}
        >
          left (blue) = intended · right (green) = actual · red = out-of-scope overreach
        </div>
      </div>

      {/* Per-task out-of-scope list */}
      <div
        style={{
          ...panelStyle,
          padding: 0,
          overflow: "hidden",
          marginTop: space[3],
          animation: `brRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 3}ms`,
        }}
      >
        <div
          style={{
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${color.border}`,
            fontSize: font.size.xs,
            color: color.text2,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
            fontWeight: font.weight.semibold,
          }}
        >
          Out-of-scope files per task
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Task", "Intended", "Actual", "Overreach", "Out-of-scope files"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 || i === 4 ? "left" : "right",
                    padding: `${space[2]}px ${space[4]}px`,
                    fontSize: font.size.xxs,
                    color: color.text2,
                    fontWeight: font.weight.medium,
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                    borderBottom: `1px solid ${color.border}`,
                    background: color.bg2,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.task}
                style={{
                  animation: `brRowIn 420ms ${ENTRY_EASE} both`,
                  animationDelay: `${STAGGER_MS * 3 + i * 24}ms`,
                }}
              >
                <td
                  style={{
                    padding: `${space[2]}px ${space[4]}px`,
                    fontSize: font.size.sm,
                    color: color.text0,
                    fontWeight: font.weight.medium,
                    borderBottom: `1px solid ${color.border}`,
                  }}
                >
                  {TASK_KOREAN[r.task]}
                </td>
                <td style={cellNumStyle}>{r.intendedFiles}</td>
                <td style={cellNumStyle}>{r.actualFiles}</td>
                <td
                  style={{
                    ...cellNumStyle,
                    color: r.overreach > 0 ? color.danger : color.text3,
                    fontWeight: r.overreach > 0 ? font.weight.semibold : font.weight.regular,
                  }}
                >
                  {r.overreach > 0 ? `+${r.overreach}` : "0"}
                </td>
                <td
                  style={{
                    padding: `${space[2]}px ${space[4]}px`,
                    borderBottom: `1px solid ${color.border}`,
                    fontSize: font.size.xxs,
                    fontFamily: font.mono,
                    color: color.text2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 320,
                  }}
                  title={r.outOfScope.join(", ")}
                >
                  {r.outOfScope.length === 0 ? "—" : r.outOfScope.join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Containment score */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          padding: `${space[4]}px ${space[5]}px`,
          animation: `brRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 4}ms`,
        }}
      >
        <div style={panelLabelStyle}>Containment score — lower overreach = higher score</div>
        <div
          style={{
            marginTop: space[3],
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            alignItems: "center",
            gap: space[4],
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: font.mono,
                fontSize: 48,
                lineHeight: 1,
                fontWeight: font.weight.bold,
                color: containmentColor,
                letterSpacing: font.letter.tight,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {Math.round(containmentAnim)}
            </span>
            <span
              style={{
                fontSize: font.size.xs,
                color: color.text3,
                fontFamily: font.mono,
              }}
            >
              / 100
            </span>
          </div>
          <div
            style={{
              height: 12,
              background: color.bg3,
              borderRadius: radius.pill,
              overflow: "hidden",
              width: "100%",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                height: "100%",
                width: `${Math.max(2, Math.min(100, containment))}%`,
                background: containmentColor,
                transformOrigin: "0 50%",
                animation: `brBarGrow 820ms ${ENTRY_EASE} both`,
                animationDelay: `${STAGGER_MS * 4 + 80}ms`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: `${space[3]}px ${space[4]}px`,
  boxSizing: "border-box",
};

const panelLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  fontWeight: font.weight.semibold,
};

const cellNumStyle: CSSProperties = {
  padding: `${space[2]}px ${space[4]}px`,
  fontSize: font.size.sm,
  color: color.text1,
  borderBottom: `1px solid ${color.border}`,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  fontFamily: font.mono,
};

const monoSpan: CSSProperties = {
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
};

const sideLabelStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  minWidth: 52,
};

export const BlastRadiusAgentView = memo(BlastRadiusAgentViewImpl);
