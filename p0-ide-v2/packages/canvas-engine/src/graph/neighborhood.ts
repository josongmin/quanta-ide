import type { WorkspaceGraph } from "./types";

export interface Neighborhood {
  center: string;
  hop: Map<string, number>;
  edges: Set<string>;
}

// BFS over fileEdges treated as undirected. Edge set is post-filtered from the
// reached node set (not collected during traversal) so edges whose other
// endpoint is beyond maxHops still appear as long as both endpoints ended up
// in the reached set via some other path within the hop budget.
export function computeNeighborhood(
  graph: Pick<WorkspaceGraph, "fileEdges">,
  centerId: string,
  maxHops: number,
): Neighborhood {
  const hop = new Map<string, number>();
  hop.set(centerId, 0);

  // Build an undirected adjacency on demand — cheap vs touching every edge
  // per BFS level, and fileEdges can be 10k+ at galaxy tier.
  const adj = new Map<string, string[]>();
  for (const e of graph.fileEdges) {
    let a = adj.get(e.from);
    if (!a) { a = []; adj.set(e.from, a); }
    a.push(e.to);
    let b = adj.get(e.to);
    if (!b) { b = []; adj.set(e.to, b); }
    b.push(e.from);
  }

  if (maxHops > 0) {
    let frontier: string[] = [centerId];
    for (let depth = 0; depth < maxHops; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        const neigh = adj.get(id);
        if (!neigh) continue;
        for (const n of neigh) {
          if (hop.has(n)) continue;
          hop.set(n, depth + 1);
          next.push(n);
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }
  }

  const edges = new Set<string>();
  for (const e of graph.fileEdges) {
    if (hop.has(e.from) && hop.has(e.to)) edges.add(e.id);
  }

  return { center: centerId, hop, edges };
}
