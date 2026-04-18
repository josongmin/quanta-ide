// LOD-domain public API. Declarative tier config + zoom→tier manager.

export { LodManager } from "./lod-manager";
export {
  LOD_TIERS,
  getTierConfig,
  resolveEffectiveTier,
  resolveLayerPolicy,
} from "./lod-config";
