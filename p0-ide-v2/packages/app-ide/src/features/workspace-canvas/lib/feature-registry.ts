// feature-registry.ts — kept as a re-export shim so existing imports
// `import { FEATURE_REGISTRY } from "./feature-registry"` keep
// working. New code should import from "./features" directly
// (or a specific category file under "./features/<category>"), and
// types from "./feature-registry-types".
//
// Each feature's metadata (id, label, default, dependencies, category)
// is declared once in its category file under `./features/*`, and the
// runtime gate (`useFeature(id)`) + HUD's "features" tab read from the
// merged `FEATURE_REGISTRY` exported by `./features/index`.
//
// See `./features/index.ts` for the defaultEnabled policy and the
// authoritative merge order.

import { FEATURE_REGISTRY } from "./features";
import type { FeatureCategory, FeatureDescriptor } from "./feature-registry-types";

export { FEATURE_REGISTRY, FEATURE_BY_ID } from "./features";
export type {
  FeatureCategory,
  FeatureMaturity,
  FeatureDescriptor,
} from "./feature-registry-types";

/** Group features by category for the HUD rendering. */
export function featuresByCategory(): ReadonlyMap<FeatureCategory, readonly FeatureDescriptor[]> {
  const out = new Map<FeatureCategory, FeatureDescriptor[]>();
  for (const f of FEATURE_REGISTRY) {
    let list = out.get(f.category);
    if (!list) { list = []; out.set(f.category, list); }
    list.push(f);
  }
  return out;
}
