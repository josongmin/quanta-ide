import type { Rect } from "../graph/types";
import type { Entity, EntityTree } from "../entity/types";
import type {
  BuildHierarchicalLayoutOpts,
  EntityWeightFn,
  HierarchicalLayout,
} from "./types";
import { squarifyInto } from "./squarified";

// build-hierarchical-layout
// --------------------------------------------------------------------
// Top-down recursion: place the root into the outer rect, then for
// every non-leaf entity squarify its children into its own rect.
// Result is a flat id→rect map covering every node of the tree.
//
// The caller can pick a render kind (universe/galaxy/street/...) and
// iterate `tree.byKind(kind)` to get just those rects. No rebuild
// needed — tier switching is purely a read-side filter on the same
// layout object.
//
// Default weight prefers `metrics.loc` when present, falls back to
// `fileCount`, and finally `childIds.length` + 1 so the pack is
// well-defined for any input (including synthetic empty trees in
// tests).

const DEFAULT_ROOT_W = 2000;
const DEFAULT_ROOT_H = 1400;
const DEFAULT_PADDING = 24;

export function buildHierarchicalLayout(
  tree: EntityTree,
  opts: BuildHierarchicalLayoutOpts = {},
): HierarchicalLayout {
  const rootWidth = opts.rootWidth ?? DEFAULT_ROOT_W;
  const rootHeight = opts.rootHeight ?? DEFAULT_ROOT_H;
  const padding = opts.padding ?? DEFAULT_PADDING;
  const weightFn = opts.weight ?? defaultWeight(tree);

  const rects = new Map<string, Rect>();
  const root = tree.byId.get(tree.rootId);
  if (!root) {
    return { rects, totalBounds: { x: 0, y: 0, w: rootWidth, h: rootHeight } };
  }
  const rootRect: Rect = { x: 0, y: 0, w: rootWidth, h: rootHeight };
  rects.set(root.id, rootRect);

  const stack: Entity[] = [root];
  while (stack.length > 0) {
    const parent = stack.pop();
    if (!parent) break;
    if (parent.childIds.length === 0) continue;
    const parentRect = rects.get(parent.id);
    if (!parentRect) continue;
    const children: Entity[] = [];
    for (const id of parent.childIds) {
      const c = tree.byId.get(id);
      if (c) children.push(c);
    }
    if (children.length === 0) continue;
    const items = children.map(c => ({ id: c.id, weight: Math.max(1, weightFn(c.id)) }));
    const childRects = squarifyInto(items, parentRect, padding);
    for (const c of children) {
      const r = childRects.get(c.id);
      if (r) {
        rects.set(c.id, r);
        if (c.childIds.length > 0) stack.push(c);
      }
    }
  }

  return { rects, totalBounds: rootRect };
}

// Default weight — descends from loc if available, else fileCount,
// else a childCount-based proxy. All paths produce a positive integer
// so squarified's weight-total never degenerates to zero.
function defaultWeight(tree: EntityTree): EntityWeightFn {
  return (id: string): number => {
    const e = tree.byId.get(id);
    if (!e) return 1;
    const m = e.metrics;
    if (m?.loc !== undefined && m.loc > 0) return m.loc;
    if (m?.fileCount !== undefined && m.fileCount > 0) return m.fileCount;
    // Rollup fallback: sum descendant weights (computed lazily).
    return rollupWeight(tree, id);
  };
}

function rollupWeight(tree: EntityTree, id: string): number {
  const e = tree.byId.get(id);
  if (!e) return 1;
  if (e.childIds.length === 0) return 1;
  let sum = 0;
  for (const cid of e.childIds) sum += rollupWeight(tree, cid);
  return sum || 1;
}
