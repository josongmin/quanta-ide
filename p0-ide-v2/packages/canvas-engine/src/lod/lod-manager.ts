import type { LodLevel } from "../view/types";

const UP = {
  universe_supergalaxy: 0.025,
  supergalaxy_galaxy: 0.08,
  galaxy_city: 0.15,
  city_street: 0.35,
  street_ground: 0.75,
};
const DOWN = {
  universe_supergalaxy: 0.02,
  supergalaxy_galaxy: 0.065,
  galaxy_city: 0.12,
  city_street: 0.32,
  street_ground: 0.72,
};

export class LodManager {
  // Default stays "galaxy" to match app-ide store's `initialLod`. The
  // first `update()` tick will downshift to "supergalaxy" if the auto-fit
  // scale is below DOWN.supergalaxy_galaxy (0.065). Callers that know
  // they're opening a huge graph can `reset("supergalaxy")` up front.
  // TODO(app-ide): consider defaulting store's `initialLod` to
  // "supergalaxy" for repos with > TREEMAP_THRESHOLD files so we skip
  // the initial galaxy tick.
  private current: LodLevel = "galaxy";

  /**
   * Single-step transition between adjacent tiers at the given scale.
   * Returns the *next* tier after one hop, or the same tier if no
   * transition fires. Used by `update()` as a fixpoint kernel so rapid
   * zoom jumps that cross multiple tiers are handled in one call
   * (e.g. user wheel-zooms from "ground" to "universe" — a single
   * pre-fixpoint tick would only downshift one level).
   */
  private transitionOnce(c: LodLevel, scale: number): LodLevel {
    if (c === "universe"    && scale >= UP.universe_supergalaxy)   return "supergalaxy";
    if (c === "supergalaxy" && scale <  DOWN.universe_supergalaxy) return "universe";
    if (c === "supergalaxy" && scale >= UP.supergalaxy_galaxy)     return "galaxy";
    if (c === "galaxy"      && scale <  DOWN.supergalaxy_galaxy)   return "supergalaxy";
    if (c === "galaxy"      && scale >= UP.galaxy_city)            return "city";
    if (c === "city"        && scale <  DOWN.galaxy_city)          return "galaxy";
    if (c === "city"        && scale >= UP.city_street)            return "street";
    if (c === "street"      && scale <  DOWN.city_street)          return "city";
    if (c === "street"      && scale >= UP.street_ground)          return "ground";
    if (c === "ground"      && scale <  DOWN.street_ground)        return "street";
    return c;
  }

  update(scale: number): LodLevel {
    // Fixpoint iteration: apply single-step transitions until stable.
    // The previous sequential if-chain captured a stale `c` at entry, so
    // a zoom jump crossing ≥2 tiers only advanced one tier per tick —
    // producing visible LOD "catch-up" during fast wheel-zooms. The
    // safety cap (10) is an order of magnitude above the worst-case
    // depth (6 tiers → 5 hops) to guard against logic bugs.
    let safety = 10;
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

export function lodFromScale(scale: number): LodLevel {
  if (scale >= UP.street_ground)         return "ground";
  if (scale >= UP.city_street)           return "street";
  if (scale >= UP.galaxy_city)           return "city";
  if (scale >= UP.supergalaxy_galaxy)    return "galaxy";
  if (scale >= UP.universe_supergalaxy)  return "supergalaxy";
  return "universe";
}
