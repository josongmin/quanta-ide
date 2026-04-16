import { useMemo } from "react";
import { featureRegistry } from "@quanta/shell/stores/feature-registry";
import {
  MAX_RESULTS,
  groupEntries,
  parseQuery,
  scoreEntry,
} from "./command-palette.utils";
import type { CommandEntry, GroupedEntries } from "./command-palette.types";

interface UseCommandSearchResult {
  devMode: boolean;
  filter: string;
  grouped: readonly GroupedEntries[];
  visualOrder: readonly CommandEntry[];
  indexOf: Map<string, number>;
}

export function useCommandSearch(rawQuery: string): UseCommandSearchResult {
  const { devMode, filter } = useMemo(() => parseQuery(rawQuery), [rawQuery]);

  const flatResults = useMemo<readonly CommandEntry[]>(() => {
    const all = featureRegistry.allCommands({ includeDevOnly: devMode });
    const query = filter.trim();
    const entries: CommandEntry[] = [];
    for (const { feature, command } of all) {
      const scored = scoreEntry(feature, command, query);
      if (!scored) continue;
      entries.push({
        feature,
        command,
        score: scored.score,
        titlePositions: scored.titlePositions,
        featurePositions: scored.featurePositions,
      });
    }
    entries.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.command.title.localeCompare(b.command.title);
    });
    return entries.slice(0, MAX_RESULTS);
  }, [filter, devMode]);

  const grouped = useMemo<readonly GroupedEntries[]>(
    () => groupEntries(flatResults, filter.trim()),
    [flatResults, filter],
  );

  const visualOrder = useMemo<readonly CommandEntry[]>(() => {
    const seq: CommandEntry[] = [];
    for (const group of grouped) seq.push(...group.items);
    return seq;
  }, [grouped]);

  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    visualOrder.forEach((entry, i) => {
      map.set(`${entry.feature.id}:${entry.command.id}`, i);
    });
    return map;
  }, [visualOrder]);

  return { devMode, filter, grouped, visualOrder, indexOf };
}
