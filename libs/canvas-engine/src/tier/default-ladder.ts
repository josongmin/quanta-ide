import type { TierLadder, TierSpec } from "./types";

// Default ladder for the Code Universe presentation.
//
// Thresholds are cloned from the legacy `LOD_TIERS` (lod-config.ts)
// because the user's zoom muscle memory should not change when they
// switch between legacy workspace-canvas and the new code-universe.
// Any retuning happens here, not at renderer sites — the app reads
// thresholds from the ladder, not from magic numbers.
//
// `visibleKind` is what distinguishes each tier:
//   - universe:   the workspace as a single constellation of galaxies
//   - galaxy:     packages (one tile per top-level dir)
//   - street:     directories inside a package (treemap within galaxy tile)
//   - building:   files (one card per file, with blame + source preview)
//   - floor:      classes/modules inside a file (function groups)
//   - room:       individual functions (deep inspection + edit)
//
// Edge policy defaults progressively: universe shows only
// safety+impact at high severity (sparse, legible); floor/room show
// everything (the user asked for detail). Individual tiers can
// override via their `edgePolicy` field.

const UNIVERSE: TierSpec = {
  name: "universe",
  visibleKind: "universe",
  rendererKind: "supercluster",
  upThreshold: 0.015,
  downThreshold: 0.008,
  edgePolicy: { minSeverity: "critical" },
  label: "Universe",
};

const GALAXY: TierSpec = {
  name: "supergalaxy",
  visibleKind: "galaxy",
  rendererKind: "cluster",
  upThreshold: 0.07,
  downThreshold: 0.015,
  edgePolicy: { minSeverity: "high" },
  label: "Galaxy",
};

const STREET: TierSpec = {
  name: "galaxy",
  visibleKind: "street",
  rendererKind: "galaxy",
  upThreshold: 0.10,
  downThreshold: 0.07,
  edgePolicy: { minSeverity: "high", layers: { structural: false, flow: false } },
  label: "Street",
};

const BUILDING: TierSpec = {
  name: "city",
  visibleKind: "building",
  rendererKind: "city",
  upThreshold: 0.13,
  downThreshold: 0.10,
  edgePolicy: { minSeverity: "medium", layers: { flow: false } },
  label: "Building",
};

const FLOOR: TierSpec = {
  name: "street",
  visibleKind: "floor",
  rendererKind: "street",
  upThreshold: 0.70,
  downThreshold: 0.13,
  edgePolicy: { minSeverity: "low" },
  label: "Floor",
};

const ROOM: TierSpec = {
  name: "ground",
  visibleKind: "room",
  rendererKind: "ground",
  upThreshold: Number.POSITIVE_INFINITY,
  downThreshold: 0.70,
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
 * Look up a tier by the active viewport scale. Walks the ladder
 * inner → outer (room → universe) and returns the first tier whose
 * band contains `scale` (scale >= downThreshold). The innermost
 * tier's `upThreshold` is `+Infinity`, so any high scale falls into
 * it. Hysteresis is the caller's job (feed `currentTier` back in
 * and only switch when the *other* side's threshold is crossed).
 */
export function resolveTierByScale(
  ladder: TierLadder,
  scale: number,
): TierSpec {
  // Inner-first walk — each band is [downThreshold, upThreshold),
  // and the innermost tier's down is the highest, so the first tier
  // whose down <= scale is the correct pick.
  for (let i = ladder.length - 1; i >= 0; i--) {
    const spec = ladder[i];
    if (!spec) continue;
    if (scale >= spec.downThreshold) return spec;
  }
  // Fallback: outermost tier. Covers pathological zero/negative scale.
  const first = ladder[0];
  if (!first) throw new Error("empty tier ladder");
  return first;
}
