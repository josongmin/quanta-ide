import { useMemo, useState } from "react";
import { useFeatureRegistry } from "@quanta/shell/stores/feature-registry";
import { preferences, usePreferences } from "@quanta/shell/stores/preferences";
import { toast } from "@quanta/shell/stores/toast-store";
import type { CategoryId } from "./settings-page.data";
import { CATEGORY_LABEL, SECTION_DESC } from "./settings-page.data";
import { seedValues } from "./settings-page.utils";

export function useSettingsPage() {
  const featuresMap = useFeatureRegistry((s) => s.features);
  const features = useMemo(() => [...featuresMap.values()], [featuresMap]);
  const [selected, setSelected] = useState<CategoryId>("all");
  const [query, setQuery] = useState("");
  const overrides = usePreferences((s) => s.features.values);
  const defaults = useMemo(() => seedValues(features), [features]);
  const values = useMemo(
    () => ({ ...defaults, ...overrides }),
    [defaults, overrides],
  );

  const userFeatures = useMemo(
    () => features.filter((f) => f.visibility === "user"),
    [features],
  );

  const counts = useMemo(() => {
    const map: Record<CategoryId, number> = {
      all: userFeatures.length,
      layout: 0,
      intelligence: 0,
      editing: 0,
      rules: 0,
      integration: 0,
      workflow: 0,
    };
    for (const f of userFeatures) map[f.category] += 1;
    return map;
  }, [userFeatures]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const layoutMode = !searching && selected === "layout";

  const visible = useMemo(() => {
    if (!searching && selected === "layout") return [];
    let list = userFeatures;
    if (searching) {
      list = list.filter((f) => {
        if (f.title.toLowerCase().includes(q)) return true;
        if (f.description.toLowerCase().includes(q)) return true;
        return f.settings?.some((s) => s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)) ?? false;
      });
    } else if (selected !== "all") {
      list = list.filter((f) => f.category === selected);
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [userFeatures, selected, q, searching]);

  function updateValue(key: string, value: unknown) {
    preferences.setFeatureValue(key, value);
  }

  function resetAll() {
    preferences.resetFeatures();
    toast.info("Settings reset", "all fields restored to defaults", "settings");
  }

  const titleLabel = searching
    ? "Search results"
    : selected === "all"
      ? "All features"
      : selected === "layout"
        ? "Layout"
        : CATEGORY_LABEL[selected];
  const titleDesc = searching
    ? `Matching "${query.trim()}" across all registered features.`
    : selected === "all"
      ? "Every registered capability in the IDE — toggle, configure, or inspect its commands."
      : selected === "layout"
        ? "How the workspace chrome renders — tab design, panels, density."
        : SECTION_DESC[selected];
  const titleCount: number | null = layoutMode ? null : visible.length;

  return {
    selected,
    setSelected,
    query,
    setQuery,
    values,
    counts,
    visible,
    updateValue,
    resetAll,
    titleLabel,
    titleDesc,
    titleCount,
    layoutMode,
    searching,
  };
}

export type SettingsPageState = ReturnType<typeof useSettingsPage>;
