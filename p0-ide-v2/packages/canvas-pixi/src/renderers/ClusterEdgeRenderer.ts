import { Graphics, Container } from "pixi.js";
import type { ClusterEdge, Viewport } from "@quanta/canvas-engine";
import { resolveEdgeStyle } from "./shared/colors";

// Supergalaxy-tier edge renderer — draws directional super-edges between
// clusters that were aggregated by `aggregateClusterEdges`. Purpose: give
// the user a one-glance feel for cross-module dependency strength
// (CodeCity / Sourcetrail hi-zoom convention) without dropping 5000+
// per-file edges on the GPU.
//
// Direct-mount (not self-registered): cluster edges are meaningful only
// in tandem with `ClusterNodeRenderer` at the supergalaxy tier. The
// registry keys tiers by single `LodRendererKind`, but cluster-nodes +
// cluster-edges are two strokes of the same tier. Keeping them as
// independent renderers and mounting both from PixiStage at supergalaxy
// keeps the registry 1-kind-1-renderer invariant intact.
//
// Visual model mirrors `EdgeStaticRenderer` — Graphics clear+replay per
// frame is the bottleneck only when the bucket count is huge, and the
// aggregator collapses ~5k file edges into at most O(C^2 * K) super-edges
// (for C=140 clusters × K=19 kinds that's 372k worst-case, but typical
// realized counts sit in the 100-2000 range because most cluster pairs
// share zero edges). clear+replay is fine at this size.

/** Minimum underlying-edge count that triggers the halo pass. Tuned so
 *  only a handful of "backbone" super-edges glow, keeping the rest readable. */
const HALO_COUNT_THRESHOLD = 10;

/** Base width is scaled by `log(count + 1) * BASE_WIDTH_MUL * invScale`. */
const BASE_WIDTH_MUL = 1.4;

/** Halo = second stroke pass at this multiple of the primary width, very low alpha. */
const HALO_WIDTH_MUL = 3.0;
const HALO_ALPHA = 0.18;

export class ClusterEdgeRenderer {
  private gfx: Graphics;
  private previousLength = 0;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    // Behind cluster boxes so the box outline reads as the foreground.
    parent.addChildAt(this.gfx, 0);
  }

  update(edges: readonly ClusterEdge[], viewport: Viewport): void {
    if (edges.length === 0 && this.previousLength === 0) return;

    const scale = viewport.scale;
    // Same scale-independence trick as EdgeStaticRenderer — stroke stays
    // legible at the super-zoom-out where supergalaxy lives.
    const invScale = Math.min(48, Math.max(1, 1 / scale));

    this.gfx.clear();
    let drawn = 0;

    // Two passes: halo first (wider, low alpha) so primary strokes render
    // on top and stay crisp. Skipped entirely when no edge clears the
    // threshold — the common case for small graphs.
    for (const edge of edges) {
      if (edge.count < HALO_COUNT_THRESHOLD) continue;
      const route = edge.route;
      if (!route) continue;
      const style = resolveEdgeStyle({
        kind: edge.kind,
        layer: edge.layer,
        severity: edge.maxSeverity,
      });
      const width = Math.log(edge.count + 1) * BASE_WIDTH_MUL * invScale * HALO_WIDTH_MUL;
      this.gfx
        .moveTo(route.x1, route.y1)
        .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
        .stroke({ color: style.color, alpha: HALO_ALPHA, width, cap: "round", pixelLine: false });
    }

    for (const edge of edges) {
      const route = edge.route;
      if (!route) continue;
      const style = resolveEdgeStyle({
        kind: edge.kind,
        layer: edge.layer,
        severity: edge.maxSeverity,
      });
      // log-scaled width: count=1 → ~0.69 * baseMul, count=100 → ~4.6 * baseMul.
      // Keeps a 100× disparity in underlying edge count from becoming a 100×
      // stroke-width disparity (which would drown out small connections).
      const width = Math.log(edge.count + 1) * BASE_WIDTH_MUL * invScale;
      // Bump alpha slightly above the per-file default — super-edges
      // represent many connections, so they should read more solidly.
      const alpha = Math.min(1, style.alpha + 0.15);
      this.gfx
        .moveTo(route.x1, route.y1)
        .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
        .stroke({ color: style.color, alpha, width, cap: "round", pixelLine: false });
      drawn++;
    }
    this.previousLength = drawn;
  }

  clear(): void {
    if (this.previousLength === 0) return;
    this.gfx.clear();
    this.previousLength = 0;
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
