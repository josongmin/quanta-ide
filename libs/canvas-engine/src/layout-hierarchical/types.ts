import type { Rect } from "../graph/types";

// Hierarchical layout
// --------------------------------------------------------------------
// One layout object carries rects for EVERY tier (universe → room) of
// a single Entity tree. The layer above (tier-switch) picks which
// rects to render based on the active tier's `visibleKind`, but the
// full map stays resident so tier transitions can morph between
// parent/child rects without recomputing.
//
// Keeping rects for all kinds in one map (keyed by entity id) means
// the consumer never needs to "convert" between tiers — it just
// walks the Entity tree and looks up rects on demand. The tree
// carries the topology, this carries the geometry.

export interface HierarchicalLayout {
  /** Every entity (of every kind) → its axis-aligned rect. Coords are
   *  in a single shared world space; parent rects contain their
   *  children's rects. */
  rects: ReadonlyMap<string, Rect>;
  /** Total bounds — union of every top-level (galaxy) rect, snapped
   *  to an outer pad. The viewport fits against this on first load. */
  totalBounds: Rect;
}

/**
 * Weight function for an entity. Controls how much of the parent's
 * rect each child claims. Default weight = `loc` if present, else
 * fileCount at the building-and-above kinds, else 1 for leaves.
 */
export type EntityWeightFn = (id: string) => number;

export interface BuildHierarchicalLayoutOpts {
  /** Outer rect the root (universe) entity is fit into. Defaults to
   *  2000×1400 — arbitrary but works well against the default
   *  viewport scale of 0.1. */
  rootWidth?: number;
  rootHeight?: number;
  /** Horizontal/vertical padding from a rect's edge to its child
   *  rects. Visual breathing room so labels don't collide. */
  padding?: number;
  /** Gutter between adjacent sibling rects, in world units. Default 0
   *  (siblings share edges, classic squarified). A non-zero gap shrinks
   *  each sibling inward so the packed set reads as a grid of discrete
   *  cards rather than a solid sheet. */
  gap?: number;
  /** Computes the weight used for squarified packing. */
  weight?: EntityWeightFn;
}
