// CommentAtlasView — dual panel:
//   - Left 60%: folder-grouped file tiles coloured by comment DENSITY.
//     Density runs 0..0.5 (50% cap in the helper) but we colour it on
//     a 0..0.5 scale so the top band reads clearly.
//   - Right 40%: quality histogram (10 buckets, 0..1 score) + stacked
//     category breakdown (TODO / FIXME / docstring / deprecated /
//     dead-code), synthesized from the same seeded RNG.
//
// Reference: Steidl et al. "Quality Analysis of Source Code Comments"
// (ICPC 2013).

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
  commentDensity,
  commentQuality,
  seeded,
} from "../../../shared/analytics/synth-metrics";

export interface CommentAtlasViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes caFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes caRectIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
`;

const CATEGORY_KEYS = ["docstring", "todo", "fixme", "deprecated", "deadcode"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];
const CATEGORY_LABELS: Record<CategoryKey, string> = {
  docstring: "docstring",
  todo: "TODO",
  fixme: "FIXME",
  deprecated: "deprecated",
  deadcode: "dead-code",
};
const CATEGORY_COLORS: Record<CategoryKey, string> = {
  docstring: tokenColor.success,
  todo: tokenColor.accent,
  fixme: tokenColor.warn,
  // Purple for "deprecated" — no token equivalent; kept literal.
  deprecated: "#a674d8",
  deadcode: tokenColor.danger,
};

interface Tile {
  id: string;
  name: string;
  path: string;
  loc: number;
  density: number; // 0..0.5
  quality: number; // 0..1
  categories: Record<CategoryKey, number>;
}

interface FolderGroup {
  key: string;
  label: string;
  tiles: Tile[];
  avgDensity: number;
}

function CommentAtlasViewImpl({ ctx }: CommentAtlasViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const { groups, histogram, categoryTotals, totalTiles } = useMemo(() => {
    if (!ctx.tree) {
      return {
        groups: [] as FolderGroup[],
        histogram: new Array(10).fill(0) as number[],
        categoryTotals: zeroCategories(),
        totalTiles: 0,
      };
    }

    const byFolder = new Map<string, FolderGroup>();
    const histogram = new Array(10).fill(0) as number[];
    const categoryTotals = zeroCategories();
    let totalTiles = 0;

    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const density = commentDensity(e as Entity);
      const quality = commentQuality(e as Entity);
      const categories = synthCategories(e as Entity);

      // Histogram bucket (10 bins over 0..1).
      const bi = Math.min(9, Math.max(0, Math.floor(quality * 10)));
      histogram[bi] = (histogram[bi] ?? 0) + 1;

      for (const k of CATEGORY_KEYS) {
        categoryTotals[k] += categories[k];
      }
      totalTiles++;

      const folder = folderKey(e);
      let g = byFolder.get(folder);
      if (!g) {
        g = { key: folder, label: folder, tiles: [], avgDensity: 0 };
        byFolder.set(folder, g);
      }
      g.tiles.push({
        id: e.id,
        name: e.name,
        path: e.path,
        loc: e.metrics?.loc ?? 0,
        density,
        quality,
        categories,
      });
    }

    const out = Array.from(byFolder.values());
    for (const g of out) {
      g.tiles.sort((a, b) => b.density - a.density);
      const total = g.tiles.reduce((acc, t) => acc + t.density, 0);
      g.avgDensity = g.tiles.length === 0 ? 0 : total / g.tiles.length;
    }
    // Densest folder first.
    out.sort((a, b) => b.avgDensity - a.avgDensity);

    return { groups: out, histogram, categoryTotals, totalTiles };
  }, [ctx.tree]);

  if (!ctx.tree || groups.length === 0) {
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

  let tileIdx = 0;
  const histMax = Math.max(1, ...histogram);

  const categoryGrand = CATEGORY_KEYS.reduce(
    (acc, k) => acc + categoryTotals[k],
    0,
  );

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        animation: `caFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          height: "100%",
          boxSizing: "border-box",
          padding: "40px 48px 32px 48px",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: space[4],
          minHeight: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              letterSpacing: font.letter.tight,
            }}
          >
            Comment Atlas
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            주석 지도 — 밀도 × 품질 (Steidl ICPC 2013)
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60fr 40fr",
            gap: space[4],
            minHeight: 0,
          }}
        >
          {/* Left: density grid */}
          <div
            style={{
              overflowY: "auto",
              paddingRight: space[2],
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[3],
                marginBottom: space[4],
                fontSize: font.size.xxs,
                color: tokenColor.text2,
              }}
            >
              <LegendSwatch color={densityColor(0.02)} label="<5%" />
              <LegendSwatch color={densityColor(0.12)} label="5-20%" />
              <LegendSwatch color={densityColor(0.28)} label="20-35%" />
              <LegendSwatch color={densityColor(0.45)} label="≥35%" />
              <span style={{ color: tokenColor.text3 }}>• 블록 크기 = LoC</span>
            </div>

            {groups.map((g, gi) => (
              <div
                key={g.key}
                style={{
                  marginBottom: space[5],
                  animation: `caRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(gi * 40, 280)}ms`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    marginBottom: space[2],
                  }}
                >
                  <div
                    style={{
                      fontSize: font.size.md,
                      fontWeight: font.weight.semibold,
                      color: tokenColor.text0,
                    }}
                  >
                    {g.label}
                  </div>
                  <div
                    style={{
                      fontSize: font.size.xxs,
                      color: tokenColor.text2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {g.tiles.length} files · avg {Math.round(g.avgDensity * 100)}%
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    padding: space[2],
                    borderRadius: radiusToken.md,
                    background: tokenColor.bg2,
                    border: `1px solid ${tokenColor.border}`,
                  }}
                >
                  {g.tiles.map(t => {
                    const isHovered = hoveredId === t.id;
                    const isSelected = ctx.selectedId === t.id;
                    const widthPx = Math.max(
                      30,
                      Math.min(170, Math.round(30 + Math.sqrt(t.loc) * 4)),
                    );
                    const tileStyle: CSSProperties = {
                      position: "relative",
                      width: widthPx,
                      height: 48,
                      borderRadius: radiusToken.sm,
                      background: densityColor(t.density),
                      border: `1px solid ${
                        isSelected ? tokenColor.accent : "rgba(0,0,0,0.06)"
                      }`,
                      boxShadow: isSelected
                        ? `0 0 0 2px ${tokenColor.accent}`
                        : "none",
                      cursor: "pointer",
                      transition:
                        "transform 180ms ease-out, filter 180ms ease-out",
                      transform: isHovered ? "scale(1.03)" : "scale(1)",
                      animation: `caRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${Math.min(tileIdx++ * STAGGER_MS, 600)}ms`,
                      overflow: "hidden",
                      padding: "6px 8px",
                      boxSizing: "border-box",
                      color: densityTextColor(t.density),
                    };
                    const title =
                      `${t.path}\n`
                      + `density  ${Math.round(t.density * 100)}%\n`
                      + `quality  ${Math.round(t.quality * 100)}%\n`
                      + `LoC ${t.loc}`;
                    return (
                      <div
                        key={t.id}
                        title={title}
                        style={tileStyle}
                        onMouseEnter={() => setHoveredId(t.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => ctx.dispatch.selectEntity(t.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div
                          style={{
                            fontSize: font.size.xxs,
                            fontWeight: font.weight.semibold,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.2,
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: font.size.xxs,
                            fontVariantNumeric: "tabular-nums",
                            opacity: 0.85,
                            marginTop: 2,
                          }}
                        >
                          {Math.round(t.density * 100)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: quality histogram + category breakdown */}
          <div
            style={{
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: space[5],
            }}
          >
            <section
              style={{
                background: tokenColor.bg1,
                border: `1px solid ${tokenColor.border}`,
                borderRadius: radiusToken.md,
                padding: space[4],
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
                Quality histogram
              </div>
              <div
                style={{
                  marginTop: space[1],
                  fontSize: font.size.xxs,
                  color: tokenColor.text3,
                }}
              >
                0 = TODO/FIXME / 낡음 · 1 = 잘 쓰여진 docstring
              </div>
              <div
                style={{
                  marginTop: space[3],
                  display: "grid",
                  gridTemplateColumns: "repeat(10, 1fr)",
                  gap: 4,
                  alignItems: "end",
                  height: 96,
                }}
              >
                {histogram.map((n, i) => {
                  const h = (n / histMax) * 100;
                  const quality = (i + 0.5) / 10;
                  const fill = qualityColor(quality);
                  return (
                    <div
                      key={i}
                      title={`${Math.round(i * 10)}-${Math.round((i + 1) * 10)}%: ${n} files`}
                      style={{
                        position: "relative",
                        height: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max(2, h)}%`,
                          background: fill,
                          borderRadius: radiusToken.xs,
                          transition: "height 520ms cubic-bezier(0.22, 1, 0.28, 1)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: space[2],
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: font.size.xxs,
                  color: tokenColor.text3,
                }}
              >
                <span>low quality</span>
                <span>{totalTiles} files total</span>
                <span>high quality</span>
              </div>
            </section>

            <section
              style={{
                background: tokenColor.bg1,
                border: `1px solid ${tokenColor.border}`,
                borderRadius: radiusToken.md,
                padding: space[4],
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
                Category breakdown
              </div>
              <div
                style={{
                  marginTop: space[1],
                  fontSize: font.size.xxs,
                  color: tokenColor.text3,
                }}
              >
                주석 분류별 총 라인 수 (레포 전체)
              </div>

              {/* Stacked bar */}
              <div
                style={{
                  marginTop: space[3],
                  display: "flex",
                  height: 14,
                  borderRadius: radiusToken.pill,
                  overflow: "hidden",
                  background: tokenColor.bg3,
                  border: `1px solid ${tokenColor.border}`,
                }}
              >
                {CATEGORY_KEYS.map(k => {
                  const v = categoryTotals[k];
                  const pct = categoryGrand === 0 ? 0 : v / categoryGrand;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={k}
                      title={`${CATEGORY_LABELS[k]}: ${v}`}
                      style={{
                        width: `${pct * 100}%`,
                        background: CATEGORY_COLORS[k],
                      }}
                    />
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: space[3],
                  display: "flex",
                  flexDirection: "column",
                  gap: space[1],
                }}
              >
                {CATEGORY_KEYS.map(k => {
                  const v = categoryTotals[k];
                  const pct = categoryGrand === 0 ? 0 : v / categoryGrand;
                  return (
                    <div
                      key={k}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "14px 1fr auto auto",
                        alignItems: "center",
                        columnGap: space[2],
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          background: CATEGORY_COLORS[k],
                          borderRadius: 2,
                        }}
                      />
                      <span
                        style={{
                          fontSize: font.size.xs,
                          color: tokenColor.text1,
                        }}
                      >
                        {CATEGORY_LABELS[k]}
                      </span>
                      <span
                        style={{
                          fontSize: font.size.xxs,
                          color: tokenColor.text2,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {v}
                      </span>
                      <span
                        style={{
                          fontSize: font.size.xxs,
                          color: tokenColor.text3,
                          fontVariantNumeric: "tabular-nums",
                          minWidth: 36,
                          textAlign: "right",
                        }}
                      >
                        {Math.round(pct * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 12,
          height: 12,
          background: color,
          borderRadius: 2,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      />
      <span>{label}</span>
    </div>
  );
}

function densityColor(d: number): string {
  // 0..0.5 scale (cap from helper). Map linearly → 0..1 then pick band.
  const n = Math.min(1, d / 0.5);
  if (n < 0.15) return "#eef3f8";
  if (n < 0.35) return "#b8dcf2";
  if (n < 0.6) return "#6aaed6";
  if (n < 0.8) return "#3578a8";
  return "#1d4f77";
}

function densityTextColor(d: number): string {
  const n = Math.min(1, d / 0.5);
  return n < 0.35 ? tokenColor.text0 : tokenColor.bg0;
}

function qualityColor(q: number): string {
  // Quality heat ramp — literal scale intentionally outside tokens
  // (tokens only carry the two end-points; we need four bands for
  // histogram legibility).
  if (q < 0.3) return tokenColor.danger;
  if (q < 0.55) return "#f1a557";
  if (q < 0.8) return "#8dd6a8";
  return tokenColor.success;
}

function folderKey(entity: Entity): string {
  const p = entity.path;
  const idx = p.lastIndexOf("/");
  if (idx > 0) return p.slice(0, idx);
  return "/";
}

function zeroCategories(): Record<CategoryKey, number> {
  return {
    docstring: 0,
    todo: 0,
    fixme: 0,
    deprecated: 0,
    deadcode: 0,
  };
}

/** Synthesize per-category comment counts for an entity. Uses same
 *  seeded-RNG contract as the rest of the analytics helpers so runs
 *  are stable across views. */
function synthCategories(entity: Entity): Record<CategoryKey, number> {
  const rng = seeded(entity.id, "comment-cats");
  const loc = entity.metrics?.loc ?? 120;
  const density = commentDensity(entity); // 0..0.5
  const totalComments = Math.max(1, Math.round(loc * density));

  // Weighted shares — most comments are docstrings, long tail for the
  // rest. Shares summed then normalised so total ≈ totalComments.
  const raw: Record<CategoryKey, number> = {
    docstring: 0.5 + rng() * 0.3,
    todo: rng() * 0.35,
    fixme: rng() * 0.2,
    deprecated: rng() * 0.12,
    deadcode: rng() * 0.15,
  };
  const sum = CATEGORY_KEYS.reduce((acc, k) => acc + raw[k], 0) || 1;
  const out: Record<CategoryKey, number> = zeroCategories();
  for (const k of CATEGORY_KEYS) {
    out[k] = Math.max(0, Math.round((raw[k] / sum) * totalComments));
  }
  return out;
}

export const CommentAtlasView = memo(CommentAtlasViewImpl);
