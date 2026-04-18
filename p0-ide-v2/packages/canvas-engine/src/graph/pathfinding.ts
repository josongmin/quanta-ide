import type { EdgeLayer, FileEdge, WorkspaceGraph } from "./types";

// Path-based subgraph selection — powers "Bloom-style" (source, target)
// highlighting. Why BFS over Dijkstra: edge weights in this codebase are
// currently uniform (all `weight: 1` in fixtures), so hop count IS the cost;
// BFS gives optimal paths in O(V+E) without a priority queue.
//
// For k-shortest we opted for Yen's algorithm over Eppstein. Yen enforces
// *simple* (loop-free) paths, which is what the UI wants — a list of
// distinct routes. Eppstein returns non-simple paths with repeated nodes
// and is considerably harder to implement correctly. At our graph sizes
// (≤10k edges, k≤5) Yen's O(k·V·(V+E)) is a non-issue.

export interface PathQuery {
  sourceFileId: string;
  targetFileId: string;
  mode: "shortest" | "all-shortest" | "k-shortest";
  /** Only used when mode === "k-shortest". Default 3. */
  k?: number;
  /** Restrict traversal to edges in these layers. undefined = all layers. */
  layerFilter?: ReadonlySet<EdgeLayer>;
  /** Safety cap on BFS depth. Default 12. */
  maxDepth?: number;
  /** When true, only follow edges from → to. Default false (undirected). */
  directional?: boolean;
}

export interface Path {
  nodeIds: string[];
  edgeIds: string[];
  cost: number;
}

export interface PathResult {
  paths: Path[];
  /** True when BFS hit maxDepth before finding the target. */
  truncated: boolean;
}

interface AdjEntry {
  readonly neighbor: string;
  readonly edgeId: string;
  readonly weight: number;
}

const DEFAULT_MAX_DEPTH = 12;
const DEFAULT_K = 3;

function edgeWeight(e: FileEdge): number {
  // A `weight` of 0 is a valid analyzer output (e.g. inert edge) but collapses
  // Dijkstra into infinite-tie territory. Floor at 1 so cost still equals
  // hop count for unit-weight graphs.
  return e.weight > 0 ? e.weight : 1;
}

function buildAdjacency(
  edges: readonly FileEdge[],
  directional: boolean,
  layerFilter: ReadonlySet<EdgeLayer> | undefined,
  excludedEdgeIds: ReadonlySet<string> | null,
  excludedNodes: ReadonlySet<string> | null,
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();
  for (const e of edges) {
    if (layerFilter && !layerFilter.has(e.layer)) continue;
    if (excludedEdgeIds && excludedEdgeIds.has(e.id)) continue;
    if (excludedNodes && (excludedNodes.has(e.from) || excludedNodes.has(e.to))) continue;
    const w = edgeWeight(e);
    const fromList = adj.get(e.from);
    const entry: AdjEntry = { neighbor: e.to, edgeId: e.id, weight: w };
    if (fromList) fromList.push(entry);
    else adj.set(e.from, [entry]);
    if (!directional) {
      const rev: AdjEntry = { neighbor: e.from, edgeId: e.id, weight: w };
      const toList = adj.get(e.to);
      if (toList) toList.push(rev);
      else adj.set(e.to, [rev]);
    }
  }
  return adj;
}

interface BfsOutcome {
  /** parents[node] = list of (parent, edgeId) triples for each optimal predecessor. */
  parents: Map<string, { parent: string; edgeId: string }[]>;
  /** Hop distance from source. */
  dist: Map<string, number>;
  /** Whether target was reachable within maxDepth. */
  reached: boolean;
  /** Whether BFS hit the depth cap (implies a potential truncation). */
  truncated: boolean;
}

function bfs(
  adj: Map<string, AdjEntry[]>,
  source: string,
  target: string,
  maxDepth: number,
): BfsOutcome {
  const dist = new Map<string, number>();
  const parents = new Map<string, { parent: string; edgeId: string }[]>();
  dist.set(source, 0);

  let frontier: string[] = [source];
  let truncated = false;
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    const nextSet = new Set<string>();
    for (const u of frontier) {
      const neigh = adj.get(u);
      if (!neigh) continue;
      for (const { neighbor, edgeId } of neigh) {
        const nd = (dist.get(u) ?? 0) + 1;
        const known = dist.get(neighbor);
        if (known === undefined) {
          dist.set(neighbor, nd);
          parents.set(neighbor, [{ parent: u, edgeId }]);
          if (!nextSet.has(neighbor)) {
            nextSet.add(neighbor);
            next.push(neighbor);
          }
        } else if (known === nd) {
          // Additional shortest-path predecessor — required so all-shortest
          // enumeration can walk every optimal predecessor chain.
          parents.get(neighbor)?.push({ parent: u, edgeId });
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
    if (depth === maxDepth - 1 && !dist.has(target)) truncated = true;
  }

  return {
    parents,
    dist,
    reached: dist.has(target),
    truncated,
  };
}

function reconstructOne(
  parents: Map<string, { parent: string; edgeId: string }[]>,
  source: string,
  target: string,
): Path {
  const nodeIds: string[] = [target];
  const edgeIds: string[] = [];
  let cur = target;
  while (cur !== source) {
    const preds = parents.get(cur);
    if (!preds || preds.length === 0) break;
    const p = preds[0]!;
    edgeIds.push(p.edgeId);
    nodeIds.push(p.parent);
    cur = p.parent;
  }
  nodeIds.reverse();
  edgeIds.reverse();
  return { nodeIds, edgeIds, cost: edgeIds.length };
}

function enumerateAllShortest(
  parents: Map<string, { parent: string; edgeId: string }[]>,
  source: string,
  target: string,
): Path[] {
  const results: Path[] = [];
  const stackNodes: string[] = [target];
  const stackEdges: string[] = [];
  const walk = (node: string) => {
    if (node === source) {
      const nodeIds = [...stackNodes].reverse();
      const edgeIds = [...stackEdges].reverse();
      results.push({ nodeIds, edgeIds, cost: edgeIds.length });
      return;
    }
    const preds = parents.get(node);
    if (!preds) return;
    for (const { parent, edgeId } of preds) {
      stackNodes.push(parent);
      stackEdges.push(edgeId);
      walk(parent);
      stackNodes.pop();
      stackEdges.pop();
    }
  };
  walk(target);
  return results;
}

function pathCost(path: Path, edgeById: Map<string, FileEdge>): number {
  let c = 0;
  for (const eid of path.edgeIds) {
    const e = edgeById.get(eid);
    c += e ? edgeWeight(e) : 1;
  }
  return c;
}

// Yen's k-shortest simple paths. Operates by repeatedly finding a shortest
// path after temporarily removing edges/nodes that force a deviation from
// every previously-accepted path at each spur node.
function yenKShortest(
  edges: readonly FileEdge[],
  _source: string,
  target: string,
  k: number,
  q: PathQuery,
  firstPath: Path,
): Path[] {
  const accepted: Path[] = [firstPath];
  const candidates: Path[] = [];
  const maxDepth = q.maxDepth ?? DEFAULT_MAX_DEPTH;
  const edgeById = new Map<string, FileEdge>();
  for (const e of edges) edgeById.set(e.id, e);

  const pathKey = (p: Path) => p.edgeIds.join(">");
  const seen = new Set<string>([pathKey(firstPath)]);

  for (let idx = 1; idx < k; idx++) {
    const prev = accepted[idx - 1];
    if (!prev) break;
    for (let i = 0; i < prev.nodeIds.length - 1; i++) {
      const spur = prev.nodeIds[i]!;
      const rootNodes = prev.nodeIds.slice(0, i + 1);
      const rootEdges = prev.edgeIds.slice(0, i);
      const rootCost = rootEdges.reduce((acc, eid) => {
        const e = edgeById.get(eid);
        return acc + (e ? edgeWeight(e) : 1);
      }, 0);

      const excludedEdges = new Set<string>();
      for (const p of accepted) {
        // Remove the outgoing edge from spur along any accepted path that
        // shares the current root — that's what forces deviation.
        if (p.nodeIds.length <= i) continue;
        let shares = true;
        for (let j = 0; j <= i; j++) {
          if (p.nodeIds[j] !== rootNodes[j]) { shares = false; break; }
        }
        if (!shares) continue;
        const e = p.edgeIds[i];
        if (e) excludedEdges.add(e);
      }
      // Root nodes (except the spur itself) are removed so the spur path
      // stays loop-free.
      const excludedNodes = new Set<string>(rootNodes.slice(0, -1));

      const adj = buildAdjacency(
        edges,
        q.directional ?? false,
        q.layerFilter,
        excludedEdges,
        excludedNodes,
      );
      const remainingDepth = Math.max(0, maxDepth - i);
      const outcome = bfs(adj, spur, target, remainingDepth);
      if (!outcome.reached) continue;
      const spurPath = reconstructOne(outcome.parents, spur, target);
      const fullNodes = [...rootNodes.slice(0, -1), ...spurPath.nodeIds];
      const fullEdges = [...rootEdges, ...spurPath.edgeIds];
      const candidate: Path = {
        nodeIds: fullNodes,
        edgeIds: fullEdges,
        cost: rootCost + pathCost(spurPath, edgeById),
      };
      const key = pathKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }

    if (candidates.length === 0) break;
    candidates.sort((a, b) => a.cost - b.cost || a.edgeIds.length - b.edgeIds.length);
    const next = candidates.shift();
    if (!next) break;
    accepted.push(next);
  }

  return accepted;
}

export function findPaths(
  graph: Pick<WorkspaceGraph, "fileEdges">,
  q: PathQuery,
): PathResult {
  const maxDepth = q.maxDepth ?? DEFAULT_MAX_DEPTH;
  const k = q.k ?? DEFAULT_K;
  const edges = graph.fileEdges;

  if (q.sourceFileId === q.targetFileId) {
    return {
      paths: [{ nodeIds: [q.sourceFileId], edgeIds: [], cost: 0 }],
      truncated: false,
    };
  }

  const adj = buildAdjacency(edges, q.directional ?? false, q.layerFilter, null, null);
  const outcome = bfs(adj, q.sourceFileId, q.targetFileId, maxDepth);

  if (!outcome.reached) {
    return { paths: [], truncated: outcome.truncated };
  }

  if (q.mode === "shortest") {
    const p = reconstructOne(outcome.parents, q.sourceFileId, q.targetFileId);
    return { paths: [p], truncated: false };
  }

  if (q.mode === "all-shortest") {
    const ps = enumerateAllShortest(outcome.parents, q.sourceFileId, q.targetFileId);
    return { paths: ps, truncated: false };
  }

  // k-shortest: seed with the BFS shortest, then run Yen.
  const seed = reconstructOne(outcome.parents, q.sourceFileId, q.targetFileId);
  const paths = yenKShortest(edges, q.sourceFileId, q.targetFileId, Math.max(1, k), q, seed);
  return { paths, truncated: false };
}
