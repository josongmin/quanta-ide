// Feature-registry type definitions. Extracted from `feature-registry.ts`
// so category files under `./features/*` can import descriptor types
// without pulling in the full registry array (which would create a
// circular import: features -> registry -> features).

export type FeatureCategory =
  | "collab"
  | "annotation"
  | "devmode"
  | "review"
  | "navigation"
  | "power"
  | "embeds"
  | "ai"
  | "temporal"
  | "archaeology"
  | "actionTerrain";

export type FeatureMaturity = "stable" | "beta" | "experimental";

export interface FeatureDescriptor {
  id: string;
  category: FeatureCategory;
  label: string;
  description: string;
  defaultEnabled: boolean;
  maturity: FeatureMaturity;
  /** Hard requirements — disabling a dependency also disables this one. */
  dependsOn?: readonly string[];
  /** Indicates which roadmap batch delivered this feature (for changelog). */
  introducedIn?: string;
}
