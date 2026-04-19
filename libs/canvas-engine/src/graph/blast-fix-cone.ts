import type { WorkspaceGraph, FileEdge } from "./types";

// Directed BFS cones. Blast follows edges forward (what a change breaks);
// Fix follows them backward (what gets stabilized by fixing the root).
// Kept directed — neighborhood.ts covers the undirected case elsewhere.

export interface ImpactConeRing {
  depth: number;
  fileIds: readonly string[];
  totalWeight: number;
}

export type ImpactDirection = "blast" | "fix";

export interface ImpactCone {
  rootFileId: string;
  direction: ImpactDirection;
  rings: readonly ImpactConeRing[];
  totalAffected: number;
}

const DEFAULT_MAX_DEPTH = 4;

interface AdjacencyEntry {
  target: string;
  weight: number;
}

function buildAdjacency(
  edges: readonly FileEdge[],
  direction: ImpactDirection,
): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();
  for (const e of edges) {
    const src = direction === "blast" ? e.from : e.to;
    const dst = direction === "blast" ? e.to : e.from;
    let list = adj.get(src);
    if (!list) {
      list = [];
      adj.set(src, list);
    }
    list.push({ target: dst, weight: e.weight });
  }
  return adj;
}

function bfsCone(
  edges: readonly FileEdge[],
  rootFileId: string,
  direction: ImpactDirection,
  maxDepth: number,
): ImpactCone {
  if (maxDepth <= 0) {
    return { rootFileId, direction, rings: [], totalAffected: 0 };
  }

  const adj = buildAdjacency(edges, direction);
  const visited = new Set<string>();
  visited.add(rootFileId);

  const rings: ImpactConeRing[] = [];
  let frontier: string[] = [rootFileId];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const nextSet = new Set<string>();
    let ringWeight = 0;
    for (const id of frontier) {
      const outs = adj.get(id);
      if (!outs) continue;
      for (const o of outs) {
        // Weight contribution counts every edge crossing the ring boundary,
        // even parallel edges, so callers can render line thickness fairly.
        if (visited.has(o.target)) continue;
        ringWeight += o.weight;
        nextSet.add(o.target);
      }
    }
    if (nextSet.size === 0) break;
    const ringIds = Array.from(nextSet).sort();
    for (const id of ringIds) visited.add(id);
    rings.push({ depth, fileIds: ringIds, totalWeight: ringWeight });
    frontier = ringIds;
  }

  const totalAffected = rings.reduce((acc, r) => acc + r.fileIds.length, 0);
  return { rootFileId, direction, rings, totalAffected };
}

export function computeBlastCone(
  graph: Pick<WorkspaceGraph, "fileEdges">,
  fileId: string,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): ImpactCone {
  return bfsCone(graph.fileEdges, fileId, "blast", maxDepth);
}

export function computeFixCone(
  graph: Pick<WorkspaceGraph, "fileEdges">,
  fileId: string,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): ImpactCone {
  return bfsCone(graph.fileEdges, fileId, "fix", maxDepth);
}
