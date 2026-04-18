// Abstract base for rect-per-item node renderers (Galaxy, Cluster,
// Supercluster — city has enough specialized LOD behaviour to stay
// standalone). Owns the 4-step pipeline that every such renderer repeats:
//   1. ensureCapacity on the InstancedRectMesh
//   2. subclass fills one instance row per item
//   3. collect pick rects + AABB → one invisible Graphics hit rect
//   4. SpatialPickIndex.load with id-set cache
//
// The base handles pool lifecycle, hit-layer visibility, and the
// "empty data → visible:false" guard that prevents phantom pointer events
// on an inactive LOD tier. Subclasses only describe: how to fill a row,
// what the hit rect looks like, and any per-renderer extras (labels etc.)
// via update() overrides that call super.update() first.

import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { InstancedRectMesh } from "./InstancedRectMesh";
import { SpatialPickIndex, type PickRect } from "./SpatialPickIndex";

export interface LabelPool {
  entries: BitmapText[];
  cursor: number;
}

export abstract class RectNodeRenderer<T> {
  protected container: Container;
  protected rectMesh: InstancedRectMesh;
  protected hitLayer: Graphics;
  protected pickIndex: SpatialPickIndex;
  protected pickRects: PickRect[] = [];

  constructor(
    parent: Container,
    initialCapacity: number,
    handlers: {
      onClick?: (id: string) => void;
      onHover?: (id: string | null) => void;
    },
  ) {
    this.container = new Container();
    this.rectMesh = new InstancedRectMesh(initialCapacity);
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();

    this.container.addChild(this.rectMesh.mesh);
    this.hookLabels();

    this.hitLayer.eventMode = "static";
    this.hitLayer.cursor = "pointer";
    this.hitLayer.on("pointertap", (e: FederatedPointerEvent) => {
      const id = this.pickAt(e.global.x, e.global.y);
      if (id) handlers.onClick?.(id);
    });
    this.hitLayer.on("pointermove", (e: FederatedPointerEvent) => {
      handlers.onHover?.(this.pickAt(e.global.x, e.global.y));
    });
    this.hitLayer.on("pointerout", () => handlers.onHover?.(null));
    this.container.addChild(this.hitLayer);

    parent.addChild(this.container);
  }

  // Subclasses that need a label layer override this to addChild their
  // labelContainer *between* rectMesh and hitLayer. Default: no-op (rect-only
  // renderers like Galaxy).
  protected hookLabels(): void {
    /* default no-op */
  }

  protected pickAt(gx: number, gy: number): string | null {
    const local = this.container.toLocal({ x: gx, y: gy });
    return this.pickIndex.pickAt(local.x, local.y);
  }

  // Pool factory for subclasses that need text labels. Keyed by font name,
  // returns { entries, cursor }. LabelPool is minimal (no LRU / no HWM) —
  // acquire/release live here. For CityNodeRenderer's more elaborate
  // capped-LRU pool, stay standalone (see class comment on CityNodeRenderer).
  protected acquireLabelPool(
    map: Map<string, LabelPool>,
    fontName: string,
  ): LabelPool {
    let pool = map.get(fontName);
    if (!pool) {
      pool = { entries: [], cursor: 0 };
      map.set(fontName, pool);
    }
    return pool;
  }

  // Subclass hook: fill FLOATS_PER_INSTANCE floats at data[i*FLOATS_PER_INSTANCE].
  // Return the pick rect for this item (or null to skip picking — e.g. a
  // sub-element like a header stripe that should never be the target).
  protected abstract renderInstance(item: T, i: number, data: Float32Array): PickRect | null;

  // Orchestrates the 4-step pipeline. Subclasses that need label rendering
  // override update() and wrap a super.update() call, or override and
  // reimplement. Default update() handles the common "one rect per item".
  protected updateBase(items: T[]): number {
    if (items.length === 0) {
      this.clear();
      return 0;
    }
    this.rectMesh.ensureCapacity(items.length);
    const data = this.rectMesh.view();
    this.pickRects.length = 0;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let written = 0;

    for (let i = 0; i < items.length; i++) {
      const pickRect = this.renderInstance(items[i], written, data);
      if (pickRect !== null) {
        this.pickRects.push(pickRect);
        if (pickRect.x < minX) minX = pickRect.x;
        if (pickRect.y < minY) minY = pickRect.y;
        if (pickRect.x + pickRect.w > maxX) maxX = pickRect.x + pickRect.w;
        if (pickRect.y + pickRect.h > maxY) maxY = pickRect.y + pickRect.h;
        written++;
      }
    }

    // Single invisible hit rect over the populated AABB. Replaces N
    // per-item Graphics.rect() calls (and their geometry rebuilds).
    this.hitLayer.clear();
    if (this.pickRects.length > 0) {
      this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY)
        .fill({ color: 0x000000, alpha: 0.001 });
    }
    // Empty data would leave an inherited `visible:false` from clear().
    // With items written, we definitely want to receive pointer events.
    this.hitLayer.visible = true;

    this.rectMesh.setInstanceCount(written);
    this.pickIndex.load(this.pickRects);
    return written;
  }

  clear(): void {
    this.rectMesh.setInstanceCount(0);
    this.hitLayer.clear();
    // Hide the hit layer entirely — otherwise an AABB from a previous LOD
    // tier would still intercept pointer events (Graphics.clear() drops
    // geometry but hitArea lingers until a fresh .rect() assignment).
    this.hitLayer.visible = false;
    this.pickRects.length = 0;
    this.pickIndex.clear();
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRects.length = 0;
    this.container.destroy({ children: true });
  }
}
