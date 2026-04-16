import type { FeatureRecord } from "@/shared/model/feature-registry";

export function seedValues(features: FeatureRecord[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of features) {
    for (const s of f.settings ?? []) {
      values[s.key] = s.default;
    }
  }
  return values;
}
