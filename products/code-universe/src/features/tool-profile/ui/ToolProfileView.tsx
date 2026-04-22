// ToolProfileView — per-file tool-use analytics dashboard.
// --------------------------------------------------------------------
// Reference: OpenAI Function Calling observability; Anthropic Claude
// Code telemetry; tool-use audit patterns (2024-2025). Aggregates all
// AgentStep.toolName entries across 6 task simulations for the
// currently-selected file, then renders:
//   ▸ Hero summary — total calls · total tokens · avg latency
//   ▸ Three horizontal stacked bars (one sized by calls, one by tokens,
//     one by latency) — same segment order, so the viewer compares a
//     single tool's share across different lenses.
//   ▸ Ranked table — tool · calls · avg latency · input tokens · output tokens.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  toolUseProfile,
  type ToolUseBucket,
} from "../../../shared/analytics/synth-metrics";

export interface ToolProfileViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes tpFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes tpRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes tpBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

// A small deterministic palette for tool segments — reused across the
// three stacked bars and the table legend so the viewer always tracks
// the same tool by color.
const PALETTE: readonly string[] = [
  "#0d99ff",
  "#22a06b",
  "#e09321",
  "#9e77ff",
  "#e5484d",
  "#2aa7a0",
  "#f76b15",
  "#8c9bab",
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

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

function ToolProfileViewImpl({
  ctx,
  entity,
  empty,
}: ToolProfileViewProps): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const buckets = useMemo<ToolUseBucket[] | null>(() => {
    if (!entity) return null;
    return toolUseProfile(entity);
  }, [entity]);

  const summary = useMemo(() => {
    if (!buckets) return null;
    let totalCalls = 0;
    let totalTokens = 0;
    let weightedLatency = 0;
    for (const b of buckets) {
      totalCalls += b.calls;
      totalTokens += b.totalTokensIn + b.totalTokensOut;
      weightedLatency += b.avgLatencyMs * b.calls;
    }
    const avgLatency = totalCalls > 0 ? weightedLatency / totalCalls : 0;
    return { totalCalls, totalTokens, avgLatency };
  }, [buckets]);

  const callsAnim = useCounter(summary?.totalCalls ?? 0, COUNTER_MS);
  const tokensAnim = useCounter(summary?.totalTokens ?? 0, COUNTER_MS);
  const latencyAnim = useCounter(summary?.avgLatency ?? 0, COUNTER_MS);

  if (empty || !entity || !buckets || !summary || buckets.length === 0) {
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
          에이전트가 해당 파일 작업 시 사용한 tool 분포를 집계합니다.
        </div>
      </div>
    );
  }

  // Assign colors in call-count order for stable identity across bars.
  const colored = buckets.map((b, i) => ({
    ...b,
    color: PALETTE[i % PALETTE.length]!,
  }));

  const totalCalls = summary.totalCalls;
  const totalTokens = summary.totalTokens;
  const totalLatencyUnits = colored.reduce(
    (acc, b) => acc + b.avgLatencyMs * b.calls,
    0,
  );

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
        animation: `tpFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
          Tool Profile
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            marginTop: 2,
          }}
        >
          도구 사용 프로파일 — OpenAI Function Calling · Anthropic Claude Code telemetry 2024-2025
        </div>
        <div
          style={{
            fontSize: font.size.xxs,
            color: color.text3,
            marginTop: 2,
            fontFamily: font.mono,
          }}
        >
          target: {entity.name} · 6 tasks aggregated
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          ...panelStyle,
          padding: `${space[4]}px ${space[5]}px`,
          animation: `tpRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS}ms`,
        }}
      >
        <div
          style={{
            fontSize: font.size.xxs,
            color: color.text2,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
            fontWeight: font.weight.medium,
          }}
        >
          Tool-use summary
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: space[4],
            marginTop: space[3],
            alignItems: "baseline",
          }}
        >
          <HeroCell
            label="Total calls"
            value={`${Math.round(callsAnim)}`}
            accent={color.accent}
          />
          <HeroCell label="Total tokens" value={fmtTokens(Math.round(tokensAnim))} />
          <HeroCell label="Avg latency" value={fmtDuration(latencyAnim)} />
        </div>
      </div>

      {/* Three stacked bars */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          animation: `tpRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 2}ms`,
        }}
      >
        <div style={panelLabelStyle}>Distribution — tools by metric</div>
        <div
          style={{
            marginTop: space[3],
            display: "flex",
            flexDirection: "column",
            gap: space[3],
          }}
        >
          <StackedBar
            label="by calls"
            items={colored.map(b => ({
              key: b.tool,
              color: b.color,
              value: b.calls,
              title: `${b.tool} · ${b.calls} calls`,
            }))}
            total={totalCalls}
            delay={STAGGER_MS * 2 + 40}
          />
          <StackedBar
            label="by tokens"
            items={colored.map(b => ({
              key: b.tool,
              color: b.color,
              value: b.totalTokensIn + b.totalTokensOut,
              title: `${b.tool} · ${fmtTokens(b.totalTokensIn + b.totalTokensOut)} tok`,
            }))}
            total={totalTokens}
            delay={STAGGER_MS * 2 + 80}
          />
          <StackedBar
            label="by latency"
            items={colored.map(b => ({
              key: b.tool,
              color: b.color,
              value: b.avgLatencyMs * b.calls,
              title: `${b.tool} · ${fmtDuration(b.avgLatencyMs)} avg`,
            }))}
            total={totalLatencyUnits}
            delay={STAGGER_MS * 2 + 120}
          />
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: space[3],
            marginTop: space[3],
            paddingTop: space[3],
            borderTop: `1px solid ${color.border}`,
          }}
        >
          {colored.map(b => (
            <span
              key={b.tool}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: space[1],
                fontSize: font.size.xxs,
                color: color.text1,
                fontFamily: font.mono,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: b.color,
                }}
              />
              {b.tool}
            </span>
          ))}
        </div>
      </div>

      {/* Ranked table */}
      <div
        style={{
          ...panelStyle,
          padding: 0,
          overflow: "hidden",
          marginTop: space[3],
          animation: `tpRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
          Ranked tools
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: font.mono,
          }}
        >
          <thead>
            <tr>
              {["Tool", "Calls", "Avg latency", "Tokens in", "Tokens out"].map(
                (h, i) => (
                  <th
                    key={h}
                    style={{
                      textAlign: i === 0 ? "left" : "right",
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
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {colored.map((b, i) => (
              <tr
                key={b.tool}
                style={{
                  animation: `tpRowIn 420ms ${ENTRY_EASE} both`,
                  animationDelay: `${STAGGER_MS * 3 + i * 22}ms`,
                }}
              >
                <td
                  style={{
                    padding: `${space[2]}px ${space[4]}px`,
                    fontSize: font.size.sm,
                    color: color.text0,
                    fontWeight: font.weight.medium,
                    borderBottom: `1px solid ${color.border}`,
                    fontFamily: font.sans,
                    display: "flex",
                    alignItems: "center",
                    gap: space[2],
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: b.color,
                      flexShrink: 0,
                    }}
                  />
                  {b.tool}
                </td>
                <td style={cellNumStyle}>{b.calls}</td>
                <td style={cellNumStyle}>{fmtDuration(b.avgLatencyMs)}</td>
                <td style={cellNumStyle}>{fmtTokens(b.totalTokensIn)}</td>
                <td style={cellNumStyle}>{fmtTokens(b.totalTokensOut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

function HeroCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
      <div
        style={{
          fontSize: font.size.xxs,
          color: color.text2,
          textTransform: "uppercase",
          letterSpacing: font.letter.ultra,
          fontWeight: font.weight.medium,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: 36,
          lineHeight: 1,
          fontWeight: font.weight.bold,
          color: accent ?? color.text0,
          letterSpacing: font.letter.tight,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StackedBar({
  label,
  items,
  total,
  delay,
}: {
  label: string;
  items: ReadonlyArray<{ key: string; color: string; value: number; title: string }>;
  total: number;
  delay: number;
}): ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "96px 1fr",
        alignItems: "center",
        gap: space[3],
      }}
    >
      <span
        style={{
          fontSize: font.size.xxs,
          color: color.text2,
          textTransform: "uppercase",
          letterSpacing: font.letter.ultra,
          fontWeight: font.weight.medium,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          height: 14,
          width: "100%",
          background: color.bg3,
          borderRadius: radius.pill,
          overflow: "hidden",
        }}
      >
        {items.map((it, i) => {
          const pct = total > 0 ? (it.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <span
              key={it.key}
              title={it.title}
              style={{
                display: "block",
                height: "100%",
                width: `${pct}%`,
                background: it.color,
                transformOrigin: "0 50%",
                animation: `tpBarGrow 540ms ${ENTRY_EASE} both`,
                animationDelay: `${delay + i * 20}ms`,
              }}
            />
          );
        })}
      </span>
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
};

export const ToolProfileView = memo(ToolProfileViewImpl);
