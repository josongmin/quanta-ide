import { Graphics, Container } from "pixi.js";
import { mixHex } from "@quanta/canvas-engine";
import {
  DEFAULT_ISO_CONFIG,
  projectIso,
  type IsoConfig,
} from "./iso-projection";

// Iso blast/fix cone — shows impact propagation rising upward (red)
// from a root file, or downstream fix fan-out sinking (cyan) toward
// the root. Without parent/child edges in the input we approximate
// the cone sweep by chaining: root → ring-1 nodes → ring-2 nearest
// ring-1 neighbour, and so on. Acceptable for a visualization cue.

export interface IsoConeRing {
  /** 1..maxDepth — determines z-offset and line tint. */
  depth: number;
  nodes: readonly { x: number; y: number; fileId: string }[];
}

export interface IsoConeInput {
  root: { x: number; y: number };
  rings: readonly IsoConeRing[];
  /** blast → red/up, fix → cyan/down. */
  direction: "blast" | "fix";
}

/** World-z step per ring depth. 25 reads clearly against the
 *  terrain column height (~180 max) without clashing at depth 5+. */
const Z_PER_DEPTH = 25;

/** Dot radius baseline, plus a small "closer rings are fatter" bonus. */
const BASE_DOT_RADIUS = 6;
const DEPTH_DOT_BONUS = 3;

const LINE_WIDTH = 2;
const LINE_ALPHA = 0.65;

const COLOR_BLAST = 0xef4444; // red-500
const COLOR_FIX = 0x22d3ee;   // cyan-400

export class IsoConeRenderer {
  private gfx: Graphics;

  constructor(world: Container) {
    this.gfx = new Graphics();
    world.addChild(this.gfx);
  }

  build(input: IsoConeInput, cfg: IsoConfig = DEFAULT_ISO_CONFIG): void {
    this.gfx.clear();
    if (input.rings.length === 0) return;

    const dirSign = input.direction === "blast" ? 1 : -1;
    const baseColor = input.direction === "blast" ? COLOR_BLAST : COLOR_FIX;

    // Sort rings by depth ascending so "nearest previous ring" lookup
    // during line drawing always has the shallower layer available.
    const rings = [...input.rings].sort((a, b) => a.depth - b.depth);
    const maxDepth = rings[rings.length - 1]?.depth ?? 1;

    // Cache projected positions per ring so we don't reproject when
    // connecting depth-N to depth-(N-1).
    const projectedByDepth = new Map<number, { x: number; y: number; fileId: string }[]>();

    // Root is z=0, so projecting is a no-op — kept explicit for clarity.
    const rootP = projectIso(input.root.x, input.root.y, 0, cfg);

    // Pass 1: connector lines (drawn first so dots paint on top).
    for (const ring of rings) {
      const z = dirSign * ring.depth * Z_PER_DEPTH;
      const projected = ring.nodes.map((n) => {
        const p = projectIso(n.x, n.y, z, cfg);
        return { x: p.x, y: p.y, fileId: n.fileId };
      });
      projectedByDepth.set(ring.depth, projected);

      const depthFactor = ring.depth / Math.max(1, maxDepth);
      // Fade the line color toward black as depth grows so the cone
      // reads as receding. Blast goes darker-red, fix goes darker-cyan.
      const lineColor = mixHex(baseColor, 0x000000, depthFactor * 0.5);

      if (ring.depth === 1) {
        // Depth-1: connect each node back to the root.
        for (const p of projected) {
          this.gfx
            .moveTo(rootP.x, rootP.y)
            .lineTo(p.x, p.y)
            .stroke({ color: lineColor, alpha: LINE_ALPHA, width: LINE_WIDTH });
        }
      } else {
        // Depth N: connect each node to the nearest node at depth N-1.
        // No parent info in input, so nearest-neighbour is the best we
        // can do; it still gives a readable fan shape.
        const parents = projectedByDepth.get(ring.depth - 1);
        if (parents && parents.length > 0) {
          for (const p of projected) {
            let nearest = parents[0];
            let nearestDist = Math.hypot(nearest.x - p.x, nearest.y - p.y);
            for (let i = 1; i < parents.length; i++) {
              const cand = parents[i];
              const d = Math.hypot(cand.x - p.x, cand.y - p.y);
              if (d < nearestDist) {
                nearest = cand;
                nearestDist = d;
              }
            }
            this.gfx
              .moveTo(nearest.x, nearest.y)
              .lineTo(p.x, p.y)
              .stroke({ color: lineColor, alpha: LINE_ALPHA, width: LINE_WIDTH });
          }
        }
      }
    }

    // Pass 2: solid dots on top of lines.
    for (const ring of rings) {
      const projected = projectedByDepth.get(ring.depth);
      if (!projected) continue;
      const depthInverse = 1 - (ring.depth - 1) / Math.max(1, maxDepth);
      const radius = BASE_DOT_RADIUS + DEPTH_DOT_BONUS * depthInverse;
      // Closer rings lean toward the pure cone color; deeper rings
      // lean darker so the eye can tell the depth apart at a glance.
      const depthFactor = ring.depth / Math.max(1, maxDepth);
      const dotColor = mixHex(baseColor, 0x000000, depthFactor * 0.35);
      for (const p of projected) {
        this.gfx.circle(p.x, p.y, radius).fill({ color: dotColor, alpha: 0.9 });
      }
    }

    // Root marker — slightly larger ring in the base color so it reads
    // as "origin".
    this.gfx.circle(rootP.x, rootP.y, BASE_DOT_RADIUS + DEPTH_DOT_BONUS)
      .fill({ color: baseColor, alpha: 1 });
  }

  clear(): void {
    this.gfx.clear();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
