import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { ClusterMeta, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_BOLD_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";

// Supergalaxy LOD renderer — draws one soft-coloured box per top-level
// directory / crate. There are at most a couple hundred of these, so the
// cost model flips: we can afford BitmapText labels for every cluster.
// Single InstancedRectMesh + one labelContainer per cluster.

function hslToRgb(h: number, s: number, l: number): number {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return (r << 16) | (g << 8) | b;
}

export class ClusterNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;
  private labelContainer: Container;
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  private pickRects: PickRect[] = [];
  private labelPool: BitmapText[] = [];
  private labelPoolCursor = 0;
  // Cluster ids are stable across frames; hashing the same id every frame
  // for 200+ clusters is wasted work. Memoize per instance — reset on
  // destroy() (module-level cache would leak across canvas remounts).
  private colorCache: Map<string, number> = new Map();

  private onClickCluster?: (id: string) => void;
  private onHoverCluster?: (id: string | null) => void;

  constructor(parent: Container, opts?: {
    onClick?: (id: string) => void;
    onHover?: (id: string | null) => void;
  }) {
    // BitmapFont.install requires the default Pixi Renderer to be ready,
    // which the PixiStage init guarantees *before* any renderer is
    // constructed. Call lazily here (idempotent guard inside).
    installCityFonts();
    this.container = new Container();
    this.rectMesh = new InstancedRectMesh(256);
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();
    this.onClickCluster = opts?.onClick;
    this.onHoverCluster = opts?.onHover;

    this.container.addChild(this.rectMesh.mesh);
    this.container.addChild(this.labelContainer);

    this.hitLayer.eventMode = "static";
    this.hitLayer.cursor = "pointer";
    this.hitLayer.on("pointertap", (e: FederatedPointerEvent) => {
      const id = this.pickAt(e.global.x, e.global.y);
      if (id) this.onClickCluster?.(id);
    });
    this.hitLayer.on("pointermove", (e: FederatedPointerEvent) => {
      this.onHoverCluster?.(this.pickAt(e.global.x, e.global.y));
    });
    this.hitLayer.on("pointerout", () => this.onHoverCluster?.(null));
    this.container.addChild(this.hitLayer);

    parent.addChild(this.container);
  }

  private pickAt(gx: number, gy: number): string | null {
    const local = this.container.toLocal({ x: gx, y: gy });
    return this.pickIndex.pickAt(local.x, local.y);
  }

  private colorForCluster(id: string): number {
    const cached = this.colorCache.get(id);
    if (cached !== undefined) return cached;
    // Stable hash → HSV-ish hue band. We want clusters of the same crate to
    // look related when the user zooms in/out quickly.
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const hue = (h & 0xffff) / 0xffff; // 0..1
    // Map hue into a soft pastel (HSL with high L, moderate S)
    const color = hslToRgb(hue, 0.45, 0.85);
    this.colorCache.set(id, color);
    return color;
  }

  private acquireLabel(): BitmapText {
    if (this.labelPoolCursor < this.labelPool.length) {
      const t = this.labelPool[this.labelPoolCursor++];
      t.visible = true;
      return t;
    }
    const t = new BitmapText({ text: "", style: { fontFamily: CITY_FONT_BOLD_NAME, fontSize: 11 } });
    this.labelContainer.addChild(t);
    this.labelPool.push(t);
    this.labelPoolCursor = this.labelPool.length;
    return t;
  }

  private releaseLabels(): void {
    for (let i = this.labelPoolCursor; i < this.labelPool.length; i++) {
      this.labelPool[i].visible = false;
    }
    this.labelPoolCursor = 0;
  }

  update(clusters: ClusterMeta[], viewport: Viewport): void {
    if (clusters.length === 0) {
      this.rectMesh.setInstanceCount(0);
      this.hitLayer.clear();
      this.pickRects.length = 0;
      this.pickIndex.clear();
      this.releaseLabels();
      return;
    }
    const invScale = Math.min(16, Math.max(1, 1 / viewport.scale));
    this.rectMesh.ensureCapacity(clusters.length);
    const data = this.rectMesh.view();
    this.pickRects.length = 0;
    this.labelPoolCursor = 0;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const fill = this.colorForCluster(c.id);
      const o = i * FLOATS_PER_INSTANCE;
      data[o] = c.rect.x;
      data[o + 1] = c.rect.y;
      data[o + 2] = c.rect.w;
      data[o + 3] = c.rect.h;
      unpackHexInto(fill, data, o + 4, 0.85);
      unpackHexInto(0x4b5563, data, o + 8, 0.55);
      data[o + 12] = invScale * 1.5;
      data[o + 13] = 24; // corner radius

      this.pickRects.push({ x: c.rect.x, y: c.rect.y, w: c.rect.w, h: c.rect.h, id: c.id });
      if (c.rect.x < minX) minX = c.rect.x;
      if (c.rect.y < minY) minY = c.rect.y;
      if (c.rect.x + c.rect.w > maxX) maxX = c.rect.x + c.rect.w;
      if (c.rect.y + c.rect.h > maxY) maxY = c.rect.y + c.rect.h;

      // Label (cluster name) — shown centered near top, scaled to viewport.
      const label = this.acquireLabel();
      const name = c.id.split("/").pop() ?? c.id;
      const displayText = `${name}  ${c.fileCount}`;
      if (label.text !== displayText) label.text = displayText;
      label.scale.set(invScale * 2);
      label.x = c.rect.x + 16 * invScale;
      label.y = c.rect.y + 16 * invScale;
    }

    // Single-AABB hit layer — resolves through SpatialPickIndex.
    this.hitLayer.clear();
    if (clusters.length > 0) {
      this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY).fill({ color: 0x000000, alpha: 0.001 });
    }

    this.rectMesh.setInstanceCount(clusters.length);
    this.pickIndex.load(this.pickRects);
    this.releaseLabels();
  }

  clear(): void {
    this.rectMesh.setInstanceCount(0);
    this.hitLayer.clear();
    this.pickRects.length = 0;
    this.pickIndex.clear();
    this.labelPoolCursor = 0;
    this.releaseLabels();
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRects.length = 0;
    this.colorCache.clear();
    this.container.destroy({ children: true });
  }
}
