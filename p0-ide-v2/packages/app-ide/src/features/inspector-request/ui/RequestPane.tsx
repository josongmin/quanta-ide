import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import { getRequestFlow, type RequestFlow, type RequestNode, type RequestStage } from "@quanta/app-ide/entities/request-flow";
import { focusStore } from "@quanta/app-ide/stores/focus-store";
import { EmptyPane } from "@quanta/ui-kit/ui/empty-pane";

const STAGE_ORDER: RequestStage[] = ["entry", "controller", "service", "repo", "external", "sink"];
const STAGE_LABEL: Record<RequestStage, string> = {
  entry: "Entry",
  controller: "Controller",
  service: "Service",
  repo: "Repo",
  external: "External",
  sink: "Sink",
};

// ColorBrewer YlOrRd-5 (perceptually uniform sequential, color-blind safe)
function latencyColor(observed: number, budget: number): string {
  const ratio = observed / budget;
  if (ratio < 0.4) return "var(--success)";
  if (ratio < 0.7) return "var(--warn)";
  if (ratio < 1.0) return "var(--accent)";
  return "var(--danger)";
}

function errorRateColor(rate: number): string {
  if (rate < 0.001) return "var(--success)";
  if (rate < 0.01) return "var(--warn)";
  return "var(--danger)";
}

interface Props {
  file: FileFacts;
}

export function RequestPane({ file }: Props) {
  const flows = useMemo(() => getRequestFlow(file.name), [file.name]);
  const [activeId, setActiveId] = useState(flows[0]?.id);
  const active = flows.find((f) => f.id === activeId) ?? flows[0];
  const [hoverNode, setHoverNode] = useState<string | null>(null);

  if (!active) return <EmptyPane label="No request flows traced for this file" />;

  return (
    <div className="req-pane">
      <div className="req-pane__tabs" role="tablist">
        {flows.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={f.id === active.id}
            className={`req-pane__tab${f.id === active.id ? " is-active" : ""}`}
            onClick={() => setActiveId(f.id)}
          >
            <span className="req-pane__tab-method">{f.entrypoint.split(" ")[0]}</span>
            <span className="req-pane__tab-label">{f.label}</span>
          </button>
        ))}
      </div>

      <header className="req-head">
        <div className="req-head__title-row">
          <h2 className="req-head__title">{active.label}</h2>
          <code className="req-head__entry">{active.entrypoint}</code>
        </div>
        <div className="req-head__budget">
          <BudgetBar observed={active.observedP99Ms} budget={active.budgetMs} />
          <div className="req-head__budget-meta">
            <span><strong>{active.observedP99Ms}</strong>ms observed p99</span>
            <span className="req-head__sep">·</span>
            <span>budget <strong>{active.budgetMs}</strong>ms</span>
            <span className="req-head__sep">·</span>
            <span className={active.observedP99Ms > active.budgetMs ? "req-head__over" : "req-head__under"}>
              {Math.round((active.observedP99Ms / active.budgetMs) * 100)}%
            </span>
          </div>
        </div>
      </header>

      <FlowGraph flow={active} hoverId={hoverNode} onHover={setHoverNode} />

      <section className="req-block">
        <div className="req-block__h">
          <h3 className="req-block__title">Hops</h3>
          <p className="req-block__desc">
            Each hop's self-time, error rate, ownership · click to jump.
          </p>
        </div>
        <ol className="req-hops">
          {active.nodes.map((n) => (
            <HopRow
              key={n.id}
              node={n}
              budget={active.budgetMs}
              isHover={hoverNode === n.id}
              onHover={setHoverNode}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

function BudgetBar({ observed, budget }: { observed: number; budget: number }) {
  const pct = Math.min(100, (observed / budget) * 100);
  const over = observed > budget;
  return (
    <div className="req-budget" aria-label="latency budget">
      <div className="req-budget__track">
        <div
          className={`req-budget__fill${over ? " is-over" : ""}`}
          style={{ width: `${pct}%`, background: latencyColor(observed, budget) }}
        />
        <div className="req-budget__marker" style={{ left: "100%" }} />
      </div>
    </div>
  );
}

function FlowGraph({
  flow,
  hoverId,
  onHover,
}: {
  flow: RequestFlow;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  const layout = useMemo(() => layoutNodes(flow), [flow]);
  const w = layout.width;
  const h = layout.height;

  return (
    <div className="req-graph-wrap">
      <svg className="req-graph" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="request flow graph">
        <defs>
          <marker id="req-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--fg-subtle)" />
          </marker>
          <marker id="req-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {/* stage backbone */}
        {STAGE_ORDER.map((stage) => {
          const x = layout.stageX[stage];
          if (x === undefined) return null;
          return (
            <g key={stage} className="req-graph__stage-col">
              <text x={x} y={14} textAnchor="middle" className="req-graph__stage-label">
                {STAGE_LABEL[stage]}
              </text>
              <line x1={x} y1={20} x2={x} y2={h - 8} className="req-graph__stage-axis" />
            </g>
          );
        })}
        {/* edges */}
        {flow.edges.map((e, i) => {
          const a = layout.pos[e.from];
          const b = layout.pos[e.to];
          if (!a || !b) return null;
          const isHot = hoverId === e.from || hoverId === e.to;
          const dx = (b.x - a.x) * 0.5;
          const path = `M ${a.x + 9} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x - 9} ${b.y}`;
          const strokeW = 1 + e.share * 5;
          return (
            <path
              key={i}
              d={path}
              className={`req-graph__edge${e.conditional ? " is-conditional" : ""}${isHot ? " is-hot" : ""}`}
              strokeWidth={strokeW}
              markerEnd={isHot ? "url(#req-arrow-active)" : "url(#req-arrow)"}
            />
          );
        })}
        {/* nodes */}
        {flow.nodes.map((n) => {
          const p = layout.pos[n.id];
          if (!p) return null;
          const errCol = errorRateColor(n.errorRate);
          const isHot = hoverId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              className={`req-graph__node${isHot ? " is-hot" : ""}`}
              onMouseEnter={() => onHover(n.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => n.line && focusStore.jumpTo(n.line)}
            >
              <circle r={9} className="req-graph__node-bg" />
              <circle r={5} fill={errCol} />
              <text x={12} y={4} className="req-graph__node-label">
                {n.label}
              </text>
              <text x={12} y={16} className="req-graph__node-meta">
                p99 {n.p99Ms}ms · {(n.errorRate * 100).toFixed(2)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function layoutNodes(flow: RequestFlow) {
  const stages = Array.from(new Set(flow.nodes.map((n) => n.stage))).sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b),
  );
  const colW = 140;
  const left = 24;
  const top = 32;
  const rowH = 56;
  const stageX: Partial<Record<RequestStage, number>> = {};
  stages.forEach((s, i) => (stageX[s] = left + i * colW));
  const byStage = new Map<RequestStage, typeof flow.nodes>();
  for (const n of flow.nodes) {
    if (!byStage.has(n.stage)) byStage.set(n.stage, []);
    byStage.get(n.stage)!.push(n);
  }
  const pos: Record<string, { x: number; y: number }> = {};
  let maxRows = 1;
  byStage.forEach((arr, stage) => {
    const x = stageX[stage]!;
    arr.forEach((n, i) => {
      pos[n.id] = { x, y: top + i * rowH };
    });
    maxRows = Math.max(maxRows, arr.length);
  });
  const width = left + (stages.length - 1) * colW + 200;
  const height = top + maxRows * rowH;
  return { width, height, stageX, pos };
}

function HopRow({
  node,
  budget,
  isHover,
  onHover,
}: {
  node: RequestNode;
  budget: number;
  isHover: boolean;
  onHover: (id: string | null) => void;
}) {
  const errCol = errorRateColor(node.errorRate);
  const latPct = Math.min(100, (node.p99Ms / budget) * 100);
  return (
    <li
      className={`req-hop${isHover ? " is-hot" : ""}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => node.line && focusStore.jumpTo(node.line)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && node.line && focusStore.jumpTo(node.line)}
    >
      <span className={`req-hop__stage req-hop__stage--${node.stage}`}>{STAGE_LABEL[node.stage]}</span>
      <div className="req-hop__main">
        <div className="req-hop__head">
          <span className="req-hop__label">{node.label}</span>
          {node.tag && <span className={`req-hop__tag req-hop__tag--${node.tag}`}>{node.tag}</span>}
        </div>
        {node.file && (
          <div className="req-hop__file">
            {node.file}
            {node.line ? `:${node.line}` : ""}
          </div>
        )}
        <div className="req-hop__bar">
          <div className="req-hop__bar-fill" style={{ width: `${latPct}%`, background: latencyColor(node.p99Ms, budget) }} />
        </div>
      </div>
      <div className="req-hop__metrics">
        <div className="req-hop__metric">
          <div className="req-hop__metric-v">{node.p99Ms}<span>ms</span></div>
          <div className="req-hop__metric-k">p99</div>
        </div>
        <div className="req-hop__metric">
          <div className="req-hop__metric-v" style={{ color: errCol }}>
            {(node.errorRate * 100).toFixed(2)}<span>%</span>
          </div>
          <div className="req-hop__metric-k">errors</div>
        </div>
        <div className="req-hop__metric">
          <div className="req-hop__metric-v">{node.rps}<span>/s</span></div>
          <div className="req-hop__metric-k">rps</div>
        </div>
      </div>
      <span className="req-hop__owner">{node.owner}</span>
    </li>
  );
}
