import "./error-flow-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getErrorFlow,
  type CatchHandler,
  type ErrorFlow,
  type ErrorPath,
  type Fate,
  type ThrowSite,
} from "@quanta/app-ide/entities/error-flow";

const FATE_ORDER: Fate[] = [
  "caught-handled",
  "caught-fallback",
  "caught-swallowed",
  "rethrown",
  "uncaught",
];

const FATE_LABEL: Record<Fate, string> = {
  "caught-handled": "handled",
  "caught-fallback": "fallback",
  "caught-swallowed": "swallowed",
  rethrown: "rethrown",
  uncaught: "uncaught",
};

const FATE_SLUG: Record<Fate, string> = {
  "caught-handled": "handled",
  "caught-fallback": "fallback",
  "caught-swallowed": "swallowed",
  rethrown: "rethrown",
  uncaught: "uncaught",
};

const SVG_W = 720;
const COL_THROW_X = 16;
const COL_THROW_W = 168;
const COL_CATCH_X = 264;
const COL_CATCH_W = 192;
const COL_FATE_X = 528;
const COL_FATE_W = 176;
const NODE_GAP = 10;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 16;
const MIN_NODE_H = 24;

interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FlowLayout {
  svgH: number;
  throws: Map<string, NodeRect>;
  catches: Map<string, NodeRect>;
  fates: Map<Fate, NodeRect>;
  fateWeights: Map<Fate, number>;
}

function layoutFlow(flow: ErrorFlow): FlowLayout {
  // throw weights = sum of weights of paths from each throw
  const throwWeights = new Map<string, number>();
  for (const t of flow.throws) throwWeights.set(t.id, 0);
  for (const p of flow.paths) {
    throwWeights.set(p.throwId, (throwWeights.get(p.throwId) ?? 0) + p.weight);
  }
  const catchWeights = new Map<string, number>();
  for (const c of flow.catches) catchWeights.set(c.id, 0);
  for (const p of flow.paths) {
    for (const h of p.hops) {
      catchWeights.set(h, (catchWeights.get(h) ?? 0) + p.weight);
    }
  }
  const fateWeights = new Map<Fate, number>();
  for (const f of FATE_ORDER) fateWeights.set(f, 0);
  for (const p of flow.paths) {
    fateWeights.set(p.fate, (fateWeights.get(p.fate) ?? 0) + p.weight);
  }

  const totalW = flow.paths.reduce((acc, p) => acc + p.weight, 0) || 1;
  const usableH = Math.max(180, flow.throws.length * 36, flow.paths.length * 14);
  const colHeights = {
    throwCount: flow.throws.length,
    catchCount: flow.catches.length,
  };
  const baseH = Math.max(
    usableH,
    colHeights.throwCount * (MIN_NODE_H + NODE_GAP),
    colHeights.catchCount * (MIN_NODE_H + NODE_GAP),
    FATE_ORDER.length * (MIN_NODE_H + NODE_GAP),
  );
  const svgH = baseH + PADDING_TOP + PADDING_BOTTOM;
  const colInner = svgH - PADDING_TOP - PADDING_BOTTOM;

  // throw column: weight-proportional heights
  const throws = new Map<string, NodeRect>();
  {
    const totalGap = NODE_GAP * Math.max(0, flow.throws.length - 1);
    const free = colInner - totalGap - flow.throws.length * MIN_NODE_H;
    let y = PADDING_TOP;
    for (const t of flow.throws) {
      const w = throwWeights.get(t.id) ?? 0;
      const extra = free > 0 ? (w / totalW) * free : 0;
      const h = MIN_NODE_H + Math.max(0, extra);
      throws.set(t.id, { x: COL_THROW_X, y, w: COL_THROW_W, h });
      y += h + NODE_GAP;
    }
  }

  // catch column: equal sized but weight-proportional
  const catches = new Map<string, NodeRect>();
  {
    const totalCatchW =
      flow.catches.reduce((acc, c) => acc + (catchWeights.get(c.id) ?? 0), 0) || 1;
    const totalGap = NODE_GAP * Math.max(0, flow.catches.length - 1);
    const free = colInner - totalGap - flow.catches.length * MIN_NODE_H;
    let y = PADDING_TOP;
    for (const c of flow.catches) {
      const w = catchWeights.get(c.id) ?? 0;
      const extra = free > 0 ? (w / totalCatchW) * free : 0;
      const h = MIN_NODE_H + Math.max(0, extra);
      catches.set(c.id, { x: COL_CATCH_X, y, w: COL_CATCH_W, h });
      y += h + NODE_GAP;
    }
  }

  // fate column: weight-proportional, gives 0-weight buckets a min
  const fates = new Map<Fate, NodeRect>();
  {
    const totalGap = NODE_GAP * (FATE_ORDER.length - 1);
    const free = colInner - totalGap - FATE_ORDER.length * MIN_NODE_H;
    let y = PADDING_TOP;
    for (const f of FATE_ORDER) {
      const w = fateWeights.get(f) ?? 0;
      const extra = free > 0 ? (w / totalW) * free : 0;
      const h = MIN_NODE_H + Math.max(0, extra);
      fates.set(f, { x: COL_FATE_X, y, w: COL_FATE_W, h });
      y += h + NODE_GAP;
    }
  }

  return { svgH, throws, catches, fates, fateWeights };
}

interface Anchor {
  x: number;
  y: number;
}

interface SegmentEntry {
  pathId: string;
  weight: number;
}

function strokeWidth(weight: number): number {
  return Math.max(1.2, Math.log2(weight + 1) * 1.6);
}

function curve(a: Anchor, b: Anchor): string {
  const dx = (b.x - a.x) * 0.5;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

interface RowSegment {
  pathId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function fmtFrame(frame: string): string {
  const dot = frame.lastIndexOf(".");
  return dot >= 0 ? frame.slice(dot + 1) : frame;
}

export function ErrorFlowPane({ file }: { file: FileFacts }) {
  const flow = useMemo(() => getErrorFlow(file.name), [file.name]);
  const [hoverThrow, setHoverThrow] = useState<string | null>(null);
  const [hoverFate, setHoverFate] = useState<Fate | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<Fate, boolean>>({
    "caught-handled": true,
    "caught-fallback": true,
    "caught-swallowed": true,
    rethrown: true,
    uncaught: true,
  });

  if (!flow) {
    return (
      <div className="eflow-pane">
        <div className="eflow-pane__empty">
          No error-flow data for <code>{file.name}</code>
          <div className="eflow-pane__empty-sub">
            Throw / catch graph is computed from the static analyzer.
          </div>
        </div>
      </div>
    );
  }

  return <ErrorFlowPaneInner
    flow={flow}
    hoverThrow={hoverThrow}
    setHoverThrow={setHoverThrow}
    hoverFate={hoverFate}
    setHoverFate={setHoverFate}
    activePath={activePath}
    setActivePath={setActivePath}
    enabled={enabled}
    setEnabled={setEnabled}
  />;
}

interface InnerProps {
  flow: ErrorFlow;
  hoverThrow: string | null;
  setHoverThrow: (v: string | null) => void;
  hoverFate: Fate | null;
  setHoverFate: (v: Fate | null) => void;
  activePath: string | null;
  setActivePath: (v: string | null) => void;
  enabled: Record<Fate, boolean>;
  setEnabled: (v: Record<Fate, boolean>) => void;
}

function ErrorFlowPaneInner(props: InnerProps) {
  const {
    flow,
    hoverThrow,
    setHoverThrow,
    hoverFate,
    setHoverFate,
    activePath,
    setActivePath,
    enabled,
    setEnabled,
  } = props;

  const layout = useMemo(() => layoutFlow(flow), [flow]);
  const fateCounts = useMemo(() => {
    const m = new Map<Fate, number>();
    for (const f of FATE_ORDER) m.set(f, 0);
    for (const p of flow.paths) m.set(p.fate, (m.get(p.fate) ?? 0) + 1);
    return m;
  }, [flow]);

  const visiblePaths = useMemo(
    () => flow.paths.filter((p) => enabled[p.fate]),
    [flow.paths, enabled],
  );

  const segments = useMemo(
    () => buildSegments(visiblePaths, layout),
    [visiblePaths, layout],
  );

  const throwById = useMemo(() => {
    const m = new Map<string, ThrowSite>();
    for (const t of flow.throws) m.set(t.id, t);
    return m;
  }, [flow]);
  const catchById = useMemo(() => {
    const m = new Map<string, CatchHandler>();
    for (const c of flow.catches) m.set(c.id, c);
    return m;
  }, [flow]);

  const worstUncaught = useMemo(() => {
    if (flow.uncaughtCount === 0) return null;
    let bestPath: ErrorPath | null = null;
    for (const p of flow.paths) {
      if (p.fate !== "uncaught") continue;
      if (!bestPath || p.weight > bestPath.weight) bestPath = p;
    }
    if (!bestPath) return null;
    const t = throwById.get(bestPath.throwId);
    return t ?? null;
  }, [flow, throwById]);

  const completenessPct = Math.round(flow.completeness * 100);
  const gaugeTone =
    completenessPct >= 80 ? "good" : completenessPct >= 50 ? "mid" : "bad";

  function isPathHighlighted(p: ErrorPath): boolean {
    if (activePath) return p.id === activePath;
    if (hoverThrow) return p.throwId === hoverThrow;
    if (hoverFate) return p.fate === hoverFate;
    return false;
  }
  const hasFocus = activePath !== null || hoverThrow !== null || hoverFate !== null;

  return (
    <div className="eflow-pane">
      {worstUncaught && (
        <div className="eflow-pane__callout" role="alert">
          <span className="eflow-pane__callout-glyph" aria-hidden="true">⚠</span>
          <div className="eflow-pane__callout-body">
            <strong>{flow.uncaughtCount}</strong> throw site
            {flow.uncaughtCount === 1 ? "" : "s"} escape the process boundary uncaught.
            {" "}Highest risk:{" "}
            <strong>{worstUncaught.errorType}</strong>{" "}
            <span className="eflow-pane__callout-loc">
              at L:{worstUncaught.line}
            </span>
            .
          </div>
        </div>
      )}

      <div className="eflow-pane__head">
        <div className="eflow-pane__gauge">
          <Gauge pct={completenessPct} tone={gaugeTone} />
        </div>
        <div className="eflow-pane__stat">
          <div className="eflow-pane__stat-v">{flow.throws.length}</div>
          <div className="eflow-pane__stat-k">throws</div>
        </div>
        <div className="eflow-pane__stat">
          <div className={`eflow-pane__stat-v${flow.uncaughtCount > 0 ? " eflow-pane__stat-v--bad" : ""}`}>
            {flow.uncaughtCount}
          </div>
          <div className="eflow-pane__stat-k">uncaught</div>
        </div>
        <div className="eflow-pane__stat">
          <div className={`eflow-pane__stat-v${flow.swallowedCount > 0 ? " eflow-pane__stat-v--warn" : ""}`}>
            {flow.swallowedCount}
          </div>
          <div className="eflow-pane__stat-k">swallowed</div>
        </div>
      </div>

      <div className="eflow-pane__filter" role="group" aria-label="fate filter">
        {FATE_ORDER.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={enabled[f]}
            className={`eflow-pane__pill eflow-pane__pill--${FATE_SLUG[f]}${enabled[f] ? " is-active" : ""}`}
            onClick={() => setEnabled({ ...enabled, [f]: !enabled[f] })}
          >
            <span className="eflow-pane__pill-dot" aria-hidden="true" />
            <span>{FATE_LABEL[f]}</span>
            <span className="eflow-pane__pill-cnt">{fateCounts.get(f) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="eflow-pane__flow">
        <svg
          className="eflow-pane__flow-svg"
          viewBox={`0 0 ${SVG_W} ${layout.svgH}`}
          role="img"
          aria-label="Error flow Sankey diagram"
        >
          <text className="eflow-col-label" x={COL_THROW_X} y={14}>throws</text>
          <text className="eflow-col-label" x={COL_CATCH_X} y={14}>catches</text>
          <text className="eflow-col-label" x={COL_FATE_X} y={14}>fates</text>

          {/* Links rendered first so nodes float on top */}
          <g className="eflow-links">
            {segments.map((seg) => {
              const path = flow.paths.find((p) => p.id === seg.pathId);
              if (!path) return null;
              const highlighted = isPathHighlighted(path);
              const dim = hasFocus && !highlighted;
              const cls =
                `eflow-link eflow-link--${FATE_SLUG[path.fate]}` +
                (highlighted ? " is-active" : "") +
                (dim ? " is-dim" : "");
              return (
                <path
                  key={`${seg.pathId}-${seg.startX}-${seg.endX}`}
                  className={cls}
                  d={curve(
                    { x: seg.startX, y: seg.startY },
                    { x: seg.endX, y: seg.endY },
                  )}
                  strokeWidth={strokeWidth(path.weight)}
                  opacity={dim ? undefined : 0.7}
                />
              );
            })}
          </g>

          {/* Throw nodes */}
          {flow.throws.map((t) => {
            const r = layout.throws.get(t.id);
            if (!r) return null;
            const isHot =
              flow.paths.some((p) => p.throwId === t.id && p.fate === "uncaught");
            return (
              <g key={t.id}>
                <rect
                  className={`eflow-throw-rect${isHot ? " is-hot" : ""}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                />
                <text className="eflow-node-label" x={r.x + 8} y={r.y + 13}>
                  {t.errorType}
                </text>
                <text className="eflow-node-sub" x={r.x + 8} y={r.y + 24}>
                  {fmtFrame(t.frame)} · L{t.line}
                </text>
                <rect
                  className="eflow-hit"
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  onMouseEnter={() => setHoverThrow(t.id)}
                  onMouseLeave={() => setHoverThrow(null)}
                />
              </g>
            );
          })}

          {/* Catch nodes */}
          {flow.catches.map((c) => {
            const r = layout.catches.get(c.id);
            if (!r) return null;
            const swallow = !c.hasFallback && !c.hasLog && !c.rethrows;
            return (
              <g key={c.id}>
                <rect
                  className={`eflow-catch-rect${swallow ? " is-swallow" : ""}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                />
                <text className="eflow-node-label" x={r.x + 8} y={r.y + 13}>
                  {c.errorTypes.join(" | ")}
                </text>
                <text className="eflow-node-sub" x={r.x + 8} y={r.y + 24}>
                  L{c.line}
                </text>
                <text className="eflow-flag" x={r.x + r.w - 38} y={r.y + 13}>
                  {c.hasFallback ? "FB" : ""}
                </text>
                <text className="eflow-flag" x={r.x + r.w - 22} y={r.y + 13}>
                  {c.hasLog ? "LG" : ""}
                </text>
                <text className="eflow-flag" x={r.x + r.w - 38} y={r.y + 24}>
                  {c.rethrows ? "↗" : ""}
                </text>
              </g>
            );
          })}

          {/* Fate nodes */}
          {FATE_ORDER.map((f) => {
            const r = layout.fates.get(f);
            if (!r) return null;
            const w = layout.fateWeights.get(f) ?? 0;
            return (
              <g key={f}>
                <rect
                  className={`eflow-fate-rect eflow-fate-rect--${FATE_SLUG[f]}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                />
                <text className="eflow-node-label" x={r.x + 8} y={r.y + 13}>
                  {FATE_LABEL[f]}
                </text>
                <text className="eflow-fate-cnt" x={r.x + 8} y={r.y + 24}>
                  {fateCounts.get(f) ?? 0} path{(fateCounts.get(f) ?? 0) === 1 ? "" : "s"} · w {w}
                </text>
                <rect
                  className="eflow-hit"
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  onMouseEnter={() => setHoverFate(f)}
                  onMouseLeave={() => setHoverFate(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="eflow-pane__list-h">
        <span>paths</span>
        <span className="eflow-pane__list-h-cnt">{visiblePaths.length} / {flow.paths.length}</span>
      </div>

      <ul className="eflow-pane__list">
        {visiblePaths.map((p) => {
          const t = throwById.get(p.throwId);
          if (!t) return null;
          const highlighted = isPathHighlighted(p);
          const dim = hasFocus && !highlighted;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`eflow-pane__row${highlighted ? " is-active" : ""}${dim ? " is-dim" : ""}`}
                onClick={() => setActivePath(activePath === p.id ? null : p.id)}
              >
                <span className="eflow-pane__row-src">
                  <span className="eflow-pane__row-err">{t.errorType}</span>
                  <span className="eflow-pane__row-loc">L{t.line}</span>
                </span>
                <span className="eflow-pane__row-hops">
                  {p.hops.length === 0 ? (
                    <span className="eflow-pane__row-hop-empty">no handler</span>
                  ) : (
                    p.hops.map((hopId, i) => {
                      const c = catchById.get(hopId);
                      return (
                        <span key={`${hopId}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span className="eflow-pane__row-hop">
                            {c ? `${fmtFrame(c.frame)}:${c.line}` : hopId}
                          </span>
                          {i < p.hops.length - 1 && (
                            <span className="eflow-pane__row-hop-arrow">→</span>
                          )}
                        </span>
                      );
                    })
                  )}
                </span>
                <span className={`eflow-pane__row-fate eflow-pane__row-fate--${FATE_SLUG[p.fate]}`}>
                  {FATE_LABEL[p.fate]}
                </span>
                <span className="eflow-pane__row-w">w {p.weight}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function buildSegments(
  visiblePaths: ErrorPath[],
  layout: FlowLayout,
): RowSegment[] {
  // Subdivide each node's right/left edge among the paths flowing through it,
  // ordered so links don't cross within the node band.
  const throwOut = new Map<string, SegmentEntry[]>();
  const catchIn = new Map<string, SegmentEntry[]>();
  const catchOut = new Map<string, SegmentEntry[]>();
  const fateIn = new Map<Fate, SegmentEntry[]>();

  for (const p of visiblePaths) {
    pushList(throwOut, p.throwId, { pathId: p.id, weight: p.weight });
    if (p.hops.length === 0) {
      pushList(fateIn, p.fate, { pathId: p.id, weight: p.weight });
    } else {
      pushList(catchIn, p.hops[0], { pathId: p.id, weight: p.weight });
      for (let i = 1; i < p.hops.length; i++) {
        pushList(catchOut, p.hops[i - 1], { pathId: p.id, weight: p.weight });
        pushList(catchIn, p.hops[i], { pathId: p.id, weight: p.weight });
      }
      pushList(catchOut, p.hops[p.hops.length - 1], { pathId: p.id, weight: p.weight });
      pushList(fateIn, p.fate, { pathId: p.id, weight: p.weight });
    }
  }

  function anchorY(rect: NodeRect, list: SegmentEntry[] | undefined, pathId: string): number {
    if (!list || list.length === 0) return rect.y + rect.h / 2;
    const total = list.reduce((acc, e) => acc + e.weight, 0);
    let cursor = 0;
    for (const e of list) {
      if (e.pathId === pathId) {
        const center = cursor + e.weight / 2;
        return rect.y + (center / total) * rect.h;
      }
      cursor += e.weight;
    }
    return rect.y + rect.h / 2;
  }

  const segments: RowSegment[] = [];
  for (const p of visiblePaths) {
    const t = layout.throws.get(p.throwId);
    if (!t) continue;
    let prevX = t.x + t.w;
    let prevY = anchorY(t, throwOut.get(p.throwId), p.id);
    for (const hopId of p.hops) {
      const c = layout.catches.get(hopId);
      if (!c) continue;
      const inY = anchorY(c, catchIn.get(hopId), p.id);
      segments.push({ pathId: p.id, startX: prevX, startY: prevY, endX: c.x, endY: inY });
      prevX = c.x + c.w;
      prevY = anchorY(c, catchOut.get(hopId), p.id);
    }
    const f = layout.fates.get(p.fate);
    if (!f) continue;
    const fY = anchorY(f, fateIn.get(p.fate), p.id);
    segments.push({ pathId: p.id, startX: prevX, startY: prevY, endX: f.x, endY: fY });
  }
  return segments;
}

function pushList<K>(map: Map<K, SegmentEntry[]>, key: K, e: SegmentEntry): void {
  const arr = map.get(key);
  if (arr) arr.push(e);
  else map.set(key, [e]);
}

function Gauge({ pct, tone }: { pct: number; tone: "good" | "mid" | "bad" }) {
  // Semicircle from (10, 50) to (100, 50) with radius 45, top
  const cx = 55;
  const cy = 50;
  const r = 40;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <>
      <svg className="eflow-pane__gauge-svg" viewBox="0 0 110 60">
        <path
          className="eflow-pane__gauge-track"
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          className={`eflow-pane__gauge-fill eflow-pane__gauge-fill--${tone}`}
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="eflow-pane__gauge-text">
        <span className="eflow-pane__gauge-pct">{pct}%</span>
        <span className="eflow-pane__gauge-lbl">complete</span>
      </div>
    </>
  );
}
