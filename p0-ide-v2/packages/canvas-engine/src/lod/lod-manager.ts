import type { LodLevel } from "../view/types";
import { LOD_TIERS, getTierConfig, lodFromScale as lodFromScaleConfig } from "./lod-config";

// LOD transition manager. Thresholds are read from `LOD_TIERS` (in
// ./lod-config.ts) so tuning lives in one place. The algorithm remains
// identical to the previous hardcoded ladder:
//
//   - Each tier owns `upThreshold` (move into this tier from the one below)
//     and `downThreshold` (leave this tier back to the one below).
//   - Hysteresis — `downThreshold < upThreshold` — prevents thrashing in the
//     dead band between the two.
//   - `update(scale)` runs a single-step transition in a fixpoint loop so a
//     large zoom jump (e.g. ground → universe) cascades across all tiers
//     within one call.

// Tier ladder ordered coarse → fine (universe first, ground last). The
// config file stores tiers fine → coarse for readability; we reverse here
// once at module load so `adjacent(i, +1)` means "finer" everywhere below.
// Index into this array = the tier's rung on the ladder.
const LADDER: readonly LodLevel[] = (() => {
  // Sort by upThreshold ascending so universe (0) is rung 0 and ground is top.
  // Ties should not occur; if they do we fall back to original insertion order.
  const sorted = [...LOD_TIERS].sort((a, b) => a.upThreshold - b.upThreshold);
  return sorted.map(t => t.name) as LodLevel[];
})();

// Reverse index for O(1) ladder-position lookup.
const LADDER_INDEX: Readonly<Record<LodLevel, number>> = (() => {
  const out: Partial<Record<LodLevel, number>> = {};
  LADDER.forEach((name, i) => { out[name] = i; });
  return out as Record<LodLevel, number>;
})();

export class LodManager {
  // Default stays "galaxy" to match app-ide store's `initialLod`. First
  // `update()` tick will downshift to "supergalaxy" if the auto-fit scale
  // sits below the galaxy tier's downThreshold. Callers opening a huge
  // graph can `reset("supergalaxy")` up front.
  private current: LodLevel = "galaxy";

  /**
   * One-step transition from `c` at scale `s`. Returns the new tier after
   * at most one rung change, or `c` if the scale is within the hysteresis
   * band. `update()` calls this in a fixpoint loop so multi-tier jumps
   * still settle in one `update` call.
   */
  private transitionOnce(c: LodLevel, s: number): LodLevel {
    const idx = LADDER_INDEX[c];
    // Move up one rung (coarse → fine) when we cross the *next* tier's
    // upThreshold. The next tier is at idx+1 (ground is at the top).
    if (idx < LADDER.length - 1) {
      const upTier = getTierConfig(LADDER[idx + 1]);
      if (s >= upTier.upThreshold) return upTier.name;
    }
    // Move down one rung (fine → coarse) when we drop below our *own*
    // downThreshold — i.e. the scale is no longer tall enough to sustain
    // the current tier.
    if (idx > 0) {
      const self = getTierConfig(c);
      if (s < self.downThreshold) return LADDER[idx - 1];
    }
    return c;
  }

  update(scale: number): LodLevel {
    // Fixpoint iteration — the previous sequential if-chain captured a
    // stale `c` at entry, so a rapid wheel-zoom crossing ≥2 tiers only
    // advanced one tier per tick and produced visible "catch-up" lag.
    // Safety cap (LOD_TIERS.length+1 hops) is strictly larger than the
    // worst case of walking the full ladder.
    let safety = LOD_TIERS.length + 1;
    while (safety-- > 0) {
      const c = this.current;
      const next = this.transitionOnce(c, scale);
      if (next === c) break;
      this.current = next;
    }
    return this.current;
  }

  get(): LodLevel { return this.current; }
  reset(lod: LodLevel = "galaxy"): void { this.current = lod; }
}

/**
 * Stateless scale → LOD lookup. Re-exported from the config module so
 * legacy import paths (`from "@quanta/canvas-engine"`) keep working.
 */
export function lodFromScale(scale: number): LodLevel {
  return lodFromScaleConfig(scale);
}
