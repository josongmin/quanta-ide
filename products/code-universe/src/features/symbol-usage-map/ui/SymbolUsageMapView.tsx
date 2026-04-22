// SymbolUsageMapView — repo-wide per-symbol usage heatmap.
// --------------------------------------------------------------------
// Reference: Voinea & Telea "CVSgrab" (SoftVis 2006); Wheeldon &
// Counsell "CodeSurveyor" treemap usage maps.
//
// Each tile = one file. Tint = # of references to the focused symbol
// inside that file. White / heavily faded = 0 hits; accent blue
// deepens with hit count. Files are sorted by hit count desc so "hot"
// files surface first; a trailing stripe of 0-count tiles provides
// visual context (most of the repo does not touch the symbol).
//
// Header summary: "N files reference · M total hits · top file: X".
// Clicking a tile selects its entity in the shell.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import {
  symbolUsageByFile,
  symbolsInFile,
  type SynthSymbol,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;

const KEYFRAMES = `
@keyframes sum-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sum-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sum-pop {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
`;

const MAX_TILES = 60;

interface Tile {
  entity: Entity;
  hits: number;
}

function kindGlyph(kind: SynthSymbol["kind"]): string {
  switch (kind) {
    case "class":     return "◆";
    case "interface": return "◇";
    case "function":  return "ƒ";
    case "method":    return "m";
    case "variable":  return "v";
  }
}

/** Deterministic tint from hit count. 0 = faded white; scale up through
 *  shallow → deep accent as hits approach `maxHits`. */
function hitTint(hits: number, maxHits: number): { bg: string; border: string; fg: string } {
  if (hits <= 0) {
    return { bg: color.bg2, border: color.border, fg: color.text3 };
  }
  const ratio = Math.min(1, hits / Math.max(1, maxHits));
  // 4-band ramp — small ratios render as a soft tint; big ratios show
  // saturated accent so "hot" files jump visually.
  if (ratio <= 0.25) return { bg: "rgba(13, 153, 255, 0.10)", border: color.accentBorder, fg: color.text0 };
  if (ratio <= 0.55) return { bg: "rgba(13, 153, 255, 0.22)", border: color.accentBorder, fg: color.text0 };
  if (ratio <= 0.80) return { bg: "rgba(13, 153, 255, 0.42)", border: color.accent,        fg: color.bg0   };
  return                 { bg: color.accent,                   border: color.accentHover,  fg: color.bg0   };
}

function SymbolUsageMapViewImpl({ ctx }: Props): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const entity: Entity | null = useMemo(() => {
    if (!ctx.tree) return null;
    const id = ctx.selectedId;
    if (!id) return null;
    return ctx.tree.byId.get(id) ?? null;
  }, [ctx.tree, ctx.selectedId]);

  const symbols = useMemo<SynthSymbol[]>(() => {
    if (!entity) return [];
    return symbolsInFile(entity);
  }, [entity]);

  const [focusedSymbolId, setFocusedSymbolId] = useState<string | null>(null);

  const focused = useMemo<SynthSymbol | null>(() => {
    if (symbols.length === 0) return null;
    const match = symbols.find(s => s.id === focusedSymbolId);
    if (match) return match;
    return symbols.slice().sort((a, b) => b.cyclomatic - a.cyclomatic)[0] ?? null;
  }, [symbols, focusedSymbolId]);

  const tiles = useMemo<Tile[]>(() => {
    if (!ctx.tree || !focused) return [];
    const pool = Array.from(ctx.tree.byId.values()).filter(e =>
      e.kind === "building" || e.kind === "floor",
    );
    const byId = symbolUsageByFile(focused.id, pool);
    // Hot tiles first.
    const hot: Tile[] = [];
    for (const [fileId, hits] of byId) {
      const e = ctx.tree.byId.get(fileId);
      if (!e) continue;
      hot.push({ entity: e, hits });
    }
    hot.sort((a, b) => b.hits - a.hits);

    // Pad with 0-hit tiles for visual context (most of repo unaffected).
    // Order padding by LoC desc so the "context" tiles are the bigger,
    // more prominent files — matches the intuition that a big file NOT
    // touching the symbol is more noteworthy than a 12-LoC helper.
    const hotIds = new Set(hot.map(t => t.entity.id));
    const cold = pool
      .filter(e => !hotIds.has(e.id))
      .sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0));

    const combined: Tile[] = hot.slice(0, MAX_TILES);
    for (const e of cold) {
      if (combined.length >= MAX_TILES) break;
      combined.push({ entity: e, hits: 0 });
    }
    return combined;
  }, [ctx.tree, focused]);

  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <EmptyFrame width={width} height={height} message="파일을 선택하면 심볼 뷰가 나타납니다." />;
  }
  if (symbols.length === 0 || !focused) {
    return <EmptyFrame width={width} height={height} message="이 파일에 추출 가능한 심볼이 없습니다." />;
  }

  const referencing = tiles.filter(t => t.hits > 0).length;
  const totalHits   = tiles.reduce((acc, t) => acc + t.hits, 0);
  const topTile     = tiles.find(t => t.hits > 0) ?? null;
  const maxHits     = tiles.reduce((m, t) => t.hits > m ? t.hits : m, 0);

  return (
    <div style={{
      width, height,
      background: color.bg0,
      fontFamily: font.sans,
      color: color.text0,
      boxSizing: "border-box",
      overflow: "auto",
    }}>
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          <span style={eyebrowStyle}>SYM USAGE · {entity.name}</span>
          <span style={{ fontSize: font.size.xxs, color: color.text2 }}>
            repo 전역 참조 집계 · 제거 전 실사용처 확인
          </span>
        </div>

        {/* Symbol-selector strip */}
        <div style={chipStripStyle} role="tablist" aria-label="Symbols in file">
          {symbols.map((s, i) => {
            const active = s.id === focused.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFocusedSymbolId(s.id)}
                style={{
                  ...selectorChipStyle,
                  background: active ? color.accentSoft : color.bg2,
                  border: `1px solid ${active ? color.accentBorder : color.border}`,
                  color: active ? color.accent : color.text1,
                  animation: `sum-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(i * STAGGER_MS, 420)}ms`,
                }}
              >
                <span style={{ fontFamily: font.mono, opacity: 0.75 }}>{kindGlyph(s.kind)}</span>
                <span style={{ fontFamily: font.mono, fontWeight: font.weight.medium }}>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{
          ...summaryRowStyle,
          animation: `sum-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: "120ms",
        }}>
          <SummaryStat label="files referencing" value={String(referencing)} />
          <SummaryStat label="total hits"        value={String(totalHits)} />
          <SummaryStat
            label="top file"
            value={topTile ? `${topTile.entity.name} · ${topTile.hits}` : "—"}
          />
          <div style={legendWrapStyle}>
            <span style={legendCaptionStyle}>hit intensity</span>
            <Swatch hits={0} max={maxHits} label="0" />
            <Swatch hits={Math.max(1, Math.round(maxHits * 0.25))} max={maxHits} label="•" />
            <Swatch hits={Math.max(1, Math.round(maxHits * 0.55))} max={maxHits} label="▪" />
            <Swatch hits={Math.max(1, Math.round(maxHits * 0.80))} max={maxHits} label="■" />
            <Swatch hits={Math.max(1, maxHits)} max={maxHits} label="hot" />
          </div>
        </div>

        {/* Tile grid */}
        <div style={gridStyle}>
          {tiles.map((t, i) => {
            const tint = hitTint(t.hits, maxHits);
            const isHovered  = hoveredId === t.entity.id;
            const isSelected = ctx.selectedId === t.entity.id;
            // sqrt(LoC) dampens so a 5k-LoC file isn't 50× bigger.
            const loc = t.entity.metrics?.loc ?? 120;
            const tileW = Math.max(88, Math.min(200, Math.round(72 + Math.sqrt(loc) * 2.4)));
            return (
              <div
                key={t.entity.id}
                title={`${t.entity.path} · ${t.hits} hits · ${loc} LoC`}
                style={{
                  ...tileStyle,
                  width: tileW,
                  background: tint.bg,
                  color: tint.fg,
                  border: `1px solid ${isSelected ? color.accent : tint.border}`,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${color.accent}`
                    : isHovered
                      ? "0 4px 12px rgba(0,0,0,0.08)"
                      : "none",
                  transform: isHovered ? "translateY(-1px)" : "translateY(0)",
                  animation: `sum-pop ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(140 + i * STAGGER_MS, 800)}ms`,
                  opacity: t.hits === 0 ? 0.55 : 1,
                }}
                onMouseEnter={() => setHoveredId(t.entity.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => ctx.dispatch.selectEntity(t.entity.id)}
                role="button"
                tabIndex={0}
              >
                <div style={{
                  fontSize: font.size.xxs,
                  fontWeight: font.weight.semibold,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.2,
                }}>
                  {t.entity.name}
                </div>
                <div style={{
                  fontSize: font.size.xxs,
                  fontVariantNumeric: "tabular-nums",
                  opacity: t.hits === 0 ? 0.65 : 0.9,
                  marginTop: 2,
                }}>
                  {t.hits === 0 ? "no hits" : `${t.hits} hit${t.hits === 1 ? "" : "s"}`}
                </div>
              </div>
            );
          })}
        </div>

        {tiles.length === 0 && (
          <div style={emptyInlineStyle}>집계할 파일이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <span style={statStyle}>
      <span style={{
        color: color.text2,
        fontSize: font.size.xxs,
        letterSpacing: font.letter.wide,
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      <span style={{
        color: color.text0,
        fontSize: font.size.md,
        fontWeight: font.weight.semibold,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </span>
    </span>
  );
}

function Swatch({ hits, max, label }: { hits: number; max: number; label: string }): ReactElement {
  const tint = hitTint(hits, max);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{
        width: 14,
        height: 10,
        borderRadius: radius.xs,
        background: tint.bg,
        border: `1px solid ${tint.border}`,
      }} />
      <span style={{
        fontSize: font.size.xxs,
        color: color.text2,
        fontFamily: font.mono,
      }}>
        {label}
      </span>
    </span>
  );
}

function EmptyFrame({ width, height, message }: { width: number; height: number; message: string }): ReactElement {
  return (
    <div style={{
      width, height,
      background: color.bg0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color.text3,
      fontFamily: font.sans,
      fontSize: font.size.md,
    }}>
      <style>{KEYFRAMES}</style>
      <div style={{ animation: `sum-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` }}>{message}</div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  padding: `${space[6]}px ${space[7]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  animation: `sum-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const eyebrowStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
};

const chipStripStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
  overflowX: "auto",
  paddingBottom: space[2],
  scrollbarWidth: "thin",
};

const selectorChipStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  padding: `${space[1]}px ${space[3]}px`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
  cursor: "pointer",
  transition: "background 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out",
  whiteSpace: "nowrap",
};

const summaryRowStyle: CSSProperties = {
  display: "flex",
  gap: space[6],
  alignItems: "center",
  flexWrap: "wrap",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
};

const statStyle: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 120,
};

const legendWrapStyle: CSSProperties = {
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: space[3],
  flexWrap: "wrap",
};

const legendCaptionStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  letterSpacing: font.letter.wide,
  textTransform: "uppercase",
};

const gridStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[2],
};

const tileStyle: CSSProperties = {
  height: 56,
  padding: `${space[2]}px ${space[3]}px`,
  borderRadius: radius.sm,
  cursor: "pointer",
  boxSizing: "border-box",
  transition: "transform 180ms ease-out, box-shadow 180ms ease-out",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const emptyInlineStyle: CSSProperties = {
  padding: space[5],
  color: color.text3,
  textAlign: "center",
};

export const SymbolUsageMapView = memo(SymbolUsageMapViewImpl);
