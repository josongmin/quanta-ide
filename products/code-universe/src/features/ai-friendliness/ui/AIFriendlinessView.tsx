// AIFriendlinessView — 2D scatter: log(tokens) × AI-friendliness score.
// --------------------------------------------------------------------
// Each file is a dot positioned by (token cost, friendliness). The plot
// is divided into four tinted quadrants, each labeled with the trade-off
// it represents — from "cheap × friendly" (값싸고 친화적) to the bottom-
// right "AI 재앙지대" (expensive + opaque). Hover reveals the 6 synth
// factors driving the score; the right rail surfaces the 10 worst
// offenders so triage starts with the most painful files. A bottom bar
// chart shows repo-wide averages per factor so the team sees WHICH
// dimension is dragging the whole codebase down.
//
// Reference: Novel concept — "AI-friendliness as a code quality
// dimension". Inspired by Uwano et al. "Analyzing individual performance
// of source code review using reviewers' eye movement" (ICSE 2006)
// adapted for LLMs; Mockus & Votta "Identifying reasons for software
// changes using historic databases" (ICSM 2000).

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  aiFriendliness,
  fileTokens,
  type AiFriendliness,
} from "../../../shared/analytics/synth-metrics";

export interface AIFriendlinessViewProps {
  ctx: ViewContextValue;
}

// ── Layout constants ──────────────────────────────────────────────────
const PAD_LEFT = 76;
const PAD_RIGHT = 20;
const PAD_TOP = 72;
const PAD_BOTTOM = 64;

const MIN_R = 4;
const MAX_R = 12;

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const SIDEBAR_W = 280;
const FACTOR_BAR_H = 120;

const KEYFRAMES = `
@keyframes afFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes afRowIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes afBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

interface Dot {
  id: string;
  name: string;
  path: string;
  kind: Entity["kind"];
  tokens: number;
  logT: number; // log10(tokens)
  score: number; // 0..100
  factors: AiFriendliness["factors"];
  loc: number;
}

interface FactorAvg {
  key: keyof AiFriendliness["factors"];
  label: string;
  value: number; // 0..1
}

const FACTOR_LABEL: Record<keyof AiFriendliness["factors"], string> = {
  typing: "typing",
  commentBalance: "comment balance",
  identifierClarity: "identifier clarity",
  sizePenalty: "size",
  tests: "tests",
  docs: "docs",
};

/** Map a score 0..100 to a tier color. */
function scoreColor(score: number): string {
  if (score >= 75) return tokenColor.success;
  if (score >= 50) return tokenColor.accent;
  if (score >= 30) return tokenColor.warn;
  return tokenColor.danger;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function AIFriendlinessViewImpl({ ctx }: AIFriendlinessViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, width - SIDEBAR_W - PAD_LEFT - PAD_RIGHT - space[4]);
  const plotH = Math.max(1, height - PAD_TOP - PAD_BOTTOM - FACTOR_BAR_H - space[4]);

  const { dots, xMin, xMax, worstOffenders, factorAvgs } = useMemo(() => {
    const d: Dot[] = [];
    if (!ctx.tree) {
      return {
        dots: d,
        xMin: 0,
        xMax: 1,
        worstOffenders: [] as Dot[],
        factorAvgs: [] as FactorAvg[],
      };
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const tokens = fileTokens(e);
      const logT = Math.log10(Math.max(1, tokens));
      const af = aiFriendliness(e);
      d.push({
        id: e.id,
        name: e.name,
        path: e.path,
        kind: e.kind,
        tokens,
        logT,
        score: af.score,
        factors: af.factors,
        loc: e.metrics?.loc ?? 0,
      });
      if (logT < lo) lo = logT;
      if (logT > hi) hi = logT;
    }
    if (!isFinite(lo) || !isFinite(hi) || lo === hi) {
      lo = 0;
      hi = Math.max(1, hi);
    }
    // Sort stable, big dots first so small ride on top.
    d.sort((a, b) => b.tokens - a.tokens);

    // Worst offenders: bottom-right quadrant (expensive × opaque).
    // Use median log tokens as x-mid; score < 50 as y-cut.
    const midX = (lo + hi) / 2;
    const offenders = d
      .filter(x => x.logT >= midX && x.score < 50)
      .sort((a, b) => {
        // Higher cost + lower score first.
        const aRank = (a.logT - midX) + (50 - a.score) * 0.02;
        const bRank = (b.logT - midX) + (50 - b.score) * 0.02;
        return bRank - aRank;
      })
      .slice(0, 10);

    // Factor averages across repo.
    const sums = {
      typing: 0,
      commentBalance: 0,
      identifierClarity: 0,
      sizePenalty: 0,
      tests: 0,
      docs: 0,
    };
    for (const x of d) {
      sums.typing += x.factors.typing;
      sums.commentBalance += x.factors.commentBalance;
      sums.identifierClarity += x.factors.identifierClarity;
      sums.sizePenalty += x.factors.sizePenalty;
      sums.tests += x.factors.tests;
      sums.docs += x.factors.docs;
    }
    const n = Math.max(1, d.length);
    const avgs: FactorAvg[] = (
      [
        "typing",
        "commentBalance",
        "identifierClarity",
        "sizePenalty",
        "tests",
        "docs",
      ] as const
    ).map(k => ({
      key: k,
      label: FACTOR_LABEL[k],
      value: sums[k] / n,
    }));

    return {
      dots: d,
      xMin: lo,
      xMax: hi,
      worstOffenders: offenders,
      factorAvgs: avgs,
    };
  }, [ctx.tree]);

  const isEmpty = dots.length === 0;

  if (!ctx.tree || isEmpty) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokenColor.text3,
          fontFamily: font.sans,
          fontSize: font.size.md,
          background: tokenColor.bg0,
        }}
      >
        <style>{KEYFRAMES}</style>
        데이터가 아직 없어요
      </div>
    );
  }

  const rootStyle: CSSProperties = {
    animation: `afFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center center",
  };

  // X/Y scales.
  const xRange = Math.max(0.0001, xMax - xMin);
  const midX = plotX + plotW / 2;
  const midY = plotY + plotH / 2;

  // Y: 0..100 score.
  const yTicks = [0, 25, 50, 75, 100];
  // X: integer log-ticks from floor(xMin) to ceil(xMax).
  const xTickVals: number[] = [];
  for (let v = Math.floor(xMin); v <= Math.ceil(xMax); v++) xTickVals.push(v);

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        position: "relative",
        boxSizing: "border-box",
        fontFamily: font.sans,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Left — scatter */}
      <svg
        width={width - SIDEBAR_W - space[4]}
        height={height}
        viewBox={`0 0 ${width - SIDEBAR_W - space[4]} ${height}`}
        style={{
          display: "block",
          userSelect: "none",
          background: "transparent",
          position: "absolute",
          left: 0,
          top: 0,
        }}
        role="img"
        aria-label="AI friendliness scatter"
      >
        <g style={rootStyle}>
          {/* Title */}
          <text
            x={PAD_LEFT}
            y={28}
            fill={tokenColor.text0}
            fontSize={font.size.display}
            fontFamily={font.sans}
            fontWeight={font.weight.semibold}
            letterSpacing={font.letter.tight}
          >
            AI Friendliness
          </text>
          <text
            x={PAD_LEFT}
            y={48}
            fill={tokenColor.text2}
            fontSize={font.size.xs}
            fontFamily={font.sans}
          >
            토큰 비용 × AI 친화도 — Uwano 2006 (ICSE) · Mockus & Votta 2000 (ICSM)
          </text>

          {/* Quadrant tints — top-left friendly-cheap = success, top-right
              friendly-expensive = warn, bottom-left opaque-cheap = warn,
              bottom-right opaque-expensive = danger. */}
          <rect
            x={plotX}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.success}
            opacity={0.07}
          />
          <rect
            x={midX}
            y={plotY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.warn}
            opacity={0.06}
          />
          <rect
            x={plotX}
            y={midY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.warn}
            opacity={0.05}
          />
          <rect
            x={midX}
            y={midY}
            width={plotW / 2}
            height={plotH / 2}
            fill={tokenColor.danger}
            opacity={0.08}
          />

          {/* Mid crosshair */}
          <line
            x1={midX}
            y1={plotY}
            x2={midX}
            y2={plotY + plotH}
            stroke={tokenColor.borderStrong}
            strokeDasharray="2 3"
            strokeWidth={1}
          />
          <line
            x1={plotX}
            y1={midY}
            x2={plotX + plotW}
            y2={midY}
            stroke={tokenColor.borderStrong}
            strokeDasharray="2 3"
            strokeWidth={1}
          />

          {/* Fine y-grid */}
          {yTicks.map(t => {
            const y = plotY + (1 - t / 100) * plotH;
            return (
              <line
                key={`gy-${t}`}
                x1={plotX}
                y1={y}
                x2={plotX + plotW}
                y2={y}
                stroke={tokenColor.border}
                strokeOpacity={0.45}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            );
          })}

          {/* Plot border */}
          <rect
            x={plotX}
            y={plotY}
            width={plotW}
            height={plotH}
            fill="none"
            stroke={tokenColor.border}
            strokeWidth={1}
          />

          {/* Quadrant labels */}
          <text
            x={plotX + 10}
            y={plotY + 18}
            fill={tokenColor.success}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            opacity={0.95}
          >
            값싸고 친화적
          </text>
          <text
            x={plotX + plotW - 8}
            y={plotY + 18}
            textAnchor="end"
            fill={tokenColor.warn}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            opacity={0.95}
          >
            값비싸지만 이해 가능
          </text>
          <text
            x={plotX + 10}
            y={plotY + plotH - 10}
            fill={tokenColor.warn}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            opacity={0.95}
          >
            값싸지만 AI 못 읽음
          </text>
          <text
            x={plotX + plotW - 8}
            y={plotY + plotH - 10}
            textAnchor="end"
            fill={tokenColor.danger}
            fontSize={font.size.xs}
            fontFamily={font.sans}
            fontWeight={font.weight.bold}
            opacity={0.95}
          >
            AI 재앙지대
          </text>

          {/* Axis labels */}
          <text
            x={plotX + plotW / 2}
            y={plotY + plotH + 38}
            textAnchor="middle"
            fill={tokenColor.text1}
            fontSize={font.size.sm}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
          >
            log₁₀(tokens) → 파일이 차지하는 context 비용
          </text>
          <text
            x={0}
            y={0}
            textAnchor="middle"
            fill={tokenColor.text1}
            fontSize={font.size.sm}
            fontFamily={font.sans}
            fontWeight={font.weight.medium}
            transform={`translate(22, ${plotY + plotH / 2}) rotate(-90)`}
          >
            친화도 0..100 — AI가 얼마나 잘 읽는가
          </text>

          {/* X tick labels */}
          {xTickVals.map(t => (
            <text
              key={`xt-${t}`}
              x={plotX + ((t - xMin) / xRange) * plotW}
              y={plotY + plotH + 16}
              textAnchor="middle"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.mono}
            >
              {fmtTokens(Math.round(Math.pow(10, t)))}
            </text>
          ))}
          {/* Y tick labels */}
          {yTicks.map(t => (
            <text
              key={`yt-${t}`}
              x={plotX - 8}
              y={plotY + (1 - t / 100) * plotH + 3}
              textAnchor="end"
              fill={tokenColor.text2}
              fontSize={font.size.xxs}
              fontFamily={font.mono}
            >
              {t}
            </text>
          ))}

          {/* Dots */}
          {dots.map((d, i) => {
            const cx = plotX + ((d.logT - xMin) / xRange) * plotW;
            const cy = plotY + (1 - d.score / 100) * plotH;
            const isHovered = hoveredId === d.id;
            const isSelected = ctx.selectedId === d.id;
            const r = MIN_R + Math.sqrt(Math.max(0, Math.min(1, d.loc / 800))) * (MAX_R - MIN_R);
            const fill = scoreColor(d.score);
            const opacity =
              hoveredId !== null && !isHovered ? 0.15 : isHovered ? 1 : 0.72;

            const dotStyle: CSSProperties = {
              cursor: "pointer",
              transition: `opacity 160ms ease-out, transform 160ms ease-out`,
              transform: isHovered ? "scale(1.2)" : "scale(1)",
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "fill-box",
              animation: `afFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(i * STAGGER_MS, 700)}ms`,
            };

            return (
              <g key={d.id} style={dotStyle}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={fill}
                  opacity={opacity}
                  stroke={isHovered ? tokenColor.text0 : "none"}
                  strokeWidth={isHovered ? 1.2 : 0}
                  onMouseEnter={() => setHoveredId(d.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(d.id)}
                />
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 4}
                    fill="none"
                    stroke={tokenColor.accent}
                    strokeWidth={1.5}
                    opacity={0.9}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {/* Hover tooltip — filename + raw factors. */}
          {hoveredId !== null &&
            (() => {
              const d = dots.find(x => x.id === hoveredId);
              if (!d) return null;
              const cx = plotX + ((d.logT - xMin) / xRange) * plotW;
              const cy = plotY + (1 - d.score / 100) * plotH;
              const boxW = 232;
              const boxH = 118;
              const bx = Math.min(
                plotX + plotW - boxW - 4,
                Math.max(plotX + 4, cx + 14),
              );
              const by = Math.min(
                plotY + plotH - boxH - 4,
                Math.max(plotY + 4, cy - boxH / 2),
              );
              const factorRows: Array<[string, number]> = [
                ["typing", d.factors.typing],
                ["comments", d.factors.commentBalance],
                ["clarity", d.factors.identifierClarity],
                ["size", d.factors.sizePenalty],
                ["tests", d.factors.tests],
                ["docs", d.factors.docs],
              ];
              return (
                <g pointerEvents="none">
                  <rect
                    x={bx}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx={radiusToken.md}
                    ry={radiusToken.md}
                    fill={tokenColor.bg1}
                    stroke={tokenColor.border}
                    strokeWidth={1}
                    opacity={0.98}
                  />
                  <text
                    x={bx + 10}
                    y={by + 16}
                    fill={tokenColor.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.semibold}
                  >
                    {d.name}
                  </text>
                  <text
                    x={bx + 10}
                    y={by + 30}
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    {`score ${d.score} · ${fmtTokens(d.tokens)} tok · ${d.loc} LoC`}
                  </text>
                  {factorRows.map(([label, value], idx) => {
                    const row = Math.floor(idx / 2);
                    const col = idx % 2;
                    const tx = bx + 10 + col * 110;
                    const ty = by + 50 + row * 18;
                    const pct = Math.round(value * 100);
                    return (
                      <g key={label}>
                        <text
                          x={tx}
                          y={ty}
                          fill={tokenColor.text2}
                          fontSize={font.size.xxs}
                          fontFamily={font.mono}
                        >
                          {label}
                        </text>
                        <text
                          x={tx + 60}
                          y={ty}
                          fill={tokenColor.text0}
                          fontSize={font.size.xxs}
                          fontFamily={font.mono}
                          fontWeight={font.weight.semibold}
                        >
                          {pct}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

          {/* Factor bars (bottom) */}
          <g
            transform={`translate(${plotX}, ${plotY + plotH + 52})`}
            style={rootStyle}
          >
            <text
              x={0}
              y={-4}
              fill={tokenColor.text2}
              fontSize={font.size.xs}
              fontFamily={font.sans}
              fontWeight={font.weight.medium}
            >
              레포 전체 6-factor 평균
            </text>
            {factorAvgs.map((f, i) => {
              const barX = (i * plotW) / 6;
              const barW = plotW / 6 - 12;
              const barH = 42;
              const fillH = Math.max(1, barH * f.value);
              const accent =
                f.value >= 0.7 ? tokenColor.success
                : f.value >= 0.5 ? tokenColor.accent
                : f.value >= 0.3 ? tokenColor.warn
                : tokenColor.danger;
              return (
                <g key={f.key} transform={`translate(${barX}, 8)`}>
                  <rect
                    x={0}
                    y={0}
                    width={barW}
                    height={barH}
                    fill={tokenColor.bg3}
                    rx={radiusToken.sm}
                  />
                  <rect
                    x={0}
                    y={barH - fillH}
                    width={barW}
                    height={fillH}
                    fill={accent}
                    opacity={0.8}
                    rx={radiusToken.sm}
                    style={{
                      transformOrigin: `0px ${barH}px`,
                      animation: `afBarGrow 520ms ${ENTRY_EASE} both`,
                      animationDelay: `${220 + i * 40}ms`,
                    }}
                  />
                  <text
                    x={barW / 2}
                    y={barH + 12}
                    textAnchor="middle"
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    {f.label}
                  </text>
                  <text
                    x={barW / 2}
                    y={barH - fillH - 4}
                    textAnchor="middle"
                    fill={tokenColor.text1}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    fontWeight={font.weight.semibold}
                  >
                    {Math.round(f.value * 100)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Sidebar — worst offenders */}
      <aside
        style={{
          position: "absolute",
          right: PAD_RIGHT,
          top: PAD_TOP - 8,
          width: SIDEBAR_W,
          maxHeight: height - PAD_TOP - PAD_BOTTOM,
          display: "flex",
          flexDirection: "column",
          background: tokenColor.bg1,
          border: `1px solid ${tokenColor.border}`,
          borderRadius: radiusToken.lg,
          overflow: "hidden",
          animation: `afFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: "120ms",
        }}
      >
        <div
          style={{
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${tokenColor.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            style={{
              fontSize: font.size.xxs,
              letterSpacing: font.letter.ultra,
              textTransform: "uppercase",
              color: tokenColor.text2,
              fontWeight: font.weight.semibold,
            }}
          >
            Worst offenders
          </div>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              fontFamily: font.mono,
            }}
          >
            AI 재앙지대 top 10
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {worstOffenders.length === 0 ? (
            <div
              style={{
                padding: space[4],
                color: tokenColor.text3,
                fontSize: font.size.sm,
                textAlign: "center",
              }}
            >
              재앙지대 없음 — 훌륭합니다.
            </div>
          ) : (
            worstOffenders.map((d, i) => {
              const active = ctx.selectedId === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => ctx.dispatch.selectEntity(d.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "22px 1fr auto",
                    alignItems: "center",
                    gap: space[2],
                    width: "100%",
                    padding: `${space[2]}px ${space[3]}px`,
                    background: active ? tokenColor.accentSofter : "transparent",
                    border: "none",
                    borderBottom: `1px solid ${tokenColor.border}`,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    animation: `afRowIn 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${180 + i * 30}ms`,
                  }}
                >
                  <span
                    style={{
                      fontSize: font.size.xxs,
                      fontFamily: font.mono,
                      color: tokenColor.text3,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: font.size.sm,
                        color: tokenColor.text0,
                        fontWeight: font.weight.medium,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontSize: font.size.xxs,
                        fontFamily: font.mono,
                        color: tokenColor.text3,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {fmtTokens(d.tokens)} tok
                    </span>
                  </span>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: font.size.sm,
                      fontWeight: font.weight.bold,
                      color: scoreColor(d.score),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {d.score}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

export const AIFriendlinessView = memo(AIFriendlinessViewImpl);
