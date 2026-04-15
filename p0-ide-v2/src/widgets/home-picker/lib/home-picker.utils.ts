import type { FeatureCategory, FeatureRecord, FeatureState } from "@/shared/model/feature-registry";

export const CATEGORIES: { id: FeatureCategory; label: string }[] = [
  { id: "intelligence", label: "Intelligence" },
  { id: "editing", label: "Editing" },
  { id: "rules", label: "Rules" },
  { id: "integration", label: "Integration" },
  { id: "workflow", label: "Workflow" },
];

export function stateLabel(s: FeatureRecord["state"]): string {
  return s;
}

export function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function sortFeaturesForUser(features: Iterable<FeatureRecord>): FeatureRecord[] {
  const stateOrder: Record<FeatureState, number> = { error: 0, active: 1, disabled: 2 };
  return [...features]
    .filter((f) => f.visibility === "user")
    .sort((a, b) => {
      const sd = stateOrder[a.state] - stateOrder[b.state];
      return sd !== 0 ? sd : a.title.localeCompare(b.title);
    });
}
