import { BitmapText, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { ClusterMeta, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { CITY_FONT_BOLD_NAME, installCityFonts } from "./shared/BitmapFontAtlas";
import { msdfText } from "./shared/msdf-text";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";
import { registerRenderer, type RendererHandle, type RenderContext } from "./shared/renderer-registry";
import { setText, hashStep, hashStringStep, makeGrowingPool, type GrowingPool } from "./shared/pixi-guards";

// Feature flag. When true, cluster boxes are drawn via InstancedRectMesh
// (one draw call for hundreds of boxes). When false, the legacy Graphics
// fallback path runs — kept as a runtime rollback handle in case the mesh
// shader misbehaves on a given GPU, and to let unit tests spy on roundRect.
let CLUSTER_MESH_ENABLED = true;
/** Toggle the instanced-mesh cluster box path. Intended for rollback / tests. */
export function setClusterMeshEnabled(enabled: boolean): void {
  CLUSTER_MESH_ENABLED = enabled;
}
/** Read the current flag — used by tests to guard expectations. */
export function isClusterMeshEnabled(): boolean {
  return CLUSTER_MESH_ENABLED;
}

// Supergalaxy LOD renderer — draws one soft-coloured box per top-level
// directory / crate. There are at most a couple hundred of these, so the
// cost model flips: we can afford BitmapText labels for every cluster.
// Single InstancedRectMesh + one labelContainer per cluster.
//
// Optimization pass (Stream-C dirty-flag parity with CityNodeRenderer):
// - `labelCache` snapshots the cluster id / fileCount pair; per-frame we
//   only rebuild the display string when that pair changes.
// - `setFontSize` / `setFill` / `setText` gates avoid BitmapText atlas
//   thrash when nothing changed (pan/zoom frames get a free pass).
// - `pickRects` pool allocates once and overwrites slots in place.
// - `lastBuildHash` / `lastInvScaleBucket` gate the entire rebuild loop:
//   when membership + geometry + zoom bucket match the previous frame,
//   we skip the N-cluster rect write and label repositioning entirely
//   (pan frames ride the parent Container transform for free).

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

// Per-cluster cached label state. displayText is expensive-ish to allocate
// (string split + template literal + number coerce) and we'd otherwise redo
// it for every cluster on every pan/zoom frame. fileCount is the only real
// invalidator — cluster id is stable, and the scene layout doesn't call
// update() unless the set itself changed.
interface ClusterLabelSnapshot {
  id: string;
  fileCount: number;
  displayText: string;
}

export class ClusterNodeRenderer {
  private container: Container;
  private rectMesh: InstancedRectMesh;
  // Fallback Graphics path. Always constructed so the feature flag can
  // flip at runtime without re-mounting the renderer. Only emits geometry
  // when CLUSTER_MESH_ENABLED is false.
  private fallbackGfx: Graphics;
  private labelContainer: Container;
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  // Pool-allocated pick rects. See pixi-guards.makeGrowingPool for the
  // allocation / truncation protocol.
  private pickRectsPool: GrowingPool<PickRect> = makeGrowingPool<PickRect>(
    () => ({ x: 0, y: 0, w: 0, h: 0, id: "" }),
  );
  private labelPool: BitmapText[] = [];
  private labelPoolCursor = 0;
  // Cluster ids are stable across frames; hashing the same id every frame
  // for 200+ clusters is wasted work. Memoize per instance — reset on
  // destroy() (module-level cache would leak across canvas remounts).
  private colorCache: Map<string, number> = new Map();
  // Per-cluster dirty-flag cache for label text. The cluster set rarely
  // changes in practice (users pan/zoom around supergalaxy a lot more than
  // they add crates), so this is almost always a cache hit.
  private labelCache: Map<string, ClusterLabelSnapshot> = new Map();
  // Shared membership + geometry hash for the hit AABB. The AABB itself
  // only needs re-drawing when membership or layout changes — pan/zoom is
  // absorbed by the parent Container transform.
  private lastHitHash = 0;
  private lastHitCount = 0;
  // Full-rebuild dirty-flag. Folds cluster ids + rects + fileCount + the
  // per-frame invScale bucket (controls border width and label scale). When
  // every input matches the previous frame we skip the rect-buffer write,
  // the label loop, and the pick-index load. Separate from `lastHitHash`:
  // the hit AABB depends only on membership/geometry, not on zoom.
  private lastBuildHash = 0;
  private lastBuildCount = 0;
  private lastInvScaleBucket = -1;
  // Track last flag value so a runtime toggle forces a full rebuild: the
  // mesh path and Graphics path emit visually equivalent but structurally
  // different commands, so we must invalidate the gate.
  private lastMeshEnabled = true;

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
    this.fallbackGfx = new Graphics();
    this.fallbackGfx.eventMode = "none";
    this.labelContainer = new Container();
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();
    this.onClickCluster = opts?.onClick;
    this.onHoverCluster = opts?.onHover;

    // Mesh and fallback both mounted; only one emits geometry per frame.
    // Keeping both in the tree lets setClusterMeshEnabled() flip instantly.
    this.container.addChild(this.rectMesh.mesh);
    this.container.addChild(this.fallbackGfx);
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
    // look related when the user zooms in/out quickly. Route through the
    // canonical hashStringStep so every renderer folds strings identically.
    const h = hashStringStep(0, id);
    const hue = (h & 0xffff) / 0xffff; // 0..1
    // Map hue into a soft pastel (HSL with high L, moderate S)
    const color = hslToRgb(hue, 0.45, 0.85);
    this.colorCache.set(id, color);
    return color;
  }

  // Acquire-or-reuse the label snapshot for a cluster. Returns the display
  // text unconditionally; internally decides whether to reformat or reuse.
  private getLabelText(c: ClusterMeta): string {
    let snap = this.labelCache.get(c.id);
    if (snap && snap.fileCount === c.fileCount) return snap.displayText;
    const name = c.id.split("/").pop() ?? c.id;
    const displayText = `${name}  ${c.fileCount}`;
    if (snap) {
      snap.fileCount = c.fileCount;
      snap.displayText = displayText;
    } else {
      snap = { id: c.id, fileCount: c.fileCount, displayText };
      this.labelCache.set(c.id, snap);
    }
    return displayText;
  }

  private acquireLabel(): BitmapText {
    if (this.labelPoolCursor < this.labelPool.length) {
      const t = this.labelPool[this.labelPoolCursor++];
      t.visible = true;
      return t;
    }
    const t = msdfText("", 11, undefined, CITY_FONT_BOLD_NAME);
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
    // Matches StartHereBadgeRenderer's scheme — granular enough that the
    // border width / label scale stay pixel-stable across bucket boundaries.
    const invScaleBucket = Math.round(invScale * 2);

    // Pre-pass hash. Covers everything writeRow / setInstance / label loop
    // reads: per-cluster id, fileCount (label text), rect (mesh geometry),
    // and the invScale bucket (border width + label scale). The flag
    // switch is funneled in separately via `lastMeshEnabled` below so a
    // runtime toggle forces a rebuild even when everything else matches.
    let buildHash = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
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

    const meshEnabled = CLUSTER_MESH_ENABLED;
    if (
      buildHash === this.lastBuildHash
      && clusters.length === this.lastBuildCount
      && invScaleBucket === this.lastInvScaleBucket
      && meshEnabled === this.lastMeshEnabled
    ) {
      // Nothing touched by the draw loop has changed — pan-only frames land
      // here and skip the full rect/label walk. The parent Container
      // transform does the visual panning for free.
      return;
    }

    this.rectMesh.ensureCapacity(clusters.length);
    const data = meshEnabled ? this.rectMesh.view() : null;
    // Graphics fallback emits geometry imperatively; clear once per rebuild.
    if (!meshEnabled) this.fallbackGfx.clear();
    // Pre-grow the pick-rect pool so the loop overwrites slots in place
    // instead of pushing fresh `{x,y,w,h,id}` literals per cluster.
    this.pickRectsPool.grow(clusters.length);
    const pickRects = this.pickRectsPool.slots;
    this.labelPoolCursor = 0;

    const borderWidth = invScale * 1.5;
    const CORNER_RADIUS = 24;
    const FILL_ALPHA = 0.85;
    const BORDER_COLOR = 0x4b5563;
    const BORDER_ALPHA = 0.55;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const fill = this.colorForCluster(c.id);
      if (meshEnabled && data) {
        const o = i * FLOATS_PER_INSTANCE;
        data[o] = c.rect.x;
        data[o + 1] = c.rect.y;
        data[o + 2] = c.rect.w;
        data[o + 3] = c.rect.h;
        unpackHexInto(fill, data, o + 4, FILL_ALPHA);
        unpackHexInto(BORDER_COLOR, data, o + 8, BORDER_ALPHA);
        data[o + 12] = borderWidth;
        data[o + 13] = CORNER_RADIUS;
      } else {
        // Legacy Graphics path — kept visually equivalent to the mesh so a
        // flag flip is a pure performance tradeoff, not a style regression.
        this.fallbackGfx
          .roundRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h, CORNER_RADIUS)
          .fill({ color: fill, alpha: FILL_ALPHA })
          .stroke({ color: BORDER_COLOR, alpha: BORDER_ALPHA, width: borderWidth });
      }

      const slot = pickRects[i];
      slot.x = c.rect.x;
      slot.y = c.rect.y;
      slot.w = c.rect.w;
      slot.h = c.rect.h;
      slot.id = c.id;

      // Label (cluster name) — shown centered near top, scaled to viewport.
      // Style is established at BitmapText construction; we only need to
      // push per-frame text / scale / position. Guarded text setter skips
      // the glyph-geometry rebuild when the string hasn't changed.
      const label = this.acquireLabel();
      const displayText = this.getLabelText(c);
      setText(label, displayText);
      label.scale.set(invScale * 2);
      label.x = c.rect.x + 16 * invScale;
      label.y = c.rect.y + 16 * invScale;
    }

    // Truncate logical length for SpatialPickIndex; retain capacity.
    pickRects.length = clusters.length;

    // Hit AABB gate — membership/geometry only, no zoom dependency.
    // Re-use buildHash (id+rect+fileCount) for the change detection.
    if (buildHash !== this.lastHitHash || clusters.length !== this.lastHitCount) {
      this.hitLayer.clear();
      this.hitLayer.rect(minX, minY, maxX - minX, maxY - minY).fill({ color: 0x000000, alpha: 0.001 });
      this.lastHitHash = buildHash;
      this.lastHitCount = clusters.length;
    }

    // When the flag is off we must clamp the mesh to zero instances so the
    // GPU doesn't double-paint boxes via stale buffer contents.
    this.rectMesh.setInstanceCount(meshEnabled ? clusters.length : 0);
    this.pickIndex.load(pickRects, "cluster");
    this.releaseLabels();

    this.lastBuildHash = buildHash;
    this.lastBuildCount = clusters.length;
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
    // Invalidate dirty-flag caches so a fresh tier activation doesn't
    // inherit stale snapshots.
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

registerRenderer("cluster", (parent, callbacks): RendererHandle => {
  const inst = new ClusterNodeRenderer(parent, {
    onClick: callbacks.onClusterClick,
    onHover: callbacks.onClusterHover,
  });
  return {
    update(ctx: RenderContext): void {
      if (ctx.sceneKind !== "clusters") return;
      inst.update(ctx.clusters, ctx.viewport);
    },
    clear(): void { inst.clear(); },
    destroy(): void { inst.destroy(); },
  };
});
