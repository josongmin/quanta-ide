import type { SecurityFlowPath, SecurityFlowNode, SecurityFlowEdge } from "@quanta/app-ide/entities/security-flow";

// ── Constants ───────────────────────────────────────────────────────

export const NODE_W   = 200;
export const NODE_H   = 64;
export const GAP_H    = 48;
export const COL_GAP  = 100;
export const ROW_GAP  = 24;
export const PAD      = 56;

// ── Layout types ────────────────────────────────────────────────────

export interface LayoutNode {
  node: SecurityFlowNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

export interface LayoutEdge {
  edge: SecurityFlowEdge;
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

// ── Layout algorithm ────────────────────────────────────────────────

function nodeH(kind: SecurityFlowNode["kind"]): number {
  return kind === "gap" ? GAP_H : NODE_H;
}

/**
 * Horizontal column-based DAG layout.
 * Source(s) are placed at depth 0 (left), sink(s) at max depth (right).
 */
export function layoutPath(path: SecurityFlowPath): FlowLayout {
  if (path.nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const nodeMap = new Map(path.nodes.map((n) => [n.id, n]));

  // ── BFS depth assignment ────────────────────────────────────────
  const incoming = new Set(path.edges.map((e) => e.to));
  const depths   = new Map<string, number>();
  const queue: [string, number][] = [];

  // Roots = nodes with no incoming edges
  for (const n of path.nodes) {
    if (!incoming.has(n.id)) queue.push([n.id, 0]);
  }

  while (queue.length > 0) {
    const [id, d] = queue.shift()!;
    if (depths.has(id)) continue;
    depths.set(id, d);
    for (const e of path.edges) {
      if (e.from === id && !depths.has(e.to)) {
        queue.push([e.to, d + 1]);
      }
    }
  }

  // Fallback for disconnected nodes
  for (const n of path.nodes) {
    if (!depths.has(n.id)) depths.set(n.id, 0);
  }

  // ── Group by depth ──────────────────────────────────────────────
  const byDepth = new Map<number, string[]>();
  for (const [id, d] of depths) {
    const list = byDepth.get(d) ?? [];
    list.push(id);
    byDepth.set(d, list);
  }

  const maxDepth = Math.max(...depths.values());

  // ── Position nodes ──────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  let maxY = 0;

  for (const [depth, nodeIds] of byDepth) {
    const x = PAD + depth * (NODE_W + COL_GAP);

    // Compute total column height for vertical centering
    const colH = nodeIds.reduce((sum, nid) => {
      const node = nodeMap.get(nid);
      return sum + (node ? nodeH(node.kind) : NODE_H) + ROW_GAP;
    }, -ROW_GAP);

    let y = PAD + Math.max(0, (200 - colH) / 2); // soft vertical center

    for (const nid of nodeIds) {
      const node = nodeMap.get(nid);
      if (!node) continue;
      const h = nodeH(node.kind);
      positions.set(nid, { x, y, w: NODE_W, h });
      y += h + ROW_GAP;
    }

    maxY = Math.max(maxY, y);
  }

  const totalW = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * COL_GAP;
  const totalH = Math.max(maxY + PAD, 300);

  // ── Build layout nodes ──────────────────────────────────────────
  const layoutNodes: LayoutNode[] = path.nodes.map((node) => {
    const pos = positions.get(node.id) ?? { x: PAD, y: PAD, w: NODE_W, h: NODE_H };
    return { node, ...pos, depth: depths.get(node.id) ?? 0 };
  });

  // ── Build layout edges ──────────────────────────────────────────
  const posMap = new Map(layoutNodes.map((ln) => [ln.node.id, ln]));

  const layoutEdges: LayoutEdge[] = path.edges.map((edge) => {
    const fromLn = posMap.get(edge.from);
    const toLn   = posMap.get(edge.to);

    if (!fromLn || !toLn) {
      return { edge, path: "", startX: 0, startY: 0, endX: 0, endY: 0 };
    }

    const sx = fromLn.x + fromLn.w;
    const sy = fromLn.y + fromLn.h / 2;
    const ex = toLn.x;
    const ey = toLn.y + toLn.h / 2;

    const dx = Math.abs(ex - sx);
    const cp = Math.max(dx * 0.45, 50);

    const d = `M ${sx} ${sy} C ${sx + cp} ${sy}, ${ex - cp} ${ey}, ${ex} ${ey}`;

    return { edge, path: d, startX: sx, startY: sy, endX: ex, endY: ey };
  });

  return { nodes: layoutNodes, edges: layoutEdges, width: totalW, height: totalH };
}
