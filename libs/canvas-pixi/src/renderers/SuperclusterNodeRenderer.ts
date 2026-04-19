import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { msdfText } from "./shared/msdf-text";
import type { ClusterMeta, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_BOLD_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";
import { setText, hashStep, hashStringStep, makeGrowingPool, type GrowingPool } from "./shared/pixi-guards";

// Feature flag. When true, supercluster boxes are drawn via InstancedRectMesh
// (one draw call for the whole tier). When false, a legacy Graphics fallback
// runs — kept as a runtime rollback handle and for tests that spy on
// roundRect. Identical pattern to ClusterNodeRenderer.
let SUPER_MESH_ENABLED = true;
/** Toggle the instanced-mesh supercluster box path. Intended for rollback / tests. */
export function setSuperclusterMeshEnabled(enabled: boolean): void {
  SUPER_MESH_ENABLED = enabled;
}
/** Read the current flag — used by tests to guard expectations. */
export function isSuperclusterMeshEnabled(): boolean {
  return SUPER_MESH_ENABLED;
}

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
//
// Optimization pass: labelCache for displayName / metaText reuse + pickRect
// pool + hit-AABB gating. Identical pattern to ClusterNodeRenderer; the
// per-frame string pair is a heavier allocation (two BitmapText writes) so
// the cache hit is worth slightly more here.

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

// Per-supercluster label snapshot. Both strings are cheap individually but
// we walk this loop on every pan/zoom frame; caching the formatted pair
// saves two string allocations × N superclusters × 60 fps.
interface SuperclusterLabelSnapshot {
  id: string;
  fileCount: number;
  displayName: string;
  metaText: string;
}

export class SuperclusterNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;
  // Fallback Graphics path. Always constructed so the feature flag can
  // flip at runtime; only emits geometry when SUPER_MESH_ENABLED is false.
  private fallbackGfx: Graphics;
  private labelContainer: Container;
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  private pickRectsPool: GrowingPool<PickRect> = makeGrowingPool<PickRect>(
    () => ({ x: 0, y: 0, w: 0, h: 0, id: "" }),
  );
  private labelPool: LabelPair[] = [];
  private labelPoolCursor = 0;
  // Stable id → palette index → (fill, border) memo. Keyed by id (not index)
  // so incoming/outgoing supercluster sets keep their colours steady across
  // updates. Reset on destroy().
  private colorCache: Map<string, { fill: number; border: number }> = new Map();
  private labelCache: Map<string, SuperclusterLabelSnapshot> = new Map();
  private lastHitHash = 0;
  private lastHitCount = 0;
  // Full-rebuild dirty flag. Same rationale as ClusterNodeRenderer — folds
  // id+rect+fileCount+invScale bucket so pan-only frames skip the rect loop.
  private lastBuildHash = 0;
  private lastBuildCount = 0;
  private lastInvScaleBucket = -1;
  private lastMeshEnabled = true;

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
    this.fallbackGfx = new Graphics();
    this.fallbackGfx.eventMode = "none";
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();
    this.onClickSupercluster = opts?.onClick;
    this.onHoverSupercluster = opts?.onHover;

    // Mesh and fallback both mounted; only one emits per frame.
    this.container.addChild(this.rectMesh.mesh);
    this.container.addChild(this.fallbackGfx);
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
    // visually coherent colour choices. Routed through hashStringStep so the
    // two renderers agree byte-for-byte on the fold.
    const h = hashStringStep(0, id);
    const idx = Math.abs(h) % SUPERCLUSTER_PALETTE.length;
    const fill = SUPERCLUSTER_PALETTE[idx];
    // Darker sibling (ΔL = 0.2) reads as a border without being harsh.
    const border = darkenHex(fill, 0.2);
    const entry = { fill, border };
    this.colorCache.set(id, entry);
    return entry;
  }

  private getLabelStrings(c: ClusterMeta): { displayName: string; metaText: string } {
    let snap = this.labelCache.get(c.id);
    if (snap && snap.fileCount === c.fileCount) return snap;
    const displayName = c.id.split("/").pop() ?? c.id;
    const metaText = `${c.fileCount} files`;
    if (snap) {
      snap.fileCount = c.fileCount;
      snap.displayName = displayName;
      snap.metaText = metaText;
    } else {
      snap = { id: c.id, fileCount: c.fileCount, displayName, metaText };
      this.labelCache.set(c.id, snap);
    }
    return snap;
  }

  private acquireLabel(): LabelPair {
    if (this.labelPoolCursor < this.labelPool.length) {
      const pair = this.labelPool[this.labelPoolCursor++];
      pair.name.visible = true;
      pair.meta.visible = true;
      return pair;
    }
    const name = msdfText("", 11, undefined, CITY_FONT_BOLD_NAME);
    const meta = msdfText("", 11, undefined, CITY_FONT_BOLD_NAME);
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
      this.fallbackGfx.clear();
      this.hitLayer.clear();
      // Use the pool's canonical reset() rather than poking .slots.length
      // directly — direct truncation leaves capacity intact, which would
      // leave stale slot objects unreachable on the next grow() call.
      this.pickRectsPool.reset();
      this.pickIndex.clear();
      this.releaseLabels();
      this.lastHitHash = 0;
      this.lastHitCount = 0;
      this.lastBuildHash = 0;
      this.lastBuildCount = 0;
      this.lastInvScaleBucket = -1;
      return;
    }
    const invScale = Math.min(16, Math.max(1, 1 / viewport.scale));
    // Bucket invScale so sub-pixel zoom jitter doesn't invalidate the gate.
    const invScaleBucket = Math.round(invScale * 2);

    // Pre-pass: accumulate geometry/membership hash + AABB. Everything the
    // rect buffer or label loop reads gets folded in so an unchanged frame
    // short-circuits below.
    let buildHash = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < superclusters.length; i++) {
      const c = superclusters[i];
      buildHash = hashStringStep(buildHash, c.id);
      buildHash = hashStep(buildHash, c.rect.x | 0);
      buildHash = hashStep(buildHash, c.rect.y | 0);
      buildHash = hashStep(buildHash, c.rect.w | 0);
      buildHash = hashStep(buildHash, c.rect.h | 0);
      buildHash = hashStep(buildHash, c.fileCount);
      if (c.rect.x < minX) minX = c.rect.x;
      if (c.rect.y < minY) minY = c.rect.y;
      if (c.rect.x + c.rect.w > maxX) maxX = c.rect.x + c.rect.w;
      if (c.rect.y + c.rect.h > maxY) maxY = c.rect.y + c.rect.h;
    }

    const meshEnabled = SUPER_MESH_ENABLED;
    if (
      buildHash === this.lastBuildHash
      && superclusters.length === this.lastBuildCount
      && invScaleBucket === this.lastInvScaleBucket
      && meshEnabled === this.lastMeshEnabled
    ) {
      // Pan-only frame. Parent Container transform absorbs the visual pan;
      // nothing the draw loop produces would differ.
      return;
    }

    this.rectMesh.ensureCapacity(superclusters.length);
    const data = meshEnabled ? this.rectMesh.view() : null;
    if (!meshEnabled) this.fallbackGfx.clear();
    this.pickRectsPool.grow(superclusters.length);
    const pickRects = this.pickRectsPool.slots;
    this.labelPoolCursor = 0;

    const borderWidth = invScale * 3;
    const CORNER_RADIUS = 48;
    const FILL_ALPHA = 0.92;
    const BORDER_ALPHA = 1.0;

    for (let i = 0; i < superclusters.length; i++) {
      const c = superclusters[i];
      const { fill, border } = this.colorForSupercluster(c.id);
      if (meshEnabled && data) {
        const o = i * FLOATS_PER_INSTANCE;
        data[o] = c.rect.x;
        data[o + 1] = c.rect.y;
        data[o + 2] = c.rect.w;
        data[o + 3] = c.rect.h;
        // Near-opaque fill — at max zoom-out we want these to read as solid
        // architectural blocks, not translucent overlays.
        unpackHexInto(fill, data, o + 4, FILL_ALPHA);
        unpackHexInto(border, data, o + 8, BORDER_ALPHA);
        data[o + 12] = borderWidth;      // thicker border than cluster tier
        data[o + 13] = CORNER_RADIUS;    // chunky corner radius (world px)
      } else {
        // Legacy Graphics path — kept visually equivalent so a flag flip
        // is a pure perf tradeoff.
        this.fallbackGfx
          .roundRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h, CORNER_RADIUS)
          .fill({ color: fill, alpha: FILL_ALPHA })
          .stroke({ color: border, alpha: BORDER_ALPHA, width: borderWidth });
      }

      const slot = pickRects[i];
      slot.x = c.rect.x;
      slot.y = c.rect.y;
      slot.w = c.rect.w;
      slot.h = c.rect.h;
      slot.id = c.id;

      // Two-line label: big display name, smaller file-count subtitle. Both
      // pulled from the pool in one shot so we only walk the pool once.
      const { name: nameLabel, meta: metaLabel } = this.acquireLabel();
      const { displayName, metaText } = this.getLabelStrings(c);
      setText(nameLabel, displayName);
      setText(metaLabel, metaText);
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

    pickRects.length = superclusters.length;

    // Single-AABB hit layer — SpatialPickIndex resolves the actual id.
    // Re-use buildHash for AABB change detection (same membership/geometry
    // inputs drive both).
    if (buildHash !== this.lastHitHash || superclusters.length !== this.lastHitCount) {
      this.hitLayer.clear();
      this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY).fill({ color: 0x000000, alpha: 0.001 });
      this.lastHitHash = buildHash;
      this.lastHitCount = superclusters.length;
    }

    // Clamp to zero when the flag is off so stale buffer contents can't paint.
    this.rectMesh.setInstanceCount(meshEnabled ? superclusters.length : 0);
    this.pickIndex.load(pickRects, "supercluster");
    this.releaseLabels();

    this.lastBuildHash = buildHash;
    this.lastBuildCount = superclusters.length;
    this.lastInvScaleBucket = invScaleBucket;
    this.lastMeshEnabled = meshEnabled;
  }

  clear(): void {
    this.rectMesh.setInstanceCount(0);
    this.fallbackGfx.clear();
    this.hitLayer.clear();
    this.pickRectsPool.reset();
    this.pickIndex.clear();
    this.labelPoolCursor = 0;
    this.releaseLabels();
    this.labelCache.clear();
    this.lastHitHash = 0;
    this.lastHitCount = 0;
    this.lastBuildHash = 0;
    this.lastBuildCount = 0;
    this.lastInvScaleBucket = -1;
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRectsPool.reset();
    this.colorCache.clear();
    this.labelCache.clear();
    this.container.destroy({ children: true });
  }
}

registerRenderer("supercluster", (parent, callbacks): RendererHandle => {
  const inst = new SuperclusterNodeRenderer(parent, {
    onClick: callbacks.onSuperclusterClick,
    onHover: callbacks.onSuperclusterHover,
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
