import type { CanvasGraph, CanvasSelection, FlowFilter, FlowSegment } from "@quanta/app-ide/entities/canvas";

// ── Selection computation ──────────────────────────────────────────

/**
 * Compute selection state from a node click:
 * find all edges connected to the node + their code lines.
 */
export function selectNode(graph: CanvasGraph, nodeId: string): CanvasSelection {
  const flowPath: string[] = [];
  const activeLines = new Set<number>();

  for (const edge of graph.edges) {
    if (edge.extNodeId === nodeId) {
      flowPath.push(edge.id);
      activeLines.add(edge.line);
    }
  }

  return {
    nodeId,
    flowPath,
    flowNodes: [nodeId],
    activeLines: [...activeLines],
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
