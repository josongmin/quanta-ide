import type { LodLevel } from "../view/types";

// Declarative LOD tier registry. Zoom thresholds + per-tier rendering policy
// live here so tuning one knob doesn't require touching LodManager, the
// scene query dispatcher, the PixiStage cascade, and the DebugHud
// independently. `LOD_TIERS` is the single source of truth consumed by:
//
//   - `LodManager`         → reads up/down thresholds for hysteretic ladder.
//   - `buildSceneQuery`    → reads `sceneKind` to dispatch file/cluster/
//                             supercluster query path.
//   - `PixiStage`          → reads `fallback` to walk down when a tier has
//                             no data (universe → supergalaxy → galaxy).
//   - `DebugHud`           → displays resolved `rendererKind` + fallback chain.

/**
 * Renderer category for a tier. Kept as a string union (not a class ref)
 * so this config module doesn't pull in Pixi — the canvas-engine package
 * must stay renderer-agnostic.
 */
export type LodRendererKind =
  | "supercluster"
  | "cluster"
  | "galaxy"
  | "city"
  | "street"
  | "ground";

export interface LodTierConfig {
  name: LodLevel;
  /** scale >= this → transition from lower tier into this one. */
  upThreshold: number;
  /** scale < this → transition from this tier back down (hysteresis). */
  downThreshold: number;
  /** Which renderer to activate at this tier (by kind, not by class). */
  rendererKind: LodRendererKind;
  /** Scene-query path — controls which visible-query helper runs. */
  sceneKind: "files" | "clusters" | "superclusters";
  /** Fallback tier when this one has no data (e.g. universe → supergalaxy). */
  fallback?: LodLevel;
  /** Display flag — renderers may read for quick on/off of labels. */
  showLabels?: boolean;
  /** Display flag — renderers may read for quick on/off of edges. */
  showEdges?: boolean;
  /**
   * Minimum world-px scale below which the tier suppresses extra detail
   * (e.g. city tier skips function labels under this). Renderer-interpreted.
   */
  minDetailScale?: number;
}

/**
 * Ordered high → low (ground is top/closest, universe is bottom/farthest).
 * The manager iterates this array; insertion order defines the ladder, so
 * adding a new tier is a single push + one `LodLevel` union extension.
 */
export const LOD_TIERS: readonly LodTierConfig[] = [
  {
    name: "ground",
    upThreshold: 0.60,
    downThreshold: 0.57,
    rendererKind: "ground",
    sceneKind: "files",
    showLabels: true,
    showEdges: true,
  },
  {
    name: "street",
    upThreshold: 0.25,
    downThreshold: 0.22,
    rendererKind: "street",
    sceneKind: "files",
    showLabels: true,
    showEdges: true,
  },
  {
    name: "city",
    // Tuned earlier (2026-04-19): user felt LOD upgrades were lagging on
    // zoom-in. Thresholds reduced ~25% across the ladder so tiers activate
    // sooner. city.down aligns with galaxy.up for clean handoff.
    upThreshold: 0.13,
    downThreshold: 0.10,
    rendererKind: "city",
    sceneKind: "files",
    showLabels: true,
    showEdges: true,
    minDetailScale: 0.25,
  },
  {
    name: "galaxy",
    // Galaxy is the "edges+files dot map" tier — the frame-time cliff when
    // visible file count is high. Band kept narrow and aligned to adjacent
    // tiers (city.down=galaxy.up, galaxy.down=supergalaxy.up) so we exit
    // it quickly in either direction.
    upThreshold: 0.10,
    downThreshold: 0.07,
    rendererKind: "galaxy",
    sceneKind: "files",
    showLabels: false,
    showEdges: false,
  },
  {
    name: "supergalaxy",
    // Supergalaxy forbids edges by config, so widening this band keeps the
    // slow galaxy tier small. Down-threshold dropped 0.03 → 0.015 per user
    // feedback: "super galaxy → universe goes too early". Users want to see
    // cluster view for a wider zoom-out range before dropping to the
    // coarsest supercluster tier.
    upThreshold: 0.07,
    downThreshold: 0.015,
    rendererKind: "cluster",
    sceneKind: "clusters",
    showLabels: true,
    showEdges: false,
    fallback: "galaxy",
  },
  {
    name: "universe",
    // Cheapest tier — superclusters only. Up-threshold aligned with
    // supergalaxy.downThreshold for clean handoff.
    upThreshold: 0.015,
    downThreshold: 0.008,
    rendererKind: "supercluster",
    sceneKind: "superclusters",
    showLabels: true,
    showEdges: false,
    fallback: "supergalaxy",
  },
] as const;

// Index for O(1) lookup. Built once at module load; callers must not
// mutate the config, so freezing the array keeps that contract honest.
const TIER_BY_NAME: Readonly<Record<LodLevel, LodTierConfig>> = (() => {
  const out: Partial<Record<LodLevel, LodTierConfig>> = {};
  for (const t of LOD_TIERS) out[t.name] = t;
  return out as Record<LodLevel, LodTierConfig>;
})();

/**
 * O(1) config lookup by LOD name. Throws if a newly-added `LodLevel` union
 * member is missing from `LOD_TIERS` — which is exactly the failure mode we
 * want (forces the config to stay in sync with the union).
 */
export function getTierConfig(lod: LodLevel): LodTierConfig {
  const t = TIER_BY_NAME[lod];
  if (!t) throw new Error(`[lod-config] no tier entry for "${lod}"`);
  return t;
}

/**
 * Availability signal for the cascading fallback. The caller passes which
 * coarse-grained data is *actually* present in the current layout/scene, so
 * `resolveEffectiveTier` can walk down the fallback chain until it finds a
 * tier whose data requirements are met.
 */
export interface SceneDataAvailability {
  hasClusters: boolean;
  hasSuperclusters: boolean;
}

/**
 * Is this tier's `sceneKind` satisfied by the given data availability?
 * Files are always assumed available — callers that truly have zero files
 * won't render anything anyway and the PixiStage handles empty scenes.
 */
function tierHasData(t: LodTierConfig, data: SceneDataAvailability): boolean {
  switch (t.sceneKind) {
    case "superclusters": return data.hasSuperclusters;
    case "clusters":      return data.hasClusters;
    case "files":         return true;
  }
}

/**
 * Walk the fallback chain starting from `lod` until we find a tier whose
 * scene-data is present, or we hit the end of the chain (returning the last
 * tier, which will be a `files` kind — always satisfiable). This replaces
 * the hardcoded `if (lod==="universe" && !superclusters) → "supergalaxy"`
 * fallback ladder at the PixiStage level.
 */
export function resolveEffectiveTier(
  lod: LodLevel,
  data: SceneDataAvailability,
): LodLevel {
  let cursor: LodTierConfig = getTierConfig(lod);
  // Safety cap — fallback chain depth is bounded by the number of tiers.
  // If a tier's `fallback` pointed back up the chain we'd have a cycle
  // bug; the cap prevents an infinite loop while letting the real bug
  // surface quickly.
  let safety = LOD_TIERS.length + 1;
  while (safety-- > 0) {
    if (tierHasData(cursor, data)) return cursor.name;
    if (!cursor.fallback) return cursor.name;
    cursor = getTierConfig(cursor.fallback);
  }
  return cursor.name;
}

/**
 * Stateless scale → LOD lookup. Mirrors the UP-threshold ladder; used by
 * call-sites that don't carry `LodManager` state (e.g. first render before
 * the manager has seen a viewport tick).
 *
 * Duplicated from lod-manager on purpose: the manager's `update()` is
 * hysteretic (depends on current state), this one is a pure function of
 * scale. The shared source of truth is the `upThreshold` field below.
 */
export function lodFromScale(scale: number): LodLevel {
  // Iterate ground → universe; first tier whose UP threshold is crossed wins.
  // Universe has upThreshold 0 so it's always a valid final fallback.
  for (const t of LOD_TIERS) {
    if (scale >= t.upThreshold) return t.name;
  }
  // Unreachable: universe.upThreshold === 0 catches all scales ≥ 0, and
  // callers pass non-negative scales. If somehow we escape, return the
  // coarsest tier rather than throwing — renderers tolerate it.
  return LOD_TIERS[LOD_TIERS.length - 1].name;
}
