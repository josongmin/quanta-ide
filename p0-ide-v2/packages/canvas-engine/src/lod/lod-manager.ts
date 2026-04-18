import type { LodLevel } from "../view/types";

const UP = {
  supergalaxy_galaxy: 0.08,
  galaxy_city: 0.15,
  city_street: 0.35,
  street_ground: 0.75,
};
const DOWN = {
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

  update(scale: number): LodLevel {
    const c = this.current;
    if (c === "supergalaxy" && scale >= UP.supergalaxy_galaxy) this.current = "galaxy";
    if (c === "galaxy" && scale <  DOWN.supergalaxy_galaxy)    this.current = "supergalaxy";
    if (c === "galaxy" && scale >= UP.galaxy_city)             this.current = "city";
    if (c === "city"   && scale <  DOWN.galaxy_city)           this.current = "galaxy";
    if (c === "city"   && scale >= UP.city_street)             this.current = "street";
    if (c === "street" && scale <  DOWN.city_street)           this.current = "city";
    if (c === "street" && scale >= UP.street_ground)           this.current = "ground";
    if (c === "ground" && scale <  DOWN.street_ground)         this.current = "street";
    return this.current;
  }

  get(): LodLevel { return this.current; }
  reset(lod: LodLevel = "galaxy"): void { this.current = lod; }
}

export function lodFromScale(scale: number): LodLevel {
  if (scale >= UP.street_ground)      return "ground";
  if (scale >= UP.city_street)        return "street";
  if (scale >= UP.galaxy_city)        return "city";
  if (scale >= UP.supergalaxy_galaxy) return "galaxy";
  return "supergalaxy";
}
