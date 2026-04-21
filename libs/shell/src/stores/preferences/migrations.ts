import { coerce, DEFAULT_PREFERENCES, type Preferences } from "./schema";

const LEGACY_LAYOUT_PREFS_KEY = "shell.layout-prefs";

export function migrate(raw: unknown): Preferences {
  if (isVersioned(raw)) return coerce(raw);
  return fromLegacy(raw);
}

export function importLegacyLayoutPrefs(storage: Storage): Preferences | null {
  const raw = storage.getItem(LEGACY_LAYOUT_PREFS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    storage.removeItem(LEGACY_LAYOUT_PREFS_KEY);
    return fromLegacy(parsed);
  } catch {
    storage.removeItem(LEGACY_LAYOUT_PREFS_KEY);
    return null;
  }
}

function isVersioned(v: unknown): v is { version: number } {
  return typeof v === "object" && v !== null && typeof (v as { version?: unknown }).version === "number";
}

function fromLegacy(raw: unknown): Preferences {
  if (typeof raw !== "object" || raw === null) return DEFAULT_PREFERENCES;
  const legacy = raw as { tabStyle?: unknown };
  return coerce({
    version: 1,
    layout: { tabStyle: legacy.tabStyle },
    features: { enabled: {}, values: {} },
  });
}
