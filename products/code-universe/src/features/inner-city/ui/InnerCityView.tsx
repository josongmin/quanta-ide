// InnerCityView — file-scope CodeCity.
// --------------------------------------------------------------------
// Reference: Wettel & Lanza, "CodeCity" (VISSOFT 2007).
// Three horizontal bands, stacked top → bottom:
//   (1) Symbol blocks. One rectangle per class / function. Width ∝ LoC,
//       height ∝ cyclomatic complexity × 6, fill tint graded by
//       cyclomatic (cool = simple, warm = hot). Masonry-packed in
//       shortest-column order so the skyline is readable, not uniform.
//   (2) Dependency arrows. Inbound count on the left, outbound on the
//       right, each drawn as a bundle of arrows into / out of the
//       block stack. Count only — no full graph (views that need the
//       graph exist already).
//   (3) Commit strip. One dot per commit in the last 90 days. Dot
//       diameter ∝ seeded "lines changed"; horizontal position ∝
//       recency. Separator above says "last 90d · N commits".
//
// Entrance: viewport fade + scale (520ms). Per-item stagger 14-22ms
// on the symbol blocks and commit dots so they read as a coordinated
// reveal, not a flash of geometry.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import {
  commitHistory,
  fanIn,
  fanOut,
  hashId,
  seeded,
  symbolsInFile,
  type SynthSymbol,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `
@keyframes ic-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ic-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ic-pop {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1); }
}
`;

// Width × complexity-height packing — masonry style. We compute block
// rectangles in advance so the parent SVG / flex can scale them.
interface PackedBlock {
  sym: SynthSymbol;
  x: number;
  y: number;
  w: number;
  h: number;
}

function packBlocks(symbols: readonly SynthSymbol[], containerW: number): { blocks: PackedBlock[]; height: number } {
  if (symbols.length === 0) return { blocks: [], height: 0 };
  // Row-oriented shelf packer: width scaled so largest LoC ≈ 30% of
  // container. Heights = complexity × 6 (minimum 14 so chips with
  // CC=1 still register visually).
  const maxLoc = Math.max(...symbols.map(s => s.loc));
  const widthScale = Math.min(0.28, 120 / Math.max(120, maxLoc));
  const blocks: PackedBlock[] = [];
  let x = 0;
  let rowY = 0;
  let rowH = 0;
  const gap = 6;
  for (const s of symbols) {
    const w = Math.max(28, Math.min(containerW - 2, s.loc * widthScale * 4));
    const h = Math.max(14, s.cyclomatic * 6);
    if (x + w > containerW && x > 0) {
      x = 0;
      rowY += rowH + gap;
      rowH = 0;
    }
    blocks.push({ sym: s, x, y: rowY, w, h });
    x += w + gap;
    if (h > rowH) rowH = h;
  }
  return { blocks, height: rowY + rowH };
}

/** Complexity → fill colour. Blue (cool) at CC=1 through warm amber at
 *  CC=8 to red at CC≥14. Values mirror Sonar cyclomatic warning bands. */
function complexityTint(cc: number): string {
  if (cc <= 2) return "#dbeafe";
  if (cc <= 4) return "#bae6fd";
  if (cc <= 6) return "#fde68a";
  if (cc <= 9) return "#fcd34d";
  if (cc <= 13) return "#fb923c";
  return "#ef4444";
}

function complexityBorder(cc: number): string {
  if (cc <= 4) return "#7dd3fc";
  if (cc <= 9) return "#f59e0b";
  return "#dc2626";
}

// ── Component ────────────────────────────────────────────────────────

function InnerCityViewImpl({ ctx, entity, empty }: Props): ReactElement {
  const width = Math.max(1, ctx.viewportSize.w);

  const data = useMemo(() => {
    if (!entity) return null;
    const symbols = symbolsInFile(entity)
      .slice()
      .sort((a, b) => b.loc - a.loc);
    const commits = commitHistory(entity, 90);
    const inbound = fanIn(entity, ctx.graph?.fileEdges);
    const outbound = fanOut(entity, ctx.graph?.fileEdges);
    return { symbols, commits, inbound, outbound };
  }, [entity, ctx.graph?.fileEdges]);

  if (empty || !entity || !data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  // Layout math
  const pad = space[5];
  const innerW = Math.max(280, width - pad * 2);
  const blockAreaW = Math.max(220, innerW - 160); // leave 80 each side for arrow bundles
  const { blocks, height: blocksH } = packBlocks(data.symbols, blockAreaW);

  // Commit strip config
  const now = Date.now();
  const stripH = 62;
  const stripW = innerW;
  const stripStart = now - 90 * 86400_000;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>InnerCity</span>
          <span style={subtitleStyle}>
            {entity.name} · {data.symbols.length} 심볼 · fanIn {data.inbound} / fanOut {data.outbound}
          </span>
        </div>
        <div style={metaPillsStyle}>
          <span style={pillStyle}>90d: {data.commits.length} commits</span>
          <span style={pillStyle}>LoC {entity.metrics?.loc ?? "—"}</span>
        </div>
      </div>

      {/* Middle band — symbol blocks + dependency arrows */}
      <div style={cityBandStyle}>
        <DependencyBundle
          count={data.inbound}
          side="in"
          label="IN"
          heightPx={Math.max(120, blocksH)}
        />

        <div
          style={{
            ...blockAreaStyle,
            width: blockAreaW,
            height: blocksH + 6,
          }}
        >
          {blocks.map((b, i) => (
            <div
              key={b.sym.id}
              title={`${b.sym.name} · ${b.sym.kind} · ${b.sym.loc} LoC · CC ${b.sym.cyclomatic}`}
              style={{
                position: "absolute",
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                background: complexityTint(b.sym.cyclomatic),
                border: `1px solid ${complexityBorder(b.sym.cyclomatic)}`,
                borderRadius: radius.sm,
                animation: `ic-pop 420ms ${ENTRY_EASE} ${60 + i * 16}ms both`,
                display: "flex",
                alignItems: "flex-end",
                overflow: "hidden",
                padding: "1px 4px",
                boxSizing: "border-box",
              }}
            >
              {b.w > 52 && (
                <span style={blockLabelStyle}>
                  {b.sym.name}
                </span>
              )}
            </div>
          ))}
        </div>

        <DependencyBundle
          count={data.outbound}
          side="out"
          label="OUT"
          heightPx={Math.max(120, blocksH)}
        />
      </div>

      {/* Bottom band — 90d commit strip */}
      <div style={stripWrapStyle}>
        <div style={stripHeadStyle}>
          <span style={stripTitleStyle}>last 90d</span>
          <span style={stripCountStyle}>{data.commits.length} commits</span>
        </div>
        <svg
          width={stripW}
          height={stripH}
          viewBox={`0 0 ${stripW} ${stripH}`}
          style={{ display: "block" }}
        >
          {/* Axis */}
          <line
            x1={0} x2={stripW}
            y1={stripH - 12} y2={stripH - 12}
            stroke={color.border}
            strokeWidth={1}
          />
          {[0, 30, 60, 90].map(d => {
            const x = stripW * (1 - d / 90);
            return (
              <g key={d}>
                <line
                  x1={x} x2={x}
                  y1={stripH - 14} y2={stripH - 10}
                  stroke={color.text3}
                  strokeWidth={0.6}
                />
                <text
                  x={x} y={stripH - 1}
                  fontFamily={font.mono}
                  fontSize={9}
                  fill={color.text3}
                  textAnchor="middle"
                >
                  {d === 0 ? "now" : `${d}d`}
                </text>
              </g>
            );
          })}
          {data.commits.map((t, i) => {
            // Only show dots inside the 90d window.
            if (t < stripStart) return null;
            const cx = stripW * (1 - (now - t) / (90 * 86400_000));
            // Seeded "lines changed" per commit to size the dot.
            const rng = seeded(`${entity.id}::commit-${i}`, "lc");
            const lines = Math.floor(rng() * 220 + 4);
            const r = Math.max(2, Math.min(8, 2 + Math.sqrt(lines) / 6));
            const cy = stripH - 18 - (hashId(`c${i}`) % 24);
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill={color.accent}
                fillOpacity={0.45}
                stroke={color.accent}
                strokeWidth={0.6}
                style={{
                  animation: `ic-pop 320ms ${ENTRY_EASE} ${140 + (i * 14) % 600}ms both`,
                  transformOrigin: `${cx}px ${cy}px`,
                }}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Dependency arrow bundle ─────────────────────────────────────────

function DependencyBundle({
  count,
  side,
  label,
  heightPx,
}: {
  count: number;
  side: "in" | "out";
  label: string;
  heightPx: number;
}): ReactElement {
  // Draw up to 6 lines; annotate the remainder as "+N".
  const visible = Math.min(6, count);
  const extra = count - visible;
  const w = 76;
  const strokeColor = side === "in" ? "#22a06b" : color.accent;
  return (
    <div style={{
      width: w,
      height: heightPx,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: side === "in" ? "flex-start" : "flex-end",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      <svg width={w} height={heightPx} viewBox={`0 0 ${w} ${heightPx}`} style={{ overflow: "visible" }}>
        {Array.from({ length: visible }, (_, i) => {
          const y = (heightPx / (visible + 1)) * (i + 1);
          const x0 = side === "in" ? 0 : w;
          const x1 = side === "in" ? w - 6 : 6;
          return (
            <line
              key={i}
              x1={x0} y1={y}
              x2={x1} y2={y}
              stroke={strokeColor}
              strokeOpacity={0.55}
              strokeWidth={1.4}
              markerEnd={side === "in" ? `url(#ic-arrow-${label})` : undefined}
              markerStart={side === "out" ? `url(#ic-arrow-${label})` : undefined}
              style={{ animation: `ic-rise 460ms ${ENTRY_EASE} ${200 + i * 22}ms both` }}
            />
          );
        })}
        <defs>
          <marker
            id={`ic-arrow-${label}`}
            viewBox="0 0 10 10"
            refX={5} refY={5}
            markerWidth={5} markerHeight={5}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={strokeColor} opacity={0.7} />
          </marker>
        </defs>
      </svg>
      <div style={{
        position: "absolute",
        top: 4,
        [side === "in" ? "left" : "right"]: 4,
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        color: color.text2,
        letterSpacing: "0.14em",
      }}>
        {label}
      </div>
      <div style={{
        position: "absolute",
        bottom: 4,
        [side === "in" ? "left" : "right"]: 4,
        fontFamily: font.mono,
        fontSize: font.size.sm,
        fontWeight: font.weight.semibold,
        color: strokeColor,
        fontVariantNumeric: "tabular-nums",
      }}>
        {count}{extra > 0 ? ` (+${extra})` : ""}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  animation: `ic-enter 520ms ${ENTRY_EASE} both`,
  overflow: "hidden",
};

const emptyStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  padding: `${space[4]}px ${space[5]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexShrink: 0,
};

const titleBlockStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 2 };

const titleStyle: CSSProperties = {
  fontSize: font.size.display,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
};

const metaPillsStyle: CSSProperties = {
  display: "flex",
  gap: space[2],
};

const pillStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  color: color.text1,
};

const cityBandStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: space[3],
  padding: `${space[4]}px ${space[5]}px`,
  minHeight: 0,
  overflow: "auto",
};

const blockAreaStyle: CSSProperties = {
  position: "relative",
  flexShrink: 0,
};

const blockLabelStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 9,
  color: "rgba(10,10,10,0.76)",
  lineHeight: 1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%",
};

const stripWrapStyle: CSSProperties = {
  flexShrink: 0,
  borderTop: `1px solid ${color.border}`,
  padding: `${space[3]}px ${space[5]}px ${space[4]}px`,
  background: color.bg1,
};

const stripHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: space[3],
  marginBottom: space[1],
};

const stripTitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const stripCountStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

export const InnerCityView = memo(InnerCityViewImpl);
