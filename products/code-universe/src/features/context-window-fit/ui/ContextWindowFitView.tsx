// ContextWindowFitView — repo-level visualization of which files fit
// in each model's context window (128K / 200K / 1M / 2M).
// --------------------------------------------------------------------
// Top: 4 hero stats (fits 128K / 200K / 1M / overflow 2M, count + %).
// Middle: horizontal stacked bar — full-repo tokens vs each tier's
//   capacity, with logarithmic reference markers at 128K/200K/1M/2M.
// Bottom: file grid coloured by which tier each file fits into (green
//   <128K / blue <200K / amber <1M / warn <2M / danger >2M).
// Hover → tokens + tier. Click → dispatch.selectEntity.
//
// References:
//   - Anthropic 200K/1M context window docs (2025)
//   - Google Gemini 2.5 Pro 2M context (2024)
//   - Kamradt et al. "Needle in a Haystack" long-context benchmarks
// "Context window fit as a model-selection metric" — a novel 2026 lens.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  CONTEXT_WINDOWS,
  fileTokens,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;
const BAR_MS = 900;

const KEYFRAMES = `
@keyframes cwf-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes cwf-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cwf-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes cwf-cell  { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
`;

// Tier colours (soft/strong pairs) — using tokens + accent shades.
// "soft" is the tile fill, "strong" the swatch / label.
const TIER_STYLE = {
  t128:  { soft: "#d7f0dc", strong: color.success, label: "<128K" },
  t200:  { soft: "#d9ecfd", strong: color.accent,  label: "<200K" },
  t1m:   { soft: "#f7e4bf", strong: color.warn,    label: "<1M" },
  t2m:   { soft: "#f5c8b4", strong: "#d0642a",     label: "<2M" },
  over:  { soft: "#f7c4c6", strong: color.danger,  label: ">2M" },
} as const;

type TierKey = keyof typeof TIER_STYLE;

function tierFor(tokens: number): TierKey {
  if (tokens < 128_000) return "t128";
  if (tokens < 200_000) return "t200";
  if (tokens < 1_000_000) return "t1m";
  if (tokens < 2_000_000) return "t2m";
  return "over";
}

// ── helpers ──────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
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

interface FileRow {
  entity: Entity;
  tokens: number;
  tier: TierKey;
}

interface Aggregate {
  files: FileRow[];
  totalTokens: number;
  fits128: number;
  fits200: number;
  fits1m: number;
  overflow2m: number;
}

function aggregate(ctx: ViewContextValue): Aggregate | null {
  if (!ctx.tree) return null;
  const files: FileRow[] = [];
  let totalTokens = 0;
  let fits128 = 0, fits200 = 0, fits1m = 0, overflow2m = 0;
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const tokens = fileTokens(e);
    totalTokens += tokens;
    const tier = tierFor(tokens);
    files.push({ entity: e, tokens, tier });
    if (tokens < 128_000) fits128++;
    if (tokens < 200_000) fits200++;
    if (tokens < 1_000_000) fits1m++;
    if (tokens >= 2_000_000) overflow2m++;
  }
  if (files.length === 0) return null;
  // Sort by tokens desc so biggest files show first.
  files.sort((a, b) => b.tokens - a.tokens);
  return { files, totalTokens, fits128, fits200, fits1m, overflow2m };
}

function ContextWindowFitViewImpl({ ctx }: Props): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const data = useMemo(() => aggregate(ctx), [ctx]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>컨텍스트 윈도우 적합성을 계산할 파일이 없습니다.</div>
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
            Context Window Fit · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>128K / 200K / 1M / 2M</span>
          </div>
          <div style={subtitleStyle}>
            파일 × 모델 컨텍스트 윈도우 적합성 · {total.toLocaleString()}개 파일
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Anthropic 200K/1M · Gemini 2M<br />
          Needle-in-Haystack benchmarks
        </div>
      </header>

      {/* Hero stats */}
      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="fits 128K"
          target={data.fits128}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.fits128).toFixed(1)}% of files`}
          tint={TIER_STYLE.t128.strong}
        />
        <HeroTile
          index={1}
          label="fits 200K"
          target={data.fits200}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.fits200).toFixed(1)}% of files`}
          tint={TIER_STYLE.t200.strong}
        />
        <HeroTile
          index={2}
          label="fits 1M"
          target={data.fits1m}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.fits1m).toFixed(1)}% of files`}
          tint={TIER_STYLE.t1m.strong}
        />
        <HeroTile
          index={3}
          label="overflow 2M"
          target={data.overflow2m}
          format={(n) => Math.round(n).toLocaleString()}
          sub={`${pct(data.overflow2m).toFixed(1)}% — split req'd`}
          tint={TIER_STYLE.over.strong}
        />
      </section>

      {/* Repo-wide horizontal capacity bar */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Repo tokens vs context windows</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            {fmtTokens(data.totalTokens)} total · log-scale reference
          </div>
        </div>
        <CapacityBar totalTokens={data.totalTokens} />
      </section>

      {/* Legend */}
      <section style={legendRowStyle}>
        {(Object.keys(TIER_STYLE) as TierKey[]).map(k => (
          <span key={k} style={legendItemStyle}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: TIER_STYLE[k].soft,
              border: `1px solid ${TIER_STYLE[k].strong}55`,
            }} />
            <span style={{ color: color.text2 }}>{TIER_STYLE[k].label}</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
          tile size = sqrt(tokens)
        </span>
      </section>

      {/* File grid — one cell per file, coloured by tier */}
      <section style={{ ...sectionStyle, marginTop: space[3] }}>
        <div style={gridStyle}>
          {data.files.map((row, i) => {
            const tierStyle = TIER_STYLE[row.tier];
            const isHovered = hoveredId === row.entity.id;
            const isSelected = ctx.selectedId === row.entity.id;
            // sqrt scale — big files get bigger tiles but not 50× bigger.
            const size = Math.max(22, Math.min(58, 22 + Math.sqrt(row.tokens / 400)));
            return (
              <button
                key={row.entity.id}
                type="button"
                title={`${row.entity.path} · ${fmtTokens(row.tokens)} tokens · ${tierStyle.label}`}
                onClick={() => ctx.dispatch.selectEntity(row.entity.id)}
                onMouseEnter={() => setHoveredId(row.entity.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  ...cellStyle,
                  width: size,
                  height: size,
                  background: tierStyle.soft,
                  borderColor: isSelected
                    ? color.accent
                    : isHovered ? tierStyle.strong : `${tierStyle.strong}33`,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${color.accent}`
                    : isHovered ? `0 2px 6px ${tierStyle.strong}40` : "none",
                  transform: isHovered ? "scale(1.06)" : "scale(1)",
                  animationDelay: `${Math.min(i * 4, 600)}ms`,
                }}
              >
                <span style={{
                  position: "absolute",
                  top: 2, right: 3,
                  width: 5, height: 5, borderRadius: "50%",
                  background: tierStyle.strong,
                }} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CapacityBar({ totalTokens }: { totalTokens: number }) {
  // Log-scale x-axis from 1K up to just above 2M.
  const logMin = Math.log10(10_000);
  const logMax = Math.log10(4_000_000);
  const pos = (tok: number) => {
    const v = Math.log10(Math.max(1, tok));
    return Math.max(0, Math.min(1, (v - logMin) / (logMax - logMin)));
  };
  const totalPct = pos(totalTokens);
  return (
    <div style={capacityWrap}>
      <div style={capacityTrack}>
        {/* Tier marker bands */}
        {CONTEXT_WINDOWS.map((w, i) => {
          const p = pos(w.tokens);
          const tierKey: TierKey = i === 0 ? "t128" : i === 1 ? "t200" : i === 2 ? "t1m" : "t2m";
          return (
            <span key={w.name} style={{
              position: "absolute",
              left: `${p * 100}%`,
              top: -4, bottom: -4,
              width: 1,
              background: TIER_STYLE[tierKey].strong,
              opacity: 0.5,
            }} />
          );
        })}
        {/* Actual total-tokens fill */}
        <span style={{
          ...capacityFill,
          width: `${totalPct * 100}%`,
          background: `linear-gradient(90deg, ${color.accent}, ${color.warn})`,
          animation: `cwf-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
        }} />
      </div>
      <div style={capacityAxis}>
        {CONTEXT_WINDOWS.map((w, i) => {
          const p = pos(w.tokens);
          const tierKey: TierKey = i === 0 ? "t128" : i === 1 ? "t200" : i === 2 ? "t1m" : "t2m";
          return (
            <div key={w.name} style={{
              position: "absolute",
              left: `${p * 100}%`,
              transform: "translateX(-50%)",
              top: 6,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}>
              <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: TIER_STYLE[tierKey].strong, fontWeight: font.weight.semibold }}>
                {fmtTokens(w.tokens)}
              </div>
              <div style={{ fontSize: font.size.xxs, color: color.text3, marginTop: 1 }}>
                {w.name}
              </div>
            </div>
          );
        })}
        <div style={{
          position: "absolute",
          left: `${totalPct * 100}%`,
          transform: "translateX(-50%)",
          bottom: 4,
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: color.text0,
          fontWeight: font.weight.semibold,
          whiteSpace: "nowrap",
          background: color.bg1,
          padding: "1px 6px",
          borderRadius: radius.pill,
          border: `1px solid ${color.border}`,
        }}>
          repo · {fmtTokens(totalTokens)}
        </div>
      </div>
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

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `cwf-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
  animation: `cwf-tile 460ms ${ENTRY_EASE} both`,
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

const capacityWrap: CSSProperties = {
  position: "relative",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: `${space[5]}px ${space[4]}px ${space[5] + 26}px`,
};

const capacityTrack: CSSProperties = {
  position: "relative",
  height: 10,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "visible",
};

const capacityFill: CSSProperties = {
  display: "block",
  position: "absolute",
  inset: 0,
  borderRadius: radius.pill,
  transformOrigin: "left center",
};

const capacityAxis: CSSProperties = {
  position: "relative",
  height: 42,
  marginTop: 0,
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  marginTop: space[5],
  fontSize: font.size.xxs,
};

const legendItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: font.size.xxs,
  color: color.text2,
};

const gridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  alignItems: "flex-end",
};

const cellStyle: CSSProperties = {
  position: "relative",
  borderRadius: radius.sm,
  border: "1px solid transparent",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
  transition: `transform ${transition.base}, border-color ${transition.base}, box-shadow ${transition.base}`,
  animation: `cwf-cell 360ms ${ENTRY_EASE} both`,
};

export const ContextWindowFitView = memo(ContextWindowFitViewImpl);
