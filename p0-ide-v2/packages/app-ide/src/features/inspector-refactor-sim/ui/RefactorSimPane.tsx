import "./refactor-sim-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getRefactorSim,
  type EdgeDelta,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type OwnershipShiftEntry,
  type RefactorCandidate,
  type RefactorOp,
  type SafetyClaim,
} from "@quanta/app-ide/entities/refactor-sim";

/* ─────────────────────────────────────────────────────────────
 * Op metadata
 * ───────────────────────────────────────────────────────────── */

const OP_ICON: Record<RefactorOp, string> = {
  "extract-method":    "Ex",
  "split-file":        "Sp",
  "inline":            "In",
  "rename":            "Rn",
  "move":              "Mv",
  "extract-interface": "I/",
};

const OP_LABEL: Record<RefactorOp, string> = {
  "extract-method":    "extract-method",
  "split-file":        "split-file",
  "inline":            "inline",
  "rename":            "rename",
  "move":              "move",
  "extract-interface": "extract-interface",
};

/* ─────────────────────────────────────────────────────────────
 * Safety score → tone
 * ───────────────────────────────────────────────────────────── */

type Tone = "ok" | "warn" | "bad";

function scoreTone(score: number): Tone {
  if (score >= 90) return "ok";
  if (score >= 70) return "warn";
  return "bad";
}

const CLAIM_GLYPH: Record<SafetyClaim["status"], string> = {
  pass: "✓",
  warn: "△",
  fail: "✗",
};

/* ─────────────────────────────────────────────────────────────
 * Deterministic graph layout
 *
 * We use a degree-ordered radial-ish placement on a 320x180 viewBox.
 * Nodes with higher degree land closer to the centroid; everyone else
 * distributes around a circle. The hashing is stable by nodeId so the
 * before/after layouts are reproducible and easy to compare visually.
 * ───────────────────────────────────────────────────────────── */

interface LaidNode {
  node: FlowNode;
  x: number;
  y: number;
  r: number;
  degree: number;
}

interface LaidGraph {
  viewBoxW: number;
  viewBoxH: number;
  nodes: Map<string, LaidNode>;
  edges: FlowEdge[];
}

const VB_W = 320;
const VB_H = 180;

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function layout(graph: FlowGraph): LaidGraph {
  const degree = new Map<string, number>();
  for (const n of graph.nodes) degree.set(n.id, 0);
  for (const e of graph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to,   (degree.get(e.to)   ?? 0) + 1);
  }

  // Order: by degree desc, then by stable hash (reproducible).
  const ordered = [...graph.nodes].sort((a, b) => {
    const da = degree.get(a.id) ?? 0;
    const db = degree.get(b.id) ?? 0;
    if (da !== db) return db - da;
    return hash(a.id) - hash(b.id);
  });

  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const placed = new Map<string, LaidNode>();

  if (ordered.length === 0) {
    return { viewBoxW: VB_W, viewBoxH: VB_H, nodes: placed, edges: graph.edges };
  }

  // First node: centroid.
  const first = ordered[0];
  placed.set(first.id, {
    node: first,
    x: cx,
    y: cy,
    r: nodeRadius(degree.get(first.id) ?? 0),
    degree: degree.get(first.id) ?? 0,
  });

  // Remaining: two concentric rings.
  const rest = ordered.slice(1);
  const innerCount = Math.ceil(rest.length / 2);
  const outerCount = rest.length - innerCount;
  const innerR = 42;
  const outerR = 72;

  for (let i = 0; i < innerCount; i++) {
    const n = rest[i];
    const bias = (hash(n.id) % 1000) / 1000; // 0..1 jitter per id
    const baseAngle = (i / Math.max(1, innerCount)) * Math.PI * 2;
    const angle = baseAngle + bias * 0.3;
    placed.set(n.id, {
      node: n,
      x: cx + innerR * Math.cos(angle),
      y: cy + innerR * Math.sin(angle) * 0.75,
      r: nodeRadius(degree.get(n.id) ?? 0),
      degree: degree.get(n.id) ?? 0,
    });
  }
  for (let i = 0; i < outerCount; i++) {
    const n = rest[innerCount + i];
    const bias = (hash(n.id) % 1000) / 1000;
    const baseAngle = (i / Math.max(1, outerCount)) * Math.PI * 2 + Math.PI / outerCount;
    const angle = baseAngle + bias * 0.2;
    placed.set(n.id, {
      node: n,
      x: cx + outerR * Math.cos(angle),
      y: cy + outerR * Math.sin(angle) * 0.78,
      r: nodeRadius(degree.get(n.id) ?? 0),
      degree: degree.get(n.id) ?? 0,
    });
  }

  // Clamp to viewBox with margin.
  const margin = 14;
  for (const lp of placed.values()) {
    lp.x = Math.max(margin, Math.min(VB_W - margin, lp.x));
    lp.y = Math.max(margin, Math.min(VB_H - margin, lp.y));
  }

  return { viewBoxW: VB_W, viewBoxH: VB_H, nodes: placed, edges: graph.edges };
}

function nodeRadius(deg: number): number {
  // 5..11 px, saturating at degree 6.
  return 5 + Math.min(6, deg) * 1;
}

/* ─────────────────────────────────────────────────────────────
 * Delta sets
 * ───────────────────────────────────────────────────────────── */

function edgeKey(e: FlowEdge): string {
  return `${e.from}→${e.to}:${e.kind}`;
}

function buildDeltaSets(
  before: FlowGraph,
  after: FlowGraph,
  deltas: EdgeDelta[],
): {
  addedEdges: Set<string>;
  removedEdges: Set<string>;
  newNodeIds: Set<string>;
} {
  const addedEdges = new Set<string>();
  const removedEdges = new Set<string>();
  for (const d of deltas) {
    if (d.op === "add") addedEdges.add(edgeKey(d.edge));
    else removedEdges.add(edgeKey(d.edge));
  }
  const beforeIds = new Set(before.nodes.map((n) => n.id));
  const newNodeIds = new Set<string>();
  for (const n of after.nodes) {
    if (!beforeIds.has(n.id)) newNodeIds.add(n.id);
  }
  return { addedEdges, removedEdges, newNodeIds };
}

/* ─────────────────────────────────────────────────────────────
 * Graph rendering
 * ───────────────────────────────────────────────────────────── */

interface MiniGraphProps {
  laid: LaidGraph;
  phase: "before" | "after";
  addedEdges: Set<string>;
  removedEdges: Set<string>;
  newNodeIds: Set<string>;
  arrowId: string;
  arrowAddId: string;
  arrowRemoveId: string;
}

function MiniGraph({
  laid,
  phase,
  addedEdges,
  removedEdges,
  newNodeIds,
  arrowId,
  arrowAddId,
  arrowRemoveId,
}: MiniGraphProps) {
  return (
    <svg
      className="rfsim-pane__graph-svg"
      viewBox={`0 0 ${laid.viewBoxW} ${laid.viewBoxH}`}
      role="img"
      aria-label={`${phase} flow graph`}
    >
      <defs>
        <marker id={arrowId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--fg-subtle)" />
        </marker>
        <marker id={arrowAddId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--ok, #3ba55c)" />
        </marker>
        <marker id={arrowRemoveId} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="var(--danger)" />
        </marker>
      </defs>

      {/* Edges layer */}
      <g>
        {laid.edges.map((e, i) => {
          const from = laid.nodes.get(e.from);
          const to = laid.nodes.get(e.to);
          if (!from || !to) return null;
          const key = edgeKey(e);
          const isAdded = phase === "after" && addedEdges.has(key);
          const isRemoved = phase === "before" && removedEdges.has(key);
          // Trim endpoints so arrow lands on node border, not center.
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.max(0.001, Math.hypot(dx, dy));
          const ux = dx / len;
          const uy = dy / len;
          const x1 = from.x + ux * from.r;
          const y1 = from.y + uy * from.r;
          const x2 = to.x - ux * (to.r + 2);
          const y2 = to.y - uy * (to.r + 2);
          const cls =
            "rfsim-g__edge" +
            (isAdded ? " rfsim-g__edge--add" : "") +
            (isRemoved ? " rfsim-g__edge--remove" : "");
          const marker = isAdded
            ? `url(#${arrowAddId})`
            : isRemoved
              ? `url(#${arrowRemoveId})`
              : `url(#${arrowId})`;
          // Slight curve on the path so parallel edges don't overlap.
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const nx = -uy;
          const ny = ux;
          const curveBias = ((hash(`${key}-${i}`) % 11) - 5) * 0.8;
          const cx = mx + nx * curveBias;
          const cy = my + ny * curveBias;
          const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
          return (
            <g key={`${key}-${i}`}>
              <path className={cls} d={d} markerEnd={marker} />
              {isAdded && (
                <text
                  className="rfsim-g__edge-mark"
                  x={cx.toFixed(2)}
                  y={(cy - 3).toFixed(2)}
                >
                  +
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Nodes layer */}
      <g>
        {[...laid.nodes.values()].map((n) => {
          const isNew = phase === "after" && newNodeIds.has(n.node.id);
          const bgClass =
            "rfsim-g__node-bg" +
            (n.node.kind === "external" ? " rfsim-g__node-bg--external" : "") +
            (n.node.kind === "module" ? " rfsim-g__node-bg--module" : "") +
            (isNew ? " rfsim-g__node-bg--new" : "");
          return (
            <g key={n.node.id}>
              <circle
                className={bgClass}
                cx={n.x}
                cy={n.y}
                r={n.r}
              />
              <text className="rfsim-g__node-label" x={n.x} y={n.y + n.r + 8}>
                {n.node.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Safety gauge
 * ───────────────────────────────────────────────────────────── */

interface GaugeProps {
  score: number;
}

function SafetyGauge({ score }: GaugeProps) {
  // Semi-circle gauge. Radius r, arc length = π·r. stroke-dasharray trick:
  // set dasharray to the arc length, dashoffset controls fill.
  const R = 64;
  const CX = 80;
  const CY = 78;
  const arcLen = Math.PI * R;
  const clamped = Math.max(0, Math.min(100, score));
  const filled = (clamped / 100) * arcLen;
  const tone = scoreTone(clamped);
  return (
    <div className="rfsim-pane__gauge">
      <svg
        className="rfsim-pane__gauge-svg"
        viewBox="0 0 160 100"
        role="img"
        aria-label={`Safety score ${clamped} of 100`}
      >
        {/* Track (background semi-circle) */}
        <path
          className="rfsim-pane__gauge-track"
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Fill (score-colored) */}
        <path
          className={`rfsim-pane__gauge-fill rfsim-pane__gauge-fill--${tone}`}
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(2)} ${arcLen.toFixed(2)}`}
        />
      </svg>
      <div className="rfsim-pane__gauge-value">
        <span className="rfsim-pane__gauge-num">{clamped}</span>
        <span className="rfsim-pane__gauge-label">safety</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Ownership compact bars
 * ───────────────────────────────────────────────────────────── */

function OwnershipBlock({ shift }: { shift: OwnershipShiftEntry[] }) {
  const top = [...shift]
    .sort((a, b) => Math.max(b.pctBefore, b.pctAfter) - Math.max(a.pctBefore, a.pctAfter))
    .slice(0, 2);
  return (
    <div className="rfsim-pane__own">
      {top.map((o) => (
        <div key={o.owner} className="rfsim-pane__own-block">
          <div className="rfsim-pane__own-owner">{o.owner}</div>
          <div className="rfsim-pane__own-row rfsim-pane__own-row--before">
            <span className="rfsim-pane__own-tag">bef</span>
            <span className="rfsim-pane__own-bar">
              <span
                className="rfsim-pane__own-fill"
                style={{ width: `${Math.max(0, Math.min(100, o.pctBefore))}%` }}
              />
            </span>
            <span className="rfsim-pane__own-pct">{o.pctBefore}%</span>
          </div>
          <div className="rfsim-pane__own-row rfsim-pane__own-row--after">
            <span className="rfsim-pane__own-tag">aft</span>
            <span className="rfsim-pane__own-bar">
              <span
                className="rfsim-pane__own-fill"
                style={{ width: `${Math.max(0, Math.min(100, o.pctAfter))}%` }}
              />
            </span>
            <span className="rfsim-pane__own-pct">{o.pctAfter}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Impact tiles
 * ───────────────────────────────────────────────────────────── */

function BlastTile({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  const tone: "down" | "up" | "flat" = diff < 0 ? "down" : diff > 0 ? "up" : "flat";
  const arrow = diff < 0 ? "↓" : diff > 0 ? "↑" : "=";
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Blast radius</div>
      <div className="rfsim-pane__tile-body">
        <span>{before}</span>
        <span className="rfsim-pane__tile-sub">→</span>
        <span>{after}</span>
        <span className={`rfsim-pane__delta rfsim-pane__delta--${tone}`}>
          {arrow}
          {Math.abs(diff)}
        </span>
      </div>
      <div className="rfsim-pane__tile-sub">files transitively affected</div>
    </div>
  );
}

function ConsumersTile({ n }: { n: number }) {
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Consumers</div>
      <div className="rfsim-pane__tile-body">
        <span>{n}</span>
      </div>
      <div className="rfsim-pane__tile-sub">external files / services</div>
    </div>
  );
}

function TestsTile({ stale, stillCover }: { stale: number; stillCover: number }) {
  const total = stale + stillCover;
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Tests</div>
      <div className="rfsim-pane__tile-body">
        <span>{stillCover}</span>
        <span className="rfsim-pane__tile-sub">/</span>
        <span>{total}</span>
        <span className="rfsim-pane__tile-sub">still cover</span>
      </div>
      <div className="rfsim-pane__tile-sub">{stale} would go stale</div>
    </div>
  );
}

function CoverageTile({ gap }: { gap: number }) {
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Coverage gap</div>
      <div className="rfsim-pane__tile-body">
        <span>{gap}</span>
        <span className="rfsim-pane__tile-sub">lines</span>
      </div>
      <div className="rfsim-pane__tile-sub">previously tested, now uncovered</div>
    </div>
  );
}

function OwnershipTile({ shift }: { shift: OwnershipShiftEntry[] }) {
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Ownership</div>
      <OwnershipBlock shift={shift} />
    </div>
  );
}

function OpTile({ op }: { op: RefactorOp }) {
  return (
    <div className="rfsim-pane__tile">
      <div className="rfsim-pane__tile-label">Operation</div>
      <div className="rfsim-pane__tile-body">
        <span className="rfsim-pane__op-pill">{OP_LABEL[op]}</span>
      </div>
      <div className="rfsim-pane__tile-sub">refactor kind</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Empty state
 * ───────────────────────────────────────────────────────────── */

function EmptyState({ fileName }: { fileName: string }) {
  return (
    <div className="rfsim-pane">
      <div className="rfsim-pane__footer">
        No refactor candidates synthesized for <code>{fileName}</code>. Open a file
        with at least one dense call graph to see pre-apply simulations.
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main pane
 * ───────────────────────────────────────────────────────────── */

export function RefactorSimPane({ file }: { file: FileFacts }) {
  const sim = useMemo(() => getRefactorSim(file.name), [file.name]);
  const candidates: RefactorCandidate[] = sim?.candidates ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates.length > 0 ? candidates[0].id : null,
  );

  const selected: RefactorCandidate | null = useMemo(() => {
    if (candidates.length === 0) return null;
    const match = candidates.find((c) => c.id === selectedId);
    return match ?? candidates[0];
  }, [candidates, selectedId]);

  const deltaSets = useMemo(() => {
    if (!selected) return null;
    return buildDeltaSets(selected.before, selected.after, selected.edgeDeltas);
  }, [selected]);

  const beforeLayout = useMemo(
    () => (selected ? layout(selected.before) : null),
    [selected],
  );
  const afterLayout = useMemo(
    () => (selected ? layout(selected.after) : null),
    [selected],
  );

  if (!sim || !selected || !deltaSets || !beforeLayout || !afterLayout) {
    return <EmptyState fileName={file.name} />;
  }

  const addedCount = selected.edgeDeltas.filter((d) => d.op === "add").length;
  const removedCount = selected.edgeDeltas.filter((d) => d.op === "remove").length;

  // Unique ids for SVG defs so multiple panes / graphs never clash.
  const uid = selected.id;
  const arrowId = `rfsim-arrow-${uid}`;
  const arrowAddId = `rfsim-arrow-add-${uid}`;
  const arrowRemoveId = `rfsim-arrow-rm-${uid}`;

  return (
    <div className="rfsim-pane">
      {/* 1. Candidate selector */}
      <section className="rfsim-pane__section">
        <div className="rfsim-pane__section-head">
          <h2 className="rfsim-pane__section-title">Candidates</h2>
          <span className="rfsim-pane__section-sub">
            {candidates.length} synthesized · click to preview
          </span>
        </div>
        <div className="rfsim-pane__cands" role="tablist">
          {candidates.map((c) => {
            const tone = scoreTone(c.safetyScore);
            const active = c.id === selected.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rfsim-pane__cand${active ? " is-active" : ""}`}
                onClick={() => setSelectedId(c.id)}
                title={c.description}
              >
                <span className="rfsim-pane__cand-op" aria-hidden>
                  {OP_ICON[c.op]}
                </span>
                <span className="rfsim-pane__cand-title">{c.title}</span>
                <span className={`rfsim-pane__cand-score rfsim-pane__cand-score--${tone}`}>
                  {c.safetyScore}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Before / After flow graphs */}
      <section className="rfsim-pane__section">
        <div className="rfsim-pane__section-head">
          <h2 className="rfsim-pane__section-title">Flow morph</h2>
          <span className="rfsim-pane__section-sub">
            <span style={{ color: "var(--danger)" }}>−{removedCount}</span>{" / "}
            <span style={{ color: "var(--ok, #3ba55c)" }}>+{addedCount}</span> edges
          </span>
        </div>
        <div className="rfsim-pane__graphs">
          <div className="rfsim-pane__graph">
            <div className="rfsim-pane__graph-head">
              <span className="rfsim-pane__graph-label">Before</span>
              <span className="rfsim-pane__graph-meta">
                {selected.before.nodes.length}n · {selected.before.edges.length}e
              </span>
            </div>
            <MiniGraph
              laid={beforeLayout}
              phase="before"
              addedEdges={deltaSets.addedEdges}
              removedEdges={deltaSets.removedEdges}
              newNodeIds={deltaSets.newNodeIds}
              arrowId={`${arrowId}-b`}
              arrowAddId={`${arrowAddId}-b`}
              arrowRemoveId={`${arrowRemoveId}-b`}
            />
          </div>
          <div className="rfsim-pane__graph">
            <div className="rfsim-pane__graph-head">
              <span className="rfsim-pane__graph-label">After</span>
              <span className="rfsim-pane__graph-meta">
                {selected.after.nodes.length}n · {selected.after.edges.length}e
              </span>
            </div>
            <MiniGraph
              laid={afterLayout}
              phase="after"
              addedEdges={deltaSets.addedEdges}
              removedEdges={deltaSets.removedEdges}
              newNodeIds={deltaSets.newNodeIds}
              arrowId={`${arrowId}-a`}
              arrowAddId={`${arrowAddId}-a`}
              arrowRemoveId={`${arrowRemoveId}-a`}
            />
          </div>
        </div>
      </section>

      {/* 3. Safety gauge + claims */}
      <section className="rfsim-pane__section">
        <div className="rfsim-pane__section-head">
          <h2 className="rfsim-pane__section-title">Safety gauge</h2>
          <span className="rfsim-pane__section-sub">
            {selected.claims.filter((c) => c.status === "pass").length} pass ·{" "}
            {selected.claims.filter((c) => c.status === "warn").length} warn ·{" "}
            {selected.claims.filter((c) => c.status === "fail").length} fail
          </span>
        </div>
        <div className="rfsim-pane__safety">
          <SafetyGauge score={selected.safetyScore} />
          <ul className="rfsim-pane__claims">
            {selected.claims.map((c) => (
              <li
                key={c.id}
                className={`rfsim-pane__claim rfsim-pane__claim--${c.status}`}
              >
                <span className="rfsim-pane__claim-glyph" aria-hidden>
                  {CLAIM_GLYPH[c.status]}
                </span>
                <span className="rfsim-pane__claim-label">{c.label}</span>
                <span className="rfsim-pane__claim-verifier">{c.verifier}</span>
                <span className="rfsim-pane__claim-evidence">{c.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Impact dashboard */}
      <section className="rfsim-pane__section">
        <div className="rfsim-pane__section-head">
          <h2 className="rfsim-pane__section-title">Impact</h2>
          <span className="rfsim-pane__section-sub">deltas vs current tree</span>
        </div>
        <div className="rfsim-pane__impact">
          <BlastTile before={selected.impact.blastBefore} after={selected.impact.blastAfter} />
          <ConsumersTile n={selected.impact.consumersAffected} />
          <TestsTile
            stale={selected.impact.testsStale}
            stillCover={selected.impact.testsStillCover}
          />
          <CoverageTile gap={selected.impact.coverageGapLines} />
          <OwnershipTile shift={selected.impact.ownershipShift} />
          <OpTile op={selected.op} />
        </div>
      </section>

      {/* 5. Footer */}
      <div className="rfsim-pane__footer">{selected.description}</div>
    </div>
  );
}
