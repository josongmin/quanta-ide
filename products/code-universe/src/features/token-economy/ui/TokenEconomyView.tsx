// TokenEconomyView — repo-wide LLM token economy dashboard.
// --------------------------------------------------------------------
// Hero row (4 stats): total repo tokens / avg tokens-per-file / most
// expensive file / AI-friendly share. Task-cost matrix (6 tasks × 5
// models) showing USD for a representative task on the anchor file.
// Top-20 expensive files ranked by token count with an inline "cost to
// explain" bar; click pivots selection through the usual dispatch.
//
// References:
//   - OpenAI tiktoken — char-to-token heuristic
//   - Anthropic Claude tokenizer — 3.7-3.9 chars/token for code
//   - 2026 model pricing sheets (Sonnet 4.6 / Opus 4.7 / GPT-5 /
//     GPT-5-mini / Gemini 2.5 Pro)
// "Token economics as a first-class software metric" — novel 2026 POV.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  aiFriendliness,
  AI_PRICING,
  AI_TASK_KINDS,
  computeCost,
  estimateTaskCost,
  fileTokens,
  type AIModel,
  type AITaskKind,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;
const BAR_MS = 480;

const KEYFRAMES = `
@keyframes te-enter  { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes te-tile   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes te-row    { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes te-bar    { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

const MODELS: readonly AIModel[] = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "gpt-5",
  "gpt-5-mini",
  "gemini-2.5-pro",
];

const MODEL_LABEL: Record<AIModel, string> = {
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-7":   "Opus 4.7",
  "gpt-5":             "GPT-5",
  "gpt-5-mini":        "GPT-5 mini",
  "gemini-2.5-pro":    "Gemini 2.5",
};

const TASK_LABEL_KO: Record<AITaskKind, string> = {
  explain:       "설명",
  "fix-bug":     "버그 수정",
  "add-feature": "기능 추가",
  refactor:      "리팩터",
  test:          "테스트 작성",
  review:        "코드 리뷰",
};

// ── Number formatting helpers ─────────────────────────────────────────
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

/** rAF counter 0 → target, ease-out cubic. */
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

interface Aggregate {
  files: Entity[];
  totalTokens: number;
  avgTokens: number;
  worst: { entity: Entity; tokens: number };
  friendlyPct: number;
  anchor: Entity;
  topFiles: Array<{ entity: Entity; tokens: number }>;
}

function aggregate(ctx: ViewContextValue): Aggregate | null {
  if (!ctx.tree) return null;
  const files: Entity[] = [];
  let totalTokens = 0;
  let friendly = 0;
  let worstTokens = -1;
  let worst: Entity | null = null;
  const perFile: Array<{ entity: Entity; tokens: number }> = [];
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    files.push(e);
    const t = fileTokens(e);
    totalTokens += t;
    perFile.push({ entity: e, tokens: t });
    if (t > worstTokens) {
      worstTokens = t;
      worst = e;
    }
    if (aiFriendliness(e).score >= 70) friendly++;
  }
  if (files.length === 0 || !worst) return null;

  // Pick anchor: selected building / floor → building, else first file.
  let anchor: Entity | null = null;
  if (ctx.selectedId) {
    const sel = ctx.tree.byId.get(ctx.selectedId);
    if (sel && (sel.kind === "building" || sel.kind === "floor")) anchor = sel;
  }
  if (!anchor) anchor = files[0] ?? null;
  if (!anchor) return null;

  perFile.sort((a, b) => b.tokens - a.tokens);

  return {
    files,
    totalTokens,
    avgTokens: Math.round(totalTokens / files.length),
    worst: { entity: worst, tokens: worstTokens },
    friendlyPct: (friendly / files.length) * 100,
    anchor,
    topFiles: perFile.slice(0, 20),
  };
}

function TokenEconomyViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => aggregate(ctx), [ctx]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>토큰 데이터를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const matrix = useMemo(() => {
    return AI_TASK_KINDS.map(kind => {
      const est = estimateTaskCost(data.anchor, ctx.tree!, ctx.graph?.fileEdges, kind);
      return { kind, est };
    });
  }, [data.anchor, ctx.tree, ctx.graph?.fileEdges]);

  // Log-scale bounds for tint interpolation across matrix cells.
  const { logMin, logMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of matrix) {
      for (const m of MODELS) {
        const v = row.est.costUsd[m];
        const logged = Math.log10(Math.max(1e-5, v));
        if (logged < lo) lo = logged;
        if (logged > hi) hi = logged;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
      return { logMin: -5, logMax: 1 };
    }
    return { logMin: lo, logMax: hi };
  }, [matrix]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Token Economy · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>repo-wide</span>
          </div>
          <div style={subtitleStyle}>
            tiktoken / Claude heuristic × 2026 pricing · {data.files.length.toLocaleString()}개 파일 집계
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          OpenAI tiktoken · Anthropic Claude tokenizer<br />
          2026 price sheet
        </div>
      </header>

      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="Total repo tokens"
          target={data.totalTokens}
          format={(n) => fmtTokens(Math.round(n))}
          sub={`${(data.totalTokens / 1_000_000).toFixed(2)}M raw`}
          tint={color.accent}
        />
        <HeroTile
          index={1}
          label="Avg tokens / file"
          target={data.avgTokens}
          format={(n) => fmtTokens(Math.round(n))}
          sub={`median scale · ${data.files.length} files`}
          tint={color.text0}
        />
        <HeroTile
          index={2}
          label="Most expensive file"
          target={data.worst.tokens}
          format={(n) => fmtTokens(Math.round(n))}
          sub={data.worst.entity.name}
          tint={color.danger}
        />
        <HeroTile
          index={3}
          label="AI-friendly %"
          target={data.friendlyPct}
          format={(n) => `${n.toFixed(1)}%`}
          sub="score ≥ 70"
          tint={color.success}
        />
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Task cost matrix</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            anchor · {data.anchor.name}
          </div>
        </div>
        <div style={matrixWrap}>
          <table style={matrixTable}>
            <thead>
              <tr>
                <th style={thTaskStyle}>Task</th>
                {MODELS.map(m => (
                  <th key={m} style={thModelStyle}>
                    <div style={{ fontWeight: font.weight.semibold, color: color.text0 }}>{MODEL_LABEL[m]}</div>
                    <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
                      ${AI_PRICING[m].input.toFixed(2)} / ${AI_PRICING[m].output.toFixed(2)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={row.kind} style={{
                  animation: `te-row ${BAR_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${i * STAGGER_MS + 120}ms`,
                }}>
                  <td style={tdTaskStyle}>
                    <div style={{ fontWeight: font.weight.semibold, color: color.text0 }}>{TASK_LABEL_KO[row.kind]}</div>
                    <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
                      {fmtTokens(row.est.inputTokens)} in · {fmtTokens(row.est.outputTokens)} out
                    </div>
                  </td>
                  {MODELS.map(m => {
                    const usd = row.est.costUsd[m];
                    const logged = Math.log10(Math.max(1e-5, usd));
                    const t = Math.max(0, Math.min(1, (logged - logMin) / Math.max(1e-3, logMax - logMin)));
                    const bg = `color-mix(in srgb, ${color.bg2} ${(1 - t) * 100}%, ${color.danger} ${t * 100}%)`;
                    const fg = t > 0.55 ? "#ffffff" : color.text0;
                    return (
                      <td key={m} style={{
                        ...tdCellStyle,
                        background: bg,
                        color: fg,
                      }}>
                        <div style={{ fontFamily: font.mono, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" }}>
                          {fmtCost(usd)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={matrixLegend}>
          <span>cheap</span>
          <span style={{ flex: 1, height: 6, background: `linear-gradient(90deg, ${color.bg2}, ${color.danger})`, borderRadius: radius.pill }} />
          <span>expensive</span>
          <span style={{ marginLeft: "auto" }}>log-scale · $ per single representative task</span>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Top 20 expensive files</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            cost to "explain" · Claude Sonnet 4.6
          </div>
        </div>
        <div style={listStyle}>
          {data.topFiles.map((row, i) => {
            const loc = row.entity.metrics?.loc ?? 0;
            const outputTokens = Math.max(200, Math.round(row.tokens * 0.18));
            const cost = computeCost(row.tokens, outputTokens)["claude-sonnet-4-6"];
            const ratio = data.worst.tokens > 0 ? row.tokens / data.worst.tokens : 0;
            return (
              <button
                key={row.entity.id}
                type="button"
                onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                style={{
                  ...rowStyle,
                  animationDelay: `${Math.min(i, 20) * 14 + 160}ms`,
                }}
              >
                <span style={rankStyle}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={rowNameStyle}>{row.entity.name}</span>
                  <span style={rowPathStyle}>{row.entity.path}</span>
                </span>
                <span style={locStyle}>{loc.toLocaleString()} LoC</span>
                <span style={tokenStyle}>{fmtTokens(row.tokens)}</span>
                <span style={{ flex: "0 0 160px" }}>
                  <span style={barBaseStyle}>
                    <span style={{
                      ...barFillStyle,
                      width: `${Math.max(3, ratio * 100)}%`,
                      background: color.accent,
                      transformOrigin: "left center",
                      animation: `te-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${Math.min(i, 20) * 14 + 200}ms`,
                    }} />
                  </span>
                </span>
                <span style={costStyle}>{fmtCost(cost)}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function HeroTile({
  index,
  label,
  target,
  format,
  sub,
  tint,
}: {
  index: number;
  label: string;
  target: number;
  format: (n: number) => string;
  sub: string;
  tint: string;
}): ReactElement {
  const v = useCounter(target, COUNTER_MS);
  return (
    <div
      style={{
        ...heroTileStyle,
        animationDelay: `${index * STAGGER_MS}ms`,
      }}
    >
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroNumStyle, color: tint }}>{format(v)}</div>
      <div style={heroSubStyle} title={sub}>{sub}</div>
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
  animation: `te-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  animation: `te-tile 460ms ${ENTRY_EASE} both`,
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

const matrixWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const matrixTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: font.size.sm,
};

const thTaskStyle: CSSProperties = {
  textAlign: "left",
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  width: 180,
};

const thModelStyle: CSSProperties = {
  textAlign: "center",
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xs,
  color: color.text1,
  fontWeight: font.weight.medium,
};

const tdTaskStyle: CSSProperties = {
  padding: `${space[3]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  fontSize: font.size.sm,
  color: color.text0,
};

const tdCellStyle: CSSProperties = {
  textAlign: "center",
  padding: `${space[3]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  fontSize: font.size.sm,
  transition: `background ${transition.base}`,
};

const matrixLegend: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  marginTop: space[2],
  fontSize: font.size.xxs,
  color: color.text3,
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
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `te-row 440ms ${ENTRY_EASE} both`,
};

const rankStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  width: 24,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
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

const locStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text2,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 90px",
  textAlign: "right" as const,
};

const tokenStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text0,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 70px",
  textAlign: "right" as const,
  fontWeight: font.weight.semibold,
};

const costStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.accent,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 70px",
  textAlign: "right" as const,
  fontWeight: font.weight.semibold,
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
};

export const TokenEconomyView = memo(TokenEconomyViewImpl);
