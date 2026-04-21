export type TabStyle = "chrome" | "linear";

export interface PreferencesV1 {
  version: 1;
  layout: {
    tabStyle: TabStyle;
  };
  features: {
    /** Explicit enable/disable override per feature ID. Absent = default (enabled). */
    enabled: Record<string, boolean>;
    /** Per-setting values keyed by SettingFieldContribution.key (globally unique). */
    values: Record<string, unknown>;
  };
}

export type Preferences = PreferencesV1;

export const PREFERENCES_VERSION = 1 as const;

export const DEFAULT_PREFERENCES: Preferences = {
  version: 1,
  layout: {
    tabStyle: "chrome",
  },
  features: {
    enabled: {},
    values: {},
  },
};

function isTabStyle(v: unknown): v is TabStyle {
  return v === "chrome" || v === "linear";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceBoolRecord(v: unknown): Record<string, boolean> {
  if (!isRecord(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

export function coerce(input: unknown): Preferences {
  if (!isRecord(input)) return DEFAULT_PREFERENCES;

  const layout = isRecord(input.layout) ? input.layout : {};
  const features = isRecord(input.features) ? input.features : {};

  return {
    version: 1,
    layout: {
      tabStyle: isTabStyle(layout.tabStyle) ? layout.tabStyle : DEFAULT_PREFERENCES.layout.tabStyle,
    },
    features: {
      enabled: coerceBoolRecord(features.enabled),
      values: isRecord(features.values) ? features.values : {},
    },
  };
}
