import "./service-mesh-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getServiceMesh,
  type Protocol,
  type ServiceEdge,
  type ServiceMesh,
  type ServiceNode,
  type FailureDomainSeverity,
} from "@quanta/app-ide/entities/service-mesh";

const VIEWBOX = { x: -220, y: -160, w: 440, h: 320 } as const;
const RING_INNER = 80;
const RING_OUTER = 140;

type LatencyTier = "ok" | "neutral" | "warn" | "danger";

function latencyTier(p95: number): LatencyTier {
  if (p95 < 50) return "ok";
  if (p95 < 200) return "neutral";
  if (p95 < 500) return "warn";
  return "danger";
}

type SloRing = "ok" | "warn" | "danger";

function sloRing(errorRate: number): SloRing {
  if (errorRate < 0.005) return "ok";
  if (errorRate < 0.02) return "warn";
  return "danger";
}

const PROTOCOL_DASH: Record<Protocol, string | undefined> = {
  http: undefined,
  grpc: "4 3",
  event: "1 3",
  db: "8 2",
};

const PROTOCOL_LABEL: Record<Protocol, string> = {
  http: "HTTP",
  grpc: "gRPC",
  event: "event",
  db: "DB",
};

/** Stable string hash → [0,1) for deterministic angles. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
  ring: 0 | 1 | 2;
}

/** BFS from focus → ring 0/1/2; deterministic hashed angle inside each ring. */
function layoutNodes(mesh: ServiceMesh): Map<string, NodePos> {
  const adj = new Map<string, Set<string>>();
  for (const n of mesh.nodes) adj.set(n.id, new Set());
  for (const e of mesh.edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const ring = new Map<string, 0 | 1 | 2>();
  ring.set(mesh.focusId, 0);
  const queue: string[] = [mesh.focusId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const r = ring.get(id) as 0 | 1 | 2;
    if (r === 2) continue;
    for (const next of adj.get(id) ?? []) {
      if (!ring.has(next)) {
        ring.set(next, (r + 1) as 1 | 2);
        if (r + 1 < 2) queue.push(next);
      }
    }
  }
  for (const n of mesh.nodes) if (!ring.has(n.id)) ring.set(n.id, 2);

  const inner: string[] = [];
  const outer: string[] = [];
  for (const n of mesh.nodes) {
    const r = ring.get(n.id);
    if (r === 1) inner.push(n.id);
    else if (r === 2) outer.push(n.id);
  }
  // sort by hash for stable, even-ish distribution while remaining deterministic
  inner.sort((a, b) => hash01(a) - hash01(b));
  outer.sort((a, b) => hash01(a) - hash01(b));

  const positions = new Map<string, NodePos>();
  positions.set(mesh.focusId, { id: mesh.focusId, x: 0, y: 0, ring: 0 });

  const place = (ids: string[], radius: number, ringIdx: 1 | 2) => {
    if (ids.length === 0) return;
    const offset = ringIdx === 1 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / Math.max(ids.length, 4);
    for (let i = 0; i < ids.length; i++) {
      const baseAngle = offset + (i / ids.length) * Math.PI * 2;
      const jitter = (hash01(ids[i] + ":j") - 0.5) * 0.18;
      const angle = baseAngle + jitter;
      positions.set(ids[i], {
        id: ids[i],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        ring: ringIdx,
      });
    }
  };
  place(inner, RING_INNER, 1);
  place(outer, RING_OUTER, 2);
  return positions;
}

function nodeRadius(n: ServiceNode): number {
  return Math.log2(n.rpsIn + 2) * 1.4 + 8;
}

function edgeWidth(rps: number): number {
  return Math.max(0.6, Math.log2(rps + 2) * 0.45);
}

function edgePathD(from: NodePos, to: NodePos): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular curvature: small bow so parallel edges separate
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(40, len * 0.18);
  const cx = mx + nx * bow;
  const cy = my + ny * bow;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

function edgeKey(e: ServiceEdge): string {
  return `${e.from}->${e.to}`;
}

function isEdgeOnCriticalPath(e: ServiceEdge, path: string[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i] === e.from && path[i + 1] === e.to) return true;
  }
  return false;
}

function cumulativeP95(mesh: ServiceMesh): number {
  let total = 0;
  for (let i = 0; i < mesh.criticalPath.length - 1; i++) {
    const a = mesh.criticalPath[i];
    const b = mesh.criticalPath[i + 1];
    const e = mesh.edges.find((x) => x.from === a && x.to === b);
    if (e) total += e.p95Ms;
  }
  return total;
}

interface DomainBox {
  id: string;
  label: string;
  severity: FailureDomainSeverity;
  x: number;
  y: number;
  w: number;
  h: number;
}

function failureDomainBoxes(mesh: ServiceMesh, positions: Map<string, NodePos>): DomainBox[] {
  const out: DomainBox[] = [];
  for (const fd of mesh.failureDomains) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let count = 0;
    for (const id of fd.nodeIds) {
      const p = positions.get(id);
      if (!p) continue;
      const node = mesh.nodes.find((n) => n.id === id);
      const r = node ? nodeRadius(node) : 12;
      if (p.x - r < minX) minX = p.x - r;
      if (p.y - r < minY) minY = p.y - r;
      if (p.x + r > maxX) maxX = p.x + r;
      if (p.y + r > maxY) maxY = p.y + r;
      count++;
    }
    if (count === 0) continue;
    const pad = 14;
    out.push({
      id: fd.id,
      label: fd.label,
      severity: fd.severity,
      x: minX - pad,
      y: minY - pad,
      w: maxX - minX + pad * 2,
      h: maxY - minY + pad * 2,
    });
  }
  return out;
}

export function ServiceMeshPane({ file }: { file: FileFacts }) {
  const mesh = useMemo(() => getServiceMesh(file.name), [file.name]);
  const [showDomains, setShowDomains] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [hoverEdgeKey, setHoverEdgeKey] = useState<string | null>(null);
  const [pinnedEdgeKey, setPinnedEdgeKey] = useState<string | null>(null);

  const positions = useMemo(() => (mesh ? layoutNodes(mesh) : new Map<string, NodePos>()), [mesh]);
  const domainBoxes = useMemo(() => (mesh ? failureDomainBoxes(mesh, positions) : []), [mesh, positions]);
  const critP95 = useMemo(() => (mesh ? cumulativeP95(mesh) : 0), [mesh]);
  const criticalSet = useMemo(() => {
    const s = new Set<string>();
    if (!mesh) return s;
    for (const e of mesh.edges) if (isEdgeOnCriticalPath(e, mesh.criticalPath)) s.add(edgeKey(e));
    return s;
  }, [mesh]);

  const visibleEdges = useMemo(() => {
    if (!mesh) return [];
    return mesh.edges.filter((e) => {
      if (criticalOnly && !criticalSet.has(edgeKey(e))) return false;
      if (errorsOnly && e.errorRate < 0.005) return false;
      return true;
    });
  }, [mesh, criticalOnly, criticalSet, errorsOnly]);

  if (!mesh) {
    return (
      <div className="mesh-pane mesh-pane--empty">
        <p className="mesh-pane__empty">No service-mesh telemetry rolled up for {file.name}.</p>
      </div>
    );
  }

  const degraded = mesh.nodes.filter((n) => n.errorRate >= 0.02).length;
  const activeKey = pinnedEdgeKey ?? hoverEdgeKey;
  const activeEdge = activeKey ? mesh.edges.find((e) => edgeKey(e) === activeKey) ?? null : null;

  return (
    <div className="mesh-pane">
      <div className="mesh-pane__head">
        <div className="mesh-pane__stat">
          <div className="mesh-pane__stat-v">
            {mesh.nodes.length}
            <span className="mesh-pane__stat-sep">·</span>
            {mesh.edges.length}
          </div>
          <div className="mesh-pane__stat-k">services · edges</div>
        </div>
        <div className="mesh-pane__stat">
          <div className={`mesh-pane__stat-v mesh-pane__stat-v--${latencyTier(critP95)}`}>
            {critP95.toFixed(0)}
            <span className="mesh-pane__stat-unit">ms</span>
          </div>
          <div className="mesh-pane__stat-k">critical-path p95</div>
        </div>
        <div className="mesh-pane__stat">
          <div className={`mesh-pane__stat-v ${degraded > 0 ? "mesh-pane__stat-v--bad" : ""}`}>{degraded}</div>
          <div className="mesh-pane__stat-k">degraded SLO</div>
        </div>
      </div>

      <div className="mesh-pane__toggles" role="group" aria-label="Mesh view toggles">
        <button
          type="button"
          className={`mesh-pane__chip${showDomains ? " is-on" : ""}`}
          aria-pressed={showDomains}
          onClick={() => setShowDomains((v) => !v)}
        >
          Failure-domain overlay
        </button>
        <button
          type="button"
          className={`mesh-pane__chip${criticalOnly ? " is-on" : ""}`}
          aria-pressed={criticalOnly}
          onClick={() => setCriticalOnly((v) => !v)}
        >
          Critical path only
        </button>
        <button
          type="button"
          className={`mesh-pane__chip${errorsOnly ? " is-on" : ""}`}
          aria-pressed={errorsOnly}
          onClick={() => setErrorsOnly((v) => !v)}
        >
          Show errors only
        </button>
      </div>

      <div className="mesh-pane__graph">
        <svg
          className="mesh-pane__svg"
          viewBox={`${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.w} ${VIEWBOX.h}`}
          role="img"
          aria-label="Service-mesh topology"
        >
          <defs>
            <marker id="mesh-arrow-ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--mesh-ok)" />
            </marker>
            <marker id="mesh-arrow-neutral" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--mesh-neutral)" />
            </marker>
            <marker id="mesh-arrow-warn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--mesh-warn)" />
            </marker>
            <marker id="mesh-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--mesh-danger)" />
            </marker>
            <filter id="mesh-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {showDomains &&
            domainBoxes.map((b) => (
              <g key={b.id} className={`mesh-pane__domain mesh-pane__domain--${b.severity}`}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} ry={14} />
                <text x={b.x + 8} y={b.y + 12} className="mesh-pane__domain-label">
                  {b.label}
                </text>
              </g>
            ))}

          {/* Edges first so node circles render above */}
          <g className="mesh-pane__edges">
            {visibleEdges.map((e) => {
              const from = positions.get(e.from);
              const to = positions.get(e.to);
              if (!from || !to) return null;
              const tier = latencyTier(e.p95Ms);
              const isCrit = criticalSet.has(edgeKey(e));
              const k = edgeKey(e);
              const isActive = activeKey === k;
              const dash = PROTOCOL_DASH[e.protocol];
              return (
                <g
                  key={k}
                  className={`mesh-pane__edge mesh-pane__edge--${tier}${isCrit ? " is-critical" : ""}${isActive ? " is-active" : ""}`}
                  onMouseEnter={() => setHoverEdgeKey(k)}
                  onMouseLeave={() => setHoverEdgeKey((cur) => (cur === k ? null : cur))}
                  onClick={() => setPinnedEdgeKey((cur) => (cur === k ? null : k))}
                >
                  {isCrit && (
                    <path
                      d={edgePathD(from, to)}
                      className="mesh-pane__edge-glow"
                      strokeWidth={edgeWidth(e.rps) + 3}
                      filter="url(#mesh-glow)"
                    />
                  )}
                  <path
                    d={edgePathD(from, to)}
                    className="mesh-pane__edge-line"
                    strokeWidth={edgeWidth(e.rps)}
                    strokeDasharray={dash}
                    markerEnd={`url(#mesh-arrow-${tier})`}
                  />
                  <path d={edgePathD(from, to)} className="mesh-pane__edge-hit" strokeWidth={10} />
                </g>
              );
            })}
          </g>

          <g className="mesh-pane__nodes">
            {mesh.nodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const r = nodeRadius(n);
              const ring = sloRing(n.errorRate);
              return (
                <g
                  key={n.id}
                  className={`mesh-pane__node mesh-pane__node--${n.kind} mesh-pane__node--${ring}${n.isFocus ? " is-focus" : ""}`}
                  transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
                >
                  <circle className="mesh-pane__node-bg" r={r} />
                  <circle className="mesh-pane__node-ring" r={r} />
                  {n.isFocus && <circle className="mesh-pane__node-focus" r={r + 4} />}
                  <text className="mesh-pane__node-label" y={-r - 4}>
                    {n.label}
                  </text>
                  <text className="mesh-pane__node-rps" y={r + 10}>
                    {n.rpsIn >= 1000 ? `${(n.rpsIn / 1000).toFixed(1)}k` : n.rpsIn} rps
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="mesh-pane__legend" aria-hidden="true">
          <div className="mesh-pane__legend-row">
            <span className="mesh-pane__legend-swatch mesh-pane__legend-swatch--ok" />
            <span>p95&lt;50</span>
            <span className="mesh-pane__legend-swatch mesh-pane__legend-swatch--neutral" />
            <span>&lt;200</span>
            <span className="mesh-pane__legend-swatch mesh-pane__legend-swatch--warn" />
            <span>&lt;500</span>
            <span className="mesh-pane__legend-swatch mesh-pane__legend-swatch--danger" />
            <span>≥500ms</span>
          </div>
          <div className="mesh-pane__legend-row">
            <span className="mesh-pane__legend-line mesh-pane__legend-line--http" />
            <span>HTTP</span>
            <span className="mesh-pane__legend-line mesh-pane__legend-line--grpc" />
            <span>gRPC</span>
            <span className="mesh-pane__legend-line mesh-pane__legend-line--event" />
            <span>event</span>
            <span className="mesh-pane__legend-line mesh-pane__legend-line--db" />
            <span>db</span>
          </div>
        </div>
      </div>

      <div className="mesh-pane__inspector">
        {activeEdge ? (
          <EdgeInspector edge={activeEdge} mesh={mesh} pinned={pinnedEdgeKey === edgeKey(activeEdge)} />
        ) : (
          <p className="mesh-pane__inspector-hint">Hover an edge to inspect latency and error rate. Click to pin.</p>
        )}
      </div>

      <div className="mesh-pane__domains">
        {mesh.failureDomains.map((fd) => (
          <span key={fd.id} className={`mesh-pane__domain-chip mesh-pane__domain-chip--${fd.severity}`}>
            <span className="mesh-pane__domain-dot" />
            {fd.label}
            <span className="mesh-pane__domain-count">{fd.nodeIds.length}</span>
          </span>
        ))}
      </div>

      <div className="mesh-pane__foot">
        Telemetry rolled-up · file: <code className="mesh-pane__foot-file">{file.name}</code>
      </div>
    </div>
  );
}

interface EdgeInspectorProps {
  edge: ServiceEdge;
  mesh: ServiceMesh;
  pinned: boolean;
}

function EdgeInspector({ edge, mesh, pinned }: EdgeInspectorProps) {
  const from = mesh.nodes.find((n) => n.id === edge.from);
  const to = mesh.nodes.find((n) => n.id === edge.to);
  const tier = latencyTier(edge.p95Ms);
  return (
    <div className={`mesh-pane__edge-card mesh-pane__edge-card--${tier}${pinned ? " is-pinned" : ""}`}>
      <div className="mesh-pane__edge-card-head">
        <span className="mesh-pane__edge-card-from">{from?.label ?? edge.from}</span>
        <span className="mesh-pane__edge-card-arrow">→</span>
        <span className="mesh-pane__edge-card-to">{to?.label ?? edge.to}</span>
        <span className={`mesh-pane__edge-card-proto mesh-pane__edge-card-proto--${edge.protocol}`}>
          {PROTOCOL_LABEL[edge.protocol]}
        </span>
        {pinned && <span className="mesh-pane__edge-card-pin">pinned</span>}
      </div>
      <div className="mesh-pane__edge-card-row">
        <Metric label="p50" value={`${edge.p50Ms}ms`} />
        <Metric label="p95" value={`${edge.p95Ms}ms`} tier={tier} />
        <Metric label="p99" value={`${edge.p99Ms}ms`} />
        <Metric label="rps" value={edge.rps >= 1000 ? `${(edge.rps / 1000).toFixed(1)}k` : `${edge.rps}`} />
        <Metric
          label="err"
          value={`${(edge.errorRate * 100).toFixed(2)}%`}
          tier={edge.errorRate >= 0.02 ? "danger" : edge.errorRate >= 0.005 ? "warn" : "ok"}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, tier }: { label: string; value: string; tier?: LatencyTier }) {
  return (
    <div className={`mesh-pane__metric${tier ? ` mesh-pane__metric--${tier}` : ""}`}>
      <span className="mesh-pane__metric-k">{label}</span>
      <span className="mesh-pane__metric-v">{value}</span>
    </div>
  );
}
