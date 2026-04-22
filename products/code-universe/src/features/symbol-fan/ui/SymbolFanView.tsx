// SymbolFanView — egocentric caller / callee fan.
// --------------------------------------------------------------------
// Reference: Understand "Butterfly" view; Doxygen caller / called-by
// graphs. This is a focused, purposely-small diagram built for a single
// symbol — NOT a general call-graph explorer (that's `call-graph`).
//
// Geometry: 3-column SVG, viewBox 0..1000 × 0..700.
//   - Left  column: caller chips. Each is a file name (the file where
//     the caller symbol lives).
//   - Center: the focused symbol, rendered as a heavy pill.
//   - Right column: callee chips.
// Edges are tapered cubic beziers — width ∝ seeded call frequency.
// Recursion (self-loop) renders as a circular arrow above the center
// pill. Both caller + callee counts come from the symbol's synthesized
// metrics; the target files are picked deterministically from the file
// tree so the same symbol always shows the same fan.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import {
  hashId,
  seeded,
  symbolsInFile,
  type SynthSymbol,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;

const KEYFRAMES = `
@keyframes sf-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sf-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sf-draw {
  from { stroke-dashoffset: var(--dash); }
  to   { stroke-dashoffset: 0; }
}
`;

// SVG viewBox constants — the wrapping div scales the SVG to fit.
const VB_W = 1000;
const VB_H = 700;
const TOP_Y = 120;
const BOTTOM_Y = 640;
const LEFT_X = 120;
const RIGHT_X = 880;
const CENTER_X = 500;
const CENTER_Y = 380;
const CHIP_W = 220;
const CHIP_H = 24;
const CENTER_PILL_W = 280;
const CENTER_PILL_H = 52;

interface FanChip {
  fileId: string;
  name: string;
  callerSymbolName: string;
  y: number;
  weight: number; // 0..1 seeded call-frequency
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

/** Pick up to `count` distinct file-like entities (building/floor) from
 *  the tree, in a deterministic order derived from (symbolId, salt). */
function pickFiles(
  pool: readonly Entity[],
  symbolId: string,
  salt: string,
  count: number,
  excludeId?: string,
): Entity[] {
  const files = pool.filter(e =>
    (e.kind === "building" || e.kind === "floor") && e.id !== excludeId,
  );
  if (files.length === 0) return [];
  // Deterministic shuffle via score.
  const scored = files
    .map(f => ({ f, score: hashId(`${symbolId}::${salt}::${f.id}`) }))
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, Math.min(count, files.length)).map(s => s.f);
}

function buildChips(
  symbol: SynthSymbol,
  total: number,
  pool: readonly Entity[],
  direction: "caller" | "callee",
  excludeId?: string,
): { chips: FanChip[]; overflow: number; recursion: boolean } {
  // Cap display at 8 per side — beyond that the fan becomes unreadable.
  const capped = Math.min(total, 8);
  const overflow = Math.max(0, total - capped);
  if (capped === 0) return { chips: [], overflow, recursion: false };

  // Decide recursion: small chance when there's ≥1 caller AND ≥1 callee,
  // deterministic per symbol.
  const recSeed = seeded(symbol.id, "recursion")();
  const recursion = direction === "caller" ? recSeed < 0.18 && total > 1 : false;

  const files = pickFiles(pool, symbol.id, `${direction}-files`, capped, excludeId);
  const chips: FanChip[] = [];
  const span = BOTTOM_Y - TOP_Y;
  const step = capped === 1 ? 0 : span / (capped - 1);
  const startY = capped === 1 ? (TOP_Y + BOTTOM_Y) / 2 : TOP_Y;

  for (let i = 0; i < capped; i++) {
    const entity = files[i];
    const name = entity ? entity.name : `${direction}-${i + 1}.ts`;
    const rngName = seeded(symbol.id, `${direction}-name-${i}`);
    const callerSymbolName = `${direction === "caller" ? "call" : "use"}${Math.floor(rngName() * 99)}`;
    const rngW = seeded(symbol.id, `${direction}-weight-${i}`);
    const weight = Math.pow(rngW(), 1.8); // skew toward thin
    chips.push({
      fileId: entity?.id ?? `synth-${direction}-${i}`,
      name,
      callerSymbolName,
      y: startY + i * step,
      weight,
    });
  }
  return { chips, overflow, recursion };
}

function SymbolFanViewImpl({ ctx }: Props): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

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

  const pool = useMemo<Entity[]>(() => {
    if (!ctx.tree) return [];
    return Array.from(ctx.tree.byId.values());
  }, [ctx.tree]);

  const fan = useMemo(() => {
    if (!focused) return null;
    const left  = buildChips(focused, focused.callers, pool, "caller", entity?.id);
    const right = buildChips(focused, focused.callees, pool, "callee", entity?.id);
    return { left, right };
  }, [focused, pool, entity?.id]);

  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <EmptyFrame width={width} height={height} message="파일을 선택하면 심볼 뷰가 나타납니다." />;
  }
  if (symbols.length === 0 || !focused || !fan) {
    return <EmptyFrame width={width} height={height} message="이 파일에 추출 가능한 심볼이 없습니다." />;
  }

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
          <span style={eyebrowStyle}>SYMFAN · {entity.name}</span>
          <span style={{ fontSize: font.size.xxs, color: color.text2 }}>
            caller × callee 부채꼴 — 선 두께 ∝ 호출 빈도
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
                  animation: `sf-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${Math.min(i * STAGGER_MS, 420)}ms`,
                }}
              >
                <span style={{ fontFamily: font.mono, opacity: 0.75 }}>{kindGlyph(s.kind)}</span>
                <span style={{ fontFamily: font.mono, fontWeight: font.weight.medium }}>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* SVG canvas */}
        <div style={canvasWrapStyle}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
            {/* Column labels */}
            <text x={LEFT_X}   y={64} fontFamily={font.sans} fontSize={11}
              fill={color.text2} letterSpacing="0.2em" textAnchor="middle">CALLERS</text>
            <text x={CENTER_X} y={64} fontFamily={font.sans} fontSize={11}
              fill={color.text2} letterSpacing="0.2em" textAnchor="middle">FOCUS</text>
            <text x={RIGHT_X}  y={64} fontFamily={font.sans} fontSize={11}
              fill={color.text2} letterSpacing="0.2em" textAnchor="middle">CALLEES</text>

            {/* Column hairlines */}
            <line x1={LEFT_X  + CHIP_W / 2 + 16} y1={96} x2={LEFT_X  + CHIP_W / 2 + 16} y2={VB_H - 40}
              stroke={color.border} strokeDasharray="2 6" />
            <line x1={RIGHT_X - CHIP_W / 2 - 16} y1={96} x2={RIGHT_X - CHIP_W / 2 - 16} y2={VB_H - 40}
              stroke={color.border} strokeDasharray="2 6" />

            {/* Caller edges — from caller chip right → center pill left. */}
            {fan.left.chips.map((c, i) => {
              const x0 = LEFT_X + CHIP_W / 2;
              const y0 = c.y;
              const x1 = CENTER_X - CENTER_PILL_W / 2;
              const y1 = CENTER_Y;
              const w = 0.6 + c.weight * 3.2;
              return (
                <path
                  key={`lin-${i}`}
                  d={`M ${x0} ${y0} C ${x0 + 140} ${y0}, ${x1 - 140} ${y1}, ${x1} ${y1}`}
                  fill="none"
                  stroke={color.accent}
                  strokeOpacity={0.55}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeDasharray="260"
                  style={{
                    ["--dash" as string]: "260",
                    animation: `sf-draw 680ms ${ENTRY_EASE} both`,
                    animationDelay: `${160 + i * 22}ms`,
                  }}
                />
              );
            })}

            {/* Callee edges — center pill right → callee chip left. */}
            {fan.right.chips.map((c, i) => {
              const x0 = CENTER_X + CENTER_PILL_W / 2;
              const y0 = CENTER_Y;
              const x1 = RIGHT_X - CHIP_W / 2;
              const y1 = c.y;
              const w = 0.6 + c.weight * 3.2;
              return (
                <path
                  key={`out-${i}`}
                  d={`M ${x0} ${y0} C ${x0 + 140} ${y0}, ${x1 - 140} ${y1}, ${x1} ${y1}`}
                  fill="none"
                  stroke={color.success}
                  strokeOpacity={0.55}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeDasharray="260"
                  style={{
                    ["--dash" as string]: "260",
                    animation: `sf-draw 680ms ${ENTRY_EASE} both`,
                    animationDelay: `${200 + i * 22}ms`,
                  }}
                />
              );
            })}

            {/* Recursion: small circular arrow above the center pill. */}
            {fan.left.recursion && (
              <g
                style={{
                  animation: `sf-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: "340ms",
                }}
              >
                <path
                  d={`M ${CENTER_X - 26} ${CENTER_Y - CENTER_PILL_H / 2 - 12}
                      a 26 20 0 1 1 52 0`}
                  fill="none"
                  stroke={color.warn}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
                <polygon
                  points={`${CENTER_X + 22},${CENTER_Y - CENTER_PILL_H / 2 - 18}
                           ${CENTER_X + 32},${CENTER_Y - CENTER_PILL_H / 2 - 12}
                           ${CENTER_X + 22},${CENTER_Y - CENTER_PILL_H / 2 - 6}`}
                  fill={color.warn}
                />
                <text x={CENTER_X} y={CENTER_Y - CENTER_PILL_H / 2 - 28}
                  fontFamily={font.sans} fontSize={10}
                  fill={color.warn} textAnchor="middle"
                  fontWeight={font.weight.semibold}>
                  recursive
                </text>
              </g>
            )}

            {/* Caller chips */}
            {fan.left.chips.map((c, i) => (
              <g
                key={`lc-${c.fileId}-${i}`}
                style={{
                  animation: `sf-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${80 + i * 26}ms`,
                  cursor: "pointer",
                }}
                onClick={() => ctx.dispatch.selectEntity(c.fileId)}
              >
                <rect
                  x={LEFT_X - CHIP_W / 2} y={c.y - CHIP_H / 2}
                  width={CHIP_W} height={CHIP_H}
                  rx={radius.sm} ry={radius.sm}
                  fill={color.bg1} stroke={color.border} strokeWidth={0.8}
                />
                <text x={LEFT_X - CHIP_W / 2 + 10} y={c.y + 3.5}
                  fontFamily={font.mono} fontSize={10.5} fill={color.text1}>
                  {c.callerSymbolName}
                </text>
                <text x={LEFT_X + CHIP_W / 2 - 10} y={c.y + 3.5}
                  fontFamily={font.sans} fontSize={10} fill={color.text2}
                  textAnchor="end">
                  {truncate(c.name, 20)}
                </text>
              </g>
            ))}

            {/* Callee chips */}
            {fan.right.chips.map((c, i) => (
              <g
                key={`rc-${c.fileId}-${i}`}
                style={{
                  animation: `sf-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                  animationDelay: `${100 + i * 26}ms`,
                  cursor: "pointer",
                }}
                onClick={() => ctx.dispatch.selectEntity(c.fileId)}
              >
                <rect
                  x={RIGHT_X - CHIP_W / 2} y={c.y - CHIP_H / 2}
                  width={CHIP_W} height={CHIP_H}
                  rx={radius.sm} ry={radius.sm}
                  fill={color.bg1} stroke={color.border} strokeWidth={0.8}
                />
                <text x={RIGHT_X - CHIP_W / 2 + 10} y={c.y + 3.5}
                  fontFamily={font.mono} fontSize={10.5} fill={color.text1}>
                  {c.callerSymbolName}
                </text>
                <text x={RIGHT_X + CHIP_W / 2 - 10} y={c.y + 3.5}
                  fontFamily={font.sans} fontSize={10} fill={color.text2}
                  textAnchor="end">
                  {truncate(c.name, 20)}
                </text>
              </g>
            ))}

            {/* Overflow indicators (+N) */}
            {fan.left.overflow > 0 && (
              <text x={LEFT_X} y={BOTTOM_Y + 30}
                fontFamily={font.sans} fontSize={10}
                fill={color.text2} textAnchor="middle">
                +{fan.left.overflow} more callers
              </text>
            )}
            {fan.right.overflow > 0 && (
              <text x={RIGHT_X} y={BOTTOM_Y + 30}
                fontFamily={font.sans} fontSize={10}
                fill={color.text2} textAnchor="middle">
                +{fan.right.overflow} more callees
              </text>
            )}

            {/* Center pill */}
            <g
              style={{
                animation: `sf-rise ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                animationDelay: "40ms",
              }}
            >
              <rect
                x={CENTER_X - CENTER_PILL_W / 2} y={CENTER_Y - CENTER_PILL_H / 2}
                width={CENTER_PILL_W} height={CENTER_PILL_H}
                rx={CENTER_PILL_H / 2} ry={CENTER_PILL_H / 2}
                fill={color.accentSoft}
                stroke={color.accent}
                strokeWidth={1.4}
              />
              <text x={CENTER_X} y={CENTER_Y - 4}
                fontFamily={font.mono} fontSize={14}
                fontWeight={font.weight.semibold}
                fill={color.text0} textAnchor="middle">
                {kindGlyph(focused.kind)} {focused.name}
              </text>
              <text x={CENTER_X} y={CENTER_Y + 14}
                fontFamily={font.sans} fontSize={10}
                fill={color.text2} textAnchor="middle">
                CC {focused.cyclomatic} · {focused.visibility} · {focused.loc} LoC
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
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
      <div style={{ animation: `sf-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` }}>{message}</div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: space[4],
  animation: `sf-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 380,
  overflow: "hidden",
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

export const SymbolFanView = memo(SymbolFanViewImpl);
