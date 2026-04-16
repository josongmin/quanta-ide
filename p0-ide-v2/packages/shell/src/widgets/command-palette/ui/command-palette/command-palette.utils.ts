import {
  type CommandContribution,
  type FeatureCategory,
  type FeatureRecord,
} from "@quanta/shell/stores/feature-registry";
import { matchPositions, positionScore } from "@quanta/ui-kit/lib/fuzzy-search";
import type { CommandEntry, GroupedEntries } from "./command-palette.types";

export const CATEGORY_ORDER: readonly FeatureCategory[] = [
  "intelligence",
  "editing",
  "rules",
  "integration",
  "workflow",
];

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  intelligence: "Intelligence",
  editing: "Editing",
  rules: "Rules",
  integration: "Integration",
  workflow: "Workflow",
};

export const MAX_RESULTS = 40;
export const MAX_RECENT = 5;
export const DEV_PREFIX = ">dev ";

export function scoreEntry(
  feature: FeatureRecord,
  command: CommandContribution,
  query: string,
): { score: number; titlePositions: number[]; featurePositions: number[] } | null {
  if (query.length === 0) {
    return { score: 0, titlePositions: [], featurePositions: [] };
  }
  const titleMatch = matchPositions(command.title, query);
  const featureMatch = matchPositions(feature.title, query);
  const descMatch = command.description ? matchPositions(command.description, query) : null;
  if (!titleMatch && !featureMatch && !descMatch) return null;
  const titleScore = titleMatch ? positionScore(titleMatch) : Infinity;
  const featureScore = featureMatch ? positionScore(featureMatch) + 40 : Infinity;
  const descScore = descMatch ? positionScore(descMatch) + 80 : Infinity;
  const best = Math.min(titleScore, featureScore, descScore);
  return {
    score: best,
    titlePositions: titleMatch ?? [],
    featurePositions: featureMatch ?? [],
  };
}

/* ──────────────────────────────────────────────────────────────────
   Module-level MRU (survives palette open/close within a session).
   ────────────────────────────────────────────────────────────────── */
const recentCommandIds: string[] = [];

export function getRecentIds(): readonly string[] {
  return recentCommandIds;
}

export function markRecent(id: string) {
  const idx = recentCommandIds.indexOf(id);
  if (idx !== -1) recentCommandIds.splice(idx, 1);
  recentCommandIds.unshift(id);
  if (recentCommandIds.length > MAX_RECENT) recentCommandIds.length = MAX_RECENT;
}

export function parseQuery(rawQuery: string): { devMode: boolean; filter: string } {
  if (rawQuery.startsWith(DEV_PREFIX)) {
    return { devMode: true, filter: rawQuery.slice(DEV_PREFIX.length) };
  }
  return { devMode: false, filter: rawQuery };
}

export function groupEntries(
  flatResults: readonly CommandEntry[],
  query: string,
): readonly GroupedEntries[] {
  const out: GroupedEntries[] = [];

  if (query.length === 0 && recentCommandIds.length > 0) {
    const byId = new Map(flatResults.map((e) => [e.command.id, e]));
    const recents: CommandEntry[] = [];
    for (const id of recentCommandIds) {
      const entry = byId.get(id);
      if (entry) recents.push(entry);
    }
    if (recents.length > 0) {
      out.push({ key: "recent", label: "Recent", items: recents });
    }
  }

  const recentIds = new Set(out[0]?.items.map((e) => e.command.id) ?? []);
  const byCat = new Map<FeatureCategory, CommandEntry[]>();
  for (const entry of flatResults) {
    if (recentIds.has(entry.command.id)) continue;
    const bucket = byCat.get(entry.feature.category);
    if (bucket) bucket.push(entry);
    else byCat.set(entry.feature.category, [entry]);
  }
  for (const cat of CATEGORY_ORDER) {
    const items = byCat.get(cat);
    if (items && items.length > 0) {
      out.push({ key: cat, label: CATEGORY_LABELS[cat], items });
    }
  }
  return out;
}
