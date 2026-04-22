// PackageSurfaceView — squarified treemap of files inside a package,
// coloured by defect-probability heat.
// --------------------------------------------------------------------
// References:
//   - Shneiderman, "Tree Visualization with Tree-Maps — A 2D Space-
//     Filling Approach", ACM InfoVis 1991.
//   - Johnson & Shneiderman SequoiaView (1999) — sqrt-scaled leaf
//     sizing used here: tile width/height ∝ sqrt(LoC) so a 5k-LoC
//     file isn't 50× a 100-LoC file.
//   - Bruls, Huijse & van Wijk, "Squarified Treemaps" (2000) — the
//     aspect-ratio greedy layout.
//
// What it shows:
//   - Only descendant `building` entities of the selected package.
//   - Tile size ∝ sqrt(LoC); color ∝ `bugProbability` (green → red).
//   - Hover: path + metrics tooltip. Click: dispatch selectEntity →
//     Code Universe drills into the file.

import {
  memo,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { bugProbability } from "../../../shared/analytics/synth-metrics";

// ── Animation tokens ──────────────────────────────────────────────────
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const HOVER_MS = 180;

const KEYFRAMES = `
@keyframes psFadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes psTileIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
`;

// ── Layout constants ─────────────────────────────────────────────────
const PAD_OUTER = 8;
const PAD_INNER = 2;
const MIN_TILE = 18;

interface Leaf {
  id: string;
  name: string;
  path: string;
  loc: number;
  risk: number;
  weight: number; // sqrt(loc)
}

interface Tile extends Leaf {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackageSurfaceViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

function PackageSurfaceViewImpl({
  ctx,
  entity,
  empty,
}: PackageSurfaceViewProps): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const leaves = useMemo<Leaf[]>(() => {
    if (!entity || !ctx.tree) return [];
    const out: Leaf[] = [];
    const seen = new Set<string>();
    const stack: string[] = [entity.id];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const e = ctx.tree.byId.get(id);
      if (!e) continue;
      if (e.kind === "building") {
        const loc = e.metrics?.loc ?? 120;
        out.push({
          id: e.id,
          name: e.name,
          path: e.path,
          loc,
          risk: bugProbability(e, ctx.graph?.fileEdges),
          weight: Math.sqrt(Math.max(4, loc)),
        });
      }
      for (const c of e.childIds) stack.push(c);
    }
    // Hottest first so big / risky tiles anchor the top-left.
    out.sort((a, b) => b.weight - a.weight);
    return out;
  }, [entity, ctx.tree, ctx.graph]);

  // Squarified packing region — leave room for header.
  const layoutRegion = useMemo(() => {
    const headerH = 92;
    return {
      x: PAD_OUTER,
      y: headerH,
      w: Math.max(64, width - PAD_OUTER * 2),
      h: Math.max(64, height - headerH - PAD_OUTER),
    };
  }, [width, height]);

  const tiles = useMemo<Tile[]>(() => {
    if (leaves.length === 0) return [];
    return squarify(leaves, layoutRegion);
  }, [leaves, layoutRegion]);

  // Empty / no-selection state.
  if (empty || !entity) {
    return (
      <div style={rootContainer(width, height)}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStateStyle}>폴더/패키지를 선택하세요.</div>
      </div>
    );
  }

  if (leaves.length === 0) {
    return (
      <div style={rootContainer(width, height)}>
        <style>{KEYFRAMES}</style>
        <Header entity={entity} count={0} />
        <div style={emptyStateStyle}>패키지 내부에 파일이 없습니다.</div>
      </div>
    );
  }

  const hovered = hoveredId ? tiles.find(t => t.id === hoveredId) ?? null : null;

  return (
    <div style={rootContainer(width, height)}>
      <style>{KEYFRAMES}</style>
      <Header entity={entity} count={leaves.length} />

      <div
        style={{
          position: "absolute",
          left: layoutRegion.x,
          top: layoutRegion.y,
          width: layoutRegion.w,
          height: layoutRegion.h,
          animation: `psFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
        }}
        onMouseMove={e => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHoveredId(null);
          setCursor(null);
        }}
      >
        {tiles.map((t, i) => {
          const isHovered = hoveredId === t.id;
          const isSelected = ctx.selectedId === t.id;
          const tileStyle: CSSProperties = {
            position: "absolute",
            left: t.x,
            top: t.y,
            width: Math.max(0, t.w - PAD_INNER),
            height: Math.max(0, t.h - PAD_INNER),
            background: riskColor(t.risk),
            borderRadius: radiusToken.sm,
            border: `1px solid ${
              isSelected ? tokenColor.accent : "rgba(0,0,0,0.06)"
            }`,
            boxShadow: isSelected
              ? `0 0 0 2px ${tokenColor.accent}`
              : isHovered
              ? "0 4px 12px rgba(0,0,0,0.08)"
              : "none",
            cursor: "pointer",
            overflow: "hidden",
            boxSizing: "border-box",
            padding: t.w >= 56 && t.h >= 28 ? "6px 8px" : 0,
            color: riskTextColor(t.risk),
            transition: `transform ${HOVER_MS}ms ease-out, box-shadow ${HOVER_MS}ms ease-out, filter ${HOVER_MS}ms ease-out`,
            transform: isHovered ? "scale(1.02)" : "scale(1)",
            filter: hoveredId && !isHovered ? "saturate(0.7)" : "none",
            animation: `psTileIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${Math.min(i * STAGGER_MS, 480)}ms`,
            zIndex: isHovered ? 2 : 1,
          };
          return (
            <div
              key={t.id}
              style={tileStyle}
              onMouseEnter={() => setHoveredId(t.id)}
              onClick={() => ctx.dispatch.selectEntity(t.id)}
              role="button"
              tabIndex={0}
              aria-label={`${t.path} · risk ${Math.round(t.risk * 100)}%`}
            >
              {t.w >= 56 && t.h >= 28 && (
                <>
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
                  {t.h >= 44 && (
                    <div
                      style={{
                        fontSize: font.size.xxs,
                        fontVariantNumeric: "tabular-nums",
                        opacity: 0.85,
                        marginTop: 2,
                      }}
                    >
                      {Math.round(t.risk * 100)}% · {t.loc} LoC
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {hovered && cursor && (
          <Tooltip tile={hovered} cursor={cursor} region={layoutRegion} />
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

function Header({ entity, count }: { entity: Entity; count: number }): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: `${space[5]}px ${space[6]}px ${space[3]}px`,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: font.size.xxl,
          fontWeight: font.weight.bold,
          letterSpacing: font.letter.tight,
          color: tokenColor.text0,
        }}
      >
        Package Surface
      </div>
      <div
        style={{
          fontSize: font.size.xs,
          color: tokenColor.text2,
          marginTop: 4,
        }}
      >
        <span style={{ fontWeight: font.weight.semibold, color: tokenColor.text1 }}>
          {entity.name}
        </span>
        <span> · {count} files · squarified treemap × bug probability</span>
      </div>
    </div>
  );
}

function Tooltip({
  tile,
  cursor,
  region,
}: {
  tile: Tile;
  cursor: { x: number; y: number };
  region: { w: number; h: number };
}): ReactElement {
  const TW = 220;
  const TH = 66;
  const x = Math.min(region.w - TW - 6, cursor.x + 12);
  const y = Math.max(6, Math.min(region.h - TH - 6, cursor.y - TH / 2));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: TW,
        padding: "8px 10px",
        background: tokenColor.bg0,
        border: `1px solid ${tokenColor.border}`,
        borderRadius: radiusToken.md,
        boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
        pointerEvents: "none",
        fontFamily: font.sans,
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          color: tokenColor.text0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {tile.name}
      </div>
      <div
        style={{
          fontSize: font.size.xxs,
          color: tokenColor.text2,
          marginTop: 2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {tile.path}
      </div>
      <div
        style={{
          fontSize: font.size.xs,
          color: tokenColor.text1,
          marginTop: 6,
          display: "flex",
          gap: 10,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>risk <b>{Math.round(tile.risk * 100)}%</b></span>
        <span>loc <b>{tile.loc}</b></span>
      </div>
    </div>
  );
}

// ── Squarified packing (Bruls et al. 2000, lightweight port) ──────────

function squarify(
  leaves: readonly Leaf[],
  region: { x: number; y: number; w: number; h: number },
): Tile[] {
  const total = leaves.reduce((acc, l) => acc + l.weight, 0);
  if (total <= 0 || region.w <= 0 || region.h <= 0) return [];
  const area = region.w * region.h;
  const scale = area / total;

  const out: Tile[] = [];
  let rx = region.x;
  let ry = region.y;
  let rw = region.w;
  let rh = region.h;

  let i = 0;
  while (i < leaves.length) {
    const short = Math.min(rw, rh);
    if (short <= 0) break;

    // Greedy: extend a row of leaves until aspect ratio worsens.
    const row: Leaf[] = [];
    let rowSum = 0;
    let bestRatio = Infinity;

    while (i < leaves.length) {
      const next = leaves[i]!;
      const nextSum = rowSum + next.weight * scale;
      const worst = worstRatio([...row, next].map(l => l.weight * scale), nextSum, short);
      if (worst >= bestRatio) break;
      row.push(next);
      rowSum = nextSum;
      bestRatio = worst;
      i++;
    }

    if (row.length === 0) {
      // Degenerate: force one leaf.
      row.push(leaves[i]!);
      rowSum = row[0]!.weight * scale;
      i++;
    }

    // Emit the row — align along the shorter side.
    const rowDepth = rowSum / short;
    if (rw >= rh) {
      // Row runs along height; row sits as a column on the left.
      let ty = ry;
      for (const l of row) {
        const slice = (l.weight * scale) / rowDepth;
        out.push({
          ...l,
          x: rx,
          y: ty,
          w: Math.max(MIN_TILE, rowDepth),
          h: Math.max(MIN_TILE, slice),
        });
        ty += slice;
      }
      rx += rowDepth;
      rw -= rowDepth;
    } else {
      // Row runs along width; row sits as a row on the top.
      let tx = rx;
      for (const l of row) {
        const slice = (l.weight * scale) / rowDepth;
        out.push({
          ...l,
          x: tx,
          y: ry,
          w: Math.max(MIN_TILE, slice),
          h: Math.max(MIN_TILE, rowDepth),
        });
        tx += slice;
      }
      ry += rowDepth;
      rh -= rowDepth;
    }
  }

  return out;
}

function worstRatio(areas: number[], sum: number, side: number): number {
  if (areas.length === 0 || sum <= 0 || side <= 0) return Infinity;
  let max = -Infinity;
  let min = Infinity;
  for (const a of areas) {
    if (a > max) max = a;
    if (a < min) min = a;
  }
  const s2 = sum * sum;
  const side2 = side * side;
  const r1 = (side2 * max) / s2;
  const r2 = s2 / (side2 * min);
  return Math.max(r1, r2);
}

// ── Colour helpers ────────────────────────────────────────────────────

/** Map 0..1 bug probability to a tile fill. Low = soft green, mid =
 *  amber, high = bright red (token `danger`). */
function riskColor(risk: number): string {
  if (risk <= 0.2) return "#8dd6a8";
  if (risk <= 0.4) return "#c9d96a";
  if (risk <= 0.6) return "#f1c05a";
  if (risk <= 0.8) return "#f1a557";
  return tokenColor.danger;
}

function riskTextColor(risk: number): string {
  // Mid/high risk tiles have saturated fills → white text; soft greens → dark.
  return risk >= 0.4 ? tokenColor.bg0 : tokenColor.text0;
}

// ── Shared styles ─────────────────────────────────────────────────────

function rootContainer(w: number, h: number): CSSProperties {
  return {
    position: "relative",
    width: w,
    height: h,
    background: tokenColor.bg0,
    fontFamily: font.sans,
    color: tokenColor.text0,
    overflow: "hidden",
  };
}

const emptyStateStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: tokenColor.text3,
  fontSize: font.size.md,
  fontFamily: font.sans,
};

export const PackageSurfaceView = memo(PackageSurfaceViewImpl);
