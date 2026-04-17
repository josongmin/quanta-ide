import type { CanvasEdge, CanvasGraph, CanvasSelection, ExternalNode, FlowFilter, FlowSegment } from "@quanta/app-ide/entities/canvas";
import type { NextHopTarget } from "@quanta/app-ide/entities/file";

// ── Selection computation ──────────────────────────────────────────

/**
 * Compute selection state from a node click:
 * find all edges connected to the node + their code lines.
 */
export function selectNode(
  graph: CanvasGraph,
  nodeId: string,
  nextHops?: Record<string, NextHopTarget[]>,
): CanvasSelection {
  const flowPath: string[] = [];
  const activeLines = new Set<number>();

  for (const edge of graph.edges) {
    if (edge.extNodeId === nodeId) {
      flowPath.push(edge.id);
      activeLines.add(edge.line);
    }
  }

  // Determine which nodes in the flow are expandable
  const expandableNodeIds: string[] = [];
  if (nextHops) {
    for (const node of graph.externalNodes) {
      if (nextHops[node.id] && nextHops[node.id].length > 0) {
        expandableNodeIds.push(node.id);
      }
    }
  }

  return {
    nodeId,
    flowPath,
    flowNodes: [nodeId],
    activeLines: [...activeLines],
    expandableNodeIds: expandableNodeIds.length > 0 ? expandableNodeIds : undefined,
  };
}

/**
 * Expand the graph by adding next-hop nodes and edges for a given node.
 * Returns a new CanvasGraph with the expanded nodes/edges appended.
 */
export function expandFlow(
  graph: CanvasGraph,
  nodeId: string,
  targets: NextHopTarget[],
): CanvasGraph {
  const sourceNode = graph.externalNodes.find((n) => n.id === nodeId);
  if (!sourceNode || targets.length === 0) return graph;

  const newNodes: ExternalNode[] = [];
  const newEdges: CanvasEdge[] = [];

  // Find the source edge to inherit line/col for the new edge
  const sourceEdge = graph.edges.find((e) => e.extNodeId === nodeId);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const newNodeId = `ext:expanded:${target.name}`;

    // Skip if already expanded
    if (graph.externalNodes.some((n) => n.id === newNodeId)) continue;

    // Position: to the right of the source node
    const newNode: ExternalNode = {
      id: newNodeId,
      name: target.name,
      file: target.file,
      side: sourceNode.side,
      connectedTo: [],
      isTerminal: !!target.terminalKind,
      terminalKind: target.terminalKind,
      x: sourceNode.side === "left"
        ? sourceNode.x - sourceNode.w - 100
        : sourceNode.x + sourceNode.w + 100,
      y: sourceNode.y + i * 60,
      w: sourceNode.w,
      h: sourceNode.h,
    };
    newNodes.push(newNode);

    // Create edge from source node's line to new node
    const edgeId = `e-expand-${graph.edges.length + i}`;
    const newEdge: CanvasEdge = {
      id: edgeId,
      line: sourceEdge?.line ?? 1,
      col: sourceEdge?.col ?? 0,
      symbolLen: sourceEdge?.symbolLen ?? 0,
      side: "right",
      extNodeId: newNodeId,
      kind: "taint",
      label: `→ ${target.name}`,
      color: sourceEdge?.color ?? "#888",
      confidence: "high",
    };
    newEdges.push(newEdge);
  }

  if (newNodes.length === 0) return graph;

  // Compute new canvas bounds
  let maxRight = graph.width;
  let maxBottom = graph.height;
  for (const n of newNodes) {
    maxRight = Math.max(maxRight, n.x + n.w + 48);
    maxBottom = Math.max(maxBottom, n.y + n.h + 48);
  }

  return {
    ...graph,
    externalNodes: [...graph.externalNodes, ...newNodes],
    edges: [...graph.edges, ...newEdges],
    width: maxRight,
    height: maxBottom,
  };
}

/**
 * Compute selection state from a symbol click (line + col):
 * find matching edges -> connected nodes -> expand to all related edges.
 */
export function selectSymbol(
  graph: CanvasGraph,
  line: number,
  col: number,
): CanvasSelection | null {
  const directEdges = graph.edges.filter(
    (e) => e.line === line && col >= e.col && col < e.col + e.symbolLen,
  );
  if (directEdges.length === 0) return null;

  const flowNodes = new Set<string>();
  const flowPath: string[] = [];
  const activeLines = new Set<number>();

  // Direct connections
  for (const edge of directEdges) {
    flowNodes.add(edge.extNodeId);
    flowPath.push(edge.id);
    activeLines.add(edge.line);
  }

  // Expand: all edges connected to the same nodes (1-hop BFS)
  for (const edge of graph.edges) {
    if (flowNodes.has(edge.extNodeId) && !flowPath.includes(edge.id)) {
      flowPath.push(edge.id);
      activeLines.add(edge.line);
    }
  }

  return {
    flowPath,
    flowNodes: [...flowNodes],
    activeLines: [...activeLines],
  };
}

// ── Flow filtering ─────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Apply a FlowFilter to a graph, returning a copy with filtered edges. */
export function filterGraph(graph: CanvasGraph, filter: FlowFilter): CanvasGraph {
  const minRank = filter.minConfidence ? CONFIDENCE_RANK[filter.minConfidence] : 0;

  const edges = graph.edges.filter((e) => {
    if (filter.kinds && !filter.kinds.includes(e.kind)) return false;
    if (minRank > 0 && e.confidence) {
      if ((CONFIDENCE_RANK[e.confidence] ?? 0) < minRank) return false;
    }
    return true;
  });

  return { ...graph, edges };
}

// ── Flow segmentation ──────────────────────────────────────────────

/**
 * Auto-segment a graph when edge count exceeds threshold.
 * Splits by line-range chunks for navigable partitions.
 */
export function computeSegments(
  graph: CanvasGraph,
  maxEdgesPerSegment = 10,
): FlowSegment[] {
  if (graph.edges.length <= maxEdgesPerSegment) {
    return [{
      id: "seg-0",
      label: "All",
      edgeIds: graph.edges.map((e) => e.id),
      nodeIds: graph.externalNodes.map((n) => n.id),
    }];
  }

  const sorted = [...graph.edges].sort((a, b) => a.line - b.line);
  const segments: FlowSegment[] = [];
  let chunk: typeof sorted = [];

  for (const edge of sorted) {
    chunk.push(edge);
    if (chunk.length >= maxEdgesPerSegment) {
      segments.push(chunkToSegment(chunk, segments.length));
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    segments.push(chunkToSegment(chunk, segments.length));
  }

  return segments;
}

function chunkToSegment(chunk: { id: string; extNodeId: string; line: number }[], index: number): FlowSegment {
  const nodeIds = [...new Set(chunk.map((e) => e.extNodeId))];
  return {
    id: `seg-${index}`,
    label: `L${chunk[0].line}–${chunk[chunk.length - 1].line}`,
    edgeIds: chunk.map((e) => e.id),
    nodeIds,
  };
}
