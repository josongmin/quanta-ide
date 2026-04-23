import type { ReactNode } from "react";

export type FeatureCategory =
  | "intelligence"
  | "editing"
  | "rules"
  | "integration"
  | "workflow";

export type FeatureVisibility = "user" | "dev-only";

export type FeatureState = "active" | "disabled" | "error";

export type FeatureBadge = "new" | "beta" | "deprecated" | "experimental";


export interface FeatureAnalysisMetadata {
  kind?: "analysis-view" | "workflow" | "external";
  primary?: {
    domain: string;
    scope: string;
    intent: string;
  };
  domains?: readonly string[];
  scopes?: readonly string[];
  intents?: readonly string[];
  subdomain?: string;
  decisionGrade?: string;
  decisionTargets?: readonly string[];
  evidenceClass?: string;
  capabilityKinds?: readonly string[];
  actions?: readonly string[];
  maturity?: string;
  hygieneDebt?: boolean;
  tabTitle?: string;
  commandId?: string;
}

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
  analysis?: FeatureAnalysisMetadata;
  primary?: {
    tileLabel: string;
    tileHint?: string;
    tileRun: () => void;
  };
}

export interface FeatureRecord extends FeatureManifest {
  state: FeatureState;
  loadedAt: number;
  loadMs: number;
  errorMessage?: string;
}
