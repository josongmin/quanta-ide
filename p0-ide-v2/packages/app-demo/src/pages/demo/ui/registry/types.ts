import type { ComponentType, ReactNode } from "react";

export type CategoryId =
  | "catalog"
  | "auth"
  | "billing"
  | "team"
  | "profile"
  | "onboarding"
  | "notifications"
  | "integrations"
  | "security"
  | "states"
  | "updates"
  | "legal"
  | "admin";

export type DemoChrome = "full" | "app";

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  blurb: string;
  icon: ReactNode;
  accent: string;
}

export interface DemoPageMeta {
  id: string;
  category: CategoryId;
  label: string;
  blurb: string;
  icon: ReactNode;
  chrome: DemoChrome;
  Component: ComponentType;
}
