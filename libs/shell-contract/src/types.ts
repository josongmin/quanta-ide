import type { ComponentType, ReactNode } from "react";

/** App identifiers corresponding to tab-bus TabApp. */
export type TabApp =
  | "new-tab"
  | "agent"
  | "pr"
  | "ide"
  | "workspace"
  | "universe"
  | "scenario"
  | "reviews"
  | "policy"
  | "settings"
  | "dashboard"
  | "demo"
  | "code-city"
  | "analysis-catalog"
  | "autopilot";

/** Superset: every surface the shell can render, including non-tab pages. */
export type AppKind = TabApp | "home";

/** Serialisable tab descriptor stored by the shell tab manager. */
export interface TabDescriptor {
  id: string;
  app: AppKind;
  label: string;
  /** Stable URL slug. Unique across open tabs; written into the hash
   *  as `#/<slug>[/...][?...]`. When omitted, the shell derives one
   *  from `app` (and suffixes `-2`, `-3`, … to disambiguate duplicates).
   *  Keep it short + lowercase-kebab. */
  slug?: string;
}

/** Each micro-web app exports this to register itself with the shell. */
export interface TabAppDescriptor {
  id: AppKind;
  label: string;
  icon?: () => ReactNode;
  Component: ComponentType<TabAppProps>;
}

/** Props injected by the shell into every tab app component. */
export interface TabAppProps {
  tabId: string;
  isActive: boolean;
}
