// BusFactorView — ranked horizontal bar list of top bus-factor risk files.
// --------------------------------------------------------------------
// Each row:
//   [ filename + path ] [ author hue dots (weighted) ] [ risk bar + % ]
//
// Sort: `busFactor(entity)` desc (1 = sole owner, 0 = many contributors).
// Cap at the top 20 rows so the list reads in one glance.
//
// Author pills come from `authorSplit(entity)` — each dot's diameter is
// a hint of that author's share. Primary (largest share) sits first.
// Hue comes from `authorHue(authorId)` so the same person gets the same
// colour across sessions.
//
// Animation: list container fades + scales in, each row staggers by
// ~20ms. No shadows; thin 1px separator lines between rows.

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
  authorHue,
  authorSplit,
  busFactor,
} from "../../../shared/analytics/synth-metrics";

export interface BusFactorViewProps {
  ctx: ViewContextValue;
}

const TOP_N = 20;

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;
const STAGGER_MS = 20;

const KEYFRAMES = `
@keyframes busFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes busRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

interface BusRow {
  id: string;
  name: string;
  path: string;
  risk: number; // 0..1
  authors: ReadonlyArray<{ id: string; share: number }>;
}

function BusFactorViewImpl({ ctx }: BusFactorViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rows = useMemo<BusRow[]>(() => {
    if (!ctx.tree) return [];
    const all: BusRow[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      all.push({
        id: e.id,
        name: e.name,
        path: e.path,
        risk: busFactor(e),
        authors: authorSplit(e as Entity),
      });
    }
    all.sort((a, b) => b.risk - a.risk);
    return all.slice(0, TOP_N);
  }, [ctx.tree]);

  if (!ctx.tree || rows.length === 0) {
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
    animation: `busFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            Bus Factor
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            한 사람에게 의존하는 파일 상위 {rows.length}개 — "이 사람 나가면 아무도 못 만짐"
          </div>
        </div>

        {/* Column legend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 160px",
            columnGap: 16,
            fontSize: font.size.xxs,
            color: tokenColor.text2,
            paddingBottom: 8,
            borderBottom: `1px solid ${tokenColor.border}`,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
          }}
        >
          <div>File</div>
          <div>Authors</div>
          <div>Risk</div>
        </div>

        {/* Rows */}
        {rows.map((row, i) => {
          const isHovered = hoveredId === row.id;
          const isSelected = ctx.selectedId === row.id;
          const rowStyle: CSSProperties = {
            display: "grid",
            gridTemplateColumns: "1fr 140px 160px",
            columnGap: 16,
            alignItems: "center",
            padding: `${space[2]}px ${space[3]}px`,
            borderRadius: radiusToken.md,
            background: isSelected
              ? tokenColor.selected
              : isHovered
              ? tokenColor.hover
              : "transparent",
            cursor: "pointer",
            transition: `background 180ms ease-out, transform 180ms ease-out`,
            transform: isHovered ? "scale(1.01)" : "scale(1)",
            transformOrigin: "left center",
            animation: `busRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${Math.min(i * STAGGER_MS, 500)}ms`,
            borderBottom: `1px solid ${tokenColor.borderSoft}`,
          };

          const riskPct = Math.round(row.risk * 100);
          // Blend neutral → danger as risk climbs.
          const barColor = riskColor(row.risk);

          return (
            <div
              key={row.id}
              style={rowStyle}
              onMouseEnter={() => setHoveredId(row.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => ctx.dispatch.selectEntity(row.id)}
              role="button"
              tabIndex={0}
            >
              {/* Filename + path */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: font.size.md,
                    fontWeight: font.weight.medium,
                    color: tokenColor.text0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.name}
                </div>
                <div
                  style={{
                    fontSize: font.size.xxs,
                    color: tokenColor.text2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: 2,
                  }}
                >
                  {row.path}
                </div>
              </div>

              {/* Author pills */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                {row.authors.slice(0, 6).map(a => {
                  // Diameter scales with share: big contributor = bigger dot.
                  const d = 8 + Math.round(a.share * 14);
                  return (
                    <div
                      key={a.id}
                      title={`${a.id} · ${Math.round(a.share * 100)}%`}
                      style={{
                        width: d,
                        height: d,
                        borderRadius: "50%",
                        background: `hsl(${authorHue(a.id)} 65% 52%)`,
                        opacity: 0.85,
                        border: `1px solid ${tokenColor.bg0}`,
                      }}
                    />
                  );
                })}
                {row.authors.length > 6 && (
                  <div
                    style={{
                      fontSize: font.size.xxs,
                      color: tokenColor.text2,
                      marginLeft: 2,
                    }}
                  >
                    +{row.authors.length - 6}
                  </div>
                )}
              </div>

              {/* Risk meter */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: space[2],
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: radiusToken.pill,
                    background: tokenColor.bg3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${riskPct}%`,
                      height: "100%",
                      background: barColor,
                      borderRadius: radiusToken.pill,
                      transition: "width 240ms ease-out",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: font.size.xs,
                    fontWeight: font.weight.semibold,
                    color: tokenColor.text0,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {riskPct}%
                </div>
              </div>
            </div>
          );
        })}

        {/* Footer legend */}
        <div
          style={{
            marginTop: 24,
            fontSize: font.size.xxs,
            color: tokenColor.text3,
          }}
        >
          risk 100% = 단일 기여자 · risk 0% = 팀 전체가 만짐
        </div>
      </div>
    </div>
  );
}

/** Neutral → danger gradient for the risk bar. */
function riskColor(risk: number): string {
  if (risk >= 0.75) return tokenColor.danger;
  if (risk >= 0.5) return tokenColor.warn;
  if (risk >= 0.25) return tokenColor.text1;
  return tokenColor.success;
}

export const BusFactorView = memo(BusFactorViewImpl);
