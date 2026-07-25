import "./knowledge-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getKnowledgeGraph,
  type KLayer,
  type KGraph,
  type KNode,
  type KEdge,
  type KInsightSeverity,
} from "@quanta/app-ide/entities/knowledge";

/* ── local helpers ─────────────────────────────────────────── */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LAYER_ORDER: readonly KLayer[] = ["code", "service", "people", "data"];
const LAYER_LABEL: Record<KLayer, string> = {
  code: "Code",
  service: "Service",
  people: "People",
  data: "Data",
};
const LAYER_RADIUS: Record<KLayer, number> = {
  code: 60,
  service: 100,
  people: 140,
  data: 180,
};

const SEVERITY_GLYPH: Record<KInsightSeverity, string> = {
  info: "i",
  warn: "!",
  danger: "•",
};

interface Point {
  x: number;
  y: number;
}

function placeNode(id: string, layer: KLayer): Point {
  const ang = ((hashStr(id) % 360) * Math.PI) / 180;
  const r = LAYER_RADIUS[layer];
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

function labelAnchor(p: Point): "start" | "end" | "middle" {
  if (Math.abs(p.x) < 8) return "middle";
  return p.x > 0 ? "start" : "end";
}

function labelOffset(p: Point): Point {
  const mag = Math.hypot(p.x, p.y) || 1;
  const pad = 9;
  return { x: p.x + (p.x / mag) * pad, y: p.y + (p.y / mag) * pad + 3 };
}

export function KnowledgePane({ file }: { file: FileFacts }) {
  const graph: KGraph | null = useMemo(() => getKnowledgeGraph(file.name), [file.name]);

  const [hiddenLayers, setHiddenLayers] = useState<ReadonlySet<KLayer>>(() => new Set<KLayer>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly string[]>([]);

  const currentFocusId = focusId ?? graph?.focusId ?? null;

  // Layer counts (from the full graph, pre-filter)
  const layerCounts = useMemo<Record<KLayer, number>>(() => {
    const counts: Record<KLayer, number> = { code: 0, service: 0, people: 0, data: 0 };
    if (!graph) return counts;
    for (const n of graph.nodes) counts[n.layer] += 1;
    return counts;
  }, [graph]);

  const nodeIndex = useMemo<Map<string, KNode>>(() => {
    const m = new Map<string, KNode>();
    if (graph) for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  const visibleNodes = useMemo<KNode[]>(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => !hiddenLayers.has(n.layer));
  }, [graph, hiddenLayers]);

  const visibleEdges = useMemo<KEdge[]>(() => {
    if (!graph) return [];
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    return graph.edges.filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to));
  }, [graph, visibleNodes]);

  const currentFocusNode: KNode | null = currentFocusId ? (nodeIndex.get(currentFocusId) ?? null) : null;

  if (!graph) {
    return (
      <div className="kgraph-pane">
        <div className="kgraph-pane__empty">
          No knowledge graph available for <strong>{file.name}</strong>.
        </div>
      </div>
    );
  }

  const toggleLayer = (layer: KLayer) => {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const recenter = (id: string) => {
    if (!nodeIndex.has(id) || id === currentFocusId) return;
    setHistory((prev) => {
      const base = currentFocusId ? [...prev, currentFocusId] : [...prev];
      // keep last 5
      return base.slice(-5);
    });
    setFocusId(id);
  };

  // Edges incident to the hovered node
  const isIncidentToHover = (e: KEdge): boolean => {
    if (!hoverId) return false;
    return e.from === hoverId || e.to === hoverId;
  };

  return (
    <div className="kgraph-pane">
      {/* ── Header: layer toggle chips ───────────────────────── */}
      <div className="kgraph-pane__head">
        {LAYER_ORDER.map((layer) => {
          const on = !hiddenLayers.has(layer);
          return (
            <button
              key={layer}
              type="button"
              className={`kgraph-pane__chip kgraph-pane__chip--${layer} ${on ? "is-on" : "is-off"}`}
              onClick={() => toggleLayer(layer)}
              aria-pressed={on}
            >
              <span className="kgraph-pane__chip-dot" />
              <span className="kgraph-pane__chip-label">{LAYER_LABEL[layer]}</span>
              <span className="kgraph-pane__chip-count">{layerCounts[layer]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Body: graph + insights ──────────────────────────── */}
      <div className="kgraph-pane__body">
        <div className="kgraph-pane__graph">
          <svg
            className="kgraph-pane__svg"
            viewBox="-200 -200 400 400"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Heterogeneous knowledge graph"
          >
            {/* Rings */}
            {LAYER_ORDER.map((layer) =>
              hiddenLayers.has(layer) ? null : (
                <circle
                  key={`ring-${layer}`}
                  className="kgraph-pane__ring"
                  cx={0}
                  cy={0}
                  r={LAYER_RADIUS[layer]}
                />
              ),
            )}

            {/* Edges */}
            <g>
              {visibleEdges.map((e, i) => {
                const a = placeNode(e.from, nodeIndex.get(e.from)!.layer);
                const b = placeNode(e.to, nodeIndex.get(e.to)!.layer);
                const hasHover = hoverId !== null;
                const incident = isIncidentToHover(e);
                const op = hasHover ? (incident ? 1 : 0.15) : 0.55;
                const w = 1 + e.weight * 2;
                return (
                  <path
                    key={`edge-${i}`}
                    className={`kgraph-pane__edge kgraph-pane__edge--${e.kind}`}
                    d={`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} Q 0 0 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`}
                    style={{ opacity: op, strokeWidth: w }}
                  />
                );
              })}
            </g>

            {/* Nodes (skip the center focus — it gets the pill) */}
            <g>
              {visibleNodes.map((n) => {
                if (n.id === currentFocusId) return null;
                const p = placeNode(n.id, n.layer);
                const hovered = hoverId === n.id;
                const dimmed = hoverId !== null && !hovered;
                const op = dimmed ? 0.35 : 0.95;
                const r = hovered ? 7 : 6;
                const lp = labelOffset(p);
                const anchor = labelAnchor(p);
                return (
                  <g key={n.id}>
                    {/* visible circle */}
                    <circle
                      className={`kgraph-pane__node kgraph-pane__node--${n.layer}`}
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      style={{ opacity: op }}
                    />
                    {/* larger invisible hit target */}
                    <circle
                      className="kgraph-pane__node-hit"
                      cx={p.x}
                      cy={p.y}
                      r={12}
                      onMouseEnter={() => setHoverId(n.id)}
                      onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                      onClick={() => recenter(n.id)}
                    >
                      <title>{`${n.label} · ${LAYER_LABEL[n.layer]}${n.sublabel ? ` · ${n.sublabel}` : ""}`}</title>
                    </circle>
                    <text
                      className={`kgraph-pane__node-label ${hovered ? "is-hovered" : ""}`}
                      x={lp.x}
                      y={lp.y}
                      textAnchor={anchor}
                      style={{ opacity: dimmed ? 0.4 : 1 }}
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Center focus pill */}
            {currentFocusNode && (
              <g
                className="kgraph-pane__focus"
                style={{ color: `var(--kg-${currentFocusNode.layer})` }}
              >
                <rect
                  className="kgraph-pane__focus-pill"
                  x={-58}
                  y={-14}
                  width={116}
                  height={28}
                  rx={14}
                  ry={14}
                />
                <circle className="kgraph-pane__focus-dot" cx={-46} cy={0} r={4} />
                <text
                  className="kgraph-pane__focus-label"
                  x={-38}
                  y={-1}
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  {currentFocusNode.label.length > 18
                    ? `${currentFocusNode.label.slice(0, 17)}…`
                    : currentFocusNode.label}
                </text>
                <text
                  className="kgraph-pane__focus-sub"
                  x={-38}
                  y={9}
                  textAnchor="start"
                  dominantBaseline="middle"
                >
                  {currentFocusNode.sublabel ?? LAYER_LABEL[currentFocusNode.layer]}
                </text>
              </g>
            )}
          </svg>

          {/* Breadcrumb strip */}
          <div className="kgraph-pane__crumbs" aria-label="Focus history">
            <span className="kgraph-pane__crumbs-label">Focus</span>
            {history.map((id, i) => {
              const node = nodeIndex.get(id);
              if (!node) return null;
              return (
                <span key={`${id}-${i}`} style={{ display: "contents" }}>
                  <button
                    type="button"
                    className="kgraph-pane__crumb"
                    onClick={() => recenter(id)}
                  >
                    <span
                      className="kgraph-pane__crumb-dot"
                      style={{ background: `var(--kg-${node.layer})` }}
                    />
                    {node.label}
                  </button>
                  <span className="kgraph-pane__crumb-sep">→</span>
                </span>
              );
            })}
            {currentFocusNode && (
              <button
                type="button"
                className="kgraph-pane__crumb is-current"
                onClick={() => undefined}
                style={{ color: `var(--kg-${currentFocusNode.layer})` }}
              >
                <span
                  className="kgraph-pane__crumb-dot"
                  style={{ background: `var(--kg-${currentFocusNode.layer})` }}
                />
                {currentFocusNode.label}
              </button>
            )}
          </div>
        </div>

        {/* Insights panel */}
        <aside className="kgraph-pane__insights" aria-label="Why this matters">
          <div className="kgraph-pane__insights-title">Why this matters</div>
          {graph.insights.map((ins, i) => (
            <div
              key={i}
              className={`kgraph-pane__insight kgraph-pane__insight--${ins.severity}`}
            >
              <div className="kgraph-pane__insight-glyph" aria-hidden="true">
                {SEVERITY_GLYPH[ins.severity]}
              </div>
              <div className="kgraph-pane__insight-title">{ins.title}</div>
              <div className="kgraph-pane__insight-detail">{ins.detail}</div>
            </div>
          ))}
        </aside>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="kgraph-pane__foot">
        <span>Heterogeneous knowledge graph</span>
        <span className="kgraph-pane__foot-sep">·</span>
        <span>4 layers</span>
        <span className="kgraph-pane__foot-sep">·</span>
        <span>{visibleEdges.length} edges</span>
        <span className="kgraph-pane__foot-sep">·</span>
        <span>
          focus:{" "}
          <span className="kgraph-pane__foot-focus">
            {currentFocusNode?.label ?? "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
