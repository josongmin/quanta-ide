import type { EntityKind } from "../entity/types";
import type { LodLevel } from "../view/types";
import type { LodRendererKind } from "../lod/lod-config";
import type { EdgeLayer, EdgeSeverity } from "../graph/types";

// TierSpec
// --------------------------------------------------------------------
// Contract bundling everything that distinguishes one zoom tier from
// another: which entity kind is the "main" unit, which renderer paints
// it, what edge policy applies, and the zoom thresholds that activate
// the tier.
//
// Relationship to the existing `LodTierConfig`:
//   - The legacy LOD ladder (`ground`/`street`/`city`/…) targets file
//     rendering at different zooms — same FileNode, different chrome.
//   - `TierSpec` targets the NEW presentation where each tier has its
//     own entity kind. Scale math (upThreshold/downThreshold) is the
//     same; the extra fields (`visibleKind`, `edgePolicy`) are what
//     drives the per-tier scene projection and rollup.
//   - A product is free to pick one ladder or the other. The legacy
//     workspace-canvas uses LodTierConfig; code-universe uses
//     TierSpec.
//
// Renderer dispatch still goes through `canvas-pixi`'s renderer
// registry keyed by `rendererKind`. A tier's renderer reads the
// tier's projected scene (Entity list + tier-local edges) instead of
// the full `WorkspaceGraph`.
export interface TierEdgePolicy {
  /** Per-layer visibility. Missing layer = default (visible). */
  layers?: Partial<Record<EdgeLayer, boolean>>;
  /** Drop edges below this severity. */
  minSeverity?: EdgeSeverity;
}

export interface TierSpec {
  /** Tier id — reuses `LodLevel` so the existing LOD manager / camera
   *  math works unchanged. */
  name: LodLevel;

  /** The entity kind that is the visible "main unit" at this tier.
   *  Tier-switch animations hand off between consecutive kinds. */
  visibleKind: EntityKind;

  /** Keyed into `canvas-pixi`'s renderer registry. */
  rendererKind: LodRendererKind;

  /** Zoom thresholds. Entering: scale >= upThreshold. Exiting (hysteresis):
   *  scale < downThreshold. Same semantics as the legacy ladder. */
  upThreshold: number;
  downThreshold: number;

  /** Tier-local edge rules. `undefined` means "inherit from the
   *  tier above" — the tier ladder resolves this. */
  edgePolicy?: TierEdgePolicy;

  /** Human label for breadcrumbs / HUD. */
  label?: string;
}

/**
 * Ordered ladder, outermost first. The consumer (zoom-to-tier logic)
 * walks the array linearly — it does NOT binary-search by threshold
 * because the ladder is short (≤8) and the linear scan is inlinable.
 */
export type TierLadder = readonly TierSpec[];
