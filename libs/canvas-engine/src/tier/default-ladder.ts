import type { TierLadder, TierSpec } from "./types";

// Default ladder for the Code Universe presentation.
// --------------------------------------------------------------------
// Bands are apparent pixel sizes of ONE leaf (file card) on screen.
// Reference constant: `LEAF_WORLD_WIDTH` (= `FILE_CARD_W` = 560 world
// units). The resolver computes `apparentPx = LEAF_WORLD_WIDTH ×
// cameraScale`, then picks the band containing that value. Because
// the leaf world size is fixed, the tier feels the same on a 10-file
// repo and a 50,000-file repo — repo size changes world size, not
// leaf size.
//
// `visibleKind` is what distinguishes each tier:
//   - universe:   the workspace as a single constellation of galaxies
//   - galaxy:     packages (one tile per top-level dir)
//   - street:     directories inside a package (treemap within galaxy tile)
//   - building:   files (one card per file)
//   - floor:      classes/modules inside a file (function blocks)
//   - room:       individual functions (body + call edges)
//
// Edge policy tightens progressively outward: at Universe only
// safety-critical edges read (anything else is noise at that density);
// at Room everything is on because the reader is inspecting source.

const UNIVERSE: TierSpec = {
  name: "universe",
  visibleKind: "universe",
  rendererKind: "supercluster",
  minApparentPx: 0,
  maxApparentPx: 4,
  edgePolicy: { minSeverity: "critical" },
  label: "Universe",
};

const GALAXY: TierSpec = {
  name: "supergalaxy",
  visibleKind: "galaxy",
  rendererKind: "cluster",
  minApparentPx: 4,
  maxApparentPx: 20,
  edgePolicy: { minSeverity: "high" },
  label: "Galaxy",
};

const STREET: TierSpec = {
  name: "galaxy",
  visibleKind: "street",
  rendererKind: "galaxy",
  minApparentPx: 20,
  maxApparentPx: 80,
  edgePolicy: { minSeverity: "high", layers: { structural: false, flow: false } },
  label: "Street",
};

const BUILDING: TierSpec = {
  name: "city",
  visibleKind: "building",
  rendererKind: "city",
  minApparentPx: 80,
  maxApparentPx: 400,
  edgePolicy: { minSeverity: "medium", layers: { flow: false } },
  label: "Building",
};

const FLOOR: TierSpec = {
  name: "street",
  visibleKind: "floor",
  rendererKind: "street",
  minApparentPx: 400,
  maxApparentPx: 1600,
  edgePolicy: { minSeverity: "low" },
  label: "Floor",
};

const ROOM: TierSpec = {
  name: "ground",
  visibleKind: "room",
  rendererKind: "ground",
  minApparentPx: 1600,
  maxApparentPx: Number.POSITIVE_INFINITY,
  edgePolicy: { minSeverity: "low" },
  label: "Room",
};

export const DEFAULT_TIER_LADDER: TierLadder = [
  UNIVERSE,
  GALAXY,
  STREET,
  BUILDING,
  FLOOR,
  ROOM,
];

/**
 * Look up the tier whose apparent-pixel band contains the current
 * leaf-card apparent size. Walks the ladder inner → outer and returns
 * the first tier whose `minApparentPx` is satisfied.
 *
 * @param ladder          The tier ladder (outermost first).
 * @param leafWorldSize   World-space size of a leaf (file card). Constant
 *                        across a session — pass `LEAF_WORLD_WIDTH` from
 *                        the layout module.
 * @param cameraScale     Current camera pixels-per-world-unit.
 */
export function resolveTierByApparentSize(
  ladder: TierLadder,
  leafWorldSize: number,
  cameraScale: number,
): TierSpec {
  const apparentPx = leafWorldSize * cameraScale;
  // Inner-first walk: innermost tier's `minApparentPx` is the largest,
  // so the first tier whose bound is reached is the correct pick.
  for (let i = ladder.length - 1; i >= 0; i--) {
    const spec = ladder[i];
    if (!spec) continue;
    if (apparentPx >= spec.minApparentPx) return spec;
  }
  const first = ladder[0];
  if (!first) throw new Error("empty tier ladder");
  return first;
}

/** Compute the apparent pixel size for a given leaf world size and
 *  camera scale. Exposed for callers that need to show the current
 *  apparent size in UI (debug HUD, tooltip). */
export function apparentPxFor(leafWorldSize: number, cameraScale: number): number {
  return leafWorldSize * cameraScale;
}

/** Inverse of `apparentPxFor` — given a target apparent pixel value,
 *  return the camera scale that produces it. Used by `jumpToTier` to
 *  seed a sensible camera scale when snapping to a named tier. */
export function scaleForApparentPx(leafWorldSize: number, apparentPx: number): number {
  if (leafWorldSize <= 0) return 1;
  return apparentPx / leafWorldSize;
}
