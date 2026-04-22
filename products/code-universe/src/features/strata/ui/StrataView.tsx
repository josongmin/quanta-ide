// StrataView — files as geological strata by age.
// --------------------------------------------------------------------
// Y-axis = file age (bottom = oldest, top = newest). Each file is a small
// tile positioned within the band corresponding to its age. Bands have
// labelled background stripes (Jurassic / Triassic / Paleogene / Modern).
// Tiles inside a band are packed left-to-right with stagger-slide-in
// on mount (14-22 ms per tile).

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import { ageDays, authorHue } from "../../../shared/analytics/synth-metrics";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";

export interface StrataViewProps {
  ctx: ViewContextValue;
}

// ── Layer definitions (bottom → top, oldest → newest) ─────────────────
// Band/accent colors are HSL-derived from a seed string via authorHue()
// so every color in this view traces back to the central palette rule
// (no free-floating hex literals).

interface StrataLayer {
  id: string;
  label: string;
  subtitle: string;
  minDays: number;   // inclusive
  maxDays: number;   // exclusive ( +Infinity for oldest )
  bandColor: string; // soft bg
  accent: string;    // label accent
}

function bandHsl(seed: string, sat: number, light: number): string {
  return `hsl(${authorHue(seed)}, ${sat}%, ${light}%)`;
}

const LAYERS: readonly StrataLayer[] = [
  // Oldest first — rendered at the bottom.
  { id: "jurassic", label: "Jurassic",  subtitle: "1y+",    minDays: 365, maxDays: Infinity, bandColor: bandHsl("strata-jurassic", 32, 92), accent: bandHsl("strata-jurassic", 55, 32) },
  { id: "triassic", label: "Triassic",  subtitle: "6-12mo", minDays: 180, maxDays: 365,      bandColor: bandHsl("strata-triassic", 32, 92), accent: bandHsl("strata-triassic", 55, 32) },
  { id: "paleogene",label: "Paleogene", subtitle: "1-6mo",  minDays: 30,  maxDays: 180,      bandColor: bandHsl("strata-paleogene", 32, 92), accent: bandHsl("strata-paleogene", 55, 32) },
  { id: "modern",   label: "Modern",    subtitle: "<1mo",   minDays: 0,   maxDays: 30,       bandColor: bandHsl("strata-modern", 32, 92),   accent: bandHsl("strata-modern", 55, 32) },
];

// Render order: topmost = newest (Modern), bottom = oldest (Jurassic).
const RENDER_ORDER: readonly StrataLayer[] = [...LAYERS].reverse();

function layerOf(days: number): StrataLayer {
  for (const l of LAYERS) {
    if (days >= l.minDays && days < l.maxDays) return l;
  }
  return LAYERS[LAYERS.length - 1]!;
}

// ── Entrance keyframes ────────────────────────────────────────────────

const KF_CSS = `
@keyframes stv-fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1);    }
}
@keyframes stv-tileIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}
`;

let _kfInjected = false;
function ensureKeyframes(): void {
  if (_kfInjected || typeof document === "undefined") return;
  _kfInjected = true;
  const el = document.createElement("style");
  el.textContent = KF_CSS;
  document.head.appendChild(el);
}

// ── Main ──────────────────────────────────────────────────────────────

interface TileEntry {
  id: string;
  name: string;
  path: string;
  days: number;
}

function StrataViewImpl({ ctx }: StrataViewProps): ReactElement | null {
  ensureKeyframes();

  const byLayer = useMemo<ReadonlyMap<string, TileEntry[]>>(() => {
    const m = new Map<string, TileEntry[]>();
    for (const l of LAYERS) m.set(l.id, []);
    if (!ctx.tree) return m;
    for (const e of ctx.tree.byId.values() as Iterable<Entity>) {
      if (e.kind !== "building") continue;
      const days = ageDays(e);
      const layer = layerOf(days);
      m.get(layer.id)!.push({ id: e.id, name: e.name, path: e.path, days });
    }
    for (const arr of m.values()) arr.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
    return m;
  }, [ctx.tree]);

  if (!ctx.tree) return null;

  // ── Styles ──────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    fontFamily: font.sans,
    animation: `stv-fadeIn 500ms cubic-bezier(0.22, 1, 0.28, 1) both`,
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    lineHeight: 1.2,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: `${space[3]}px ${space[4]}px`,
    display: "flex",
    flexDirection: "column",
    gap: space[2],
  };

  const bandWrapStyle = (bandColor: string): CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "stretch",
    gap: space[3],
    padding: `${space[2]}px ${space[3]}px`,
    borderRadius: radius.md,
    border: `1px solid ${tokenColor.borderSoft}`,
    background: `linear-gradient(to right, ${bandColor} 0%, ${bandColor} 140px, ${tokenColor.bg2} 140px, ${tokenColor.bg1} 100%)`,
    minHeight: 60,
  });

  const labelColStyle = (accent: string): CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 2,
    width: 120,
    flexShrink: 0,
    color: accent,
  });

  const layerLabelStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    letterSpacing: "0.02em",
    fontFamily: font.sans,
  };

  const layerSubStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    fontFamily: font.mono,
    fontVariantNumeric: "tabular-nums",
  };

  const tilesStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexWrap: "wrap",
    alignContent: "center",
    gap: 4,
    minHeight: 0,
  };

  return (
    <div style={rootStyle} role="region" aria-label="Strata">
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Strata</span>
        <span style={subtitleStyle}>지층 — 파일 생성 시점별 분포 · git log 첫 커밋 타임스탬프</span>
      </div>

      {/* Bands — newest on top, oldest at bottom */}
      <div style={bodyStyle}>
        {RENDER_ORDER.map(layer => {
          const tiles = byLayer.get(layer.id) ?? [];
          return (
            <div
              key={layer.id}
              style={bandWrapStyle(layer.bandColor)}
              aria-label={`${layer.label} layer, ${tiles.length} files`}
            >
              <div style={labelColStyle(layer.accent)}>
                <span style={layerLabelStyle}>{layer.label}</span>
                <span style={layerSubStyle}>{layer.subtitle}</span>
                <span style={layerSubStyle}>{tiles.length} file{tiles.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={tilesStyle}>
                {tiles.length === 0 && (
                  <span style={{ fontSize: font.size.xxs, color: tokenColor.text3, fontStyle: "italic" }}>
                    empty stratum
                  </span>
                )}
                {tiles.map((t, i) => {
                  const delay = Math.min(i, 80) * 18;
                  const tileStyle: CSSProperties = {
                    padding: "2px 6px",
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    backgroundColor: tokenColor.bg1,
                    border: `1px solid ${tokenColor.border}`,
                    borderRadius: radius.xs,
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    color: tokenColor.text1,
                    whiteSpace: "nowrap",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    animation: `stv-tileIn 320ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${delay}ms`,
                  };
                  return (
                    <span key={t.id} style={tileStyle} title={`${t.path} — ${t.days}d`}>
                      {t.name}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StrataView = memo(StrataViewImpl);
