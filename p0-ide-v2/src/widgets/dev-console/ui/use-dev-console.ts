import { useEffect, useMemo, useState } from "react";
import {
  useFeatureRegistry,
  type FeatureRecord,
  type RegistryEvent,
} from "@/shared/model/feature-registry";
import { uiBus } from "@/shared/model/ui-bus";
import { STATE_ORDER, eventCommandId, eventFeatureId, eventMessage } from "./dev-console.utils";

type TabId = "features" | "events" | "graph";

export function useDevConsole() {
  const [tab, setTab] = useState<TabId>("features");
  const [filter, setFilter] = useState("");
  const [includeDevOnly, setIncludeDevOnly] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const features = useFeatureRegistry((s) => s.features);
  const events = useFeatureRegistry((s) => s.events);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        uiBus.toggleDevConsole(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sortedFeatures = useMemo(() => {
    const all: FeatureRecord[] = [];
    for (const f of features.values()) {
      if (!includeDevOnly && f.visibility === "dev-only") continue;
      all.push(f);
    }
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (f) =>
            f.id.toLowerCase().includes(q) ||
            f.title.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q),
        )
      : all;
    return filtered.sort((a, b) => {
      const sd = STATE_ORDER[a.state] - STATE_ORDER[b.state];
      if (sd !== 0) return sd;
      return a.title.localeCompare(b.title);
    });
  }, [features, includeDevOnly, filter]);

  const selected = selectedId ? features.get(selectedId) : undefined;

  const dependedOnBy = useMemo(() => {
    if (!selected) return [] as string[];
    const out: string[] = [];
    for (const f of features.values()) {
      if (f.id === selected.id) continue;
      if (f.dependsOn?.includes(selected.id)) out.push(f.id);
    }
    return out.sort();
  }, [features, selected]);

  const filteredEvents: readonly RegistryEvent[] = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        (eventFeatureId(e) ?? "").toLowerCase().includes(q) ||
        (eventCommandId(e) ?? "").toLowerCase().includes(q) ||
        (eventMessage(e) ?? "").toLowerCase().includes(q) ||
        e.kind.includes(q),
    );
  }, [events, filter]);

  return {
    tab, setTab,
    filter, setFilter,
    includeDevOnly, setIncludeDevOnly,
    selectedId, setSelectedId,
    sortedFeatures,
    selected,
    dependedOnBy,
    filteredEvents,
  } as const;
}
