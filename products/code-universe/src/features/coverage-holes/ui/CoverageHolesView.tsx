// CoverageHolesView — test-coverage heatmap tree as a simple row grid.
// --------------------------------------------------------------------
// We deliberately avoid squarified treemap packing — it's a lot of
// geometry for a view that's supposed to be glanceable. Instead:
//
//   1. Group files by parent folder (`street` entity if present,
//      otherwise synthesize from dirname).
//   2. Sort folders by count desc so the biggest groups are on top.
//   3. Lay each folder out as a labelled block, with its files inside
//      arranged as a wrapping row of mini-rectangles. Each rect's
//      width is proportional to sqrt(LoC), height is fixed.
//   4. Colour each rect by `coverage(entity)`: bright red (≤ 30%) →
//      amber (≤ 60%) → soft green (≤ 85%) → deep green (>85%).
//
// This keeps the layout cheap, legible, and kind to reflows while
// still reading as "file rectangles coloured by coverage".

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
import { coverage } from "../../../shared/analytics/synth-metrics";

export interface CoverageHolesViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 500;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes covFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes covRectIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface Tile {
  id: string;
  name: string;
  path: string;
  loc: number;
  cov: number; // 0..1
}

interface FolderGroup {
  key: string;
  label: string;
  tiles: Tile[];
  avgCov: number;
}

function CoverageHolesViewImpl({ ctx }: CoverageHolesViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const groups = useMemo<FolderGroup[]>(() => {
    if (!ctx.tree) return [];
    const byFolder = new Map<string, FolderGroup>();
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const folder = folderKey(e);
      let g = byFolder.get(folder);
      if (!g) {
        g = { key: folder, label: folder, tiles: [], avgCov: 0 };
        byFolder.set(folder, g);
      }
      g.tiles.push({
        id: e.id,
        name: e.name,
        path: e.path,
        loc: e.metrics?.loc ?? 0,
        cov: coverage(e as Entity),
      });
    }
    const out = Array.from(byFolder.values());
    for (const g of out) {
      // Sort worst coverage first inside each folder (holes upfront).
      g.tiles.sort((a, b) => a.cov - b.cov);
      const total = g.tiles.reduce((acc, t) => acc + t.cov, 0);
      g.avgCov = g.tiles.length === 0 ? 0 : total / g.tiles.length;
    }
    // Folder order: worst average coverage first.
    out.sort((a, b) => a.avgCov - b.avgCov);
    return out;
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

  const rootStyle: CSSProperties = {
    animation: `covFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  let tileIdx = 0;

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              letterSpacing: font.letter.tight,
            }}
          >
            Coverage Holes
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            테스트 커버리지 구멍 — 빨간 블록이 무테스트 영역
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[4],
            margin: `${space[4]}px 0 ${space[6]}px 0`,
            fontSize: font.size.xxs,
            color: tokenColor.text2,
          }}
        >
          <LegendSwatch color={coverageColor(0.15)} label="≤30%" />
          <LegendSwatch color={coverageColor(0.45)} label="30-60%" />
          <LegendSwatch color={coverageColor(0.75)} label="60-85%" />
          <LegendSwatch color={coverageColor(0.95)} label=">85%" />
          <div style={{ color: tokenColor.text3 }}>• 블록 크기 = LoC</div>
        </div>

        {/* Folder groups */}
        {groups.map((g, gi) => (
          <div
            key={g.key}
            style={{
              marginBottom: space[6],
              animation: `covRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(gi * 40, 300)}ms`,
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
                  fontSize: font.size.lg,
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
                {g.tiles.length} files · avg {Math.round(g.avgCov * 100)}%
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
                // sqrt(LoC) dampens so a 5k-LoC file isn't 50× bigger.
                const widthPx = Math.max(
                  28,
                  Math.min(180, Math.round(28 + Math.sqrt(t.loc) * 4)),
                );
                const tileStyle: CSSProperties = {
                  position: "relative",
                  width: widthPx,
                  height: 48,
                  borderRadius: radiusToken.sm,
                  background: coverageColor(t.cov),
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
                  filter: isHovered ? "none" : undefined,
                  animation: `covRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(tileIdx++ * STAGGER_MS, 600)}ms`,
                  overflow: "hidden",
                  padding: "6px 8px",
                  boxSizing: "border-box",
                  color: coverageTextColor(t.cov),
                };
                return (
                  <div
                    key={t.id}
                    title={`${t.path} · coverage ${Math.round(t.cov * 100)}% · ${t.loc} LoC`}
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
                      {Math.round(t.cov * 100)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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

/** Map coverage fraction → CSS colour. Red → green scale tuned to stay
 *  readable on white (bright red is intentional for the ≤30% bucket). */
function coverageColor(cov: number): string {
  // Four-band ramp. Tokens cover the two ends (danger / success); amber
  // and soft-green are literal to keep the gradient readable.
  if (cov <= 0.3) return tokenColor.danger;
  if (cov <= 0.6) return "#f1a557";
  if (cov <= 0.85) return "#8dd6a8";
  return tokenColor.success;
}

/** Text colour that reads on top of the matching tile background. */
function coverageTextColor(cov: number): string {
  // Red/amber tiles → white text; greens → dark for contrast.
  return cov <= 0.6 ? tokenColor.bg0 : tokenColor.text0;
}

/** Derive a folder label from an entity. Prefer its parent street/galaxy
 *  name when present; otherwise fall back to dirname of the path. */
function folderKey(entity: Entity): string {
  const p = entity.path;
  const idx = p.lastIndexOf("/");
  if (idx > 0) return p.slice(0, idx);
  return "/";
}

export const CoverageHolesView = memo(CoverageHolesViewImpl);
