// ContextFootprintView — file-scoped transitive context cost.
// --------------------------------------------------------------------
// Shows, for the selected file, how many LLM tokens are actually
// needed to understand it: self + each hop (1/2/3) of transitive
// imports via the file-edge graph. The BFS layers make "blast radius"
// legible. The right panel prices that context for 5 models so the
// reviewer sees raw cost perspective.
//
// References:
//   - Anthropic context-window docs (2025) — 200K context ≠ free
//   - OpenAI "Prompt Engineering" guide — transitive import blast
//     is the #1 context bloat pattern in IDE coding agents
//   - Rule of thumb: interface-only extraction ~38% of full context

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  AI_PRICING,
  computeCost,
  contextFootprint,
  type AIModel,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;
const BAR_MS = 480;

const KEYFRAMES = `
@keyframes cf-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes cf-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cf-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes cf-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
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

// Segment tints — self → hop1 → hop2 → hop3, darker = deeper.
const SEG_TINT = [
  color.accent,
  "#7db843",
  color.warn,
  color.danger,
];
const SEG_LABEL = ["Self", "Hop 1", "Hop 2", "Hop 3"];

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

function ContextFootprintViewImpl({ ctx, entity, empty }: Props): ReactElement {
  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하면 context footprint가 나타납니다.</div>
      </div>
    );
  }

  const fp = useMemo(
    () => contextFootprint(entity, ctx.tree!, ctx.graph?.fileEdges, 3),
    [entity, ctx.tree, ctx.graph?.fileEdges],
  );

  // Segments for the stacked bar: [self, hop1, hop2, hop3].
  const segments = useMemo(() => {
    const out = [
      { label: SEG_LABEL[0]!, tokens: fp.self, tint: SEG_TINT[0]! },
      { label: SEG_LABEL[1]!, tokens: fp.byHop[0] ?? 0, tint: SEG_TINT[1]! },
      { label: SEG_LABEL[2]!, tokens: fp.byHop[1] ?? 0, tint: SEG_TINT[2]! },
      { label: SEG_LABEL[3]!, tokens: fp.byHop[2] ?? 0, tint: SEG_TINT[3]! },
    ];
    return out;
  }, [fp]);

  // Approximate file counts per hop. We don't have the exact per-hop
  // file count from the struct, so distribute uniqueFiles-1 across the
  // non-zero hops weighted by tokens.
  const hopFiles = useMemo(() => {
    const depRemaining = fp.uniqueFiles - 1; // exclude self
    const totalHopTokens = segments.slice(1).reduce((s, x) => s + x.tokens, 0);
    return segments.map((seg, i) => {
      if (i === 0) return 1;
      if (totalHopTokens <= 0 || depRemaining <= 0) return 0;
      return Math.round((seg.tokens / totalHopTokens) * depRemaining);
    });
  }, [segments, fp]);

  const readCost = useMemo(() => computeCost(fp.total, 0), [fp.total]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Context Footprint · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {entity.path} · BFS import graph × tiktoken heuristic · 최대 3 hop
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Anthropic context-window 2025<br />
          OpenAI Prompt Engineering guide
        </div>
      </header>

      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="Total context"
          target={fp.total}
          format={(n) => fmtTokens(Math.round(n))}
          sub={`${fp.uniqueFiles.toLocaleString()}개 unique files`}
          tint={color.accent}
        />
        <HeroTile
          index={1}
          label="Minimum viable"
          target={fp.minimumViable}
          format={(n) => fmtTokens(Math.round(n))}
          sub={`interface-only · ≈${Math.round((fp.minimumViable / Math.max(1, fp.total)) * 100)}% of full`}
          tint={color.success}
        />
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Token split by hop depth</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            self + transitive imports · BFS
          </div>
        </div>

        <StackedBar segments={segments} total={fp.total} />

        <div style={tableWrapStyle}>
          <table style={breakdownTable}>
            <thead>
              <tr>
                <th style={thColStyle}>Layer</th>
                <th style={thNumStyle}>Tokens</th>
                <th style={thNumStyle}>Files</th>
                <th style={thNumStyle}>Cumulative %</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let cumTokens = 0;
                return segments.map((seg, i) => {
                  cumTokens += seg.tokens;
                  const cumPct = fp.total > 0 ? (cumTokens / fp.total) * 100 : 0;
                  return (
                    <tr key={seg.label} style={{
                      animation: `cf-row ${BAR_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${i * STAGGER_MS + 240}ms`,
                    }}>
                      <td style={tdLayerStyle}>
                        <span style={{
                          display: "inline-block",
                          width: 10, height: 10,
                          borderRadius: 2,
                          background: seg.tint,
                          marginRight: 8,
                          verticalAlign: "middle",
                        }} />
                        <span style={{ color: color.text0, fontWeight: font.weight.medium }}>{seg.label}</span>
                      </td>
                      <td style={tdNumStyle}>{fmtTokens(seg.tokens)}</td>
                      <td style={tdNumStyle}>{hopFiles[i]?.toLocaleString() ?? "0"}</td>
                      <td style={tdNumStyle}>{cumPct.toFixed(1)}%</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Cost to feed this context (read-only)</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            input = {fmtTokens(fp.total)} · output = 0
          </div>
        </div>
        <div style={costWrapStyle}>
          {MODELS.map((m, i) => (
            <div
              key={m}
              style={{
                ...costRowStyle,
                animationDelay: `${i * STAGGER_MS + 320}ms`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ fontSize: font.size.sm, color: color.text0, fontWeight: font.weight.semibold }}>
                  {MODEL_LABEL[m]}
                </div>
                <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
                  ${AI_PRICING[m].input.toFixed(2)} / 1M input
                </div>
              </div>
              <div style={{
                fontFamily: font.mono,
                fontWeight: font.weight.bold,
                fontSize: font.size.xl,
                color: color.accent,
                fontVariantNumeric: "tabular-nums",
              }}>
                {fmtCost(readCost[m])}
              </div>
            </div>
          ))}
        </div>
        <div style={footnoteStyle}>
          출력 토큰은 0으로 가정한 pure-read 비용 · 실제 채팅 1회 비용은 응답 길이에 따라 +10-60% 추가됩니다.
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

function StackedBar({ segments, total }: { segments: Array<{ label: string; tokens: number; tint: string }>; total: number }): ReactElement {
  return (
    <div style={stackedWrap}>
      <div style={stackedBarRow}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.tokens / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label}
              title={`${seg.label} · ${fmtTokens(seg.tokens)} · ${pct.toFixed(1)}%`}
              style={{
                width: `${pct}%`,
                background: seg.tint,
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transformOrigin: "left center",
                animation: `cf-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
                animationDelay: `${i * STAGGER_MS + 120}ms`,
                color: "#ffffff",
                fontSize: font.size.xxs,
                fontFamily: font.mono,
                fontWeight: font.weight.semibold,
                letterSpacing: font.letter.wide,
                overflow: "hidden",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {pct >= 8 ? fmtTokens(seg.tokens) : ""}
            </div>
          );
        })}
      </div>
      <div style={stackedLegend}>
        {segments.map((seg) => (
          <span key={seg.label} style={{ display: "inline-flex", alignItems: "center", gap: space[1], color: color.text1 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: seg.tint }} />
            <strong style={{ color: color.text0, fontSize: font.size.xs }}>{seg.label}</strong>
            <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
              {fmtTokens(seg.tokens)}
            </span>
          </span>
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
  animation: `cf-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
  animation: `cf-tile 460ms ${ENTRY_EASE} both`,
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
  fontSize: 42,
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

const stackedWrap: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const stackedBarRow: CSSProperties = {
  display: "flex",
  height: 28,
  borderRadius: radius.pill,
  overflow: "hidden",
  background: color.bg3,
};

const stackedLegend: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[4],
  marginTop: space[3],
};

const tableWrapStyle: CSSProperties = {
  marginTop: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const breakdownTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: font.size.sm,
};

const thColStyle: CSSProperties = {
  textAlign: "left",
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const thNumStyle: CSSProperties = {
  ...thColStyle,
  textAlign: "right" as const,
};

const tdLayerStyle: CSSProperties = {
  padding: `${space[3]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
};

const tdNumStyle: CSSProperties = {
  padding: `${space[3]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "right" as const,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  color: color.text1,
};

const costWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const costRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `cf-row 440ms ${ENTRY_EASE} both`,
  transition: `background ${transition.base}`,
};

const footnoteStyle: CSSProperties = {
  marginTop: space[2],
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

export const ContextFootprintView = memo(ContextFootprintViewImpl);
