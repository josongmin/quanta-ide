import { Graphics, Container, Text } from "pixi.js";
import type { Rect, Viewport } from "@quanta/canvas-engine";

// Strongly-connected-component bubble renderer. Wraps each cycle (≥2 members)
// in a soft orange rounded-rect so cycles are obvious at any zoom above
// supergalaxy. Structure101 / SonarGraph / NDepend use the same pattern —
// a design cycle is a defect, and wrapping the member nodes in a coloured
// hull makes that defect pre-attentive.
//
// AABB over convex-hull: hulls look nice for 3 members in open space, but
// at galaxy scale the member rects are tightly packed by the treemap layout
// so a hull ends up nearly rectangular anyway. AABB + padding is cheaper
// to compute, trivially deterministic, and reads the same visually.
//
// Direct-mount from PixiStage (not via the renderer registry) for the same
// reason as ClusterEdgeRenderer — this is an overlay pass, not a tier.

const PADDING = 12;
const CORNER_RADIUS = 16;
const FILL_COLOR = 0xf97316;   // orange-500
const FILL_ALPHA = 0.10;
const STROKE_COLOR = 0xea580c; // orange-600
const STROKE_ALPHA = 0.55;
const LABEL_MIN_SCALE = 0.3;   // below this, labels clutter the galaxy view

export class SCCBubbleRenderer {
  private container: Container;
  private gfx: Graphics;
  private labelPool: Text[] = [];
  private labelPoolIdx = 0;

  constructor(parent: Container) {
    this.container = new Container();
    this.container.eventMode = "none";
    parent.addChildAt(this.container, 0);
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  build(
    sccs: readonly (readonly string[])[] | undefined,
    fileRectById: Map<string, Rect>,
    viewport?: Viewport,
  ): void {
    this.gfx.clear();
    this.resetLabels();
    if (!sccs || sccs.length === 0) return;

    const scale = viewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const strokeWidth = 2 * invScale;
    const showLabels = scale >= LABEL_MIN_SCALE;

    for (const members of sccs) {
      if (members.length < 2) continue;
      const bbox = aabbOfMembers(members, fileRectById);
      if (!bbox) continue;

      const x = bbox.x - PADDING;
      const y = bbox.y - PADDING;
      const w = bbox.w + PADDING * 2;
      const h = bbox.h + PADDING * 2;

      this.gfx
        .roundRect(x, y, w, h, CORNER_RADIUS)
        .fill({ color: FILL_COLOR, alpha: FILL_ALPHA })
        .stroke({ color: STROKE_COLOR, alpha: STROKE_ALPHA, width: strokeWidth });

      if (showLabels) {
        const label = this.acquireLabel();
        label.text = `cycle · ${members.length}`;
        label.style.fontSize = 11 * invScale;
        label.position.set(x + 8, y + 6);
        label.visible = true;
      }
    }
  }

  clear(): void {
    this.gfx.clear();
    this.resetLabels();
  }

  destroy(): void {
    for (const l of this.labelPool) l.destroy();
    this.labelPool.length = 0;
    this.gfx.destroy();
    this.container.destroy();
  }

  private acquireLabel(): Text {
    let label = this.labelPool[this.labelPoolIdx];
    if (!label) {
      label = new Text({
        text: "",
        style: {
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          fontWeight: "600",
          fill: 0xea580c,
        },
      });
      label.eventMode = "none";
      this.container.addChild(label);
      this.labelPool[this.labelPoolIdx] = label;
    }
    this.labelPoolIdx++;
    return label;
  }

  private resetLabels(): void {
    for (let i = 0; i < this.labelPoolIdx; i++) this.labelPool[i].visible = false;
    this.labelPoolIdx = 0;
  }
}

function aabbOfMembers(
  members: readonly string[],
  fileRectById: Map<string, Rect>,
): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0;
  for (const id of members) {
    const r = fileRectById.get(id);
    if (!r) continue;
    count++;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  if (count === 0) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
