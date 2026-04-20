import type {
  EntityKind,
  EntityTree,
  FileEdge,
  TierEdge,
} from "@quanta/canvas-engine";
import { rollupEdges } from "@quanta/canvas-engine";

// Entity-centric edge derivation
// --------------------------------------------------------------------
// `rollupEdges` aggregates every file-edge in the workspace up to a
// given tier kind. This helper narrows that result to one entity:
// inbound + outbound, sorted by weight.
//
// Used in:
//   - Inspector → Relations section (top N inbound/outbound rows).
//   - CanvasViewport → neighborhood focus mode (ego set for culling).
//
// Stateless and cheap — the inner `rollupEdges` call dominates, and
// callers memoise by (tree, fileEdges, kind) which is stable per
// scene. Pulling this into a shared helper keeps both consumers in
// lockstep: whatever Inspector shows as "top inbound" is exactly
// what the neighborhood view will reveal on the canvas.

export interface EntityRelations {
  inbound: readonly TierEdge[];
  outbound: readonly TierEdge[];
}

export function computeEntityRelations(
  tree: EntityTree,
  fileEdges: readonly FileEdge[],
  entityId: string,
  entityKind: EntityKind,
): EntityRelations {
  const tierEdges = rollupEdges(tree, fileEdges, entityKind);
  const inbound: TierEdge[] = [];
  const outbound: TierEdge[] = [];
  for (const edge of tierEdges) {
    if (edge.toId === entityId) inbound.push(edge);
    else if (edge.fromId === entityId) outbound.push(edge);
  }
  inbound.sort((a, b) => b.weight - a.weight);
  outbound.sort((a, b) => b.weight - a.weight);
  return { inbound, outbound };
}

/** Ego set for neighborhood-focus culling: the entity itself plus
 *  every 1-hop counterpart. Caller uses `Set.has` on the entity-render
 *  loop to mask non-ego entities / edges. */
export function computeEgoSet(relations: EntityRelations, entityId: string): Set<string> {
  const set = new Set<string>([entityId]);
  for (const e of relations.inbound) set.add(e.fromId);
  for (const e of relations.outbound) set.add(e.toId);
  return set;
}
