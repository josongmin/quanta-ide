import type { LodLevel } from "../view/types";

const UP   = { galaxy_city: 0.15, city_street: 0.35, street_ground: 0.75 };
const DOWN = { galaxy_city: 0.12, city_street: 0.32, street_ground: 0.72 };

export class LodManager {
  private current: LodLevel = "galaxy";

  update(scale: number): LodLevel {
    const c = this.current;
    if (c === "galaxy"  && scale >= UP.galaxy_city)     this.current = "city";
    if (c === "city"    && scale < DOWN.galaxy_city)    this.current = "galaxy";
    if (c === "city"    && scale >= UP.city_street)     this.current = "street";
    if (c === "street"  && scale < DOWN.city_street)    this.current = "city";
    if (c === "street"  && scale >= UP.street_ground)   this.current = "ground";
    if (c === "ground"  && scale < DOWN.street_ground)  this.current = "street";
    return this.current;
  }

  get(): LodLevel { return this.current; }
  reset(lod: LodLevel = "galaxy"): void { this.current = lod; }
}

export function lodFromScale(scale: number): LodLevel {
  if (scale >= UP.street_ground) return "ground";
  if (scale >= UP.city_street)   return "street";
  if (scale >= UP.galaxy_city)   return "city";
  return "galaxy";
}
