import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { ClusterMeta, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_BOLD_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";

// Universe LOD renderer — draws one chunky architectural box per supercluster
// (e.g. `crates/`, `tests/`, future service groups). Shares the same
// InstancedRectMesh / BitmapFontAtlas / SpatialPickIndex pipeline as
// ClusterNodeRenderer but differs on three axes:
//   1. Fewer instances → initial capacity 32 (vs 256) and a curated 8-colour
//      palette (vs HSL hue hash) so related superclusters read as distinct
//      at a glance rather than blending into a pastel gradient.
//   2. Two label lines per box (name + file count) using CITY_FONT_BOLD_NAME
//      at 3.5× invScale so the text stays readable at max zoom-out.
//   3. Thicker borders (invScale * 3), 48px corner radius, 0.92 fill alpha —
//      tuned to look "architectural" against the grid background.

// Curated palette — pastel-ish but slightly warmer than the ClusterNodeRenderer
// HSL output so the universe tier reads as its own layer when both are visible
// during the LOD cross-fade. 8 entries is plenty: superclusters are typically
// <20, and cycling palette-by-hash gives visually stable assignment.
const SUPERCLUSTER_PALETTE = [
  0xe0f2fe, // sky
  0xfce7f3, // pink
  0xdcfce7, // mint
  0xfef3c7, // amber
  0xe9d5ff, // violet
  0xfee2e2, // rose
  0xd1fae5, // emerald
  0xfed7aa, // peach
];

// Convert 0xRRGGBB → HSL, darken L by `delta`, back to 0xRRGGBB.
// Used once per palette entry at cache-fill time, so the cost is negligible.
function darkenHex(color: number, delta: number): number {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) + (g < b ? 6 : 0);
    else if (max === g) h = ((b - r) / (max - min)) + 2;
    else h = ((r - g) / (max - min)) + 4;
    h /= 6;
  }
  const nl = Math.max(0, l - delta);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
  const p = 2 * nl - q;
  const nr = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const ng = Math.round(hue2rgb(p, q, h) * 255);
  const nb = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return (nr << 16) | (ng << 8) | nb;
}

interface LabelPair {
  name: BitmapText;
  meta: BitmapText;
}

export class SuperclusterNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;
  private labelContainer: Container;
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  private pickRects: PickRect[] = [];
  private labelPool: LabelPair[] = [];
  private labelPoolCursor = 0;
  // Stable id → palette index → (fill, border) memo. Keyed by id (not index)
  // so incoming/outgoing supercluster sets keep their colours steady across
  // updates. Reset on destroy().
  private colorCache: Map<string, { fill: number; border: number }> = new Map();

  private onClickSupercluster?: (id: string) => void;
  private onHoverSupercluster?: (id: string | null) => void;

  constructor(parent: Container, opts?: {
    onClick?: (id: string) => void;
    onHover?: (id: string | null) => void;
  }) {
    installCityFonts();
    this.container = new Container();
    // Superclusters are few (~dozens); 32 is plenty and avoids the 14KB
    // per-instance over-allocation that 256 would incur.
    this.rectMesh = new InstancedRectMesh(32);
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();
    this.onClickSupercluster = opts?.onClick;
    this.onHoverSupercluster = opts?.onHover;

    this.container.addChild(this.rectMesh.mesh);
    this.container.addChild(this.labelContainer);

    this.hitLayer.eventMode = "static";
    this.hitLayer.cursor = "pointer";
    this.hitLayer.on("pointertap", (e: FederatedPointerEvent) => {
      const id = this.pickAt(e.global.x, e.global.y);
      if (id) this.onClickSupercluster?.(id);
    });
    this.hitLayer.on("pointermove", (e: FederatedPointerEvent) => {
      this.onHoverSupercluster?.(this.pickAt(e.global.x, e.global.y));
    });
    this.hitLayer.on("pointerout", () => this.onHoverSupercluster?.(null));
    this.container.addChild(this.hitLayer);

    parent.addChild(this.container);
  }

  private pickAt(gx: number, gy: number): string | null {
    const local = this.container.toLocal({ x: gx, y: gy });
    return this.pickIndex.pickAt(local.x, local.y);
  }

  private colorForSupercluster(id: string): { fill: number; border: number } {
    const cached = this.colorCache.get(id);
    if (cached !== undefined) return cached;
    // Stable hash → palette index. Same hashing scheme as ClusterNodeRenderer
    // so paired renderings (if we ever show both tiers in a cross-fade) give
    // visually coherent colour choices.
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % SUPERCLUSTER_PALETTE.length;
    const fill = SUPERCLUSTER_PALETTE[idx];
    // Darker sibling (ΔL = 0.2) reads as a border without being harsh.
    const border = darkenHex(fill, 0.2);
    const entry = { fill, border };
    this.colorCache.set(id, entry);
    return entry;
  }

  private acquireLabel(): LabelPair {
    if (this.labelPoolCursor < this.labelPool.length) {
      const pair = this.labelPool[this.labelPoolCursor++];
      pair.name.visible = true;
      pair.meta.visible = true;
      return pair;
    }
    const name = new BitmapText({ text: "", style: { fontFamily: CITY_FONT_BOLD_NAME, fontSize: 11 } });
    const meta = new BitmapText({ text: "", style: { fontFamily: CITY_FONT_BOLD_NAME, fontSize: 11 } });
    this.labelContainer.addChild(name);
    this.labelContainer.addChild(meta);
    const pair: LabelPair = { name, meta };
    this.labelPool.push(pair);
    this.labelPoolCursor = this.labelPool.length;
    return pair;
  }

  private releaseLabels(): void {
    for (let i = this.labelPoolCursor; i < this.labelPool.length; i++) {
      this.labelPool[i].name.visible = false;
      this.labelPool[i].meta.visible = false;
    }
    this.labelPoolCursor = 0;
  }

  update(superclusters: ClusterMeta[], viewport: Viewport): void {
    if (superclusters.length === 0) {
      this.rectMesh.setInstanceCount(0);
      this.hitLayer.clear();
      this.pickRects.length = 0;
      this.pickIndex.clear();
      this.releaseLabels();
      return;
    }
    const invScale = Math.min(16, Math.max(1, 1 / viewport.scale));
    this.rectMesh.ensureCapacity(superclusters.length);
    const data = this.rectMesh.view();
    this.pickRects.length = 0;
    this.labelPoolCursor = 0;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < superclusters.length; i++) {
      const c = superclusters[i];
      const { fill, border } = this.colorForSupercluster(c.id);
      const o = i * FLOATS_PER_INSTANCE;
      data[o] = c.rect.x;
      data[o + 1] = c.rect.y;
      data[o + 2] = c.rect.w;
      data[o + 3] = c.rect.h;
      // Near-opaque fill — at max zoom-out we want these to read as solid
      // architectural blocks, not translucent overlays.
      unpackHexInto(fill, data, o + 4, 0.92);
      unpackHexInto(border, data, o + 8, 1.0);
      data[o + 12] = invScale * 3;    // thicker border than cluster tier
      data[o + 13] = 48;              // chunky corner radius (world px)

      this.pickRects.push({ x: c.rect.x, y: c.rect.y, w: c.rect.w, h: c.rect.h, id: c.id });
      if (c.rect.x < minX) minX = c.rect.x;
      if (c.rect.y < minY) minY = c.rect.y;
      if (c.rect.x + c.rect.w > maxX) maxX = c.rect.x + c.rect.w;
      if (c.rect.y + c.rect.h > maxY) maxY = c.rect.y + c.rect.h;

      // Two-line label: big display name, smaller file-count subtitle. Both
      // pulled from the pool in one shot so we only walk the pool once.
      const { name: nameLabel, meta: metaLabel } = this.acquireLabel();
      const displayName = c.id.split("/").pop() ?? c.id;
      const metaText = `${c.fileCount} files`;
      if (nameLabel.text !== displayName) nameLabel.text = displayName;
      if (metaLabel.text !== metaText) metaLabel.text = metaText;
      nameLabel.scale.set(invScale * 3.5);
      // Subtitle ~55% of the headline — keeps the hierarchy readable without
      // a second font install.
      metaLabel.scale.set(invScale * 2);
      nameLabel.x = c.rect.x + 24 * invScale;
      nameLabel.y = c.rect.y + 24 * invScale;
      // Bitmap atlas is 28px; headline rendered height ≈ 28 * invScale * 3.5.
      // Stacking the subtitle directly beneath adds invScale*6 of vertical
      // gap — tight enough to read as one block.
      metaLabel.x = c.rect.x + 24 * invScale;
      metaLabel.y = nameLabel.y + 28 * invScale * 3.5 + invScale * 6;
    }

    // Single-AABB hit layer — SpatialPickIndex resolves the actual id.
    this.hitLayer.clear();
    this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY).fill({ color: 0x000000, alpha: 0.001 });

    this.rectMesh.setInstanceCount(superclusters.length);
    this.pickIndex.load(this.pickRects, "supercluster");
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

registerRenderer("supercluster", (parent, callbacks): RendererHandle => {
  const inst = new SuperclusterNodeRenderer(parent, {
    onClick: callbacks.onSuperclusterClick,
  });
  return {
    update(ctx: RenderContext): void {
      if (ctx.sceneKind !== "superclusters") return;
      inst.update(ctx.superclusters, ctx.viewport);
    },
    clear(): void { inst.clear(); },
    destroy(): void { inst.destroy(); },
  };
});
