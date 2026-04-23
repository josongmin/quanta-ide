import RBush from "rbush";
import type { Rect } from "../graph/types";
import type { Entity, EntityKind } from "../entity/types";

// LayoutSpatialIndex
// --------------------------------------------------------------------
// Per-kind rbush of entity rects. Lets the render pipeline cull the
// visible-entity array down from `O(total entities of this kind)` to
// `O(entities intersecting the current viewport)` — same pattern
// Google Maps / Figma use to stay smooth at arbitrary zoom-out on
// huge scenes. Without this, a 50k-file repo at Universe tier
// would push 50k entities through React's memo / focus-filter each
// frame; with it, the filter sees ~300 (viewport-size-bound).
//
// Why rbush vs a hand-rolled quadtree:
//   - rbush is already a workspace dep (see spatial/file-index.ts),
//     battle-tested on the legacy workspace-canvas.
//   - Packed construction is O(n log n); query is O(log n + k) where
//     k is hits. For the largest realistic repo (~500k files) the
//     build fits comfortably inside layout-compute time.
//
// One tree per EntityKind because queries always scope by kind:
// "show me all *file* entities intersecting this rect". Mixing kinds
// would force consumers to post-filter, which defeats the index.

interface BBoxItem {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly id: string;
}

type MutableBBoxItem = { -readonly [K in keyof BBoxItem]: BBoxItem[K] };

export class LayoutSpatialIndex {
  private readonly trees = new Map<EntityKind, RBush<BBoxItem>>();

  constructor(entities: Iterable<Entity>, rects: ReadonlyMap<string, Rect>) {
    const buckets = new Map<EntityKind, MutableBBoxItem[]>();
    for (const e of entities) {
      const r = rects.get(e.id);
      if (!r) continue;
      let bucket = buckets.get(e.kind);
      if (!bucket) {
        bucket = [];
        buckets.set(e.kind, bucket);
      }
      bucket.push({
        minX: r.x,
        minY: r.y,
        maxX: r.x + r.w,
        maxY: r.y + r.h,
        id: e.id,
      });
    }
    for (const [kind, items] of buckets) {
      const tree = new RBush<BBoxItem>();
      tree.load(items);
      this.trees.set(kind, tree);
    }
  }

  /** Entity ids of the given kind whose rect intersects `rect`.
   *  Returns an empty array when the kind has no entities. */
  queryIds(kind: EntityKind, rect: Rect): string[] {
    const tree = this.trees.get(kind);
    if (!tree) return [];
    const hits = tree.search({
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.w,
      maxY: rect.y + rect.h,
    });
    const out: string[] = new Array(hits.length);
    for (let i = 0; i < hits.length; i++) out[i] = hits[i]!.id;
    return out;
  }

  /** Convenience: filter an entity list down to those intersecting the
   *  rect. Preserves input order so callers that depend on tree-order
   *  (e.g. sibling clustering) stay consistent. */
  filterEntities(entities: readonly Entity[], rect: Rect): Entity[] {
    if (entities.length === 0) return [];
    const kind = entities[0]?.kind;
    if (!kind) return [];
    const hits = new Set(this.queryIds(kind, rect));
    const out: Entity[] = [];
    for (const e of entities) if (hits.has(e.id)) out.push(e);
    return out;
  }
}

/** World-space rectangle visible in the current viewport. Inverts the
 *  camera transform so callers can feed the result directly to
 *  `LayoutSpatialIndex.queryIds`. */
export function worldViewportRect(
  camera: { tx: number; ty: number; scale: number },
  viewportW: number,
  viewportH: number,
): Rect {
  if (camera.scale <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  // `+ 0` normalises the IEEE-754 `-0` that falls out of `-camera.tx /
  // scale` when tx is 0 — downstream deep-equality tests and tooltip
  // text readers treat -0 as a bug signal.
  return {
    x: -camera.tx / camera.scale + 0,
    y: -camera.ty / camera.scale + 0,
    w: viewportW / camera.scale,
    h: viewportH / camera.scale,
  };
}
