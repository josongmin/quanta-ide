// BugPredictionView — folder-nested heatmap of defect-likelihood scores.
// --------------------------------------------------------------------
// Each tile is a file, coloured by `bugProbability(entity, fileEdges)`
// computed from a weighted sum of complexity (35%), churn (35%) and
// coupling (30%) — the Zimmermann/Nagappan defect-prediction shape.
//
// Layout:
//   - Three-bar summary at the top counts HIGH / MODERATE / LOW files.
//   - Files are grouped by folder and rendered as wrapping rows of
//     tiles (same cheap flexbox pattern as Coverage Holes). Folders are
//     ordered by highest max-risk first so the scariest clusters float
//     to the top.
//   - Tile colour is stepped (deep red ≥0.8 / red ≥0.6 / amber ≥0.4 /
//     soft green ≥0.2 / deep green <0.2) for fast glanceability.
//   - Tooltip exposes the three feature contributions.

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
  bugProbability,
  cbo,
  churn,
  complexity,
} from "../../../shared/analytics/synth-metrics";

export interface BugPredictionViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes bpFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes bpRectIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
`;

interface Tile {
  id: string;
  name: string;
  path: string;
  loc: number;
  prob: number;   // 0..1
  cxShare: number;
  chShare: number;
  cpShare: number;
}

interface FolderGroup {
  key: string;
  label: string;
  tiles: Tile[];
  maxProb: number;
  avgProb: number;
}

function BugPredictionViewImpl({ ctx }: BugPredictionViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const { groups, counts } = useMemo(() => {
    const edges = ctx.graph?.fileEdges;
    const byFolder = new Map<string, FolderGroup>();
    const counts = { high: 0, moderate: 0, low: 0 };
    if (!ctx.tree) return { groups: [] as FolderGroup[], counts };

    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const prob = bugProbability(e as Entity, edges);
      const cx = complexity(e as Entity);
      const ch = churn(e as Entity);
      const cp = cbo(e as Entity, edges);
      // Raw weighted contributions (pre-clamp) then normalise to shares
      // that sum to 1 — used for tooltip feature attribution.
      const wCx = cx * 0.35;
      const wCh = ch * 0.35;
      const wCp = cp * 0.30;
      const total = Math.max(0.0001, wCx + wCh + wCp);

      if (prob >= 0.6) counts.high++;
      else if (prob >= 0.3) counts.moderate++;
      else counts.low++;

      const folder = folderKey(e);
      let g = byFolder.get(folder);
      if (!g) {
        g = { key: folder, label: folder, tiles: [], maxProb: 0, avgProb: 0 };
        byFolder.set(folder, g);
      }
      g.tiles.push({
        id: e.id,
        name: e.name,
        path: e.path,
        loc: e.metrics?.loc ?? 0,
        prob,
        cxShare: wCx / total,
        chShare: wCh / total,
        cpShare: wCp / total,
      });
    }

    const out = Array.from(byFolder.values());
    for (const g of out) {
      g.tiles.sort((a, b) => b.prob - a.prob);
      let sum = 0;
      let mx = 0;
      for (const t of g.tiles) {
        sum += t.prob;
        if (t.prob > mx) mx = t.prob;
      }
      g.avgProb = g.tiles.length === 0 ? 0 : sum / g.tiles.length;
      g.maxProb = mx;
    }
    // Highest-risk folder on top.
    out.sort((a, b) => b.maxProb - a.maxProb);
    return { groups: out, counts };
  }, [ctx.tree, ctx.graph]);

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

  const total = counts.high + counts.moderate + counts.low;
  const pct = (n: number) => total === 0 ? 0 : n / total;

  const rootStyle: CSSProperties = {
    animation: `bpFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
        <div style={{ marginBottom: space[3] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              letterSpacing: font.letter.tight,
            }}
          >
            Bug Risk
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            결함 예측 — 복잡도 × churn × 결합도 모델 (Zimmermann/Nagappan)
          </div>
        </div>

        {/* Three-bar summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: space[3],
            margin: `${space[4]}px 0 ${space[6]}px 0`,
          }}
        >
          <RiskBar
            label="HIGH RISK"
            caption="≥ 60% defect-likelihood"
            count={counts.high}
            ratio={pct(counts.high)}
            color={severityColor(0.82)}
          />
          <RiskBar
            label="MODERATE"
            caption="30% – 60%"
            count={counts.moderate}
            ratio={pct(counts.moderate)}
            color={severityColor(0.45)}
          />
          <RiskBar
            label="LOW"
            caption="< 30%"
            count={counts.low}
            ratio={pct(counts.low)}
            color={severityColor(0.15)}
          />
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[4],
            marginBottom: space[4],
            fontSize: font.size.xxs,
            color: tokenColor.text2,
          }}
        >
          <LegendSwatch color={severityColor(0.15)} label="<20%" />
          <LegendSwatch color={severityColor(0.30)} label="20-40%" />
          <LegendSwatch color={severityColor(0.50)} label="40-60%" />
          <LegendSwatch color={severityColor(0.70)} label="60-80%" />
          <LegendSwatch color={severityColor(0.90)} label="≥80%" />
          <div style={{ color: tokenColor.text3 }}>• 블록 크기 = LoC</div>
        </div>

        {/* Folder groups */}
        {groups.map((g, gi) => (
          <div
            key={g.key}
            style={{
              marginBottom: space[6],
              animation: `bpRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
              animationDelay: `${Math.min(gi * 40, 320)}ms`,
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
                {g.tiles.length} files · max {Math.round(g.maxProb * 100)}% · avg {Math.round(g.avgProb * 100)}%
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
                  Math.min(180, Math.round(30 + Math.sqrt(t.loc) * 4)),
                );
                const tileStyle: CSSProperties = {
                  position: "relative",
                  width: widthPx,
                  height: 50,
                  borderRadius: radiusToken.sm,
                  background: severityColor(t.prob),
                  border: `1px solid ${
                    isSelected ? tokenColor.accent : "rgba(0,0,0,0.06)"
                  }`,
                  boxShadow: isSelected
                    ? `0 0 0 2px ${tokenColor.accent}`
                    : "none",
                  cursor: "pointer",
                  transition:
                    "transform 180ms ease-out, filter 180ms ease-out",
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
                  animation: `bpRectIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(tileIdx++ * STAGGER_MS, 680)}ms`,
                  overflow: "hidden",
                  padding: "6px 8px",
                  boxSizing: "border-box",
                  color: severityTextColor(t.prob),
                };
                const title =
                  `${t.path}\n`
                  + `bug probability: ${Math.round(t.prob * 100)}%\n`
                  + `  complexity  ${Math.round(t.cxShare * 100)}%\n`
                  + `  churn       ${Math.round(t.chShare * 100)}%\n`
                  + `  coupling    ${Math.round(t.cpShare * 100)}%\n`
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
                      {Math.round(t.prob * 100)}%
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

function RiskBar({
  label,
  caption,
  count,
  ratio,
  color: barColor,
}: {
  label: string;
  caption: string;
  count: number;
  ratio: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: `${space[3]}px ${space[4]}px`,
        borderRadius: radiusToken.md,
        background: tokenColor.bg1,
        border: `1px solid ${tokenColor.border}`,
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
        <span
          style={{
            fontSize: font.size.xxs,
            letterSpacing: font.letter.ultra,
            textTransform: "uppercase",
            color: tokenColor.text2,
            fontWeight: font.weight.semibold,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: font.size.xl,
            fontWeight: font.weight.bold,
            fontVariantNumeric: "tabular-nums",
            color: tokenColor.text0,
          }}
        >
          {count}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 6,
          background: tokenColor.bg3,
          borderRadius: radiusToken.pill,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${Math.round(ratio * 100)}%`,
            background: barColor,
            borderRadius: radiusToken.pill,
            transition: "width 520ms cubic-bezier(0.22, 1, 0.28, 1)",
          }}
        />
      </div>
      <div
        style={{
          marginTop: space[1],
          fontSize: font.size.xxs,
          color: tokenColor.text3,
        }}
      >
        {caption}
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

/** Map bug probability → CSS colour. 5-step scale tuned for white bg:
 *  deep-red ≥0.8 / red 0.6-0.8 / amber 0.4-0.6 / soft-green 0.2-0.4 /
 *  deep-green <0.2. */
function severityColor(p: number): string {
  // 5-band risk scale — deep-red / red / amber / soft-green / deep-green.
  // Tokens cover only the two "ends" (danger / success); the three
  // intermediate bands are literal to keep the heat gradient readable.
  if (p >= 0.8) return "#b72026";
  if (p >= 0.6) return tokenColor.danger;
  if (p >= 0.4) return "#f1a557";
  if (p >= 0.2) return "#8dd6a8";
  return tokenColor.success;
}

function severityTextColor(p: number): string {
  return p >= 0.4 ? tokenColor.bg0 : tokenColor.text0;
}

function folderKey(entity: Entity): string {
  const p = entity.path;
  const idx = p.lastIndexOf("/");
  if (idx > 0) return p.slice(0, idx);
  return "/";
}

export const BugPredictionView = memo(BugPredictionViewImpl);
