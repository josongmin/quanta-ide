// MaintainabilityIndexView — Oman & Hagemeister / MS Visual Studio MI.
// --------------------------------------------------------------------
// Single health score (average MI, 0-100) at the top with a ring
// gauge, then four tiered collapsible lists:
//   Excellent  (MI ≥ 85)   success
//   OK         (65-85)     neutral
//   Concerning (40-65)     warn
//   Critical   (<40)       danger
// Each tier shows count + file list (sortable by MI ascending so the
// worst offenders within a tier float to the top of its section).

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius,
  space,
  shadow,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { maintainabilityIndex } from "../../../shared/analytics/synth-metrics";

export interface MaintainabilityIndexViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes miFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes miRingSweep {
  from { stroke-dashoffset: var(--mi-ring-circ); }
  to   { stroke-dashoffset: var(--mi-ring-offset); }
}
`;

interface Tier {
  id: "excellent" | "ok" | "concerning" | "critical";
  label: string;
  subtitle: string;
  min: number;
  max: number;
  color: string;
}

// Four-tier MI band. Tokens cover success/warn/danger; the "OK" mid-band
// uses a literal green shade to keep the gradient readable between
// Excellent and Concerning.
const TIERS: readonly Tier[] = [
  {
    id: "excellent",
    label: "Excellent",
    subtitle: "MI ≥ 85",
    min: 85,
    max: 100,
    color: tokenColor.success,
  },
  {
    id: "ok",
    label: "OK",
    subtitle: "65 ≤ MI < 85",
    min: 65,
    max: 85,
    color: "#7db843",
  },
  {
    id: "concerning",
    label: "Concerning",
    subtitle: "40 ≤ MI < 65",
    min: 40,
    max: 65,
    color: tokenColor.warn,
  },
  {
    id: "critical",
    label: "Critical",
    subtitle: "MI < 40",
    min: 0,
    max: 40,
    color: tokenColor.danger,
  },
];

interface FileRow {
  id: string;
  name: string;
  path: string;
  mi: number;
}

function tierFor(mi: number): Tier {
  for (const t of TIERS) {
    if (mi >= t.min && mi < t.max) return t;
  }
  // Edge: exactly 100 ⇒ Excellent.
  return TIERS[0]!;
}

function MaintainabilityIndexViewImpl({
  ctx,
}: MaintainabilityIndexViewProps): ReactElement | null {
  const [expanded, setExpanded] = useState<Record<Tier["id"], boolean>>({
    excellent: false,
    ok: false,
    concerning: true,
    critical: true,
  });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rows = useMemo<FileRow[]>(() => {
    if (!ctx.tree) return [];
    const out: FileRow[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      out.push({
        id: e.id,
        name: e.name,
        path: e.path,
        mi: maintainabilityIndex(e),
      });
    }
    return out;
  }, [ctx.tree]);

  const grouped = useMemo(() => {
    const g: Record<Tier["id"], FileRow[]> = {
      excellent: [],
      ok: [],
      concerning: [],
      critical: [],
    };
    for (const r of rows) {
      const t = tierFor(r.mi);
      g[t.id].push(r);
    }
    for (const id of Object.keys(g) as Tier["id"][]) {
      g[id].sort((a, b) => a.mi - b.mi);
    }
    return g;
  }, [rows]);

  const avg = useMemo(() => {
    if (rows.length === 0) return 0;
    const sum = rows.reduce((acc, r) => acc + r.mi, 0);
    return sum / rows.length;
  }, [rows]);

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
        로딩 중
      </div>
    );
  }

  const avgTier = tierFor(avg);
  const PAD = 32;

  const ringRadius = 56;
  const ringStroke = 10;
  const circ = 2 * Math.PI * ringRadius;
  const offset = circ * (1 - Math.max(0, Math.min(1, avg / 100)));

  const rootStyle: CSSProperties = {
    animation: `miFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
  };

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        fontFamily: font.sans,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...rootStyle,
          position: "absolute",
          inset: 0,
          padding: `${PAD}px ${PAD}px ${PAD}px ${PAD}px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: space[4],
          overflow: "auto",
        }}
      >
        {/* Header */}
        <div>
          <div
            style={{
              color: tokenColor.text0,
              fontSize: font.size.display,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.tight,
            }}
          >
            Maintainability Index
          </div>
          <div
            style={{
              color: tokenColor.text2,
              fontSize: font.size.xs,
              marginTop: 4,
            }}
          >
            헬스 스코어 — MI = 171 − 5.2·ln(V) − 0.23·CC − 16.2·ln(LoC) ·
            Oman & Hagemeister 1992 · MS VS
          </div>
        </div>

        {/* Health card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[6],
            padding: space[5],
            background: tokenColor.bg2,
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.sm,
          }}
        >
          <svg
            width={ringRadius * 2 + ringStroke * 2}
            height={ringRadius * 2 + ringStroke * 2}
            style={{ flexShrink: 0 }}
            role="img"
            aria-label={`Average MI ${avg.toFixed(1)}`}
          >
            <g
              transform={`translate(${ringRadius + ringStroke}, ${
                ringRadius + ringStroke
              })`}
            >
              <circle
                r={ringRadius}
                fill="none"
                stroke={tokenColor.border}
                strokeWidth={ringStroke}
              />
              <circle
                r={ringRadius}
                fill="none"
                stroke={avgTier.color}
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                transform="rotate(-90)"
                style={{
                  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                  ["--mi-ring-circ" as string]: `${circ}`,
                  ["--mi-ring-offset" as string]: `${offset}`,
                  animation: `miRingSweep 780ms ${ENTRY_EASE} 100ms both`,
                }}
              />
              <text
                textAnchor="middle"
                y={6}
                fill={tokenColor.text0}
                fontSize={26}
                fontWeight={font.weight.semibold}
                fontFamily={font.mono}
              >
                {avg.toFixed(0)}
              </text>
              <text
                textAnchor="middle"
                y={24}
                fill={tokenColor.text2}
                fontSize={font.size.xxs}
                fontFamily={font.sans}
                letterSpacing={font.letter.wide}
              >
                / 100
              </text>
            </g>
          </svg>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: tokenColor.text2,
                fontSize: font.size.xs,
                letterSpacing: font.letter.wide,
                textTransform: "uppercase",
              }}
            >
              Repo Health
            </div>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                alignItems: "baseline",
                gap: space[3],
              }}
            >
              <div
                style={{
                  color: avgTier.color,
                  fontSize: font.size.display + 6,
                  fontWeight: font.weight.semibold,
                  fontFamily: font.sans,
                  letterSpacing: font.letter.tight,
                }}
              >
                {avgTier.label}
              </div>
              <div
                style={{
                  color: tokenColor.text2,
                  fontSize: font.size.sm,
                  fontFamily: font.mono,
                }}
              >
                avg MI {avg.toFixed(1)} · {rows.length} files
              </div>
            </div>
            {/* Tier distribution strip */}
            <div
              style={{
                marginTop: space[3],
                height: 10,
                display: "flex",
                borderRadius: radius.pill,
                overflow: "hidden",
                border: `1px solid ${tokenColor.border}`,
                background: tokenColor.bg3,
              }}
            >
              {TIERS.map(t => {
                const count = grouped[t.id].length;
                const share = rows.length > 0 ? count / rows.length : 0;
                if (share === 0) return null;
                return (
                  <div
                    key={t.id}
                    title={`${t.label}: ${count}`}
                    style={{
                      flexGrow: share,
                      flexBasis: 0,
                      background: t.color,
                      opacity: 0.9,
                    }}
                  />
                );
              })}
            </div>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                gap: space[4],
                color: tokenColor.text2,
                fontSize: font.size.xxs,
                fontFamily: font.mono,
              }}
            >
              {TIERS.map(t => (
                <span key={t.id} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: radius.pill,
                      background: t.color,
                    }}
                  />
                  <span style={{ color: tokenColor.text1 }}>{t.label}</span>
                  <span>{grouped[t.id].length}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tier list sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          {TIERS.map((t, tIdx) => {
            const list = grouped[t.id];
            const isOpen = expanded[t.id];
            return (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${tokenColor.border}`,
                  borderRadius: radius.md,
                  background: tokenColor.bg1,
                  overflow: "hidden",
                  animation: `miFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${120 + tIdx * 60}ms`,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(prev => ({ ...prev, [t.id]: !prev[t.id] }))
                  }
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: `${space[3]}px ${space[4]}px`,
                    display: "flex",
                    alignItems: "center",
                    gap: space[3],
                    cursor: "pointer",
                    fontFamily: font.sans,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radius.pill,
                      background: t.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: tokenColor.text0,
                      fontSize: font.size.lg,
                      fontWeight: font.weight.semibold,
                    }}
                  >
                    {t.label}
                  </span>
                  <span
                    style={{
                      color: tokenColor.text2,
                      fontSize: font.size.xs,
                      fontFamily: font.mono,
                    }}
                  >
                    {t.subtitle}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      color: tokenColor.text1,
                      fontSize: font.size.sm,
                      fontFamily: font.mono,
                    }}
                  >
                    {list.length}
                  </span>
                  <span
                    style={{
                      color: tokenColor.text2,
                      fontSize: font.size.xs,
                      marginLeft: space[2],
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 180ms ease-out",
                      display: "inline-block",
                      width: 10,
                    }}
                  >
                    ▸
                  </span>
                </button>
                {isOpen && list.length > 0 && (
                  <div
                    style={{
                      borderTop: `1px solid ${tokenColor.border}`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {list.slice(0, 80).map((r, i) => {
                      const isHovered = hoveredId === r.id;
                      const isSelected = ctx.selectedId === r.id;
                      const rowStyle: CSSProperties = {
                        padding: `${space[2]}px ${space[4]}px`,
                        display: "flex",
                        alignItems: "center",
                        gap: space[3],
                        cursor: "pointer",
                        background: isSelected
                          ? tokenColor.accentSoft
                          : isHovered
                            ? tokenColor.hover
                            : "transparent",
                        borderBottom:
                          i < Math.min(list.length, 80) - 1
                            ? `1px solid ${tokenColor.borderSoft}`
                            : "none",
                        transition: "background 180ms ease-out",
                        animation: `miFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                        animationDelay: `${180 + Math.min(i * STAGGER_MS, 700)}ms`,
                      };
                      return (
                        <div
                          key={r.id}
                          style={rowStyle}
                          onMouseEnter={() => setHoveredId(r.id)}
                          onMouseLeave={() => setHoveredId(null)}
                          onClick={() => ctx.dispatch.selectEntity(r.id)}
                        >
                          <div
                            style={{
                              color: tokenColor.text0,
                              fontSize: font.size.sm,
                              fontFamily: font.sans,
                              fontWeight: isSelected
                                ? font.weight.semibold
                                : font.weight.regular,
                              flex: 1,
                              minWidth: 0,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {r.name}
                          </div>
                          <div
                            style={{
                              color: tokenColor.text2,
                              fontSize: font.size.xxs,
                              fontFamily: font.mono,
                              flex: "0 0 auto",
                              maxWidth: 280,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.path}
                          </div>
                          <div
                            style={{
                              width: 60,
                              textAlign: "right",
                              color: t.color,
                              fontFamily: font.mono,
                              fontSize: font.size.sm,
                              fontWeight: font.weight.semibold,
                            }}
                          >
                            {r.mi.toFixed(1)}
                          </div>
                        </div>
                      );
                    })}
                    {list.length > 80 && (
                      <div
                        style={{
                          padding: `${space[2]}px ${space[4]}px`,
                          color: tokenColor.text3,
                          fontSize: font.size.xxs,
                          fontFamily: font.mono,
                          textAlign: "center",
                          borderTop: `1px solid ${tokenColor.borderSoft}`,
                        }}
                      >
                        +{list.length - 80} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const MaintainabilityIndexView = memo(MaintainabilityIndexViewImpl);
