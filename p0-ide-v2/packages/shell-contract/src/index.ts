// Shell contract — public API
// Every micro-web tab app depends on this package.

export type {
  TabApp,
  AppKind,
  TabDescriptor,
  TabAppDescriptor,
  TabAppProps,
} from "./types";

export type { ShellAPI } from "./shell-api";

export { ShellProvider, useShell } from "./context";

export type {
  FeatureCategory,
  FeatureVisibility,
  FeatureState,
  FeatureBadge,
  CommandContribution,
  ShortcutContribution,
  SettingFieldContribution,
  StatusContribution,
  FeatureManifest,
} from "./feature-types";

export type { ShortcutBinding } from "./shortcut-types";

export type { ToastKind, Toast, ToastOptions } from "./toast-types";

export type { IconPackId } from "./icon-types";

export { IconPackProvider, useIconPackId } from "./icon-pack-context";

export type {
  ShellEvents,
  ShellEventName,
  ShellEventPayload,
} from "./events";

export { LayoutProvider, useLayout, type LayoutCallbacks } from "./layout-types";
