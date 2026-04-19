import type { EntityKind, EntityTree } from "../entity/types";
import type { FileEdge } from "../graph/types";

// Edge rollup
// --------------------------------------------------------------------
// Collapse file-level edges into tier-level edges by walking up the
// entity tree to the target `EntityKind`. Aggregated edges carry the
// sum of weights + the list of underlying file edge ids so an inspector
// can drill back down to the source.
//
// Stateless pure function: `(tree, edges, kind) => TierEdge[]`. Safe
// to call per frame, but in practice the tier feature caches the
// result per (tree, kind) pair because the pair is stable per scene.

export interface TierEdge {
  /** Synthetic id — `${fromEntity}->${toEntity}` at the tier level. */
  id: string;
  fromId: string;
  toId: string;
  /** Sum of underlying file-edge weights. */
  weight: number;
  /** How many file edges collapsed into this aggregate. */
  count: number;
  /** IDs of the contributing file edges (for drill-down). */
  memberEdgeIds: readonly string[];
}

/**
 * Roll up every file edge to the nearest ancestor of `targetKind`.
 * Self-loops (an edge between two files in the same target ancestor)
 * are dropped — they aren't meaningful at a coarser grain and would
 * clutter the render.
 */
export function rollupEdges(
  tree: EntityTree,
  edges: readonly FileEdge[],
  targetKind: EntityKind,
): TierEdge[] {
  const ancestorOf = makeAncestorResolver(tree, targetKind);
  const agg = new Map<string, TierEdge>();

  for (const edge of edges) {
    const fromId = ancestorOf(edge.from);
    const toId = ancestorOf(edge.to);
    if (!fromId || !toId || fromId === toId) continue;
    const key = `${fromId}->${toId}`;
    const cur = agg.get(key);
    if (cur) {
      // Mutate in place — the edge is ours.
      (cur as { weight: number }).weight += edge.weight;
      (cur as { count: number }).count += 1;
      (cur.memberEdgeIds as string[]).push(edge.id);
    } else {
      agg.set(key, {
        id: key,
        fromId,
        toId,
        weight: edge.weight,
        count: 1,
        memberEdgeIds: [edge.id],
      });
    }
  }

  return [...agg.values()];
}

// Build a memoised walker: file id → ancestor entity id of `targetKind`.
// One allocation per rollup call; cache survives the loop.
function makeAncestorResolver(
  tree: EntityTree,
  targetKind: EntityKind,
): (fileId: string) => string | null {
  const cache = new Map<string, string | null>();
  return (fileId: string) => {
    const cached = cache.get(fileId);
    if (cached !== undefined) return cached;
    const chain = tree.ancestorsOf(fileId);
    for (const e of chain) {
      if (e.kind === targetKind) {
        cache.set(fileId, e.id);
        return e.id;
      }
    }
    cache.set(fileId, null);
    return null;
  };
}
