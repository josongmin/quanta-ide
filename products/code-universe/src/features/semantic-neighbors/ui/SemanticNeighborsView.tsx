// SemanticNeighborsView — pure embedding-based nearest files.
// --------------------------------------------------------------------
// Hero card: selected file + "semantic cluster: X files within 0.7".
// Center scatter: selected at origin, 20 neighbors placed at (radius =
// distance, angle = seeded hash). Lines from origin thicker when closer.
// Dots colored by tier (≥0.9 green / ≥0.7 amber / <0.7 neutral). Right
// rail: top-12 ranked list with similarity % + shared-prefix badge.
// Bottom: cluster-suggestion card if ≥5 files live within 0.8 similarity.
//
// Reference: Feng et al. "CodeBERT" EMNLP 2020; Alon et al. "code2vec"
// POPL 2019; OpenAI text-embedding-ada-002.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  semanticNeighbors,
  type SemanticNeighbor,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes sn-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sn-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
@keyframes sn-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sn-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
`;

const PLOT_W = 460;
const PLOT_H = 360;
const PLOT_PAD = 32;

function tierColor(sim: number): string {
  if (sim >= 0.9) return color.success;
  if (sim >= 0.7) return color.warn;
  return color.text2;
}

function tierLabel(sim: number): string {
  if (sim >= 0.9) return "near-identical";
  if (sim >= 0.7) return "close";
  return "distant";
}

/** Deterministic 0..1 hash for angle dispersal. */
function hashAngle(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function sharedPrefix(a: string, b: string): string {
  const ax = a.split("/");
  const bx = b.split("/");
  const parts: string[] = [];
  for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
    if (ax[i] === bx[i]) parts.push(ax[i]!);
    else break;
  }
  if (parts.length === 0) return "—";
  // Don't include the filename in the prefix if they diverge at the leaf.
  if (parts.length === ax.length || parts.length === bx.length) {
    return parts.slice(0, -1).join("/") || "/";
  }
  return parts.join("/");
}

function SemanticNeighborsViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const neighbors = useMemo<SemanticNeighbor[]>(() => {
    if (!entity || !ctx.tree) return [];
    const pool = [...ctx.tree.byId.values()];
    return semanticNeighbors(entity, pool, 20);
  }, [entity, ctx.tree]);

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const clusterWithin07 = neighbors.filter(n => n.similarity >= 0.7).length;
  const clusterWithin08 = neighbors.filter(n => n.similarity >= 0.8).length;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Semantic Neighbors · <span style={fileNameStyle}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            embedding cosine distance · {neighbors.length} nearest · pure semantic (no structure)
          </div>
        </div>
        <div style={refStyle}>
          CodeBERT (EMNLP 2020) · code2vec (POPL 2019) · ada-002
        </div>
      </header>

      <section style={heroRow}>
        <div style={{ ...heroCard, flex: 2 }}>
          <div style={heroLabel}>선택 파일</div>
          <div style={heroName}>{entity.name}</div>
          <div style={heroPath} title={entity.path}>{entity.path}</div>
        </div>
        <div style={heroCard}>
          <div style={heroLabel}>Semantic cluster</div>
          <div style={heroNum}>{clusterWithin07}</div>
          <div style={heroSub}>files · similarity ≥ 0.7</div>
        </div>
        <div style={heroCard}>
          <div style={heroLabel}>Near-identical</div>
          <div style={{ ...heroNum, color: color.success }}>
            {neighbors.filter(n => n.similarity >= 0.9).length}
          </div>
          <div style={heroSub}>files · similarity ≥ 0.9</div>
        </div>
      </section>

      <section style={bodyGrid}>
        {/* ── Scatter ── */}
        <div style={scatterWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Embedding scatter</span>
            <span style={mutedMono}>distance = radius · angle = seeded hash</span>
          </div>
          <svg
            width={PLOT_W}
            height={PLOT_H}
            viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
            role="img"
            aria-label="Semantic neighbor scatter"
            style={{ display: "block" }}
          >
            {/* Concentric rings for 0.9 / 0.7 bands. */}
            {[0.9, 0.7, 0.5].map((simBand, i) => {
              const d = 1 - simBand;
              const r = (d / 1) * (Math.min(PLOT_W, PLOT_H) / 2 - PLOT_PAD);
              const bandColor = simBand >= 0.9 ? color.success : simBand >= 0.7 ? color.warn : color.border;
              return (
                <g key={`ring-${simBand}`}>
                  <circle
                    cx={PLOT_W / 2}
                    cy={PLOT_H / 2}
                    r={r}
                    fill="none"
                    stroke={bandColor}
                    strokeOpacity={0.22}
                    strokeDasharray="3 4"
                    strokeWidth={1}
                  />
                  <text
                    x={PLOT_W / 2 + r + 6}
                    y={PLOT_H / 2 + 3}
                    fill={bandColor}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                    opacity={0.75}
                    style={{
                      animation: `sn-tile 520ms ${ENTRY_EASE} both`,
                      animationDelay: `${80 + i * 40}ms`,
                    }}
                  >
                    {simBand.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Connector lines — thicker when closer. */}
            {neighbors.map((n, i) => {
              const theta = hashAngle(n.entity.id) * Math.PI * 2;
              const maxR = Math.min(PLOT_W, PLOT_H) / 2 - PLOT_PAD;
              const r = Math.max(8, n.distance * maxR);
              const cx = PLOT_W / 2 + Math.cos(theta) * r;
              const cy = PLOT_H / 2 + Math.sin(theta) * r;
              const thickness = 0.5 + (1 - n.distance) * 2.4;
              const isHovered = hoveredId === n.entity.id;
              return (
                <line
                  key={`line-${n.entity.id}`}
                  x1={PLOT_W / 2}
                  y1={PLOT_H / 2}
                  x2={cx}
                  y2={cy}
                  stroke={tierColor(n.similarity)}
                  strokeOpacity={isHovered ? 0.9 : 0.32}
                  strokeWidth={thickness}
                  style={{
                    animation: `sn-dot ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${80 + i * STAGGER_MS}ms`,
                  }}
                />
              );
            })}

            {/* Neighbor dots. */}
            {neighbors.map((n, i) => {
              const theta = hashAngle(n.entity.id) * Math.PI * 2;
              const maxR = Math.min(PLOT_W, PLOT_H) / 2 - PLOT_PAD;
              const r = Math.max(8, n.distance * maxR);
              const cx = PLOT_W / 2 + Math.cos(theta) * r;
              const cy = PLOT_H / 2 + Math.sin(theta) * r;
              const tint = tierColor(n.similarity);
              const isHovered = hoveredId === n.entity.id;
              const isSelected = ctx.selectedId === n.entity.id;
              const dotR = 5 + (1 - n.distance) * 3;
              return (
                <g
                  key={n.entity.id}
                  style={{
                    cursor: "pointer",
                    animation: `sn-dot ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${120 + i * STAGGER_MS}ms`,
                    transformOrigin: `${cx}px ${cy}px`,
                    transformBox: "fill-box",
                  }}
                  onMouseEnter={() => setHoveredId(n.entity.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(n.entity.id)}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={dotR + (isHovered ? 2 : 0)}
                    fill={tint}
                    opacity={isHovered ? 1 : 0.85}
                    stroke={isHovered ? color.text0 : "none"}
                    strokeWidth={isHovered ? 1.2 : 0}
                    style={{ transition: `r 140ms ease-out` }}
                  />
                  {isSelected && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={dotR + 5}
                      fill="none"
                      stroke={color.accent}
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* Center (self). */}
            <circle
              cx={PLOT_W / 2}
              cy={PLOT_H / 2}
              r={9}
              fill={color.accent}
              style={{
                animation: `sn-dot 620ms ${ENTRY_EASE} both`,
              }}
            />
            <circle
              cx={PLOT_W / 2}
              cy={PLOT_H / 2}
              r={14}
              fill="none"
              stroke={color.accent}
              strokeWidth={1.2}
              opacity={0.35}
            />
            <text
              x={PLOT_W / 2}
              y={PLOT_H / 2 + 28}
              textAnchor="middle"
              fontSize={font.size.xxs}
              fontFamily={font.mono}
              fill={color.text2}
            >
              self
            </text>

            {/* Hover tooltip. */}
            {hoveredId !== null && (() => {
              const n = neighbors.find(x => x.entity.id === hoveredId);
              if (!n) return null;
              const theta = hashAngle(n.entity.id) * Math.PI * 2;
              const maxR = Math.min(PLOT_W, PLOT_H) / 2 - PLOT_PAD;
              const rr = Math.max(8, n.distance * maxR);
              const cx = PLOT_W / 2 + Math.cos(theta) * rr;
              const cy = PLOT_H / 2 + Math.sin(theta) * rr;
              const boxW = 200;
              const boxH = 48;
              const bx = Math.min(PLOT_W - boxW - 4, Math.max(4, cx + 12));
              const by = Math.min(PLOT_H - boxH - 4, Math.max(4, cy - boxH / 2));
              return (
                <g pointerEvents="none">
                  <rect
                    x={bx} y={by} width={boxW} height={boxH}
                    rx={radius.md} ry={radius.md}
                    fill={color.bg1}
                    stroke={color.border}
                  />
                  <text
                    x={bx + 10} y={by + 18}
                    fill={color.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={font.weight.semibold}
                  >
                    {n.entity.name}
                  </text>
                  <text
                    x={bx + 10} y={by + 34}
                    fill={color.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.mono}
                  >
                    sim {(n.similarity * 100).toFixed(1)}% · {tierLabel(n.similarity)}
                  </text>
                </g>
              );
            })()}
          </svg>
          <div style={legendRow}>
            <LegendChip tint={color.success} label="≥ 0.9" />
            <LegendChip tint={color.warn} label="≥ 0.7" />
            <LegendChip tint={color.text2} label="< 0.7" />
            <span style={{ marginLeft: "auto", ...mutedMono }}>
              line thickness ∝ similarity
            </span>
          </div>
        </div>

        {/* ── Top-12 ranked list ── */}
        <div style={listWrap}>
          <div style={listHead}>
            <span style={sectionHead}>Top 12 nearest</span>
            <span style={mutedMono}>by cosine distance</span>
          </div>
          <div style={listBody}>
            {neighbors.slice(0, 12).map((n, i) => {
              const simPct = (n.similarity * 100).toFixed(1);
              const prefix = sharedPrefix(entity.path, n.entity.path);
              const active = ctx.selectedId === n.entity.id;
              return (
                <button
                  key={n.entity.id}
                  type="button"
                  onClick={() => ctx.dispatch.selectEntity(n.entity.id)}
                  style={{
                    ...rowStyle,
                    background: active ? color.accentSofter : "transparent",
                    animationDelay: `${160 + i * 14}ms`,
                  }}
                >
                  <span style={rowRank}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <span style={rowName}>{n.entity.name}</span>
                    <span style={rowPath} title={prefix}>{prefix}</span>
                  </span>
                  <span
                    style={{
                      ...simPctStyle,
                      color: tierColor(n.similarity),
                    }}
                  >
                    {simPct}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {clusterWithin08 >= 5 && (
        <section style={suggestCard}>
          <div style={suggestLabel}>Cluster suggestion</div>
          <div style={suggestBody}>
            <strong style={{ color: color.text0 }}>consider extracting shared module</strong>{" "}
            <span style={{ color: color.text2 }}>·</span>{" "}
            <span style={{ color: color.text1 }}>
              {neighbors
                .filter(n => n.similarity >= 0.8)
                .slice(0, 4)
                .map(n => n.entity.name)
                .join(", ")}
              {clusterWithin08 > 4 ? `, +${clusterWithin08 - 4}` : ""}
            </span>
          </div>
          <div style={suggestHint}>
            {clusterWithin08} files share ≥ 0.8 semantic similarity — strong signal for concept duplication.
          </div>
        </section>
      )}
    </div>
  );
}

function LegendChip({ tint, label }: { tint: string; label: string }): ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: tint }} />
      <span style={{ fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
        {label}
      </span>
    </span>
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
  animation: `sn-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const fileNameStyle: CSSProperties = {
  color: color.text1,
  fontWeight: font.weight.medium,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const refStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const heroRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const heroCard: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  animation: `sn-tile 460ms ${ENTRY_EASE} both`,
};

const heroLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroName: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.lg,
  color: color.text0,
  fontWeight: font.weight.semibold,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const heroPath: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const heroNum: CSSProperties = {
  fontSize: 34,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  color: color.accent,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
};

const heroSub: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${PLOT_W + 32}px 1fr`,
  gap: space[4],
  alignItems: "stretch",
};

const scatterWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[1]}px`,
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const mutedMono: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const legendRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[1]}px ${space[1]}px`,
};

const listWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  minHeight: PLOT_H,
};

const listHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const listBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  overflowY: "auto",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `sn-row 420ms ${ENTRY_EASE} both`,
};

const rowRank: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  width: 24,
  flexShrink: 0,
  fontVariantNumeric: "tabular-nums",
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  color: color.text3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const simPctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  flex: "0 0 60px",
  textAlign: "right",
};

const suggestCard: CSSProperties = {
  marginTop: space[5],
  padding: `${space[3]}px ${space[4]}px`,
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  animation: `sn-tile 520ms ${ENTRY_EASE} both`,
  animationDelay: "280ms",
};

const suggestLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.accent,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const suggestBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.sm,
};

const suggestHint: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
};

export const SemanticNeighborsView = memo(SemanticNeighborsViewImpl);
