import type { Entity, EntityTree } from "@quanta/canvas-engine";

// Entity search
// --------------------------------------------------------------------
// Lightweight fuzzy matcher for the command palette. Simpler than a
// full fuzzy-scorer (fzy/fzf) because the entity tree tops out at
// ~10k nodes and we care about snappy type-ahead, not optimal ranking
// across a million-doc index.
//
// Scoring rules (higher = better):
//   1000   exact name match
//   +500   name starts with the query
//   +200   name contains the query
//   +60    path contains the query
//   +kind  bump by kind depth (deeper kinds rank first when tied so
//          "Button" matches the file over its package)
//
// Ties broken by name length (shorter wins — "Button.tsx" beats
// "ButtonGroup.tsx" on the query "button").

export interface EntitySearchResult {
  entity: Entity;
  score: number;
}

const KIND_BONUS: Record<Entity["kind"], number> = {
  universe: 0,
  galaxy: 5,
  street: 10,
  building: 40,
  floor: 20,
  room: 30,
};

export function searchEntities(
  tree: EntityTree | null,
  query: string,
  limit = 10,
): EntitySearchResult[] {
  if (!tree) return [];
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const out: EntitySearchResult[] = [];
  for (const entity of tree.byId.values()) {
    const score = scoreEntity(entity, q);
    if (score <= 0) continue;
    out.push({ entity, score });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entity.name.length - b.entity.name.length;
  });
  if (out.length > limit) out.length = limit;
  return out;
}

function scoreEntity(entity: Entity, q: string): number {
  const name = entity.name.toLowerCase();
  const path = (entity.path ?? "").toLowerCase();
  let score = 0;
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 500;
  else if (name.includes(q)) score += 200;
  if (path.includes(q) && !name.includes(q)) score += 60;
  if (score > 0) score += KIND_BONUS[entity.kind];
  return score;
}
