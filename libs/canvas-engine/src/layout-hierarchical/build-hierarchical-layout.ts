import type { Rect } from "../graph/types";
import type { Entity, EntityTree } from "../entity/types";
import type {
  BuildHierarchicalLayoutOpts,
  HierarchicalLayout,
} from "./types";
import {
  FILE_CARD_W,
  FILE_CARD_MIN_H,
  computeFileHeight,
} from "../layout/types";
import { masonryPack, type MasonryItem } from "./masonry-pack";
import { clusterChildren } from "./cluster-children";
import { LayoutSpatialIndex } from "./spatial-index";

// build-hierarchical-layout (bottom-up)
// --------------------------------------------------------------------
// Two-pass construction:
//   1. Post-order DFS: each leaf's size comes from `computeFileHeight`
//      (LoC-driven), each internal node's size is shortest-column
//      masonry of its packed children + padding. Sizes bubble up; the
//      root ends up as big as it needs to be.
//   2. Pre-order walk from root(0,0): for each parent, place children
//      at their pack-relative offsets translated by the parent's origin.
//
// The leaf world size (FILE_CARD_W × minimum card height) is the
// "minimum unit" the camera zooms against — every tier threshold in
// the apparent-size resolver compares against that constant, so repo
// size changes the WORLD size (more files → bigger world) but leaves
// the zoom feel invariant. This is the inverse of the legacy top-down
// squarified layout where the world was 2000×1400 and file cards
// shrank as files multiplied.
//
// `padding` = outer gutter inside each non-leaf rect (breathing room
// around a folder's children so the parent label has space above the
// child pack). `gap` = sibling gutter between packed children.

const DEFAULT_PADDING = 24;
const DEFAULT_GAP = 8;

/** World-space width of a single leaf (file card). Constant by design —
 *  see `FILE_CARD_W` in `layout/types.ts`. Used by the tier resolver
 *  as the reference unit for apparent-size thresholds. */
export const LEAF_WORLD_WIDTH = FILE_CARD_W;
/** World-space height of the smallest possible leaf (empty / 0 LoC
 *  file). Paired with `LEAF_WORLD_WIDTH` to give tier thresholds a
 *  stable apparent-size unit regardless of the specific file size. */
export const LEAF_WORLD_MIN_HEIGHT = FILE_CARD_MIN_H;

export function buildHierarchicalLayout(
  tree: EntityTree,
  opts: BuildHierarchicalLayoutOpts = {},
): HierarchicalLayout {
  const padding = opts.padding ?? DEFAULT_PADDING;
  const gap = opts.gap ?? DEFAULT_GAP;

  const rects = new Map<string, Rect>();
  const root = tree.byId.get(tree.rootId);
  if (!root) {
    // Empty tree — still give callers a valid bounds so cameraForRect
    // doesn't divide by zero on first paint.
    return {
      rects,
      totalBounds: { x: 0, y: 0, w: LEAF_WORLD_WIDTH, h: LEAF_WORLD_MIN_HEIGHT },
      spatialIndex: new LayoutSpatialIndex([], rects),
    };
  }

  // Pass 1 — post-order: size every subtree.
  const sizes = new Map<string, { w: number; h: number }>();
  // Per-parent placements of children (relative to inner origin).
  const childPlacements = new Map<string, Array<{ id: string; x: number; y: number }>>();
  sizeSubtree(root, tree, opts.weight, padding, gap, sizes, childPlacements);

  // Pass 2 — pre-order from root: translate relative placements into
  // absolute world coords and emit rects.
  const rootSize = sizes.get(root.id) ?? { w: LEAF_WORLD_WIDTH, h: LEAF_WORLD_MIN_HEIGHT };
  const rootRect: Rect = { x: 0, y: 0, w: rootSize.w, h: rootSize.h };
  rects.set(root.id, rootRect);
  placeDescendants(root, tree, rects, sizes, childPlacements);

  // Spatial index — packed rbush per kind so the render pipeline can
  // cull off-viewport entities in O(log n + k) per frame. Built once
  // after placement; tree / rects are frozen from here on.
  const spatialIndex = new LayoutSpatialIndex(tree.byId.values(), rects);

  return { rects, totalBounds: rootRect, spatialIndex };
}

function sizeSubtree(
  entity: Entity,
  tree: EntityTree,
  weight: BuildHierarchicalLayoutOpts["weight"],
  padding: number,
  gap: number,
  sizes: Map<string, { w: number; h: number }>,
  childPlacements: Map<string, Array<{ id: string; x: number; y: number }>>,
): void {
  if (entity.childIds.length === 0) {
    // Leaf — intrinsic size from LoC (or weight override).
    const loc = weightOrLoc(entity, weight) ?? entity.metrics?.loc ?? 0;
    const w = LEAF_WORLD_WIDTH;
    const h = computeFileHeight(loc);
    sizes.set(entity.id, { w, h });
    return;
  }

  // Collect + size children first (post-order).
  const children: Entity[] = [];
  for (const id of entity.childIds) {
    const c = tree.byId.get(id);
    if (c) {
      sizeSubtree(c, tree, weight, padding, gap, sizes, childPlacements);
      children.push(c);
    }
  }
  if (children.length === 0) {
    // Declared childIds exist but resolve to nothing — treat as leaf.
    sizes.set(entity.id, { w: LEAF_WORLD_WIDTH, h: LEAF_WORLD_MIN_HEIGHT });
    return;
  }

  // Stable cluster-aware reorder so name-stemmed siblings pack
  // adjacently (same reason as the legacy top-down path).
  const ordered = clusterChildren(children);
  const items: MasonryItem[] = ordered.map(c => {
    const s = sizes.get(c.id) ?? { w: LEAF_WORLD_WIDTH, h: LEAF_WORLD_MIN_HEIGHT };
    return { id: c.id, w: s.w, h: s.h };
  });

  const packed = masonryPack(items, gap);
  // Adaptive padding: if the pack is tiny (rare — empty stems), don't
  // add more chrome than content.
  const effPad = Math.max(0, Math.min(padding, Math.max(packed.w, packed.h) / 4 || padding));
  const parentW = packed.w + effPad * 2;
  const parentH = packed.h + effPad * 2;
  sizes.set(entity.id, { w: parentW, h: parentH });

  // Stash child placements (relative to parent's inner origin =
  // (effPad, effPad)). Absolute coords computed in pass 2.
  const placements: Array<{ id: string; x: number; y: number }> = packed.placements.map(p => ({
    id: p.id,
    x: p.x + effPad,
    y: p.y + effPad,
  }));
  childPlacements.set(entity.id, placements);
}

function placeDescendants(
  entity: Entity,
  tree: EntityTree,
  rects: Map<string, Rect>,
  sizes: Map<string, { w: number; h: number }>,
  childPlacements: Map<string, Array<{ id: string; x: number; y: number }>>,
): void {
  const parentRect = rects.get(entity.id);
  if (!parentRect) return;
  const places = childPlacements.get(entity.id);
  if (!places) return;
  for (const p of places) {
    const s = sizes.get(p.id);
    if (!s) continue;
    const rect: Rect = { x: parentRect.x + p.x, y: parentRect.y + p.y, w: s.w, h: s.h };
    rects.set(p.id, rect);
    const child = tree.byId.get(p.id);
    if (child) placeDescendants(child, tree, rects, sizes, childPlacements);
  }
}

// Caller-provided weight function wins over metrics.loc so custom
// weightings (e.g. per-author area, complexity) still drive leaf size.
// Returns undefined when no custom weight is supplied OR the weight
// yielded zero / negative (which would collapse the leaf).
function weightOrLoc(entity: Entity, weight: BuildHierarchicalLayoutOpts["weight"]): number | undefined {
  if (!weight) return undefined;
  const w = weight(entity.id);
  if (!Number.isFinite(w) || w <= 0) return undefined;
  return w;
}
