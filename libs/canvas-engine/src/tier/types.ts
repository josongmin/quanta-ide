import type { EntityKind } from "../entity/types";
import type { LodLevel } from "../view/types";
import type { LodRendererKind } from "../lod/lod-config";
import type { EdgeLayer, EdgeSeverity } from "../graph/types";

// TierSpec (apparent-size bands)
// --------------------------------------------------------------------
// Each tier owns a pixel-size band. The active tier is picked by
// asking: "how big is ONE leaf (file card) on screen right now?" —
// `leafWorldSize × cameraScale = apparentPx`. The tier whose band
// contains that apparent-pixel value is the one the scene renders.
//
// Why pixel bands instead of raw camera scale:
//   - With bottom-up layout (see `build-hierarchical-layout.ts`) the
//     world grows with the repo, but the leaf-card world size stays
//     constant. "File card is 40px on screen" means the same thing
//     on a 10-file repo and a 50,000-file repo, so the tier feels
//     consistent across repo sizes without per-repo retuning.
//   - The bands describe *legibility*: below 4px a card is a dot
//     (Universe), between 60–400px the label reads (Building), past
//     that the inside structure is worth showing (Floor/Room).
//
// The ladder is inner → outer (highest apparent-px band last). The
// resolver walks outer → inner so the first tier whose `minPx` is
// reached wins. Hysteresis (stay inside the current band until it's
// crossed out) lives in the consumer store, not here.

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

  /** Apparent-size band lower bound in CSS pixels (inclusive). Once
   *  `leafWorldSize × cameraScale` reaches this, the tier activates. */
  minApparentPx: number;
  /** Apparent-size band upper bound in CSS pixels (exclusive). When
   *  the apparent size crosses above, the next tier takes over. Set to
   *  `Number.POSITIVE_INFINITY` for the innermost tier. */
  maxApparentPx: number;

  /** Tier-local edge rules. `undefined` means "inherit from the
   *  tier above" — the tier ladder resolves this. */
  edgePolicy?: TierEdgePolicy;

  /** Human label for breadcrumbs / HUD. */
  label?: string;
}

/**
 * Ordered ladder, outermost first (smallest apparent-px band first).
 * Inner tiers have higher `minApparentPx` — as the camera zooms in,
 * the leaf card grows on screen and the active tier walks inward.
 */
export type TierLadder = readonly TierSpec[];
