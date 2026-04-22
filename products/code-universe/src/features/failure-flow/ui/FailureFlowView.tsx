// FailureFlowView — directed graph of error type propagation.
// --------------------------------------------------------------------
// Sankey-style 3-column layout. Error "species" are nodes; edges point
// from throwers (left column) through the error-type mid column to
// catchers (right column). When a thrown error has no catcher, a red
// "→ top" arrow exits the graph (the error bubbles out of the process).
//
// Layout contract:
//   - Each unique fileId appears EXACTLY ONCE per side. A file that
//     throws three different errors renders as a single left chip with
//     three outgoing curves, not three overlapping chips — the old
//     hash-per-chip strategy stacked duplicates at random y positions
//     and made the line ends drift off the chip rectangles.
//   - Chip y-order is barycentric (avg of connected error-type y's)
//     so incident curves read top-to-bottom without crossing.
//   - Slot assignment uses a fixed vertical step so chips never collide
//     regardless of how many files land in a column.

import { memo, useEffect, useMemo, type CSSProperties, type ReactElement } from "react";

import type { EntityTree } from "../../../entities/entity";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { seeded } from "../../../shared/analytics/synth-metrics";

interface Props {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
}

const ERROR_TYPES: readonly string[] = [
  "NetworkError",
  "ParseError",
  "AuthError",
  "ValidationError",
  "TimeoutError",
  "NotFoundError",
  "PermissionError",
  "RateLimitError",
];

// Layout constants — column + chip geometry in SVG userspace.
// viewBox is 0..1000 (x) × 0..700 (y). Chips render at these pixel
// coordinates and the parent <svg> scales uniformly.
const TOP_Y       = 60;
const BOTTOM_Y    = 660;
const CHIP_H      = 20;
const CHIP_GAP    = 10;
const CHIP_STEP   = CHIP_H + CHIP_GAP; // 30 — min vertical per chip
const THROWER_X   = 140;
const CATCHER_X   = 860;
const ERROR_X     = 500;
const THROWER_X_RIGHT = 240;  // curve leaves left chip edge here
const CATCHER_X_LEFT  = 760;  // curve arrives at right chip edge here
const ERR_LEFT    = 440;
const ERR_RIGHT   = 560;

interface ChipPos {
  fileId: string;
  label: string;
  path: string;
  y: number;
  /** Error types this chip participates in (throws OR catches). */
  errorTypes: string[];
}

interface ErrorTypePos {
  name: string;
  y: number;
  unhandled: boolean;
  /** Index of original throwers (used for stable staggered animation). */
  throwCount: number;
  catchCount: number;
}

interface FlowGraph {
  errorTypes: ErrorTypePos[];
  throwers: ChipPos[];
  catchers: ChipPos[];
  /** One entry per (thrower → error-type) pair. */
  throwEdges: Array<{ fromFileId: string; errName: string }>;
  /** One entry per (error-type → catcher) pair. */
  catchEdges: Array<{ errName: string; toFileId: string }>;
  unhandledCount: number;
}

const KEYFRAMES = `
@keyframes ff-enter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ff-draw {
  0%   { stroke-dashoffset: var(--dash); }
  100% { stroke-dashoffset: 0; }
}
@keyframes ff-pulse {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 0.85; }
}
`;

function buildGraph(tree: EntityTree): FlowGraph {
  // Pick the top-12 "biggest" files (highest LoC) as candidate
  // throwers/catchers. Real analyzer would scan AST for throw/try.
  const files = Array.from(tree.byId.values())
    .filter(e => e.kind === "building")
    .sort((a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0))
    .slice(0, 12);

  const empty: FlowGraph = {
    errorTypes: [], throwers: [], catchers: [],
    throwEdges: [], catchEdges: [], unhandledCount: 0,
  };
  if (files.length === 0) return empty;

  const usedErrors = ERROR_TYPES.slice(0, Math.min(ERROR_TYPES.length, Math.max(3, Math.min(7, files.length))));

  // ── Pass 1: collect raw relationships per error type ──────────────
  // Mirrors the old "nodes" shape locally so we know which files throw /
  // catch which errors. We do NOT render chips from this structure —
  // it's just the adjacency we feed into the sankey layout below.
  const rawThrow = new Map<string, Set<string>>();   // fileId → err set
  const rawCatch = new Map<string, Set<string>>();
  const errorThrowers = new Map<string, Set<string>>();
  const errorCatchers = new Map<string, Set<string>>();
  for (const err of usedErrors) {
    errorThrowers.set(err, new Set());
    errorCatchers.set(err, new Set());
  }

  for (const err of usedErrors) {
    for (const file of files) {
      const rng = seeded(file.id, `err-${err}`);
      const throws = rng() < 0.28;
      const catches = rng() < 0.22;
      if (throws) {
        if (!rawThrow.has(file.id)) rawThrow.set(file.id, new Set());
        rawThrow.get(file.id)!.add(err);
        errorThrowers.get(err)!.add(file.id);
      }
      if (catches) {
        if (!rawCatch.has(file.id)) rawCatch.set(file.id, new Set());
        rawCatch.get(file.id)!.add(err);
        errorCatchers.get(err)!.add(file.id);
      }
    }
  }

  // ── Pass 2: place error types evenly in the middle column ─────────
  // An error type only renders if it has ≥1 thrower OR ≥1 catcher —
  // otherwise it's visual noise with no connected edges.
  const activeErrors = usedErrors.filter(err =>
    (errorThrowers.get(err)?.size ?? 0) > 0 || (errorCatchers.get(err)?.size ?? 0) > 0,
  );
  const errorY = new Map<string, number>();
  const errorTypes: ErrorTypePos[] = [];
  let unhandledCount = 0;
  const slotGap = activeErrors.length <= 1
    ? 0
    : (BOTTOM_Y - TOP_Y) / (activeErrors.length - 1);
  const startY  = activeErrors.length <= 1
    ? (TOP_Y + BOTTOM_Y) / 2
    : TOP_Y;
  for (let i = 0; i < activeErrors.length; i++) {
    const err = activeErrors[i]!;
    const y = startY + i * slotGap;
    errorY.set(err, y);
    const throwCount = errorThrowers.get(err)?.size ?? 0;
    const catchCount = errorCatchers.get(err)?.size ?? 0;
    const unhandled = throwCount > 0 && catchCount === 0;
    if (unhandled) unhandledCount += 1;
    errorTypes.push({ name: err, y, unhandled, throwCount, catchCount });
  }

  // ── Pass 3: lay out thrower column (one chip per unique fileId) ───
  // Barycentre = mean y of the error types this file throws — pulls
  // chips roughly opposite their connections so curves read left-to-
  // right without crossing. Files in different error types sharing the
  // same barycentre are disambiguated by fileId for determinism.
  const throwers = layoutColumn(rawThrow, errorY, tree);
  const catchers = layoutColumn(rawCatch, errorY, tree);

  // ── Pass 4: emit edges ────────────────────────────────────────────
  // One line per participation — a thrower that throws 3 errors yields
  // 3 curves leaving the same chip, a catcher that catches 2 errors
  // receives 2. The SVG renders each as its own <path>.
  const throwEdges: FlowGraph["throwEdges"] = [];
  for (const [fileId, errs] of rawThrow) {
    for (const err of errs) {
      if (!errorY.has(err)) continue; // err was filtered out as inactive
      throwEdges.push({ fromFileId: fileId, errName: err });
    }
  }
  const catchEdges: FlowGraph["catchEdges"] = [];
  for (const [fileId, errs] of rawCatch) {
    for (const err of errs) {
      if (!errorY.has(err)) continue;
      catchEdges.push({ errName: err, toFileId: fileId });
    }
  }

  return { errorTypes, throwers, catchers, throwEdges, catchEdges, unhandledCount };
}

/** Barycentric column layout. Given a fileId → error-types map and the
 *  error types' y positions, emit one chip per fileId at an even
 *  vertical spacing ordered by the mean y of their connections. */
function layoutColumn(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  errorY: ReadonlyMap<string, number>,
  tree: EntityTree,
): ChipPos[] {
  if (adjacency.size === 0) return [];

  const preliminary: Array<{
    fileId: string; label: string; path: string;
    errorTypes: string[]; bary: number;
  }> = [];

  for (const [fileId, errs] of adjacency) {
    const entity = tree.byId.get(fileId);
    if (!entity) continue;
    let sum = 0, count = 0;
    const errorTypes: string[] = [];
    for (const err of errs) {
      const y = errorY.get(err);
      if (y === undefined) continue;
      sum += y; count += 1;
      errorTypes.push(err);
    }
    if (count === 0) continue;
    preliminary.push({
      fileId,
      label: entity.name,
      path: entity.path,
      errorTypes,
      bary: sum / count,
    });
  }

  // Sort by barycentre, tie-break by fileId so runs are deterministic.
  preliminary.sort((a, b) => {
    if (a.bary !== b.bary) return a.bary - b.bary;
    return a.fileId < b.fileId ? -1 : 1;
  });

  // Even spacing between TOP_Y and BOTTOM_Y. If more chips than slots,
  // clamp step to CHIP_STEP and let the stack extend below BOTTOM_Y —
  // the parent viewBox clips softly but this is strictly better than
  // overlapping at reduced pitch (unreadable labels).
  const maxSlots   = Math.floor((BOTTOM_Y - TOP_Y) / CHIP_STEP) + 1;
  const step       = preliminary.length <= 1
    ? 0
    : Math.max(CHIP_STEP, (BOTTOM_Y - TOP_Y) / (preliminary.length - 1));
  const totalH     = step * (preliminary.length - 1);
  const startOffset = preliminary.length <= maxSlots
    ? (TOP_Y + BOTTOM_Y) / 2 - totalH / 2
    : TOP_Y;

  return preliminary.map((p, i) => ({
    fileId: p.fileId,
    label: p.label,
    path: p.path,
    errorTypes: p.errorTypes,
    y: startOffset + i * step,
  }));
}

function FailureFlowViewImpl({ tree, onFocusEntity }: Props): ReactElement {
  const graph = useMemo(() => buildGraph(tree), [tree]);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.failureFlowKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  if (graph.errorTypes.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>
          에러 흐름을 추적할 데이터가 없습니다.
        </div>
      </div>
    );
  }

  // Quick lookups — both edge rendering and chip rendering need to
  // locate chip/error positions by id. Build once per render pass.
  const throwerByFileId = new Map(graph.throwers.map(c => [c.fileId, c]));
  const catcherByFileId = new Map(graph.catchers.map(c => [c.fileId, c]));
  const errorByName     = new Map(graph.errorTypes.map(e => [e.name, e]));
  const unhandledErrNames = new Set(graph.errorTypes.filter(e => e.unhandled).map(e => e.name));

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Failure Flow
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            throw → catch 전파 경로 · 처리 안 된 에러 <strong style={{ color: color.danger }}>{graph.unhandledCount}</strong>건
          </div>
        </div>
        <Legend />
      </header>

      <div style={canvasWrapStyle}>
        <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" style={svgStyle}>
          {/* Column labels */}
          <text x={130} y={28} fontFamily={font.sans} fontSize={11} fill={color.text2} letterSpacing="0.08em" textAnchor="middle">THROWERS</text>
          <text x={500} y={28} fontFamily={font.sans} fontSize={11} fill={color.text2} letterSpacing="0.08em" textAnchor="middle">ERROR TYPE</text>
          <text x={870} y={28} fontFamily={font.sans} fontSize={11} fill={color.text2} letterSpacing="0.08em" textAnchor="middle">CATCHERS</text>

          {/* Column hairlines */}
          <line x1={260} y1={44} x2={260} y2={676} stroke={color.border} strokeDasharray="2 6" />
          <line x1={740} y1={44} x2={740} y2={676} stroke={color.border} strokeDasharray="2 6" />

          {/* Throw edges — drawn before chips so chips paint on top.
           *  Each (thrower, errorType) pair gets one bezier from the
           *  chip's right edge to the error pill's left edge. */}
          {graph.throwEdges.map((e, i) => {
            const from = throwerByFileId.get(e.fromFileId);
            const to   = errorByName.get(e.errName);
            if (!from || !to) return null;
            const isUnhandled = unhandledErrNames.has(e.errName);
            return (
              <path
                key={`te-${e.fromFileId}-${e.errName}`}
                d={`M ${THROWER_X_RIGHT} ${from.y} C ${THROWER_X_RIGHT + 90} ${from.y}, ${ERR_LEFT - 90} ${to.y}, ${ERR_LEFT} ${to.y}`}
                fill="none"
                stroke={isUnhandled ? color.danger : color.text2}
                strokeOpacity={0.55}
                strokeWidth={1.1}
                strokeDasharray="240"
                style={{
                  ["--dash" as string]: "240",
                  animation: `ff-draw 640ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${120 + i * 18}ms`,
                }}
              />
            );
          })}

          {/* Catch edges — error pill's right edge → catcher chip's left. */}
          {graph.catchEdges.map((e, i) => {
            const from = errorByName.get(e.errName);
            const to   = catcherByFileId.get(e.toFileId);
            if (!from || !to) return null;
            return (
              <path
                key={`ce-${e.errName}-${e.toFileId}`}
                d={`M ${ERR_RIGHT} ${from.y} C ${ERR_RIGHT + 90} ${from.y}, ${CATCHER_X_LEFT - 90} ${to.y}, ${CATCHER_X_LEFT} ${to.y}`}
                fill="none"
                stroke={color.success}
                strokeOpacity={0.55}
                strokeWidth={1.1}
                strokeDasharray="240"
                style={{
                  ["--dash" as string]: "240",
                  animation: `ff-draw 640ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${180 + i * 18}ms`,
                }}
              />
            );
          })}

          {/* Unhandled arrow — rendered per unhandled error type (throwers
           *  exist but zero catchers caught). Exits the right edge of the
           *  error pill in red to read as "bubbled out of the process". */}
          {graph.errorTypes.map(e => e.unhandled && (
            <g key={`un-${e.name}`}>
              <path
                d={`M ${ERR_RIGHT} ${e.y} L ${CATCHER_X_LEFT + 60} ${e.y}`}
                stroke={color.danger}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                style={{ animation: `ff-pulse 1.8s ease-in-out infinite` }}
              />
              <polygon
                points={`${CATCHER_X_LEFT + 60},${e.y - 4} ${CATCHER_X_LEFT + 70},${e.y} ${CATCHER_X_LEFT + 60},${e.y + 4}`}
                fill={color.danger}
              />
              <text x={CATCHER_X_LEFT + 78} y={e.y + 3} fontFamily={font.sans} fontSize={10}
                fill={color.danger} fontWeight={font.weight.semibold}>uncaught</text>
            </g>
          ))}

          {/* Thrower chips — one per unique fileId. */}
          {graph.throwers.map((t, i) => (
            <g
              key={`tc-${t.fileId}`}
              style={{
                cursor: "pointer",
                animation: `ff-enter 420ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                animationDelay: `${60 + i * 30}ms`,
              }}
              onClick={() => onFocusEntity?.(t.fileId)}
            >
              <rect x={THROWER_X - 96} y={t.y - CHIP_H / 2} width={192} height={CHIP_H}
                rx={radius.sm} ry={radius.sm}
                fill={color.bg1} stroke={color.border} strokeWidth={0.8}
                style={{ transition: `stroke ${transition.base}` }}
              />
              <text x={THROWER_X} y={t.y + 3} fontFamily={font.sans} fontSize={10.5}
                fill={color.text0} textAnchor="middle">
                {t.label.length > 22 ? t.label.slice(0, 20) + "…" : t.label}
              </text>
            </g>
          ))}

          {/* Catcher chips — one per unique fileId. */}
          {graph.catchers.map((c, i) => (
            <g
              key={`cc-${c.fileId}`}
              style={{
                cursor: "pointer",
                animation: `ff-enter 420ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                animationDelay: `${60 + i * 30}ms`,
              }}
              onClick={() => onFocusEntity?.(c.fileId)}
            >
              <rect x={CATCHER_X - 96} y={c.y - CHIP_H / 2} width={192} height={CHIP_H}
                rx={radius.sm} ry={radius.sm}
                fill={color.bg1} stroke={color.border} strokeWidth={0.8}
                style={{ transition: `stroke ${transition.base}` }}
              />
              <text x={CATCHER_X} y={c.y + 3} fontFamily={font.sans} fontSize={10.5}
                fill={color.text0} textAnchor="middle">
                {c.label.length > 22 ? c.label.slice(0, 20) + "…" : c.label}
              </text>
            </g>
          ))}

          {/* Error-type pills — middle column. */}
          {graph.errorTypes.map((e, i) => {
            const tint = e.unhandled ? color.danger : color.text1;
            return (
              <g key={`err-${e.name}`} style={{
                animation: `ff-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                animationDelay: `${i * 60}ms`,
              }}>
                <rect x={ERROR_X - 60} y={e.y - 14} width={120} height={28}
                  rx={radius.md} ry={radius.md}
                  fill={e.unhandled ? "rgba(229, 72, 77, 0.08)" : color.bg2}
                  stroke={tint}
                  strokeWidth={e.unhandled ? 1.4 : 1.0}
                  strokeOpacity={e.unhandled ? 0.75 : 0.5}
                />
                <text x={ERROR_X} y={e.y + 3} fontFamily={font.mono} fontSize={11.5}
                  fontWeight={font.weight.semibold} fill={tint} textAnchor="middle">
                  {e.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: space[4], fontSize: font.size.xxs, color: color.text2 }}>
      <span style={legendItemStyle}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={color.text2} strokeWidth={1.1} strokeOpacity={0.6} /></svg>
        throw
      </span>
      <span style={legendItemStyle}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={color.success} strokeWidth={1.1} strokeOpacity={0.6} /></svg>
        catch
      </span>
      <span style={legendItemStyle}>
        <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={color.danger} strokeWidth={1.4} strokeDasharray="4 4" /></svg>
        uncaught
      </span>
    </div>
  );
}

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  animation: "ff-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
};

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
  padding: space[7],
};

export const FailureFlowView = memo(FailureFlowViewImpl);
