import type { Rect } from "../graph/types";
import type { LayoutSpatialIndex } from "./spatial-index";

// Hierarchical layout
// --------------------------------------------------------------------
// One layout object carries rects for EVERY tier (universe → room) of
// a single Entity tree. The layer above (tier-switch) picks which
// rects to render based on the active tier's `visibleKind`, but the
// full map stays resident so tier transitions can morph between
// parent/child rects without recomputing.
//
// Sizes come from bottom-up packing: leaves (files) use
// `computeFileHeight(loc)` as their intrinsic height against the
// constant `FILE_CARD_W` width; parents masonry-pack their children
// and add padding. The world grows with the repo — there is no
// fixed root rectangle. The leaf size is constant, which makes the
// apparent-size tier resolver scale-invariant across any repo size.

export interface HierarchicalLayout {
  /** Every entity (of every kind) → its axis-aligned rect. Coords are
   *  in a single shared world space; parent rects contain their
   *  children's rects. */
  rects: ReadonlyMap<string, Rect>;
  /** Total bounds — equals the root entity's rect. Viewport fits
   *  against this on first load. */
  totalBounds: Rect;
  /** Per-kind spatial index — used by the render pipeline to cull
   *  entities outside the current viewport. Build cost lives in
   *  `buildHierarchicalLayout`; query cost is O(log n + k). */
  spatialIndex: LayoutSpatialIndex;
}

/**
 * Weight function for an entity. Overrides the default (leaf size =
 * `computeFileHeight(metrics.loc)`) when caller wants custom area
 * allocation (e.g. per-author territory, complexity heatmap).
 */
export type EntityWeightFn = (id: string) => number;

export interface BuildHierarchicalLayoutOpts {
  /** Horizontal/vertical padding from a parent rect's edge to its
   *  children's pack. Visual breathing room so the parent label has
   *  space above the child masonry. */
  padding?: number;
  /** Gutter between adjacent sibling rects, in world units. A small
   *  non-zero gap (default 8) reads as "discrete cards"; gap=0 packs
   *  siblings edge-to-edge. */
  gap?: number;
  /** Computes a custom weight used in place of `metrics.loc` for
   *  leaf sizing. Non-leaf sizes are always derived from children. */
  weight?: EntityWeightFn;
}
