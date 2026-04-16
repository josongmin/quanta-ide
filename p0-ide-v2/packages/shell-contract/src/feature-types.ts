import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Feature registry contract types
// Standalone copies of `src/shared/model/feature-registry/types.ts`.
// The contract package must NEVER import from `@/`.
// ---------------------------------------------------------------------------

export type FeatureCategory =
  | "intelligence"
  | "editing"
  | "rules"
  | "integration"
  | "workflow";

export type FeatureVisibility = "user" | "dev-only";

export type FeatureState = "active" | "disabled" | "error";

export type FeatureBadge = "new" | "beta" | "deprecated" | "experimental";

export interface CommandContribution {
  id: string;
  title: string;
  keybinding?: string;
  description?: string;
  run: () => void;
}

export interface ShortcutContribution {
  key: string;
  commandId: string;
}

export interface SettingFieldContribution {
  key: string;
  label: string;
  type: "boolean" | "string" | "number" | "enum";
  default: unknown;
  description?: string;
  enumValues?: readonly string[];
}

export interface StatusContribution {
  id: string;
  render: () => ReactNode;
}

export interface FeatureManifest {
  id: string;
  title: string;
  description: string;
  category: FeatureCategory;
  visibility: FeatureVisibility;
  version: string;
  badge?: FeatureBadge;
  icon?: ReactNode;
  dependsOn?: readonly string[];
  commands?: readonly CommandContribution[];
  shortcuts?: readonly ShortcutContribution[];
  settings?: readonly SettingFieldContribution[];
  status?: StatusContribution;
  primary?: {
    tileLabel: string;
    tileHint?: string;
    tileRun: () => void;
  };
}
