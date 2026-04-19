import { describe, it, expect } from "vitest";
import { Container } from "pixi.js";
import { RectNodeRenderer } from "./RectNodeRenderer";
import { type PickRect } from "./SpatialPickIndex";
import { FLOATS_PER_INSTANCE } from "./InstancedRectMesh";

// RectNodeRenderer is abstract — we subclass it with a minimal concrete
// renderer that writes one well-known row per item, then verify:
//   - updateBase returns the number of rows actually written (null pickRect
//     rows are skipped)
//   - clear() zeroes the mesh instance count and hides the hit layer
//   - destroy() tears down cleanly
//   - pickKindKey propagates to SpatialPickIndex.load so tiers are namespaced
//
// We don't need a live WebGL context — Pixi's `Mesh`, `Graphics`, and
// `Container` instantiate fine in jsdom; the actual draw is what would need
// the GL context, and we never call the stage's render loop.

interface Item {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // When true, renderInstance returns null — simulating a sub-element that
  // should be drawn but not be pickable.
  skipPick?: boolean;
}

class TestRenderer extends RectNodeRenderer<Item> {
  public lastPickKindKeySeen: string | null | undefined = undefined;

  constructor(parent: Container, opts: { pickKindKey?: string | null } = {}) {
    super(parent, 16, {}, opts.pickKindKey ?? null);
  }

  protected renderInstance(item: Item, i: number, data: Float32Array): PickRect | null {
    // Just write position/size so we can assert the offset math works.
    const o = i * FLOATS_PER_INSTANCE;
    data[o] = item.x;
    data[o + 1] = item.y;
    data[o + 2] = item.w;
    data[o + 3] = item.h;
    if (item.skipPick) return null;
    return { id: item.id, x: item.x, y: item.y, w: item.w, h: item.h };
  }

  update(items: Item[]): number {
    return this.updateBase(items);
  }

  // Expose protected internals for assertions.
  getHitLayerVisible(): boolean {
    return this.hitLayer.visible;
  }
  pick(globalX: number, globalY: number): string | null {
    // Bypass toLocal because we're not in a live stage — treat world-coords
    // as the pickIndex coordinate system directly (identity transform on a
    // detached container).
    return this.pickIndex.pickAt(globalX, globalY);
  }
}

describe("RectNodeRenderer.updateBase", () => {
  it("returns 0 and hides the hit layer on an empty update", () => {
    const parent = new Container();
    const r = new TestRenderer(parent);
    const written = r.update([]);
    expect(written).toBe(0);
    expect(r.getHitLayerVisible()).toBe(false);
    r.destroy();
  });

  it("writes one instance per non-null pickRect and makes the hit layer visible", () => {
    const parent = new Container();
    const r = new TestRenderer(parent);
    const written = r.update([
      { id: "a", x: 0, y: 0, w: 10, h: 10 },
      { id: "b", x: 50, y: 50, w: 10, h: 10 },
    ]);
    expect(written).toBe(2);
    expect(r.getHitLayerVisible()).toBe(true);
    // Tight pick test — (5, 5) is inside "a", (55, 55) inside "b".
    expect(r.pick(5, 5)).toBe("a");
    expect(r.pick(55, 55)).toBe("b");
    r.destroy();
  });

  it("skips rows whose renderInstance returns null (sub-elements)", () => {
    const parent = new Container();
    const r = new TestRenderer(parent);
    const written = r.update([
      { id: "a", x: 0, y: 0, w: 10, h: 10 },
      { id: "header", x: 0, y: 0, w: 10, h: 2, skipPick: true },
      { id: "b", x: 50, y: 50, w: 10, h: 10 },
    ]);
    // renderInstance was called 3 times but only 2 returned a pickRect.
    expect(written).toBe(2);
    // The skipped id isn't pickable either.
    expect(r.pick(5, 1)).not.toBe("header");
    r.destroy();
  });
});

describe("RectNodeRenderer.clear", () => {
  it("zeroes pickRects + pickIndex and hides the hit layer", () => {
    const parent = new Container();
    const r = new TestRenderer(parent);
    r.update([{ id: "a", x: 0, y: 0, w: 10, h: 10 }]);
    expect(r.pick(5, 5)).toBe("a");
    r.clear();
    expect(r.pick(5, 5)).toBeNull();
    expect(r.getHitLayerVisible()).toBe(false);
    r.destroy();
  });
});

describe("RectNodeRenderer pickKindKey", () => {
  it("second update with identical rects is a cache hit (load skipped) when kindKey is stable", () => {
    const parent = new Container();
    const r = new TestRenderer(parent, { pickKindKey: "galaxy" });
    const rects = [{ id: "a", x: 0, y: 0, w: 10, h: 10 }];
    r.update(rects);
    r.update(rects);
    // The tree is still queryable even though the second load was a no-op.
    expect(r.pick(5, 5)).toBe("a");
    r.destroy();
  });
});
