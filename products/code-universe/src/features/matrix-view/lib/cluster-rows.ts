// cluster-rows — greedy bandwidth reduction for DSM ordering
// --------------------------------------------------------------------
// Reorders row ids so that densely connected entities end up adjacent,
// which in a DSM surfaces block structure along the diagonal. The
// classic choice here is Reverse Cuthill-McKee; for the MVP we use a
// simpler greedy "highest-degree seed + keep appending the closest
// unplaced neighbour" heuristic that produces visible block structure
// on realistic workspace graphs and is easy to reason about.
//
// The algorithm:
//   1. Within-group pass — for each group, seed on the highest-degree
//      row (edge count within the group wins; total degree breaks
//      ties). Repeatedly append the unplaced row with the most edges
//      to the ALREADY-PLACED tail. This BFS-like growth pulls tightly
//      coupled clusters into contiguous runs.
//   2. Between-group pass — build a group × group summary graph
//      (edge weight = total cross-group edges). Apply the same greedy
//      ordering to the group list so heavily-coupled packages sit
//      adjacent. Intra-package structure is invariant; this just
//      decides which adjacent package sits above which.
//   3. Concatenate — emit all rows from group 1 (within-group order),
//      then group 2, etc.
//   4. Tie-breaks — alphabetical by id whenever edge counts match,
//      so runs are bit-identical across identical inputs.
//
// Deliberate scope:
//   - Not spectral, not Markov Clustering — those need eigendec /
//     inflation loops that are fine for a 200×200 matrix but overkill
//     for a feature that's supposed to keep the segmented picker
//     responsive. The greedy order is "good enough" block structure.
//   - Rows WITHOUT a group (no `groupOf` entry) are treated as a
//     single synthetic "" group so they still cluster among
//     themselves rather than being scattered.
//   - Self-loops are ignored for degree counting — a row pointing at
//     itself shouldn't pull it toward anything else.

export interface ClusterRowsOpts {
  /** Ids in initial order (pre-clustering). Every id here must be
   *  unique; duplicates are dropped silently so the result is
   *  still a valid permutation of the unique set. */
  ids: readonly string[];
  /** Directed adjacency: adj[from] = Set<to>. The clustering treats
   *  edges as undirected for neighbour-affinity scoring — both
   *  directions pull two entities together. */
  adj: ReadonlyMap<string, ReadonlySet<string>>;
  /** Optional grouping — rows from the same group should stay
   *  contiguous unless clustering strongly indicates otherwise. Pass
   *  the entity's package/dir id. The algorithm first clusters rows
   *  WITHIN each group, then orders the groups themselves by total
   *  cross-group edge weight so heavily-coupled packages sit adjacent. */
  groupOf?: ReadonlyMap<string, string>;
}

/** Deterministic, length-preserving permutation of `ids`. */
export function clusterRows(opts: ClusterRowsOpts): readonly string[] {
  const { adj, groupOf } = opts;

  // Dedup while preserving first-seen order — keeps the permutation a
  // bijection on the unique set.
  const uniqIds: string[] = [];
  const seen = new Set<string>();
  for (const id of opts.ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    uniqIds.push(id);
  }
  if (uniqIds.length <= 1) return uniqIds;

  // ── Build undirected neighbour map (within the given id set) ──────
  // We ignore edges whose endpoints fall outside the row set (caller
  // may have trimmed rows for maxRows); they'd only leak misleading
  // affinity. Self-loops are skipped.
  const idSet = new Set(uniqIds);
  const undirected = new Map<string, Map<string, number>>();
  for (const id of uniqIds) undirected.set(id, new Map());

  for (const [from, tos] of adj) {
    if (!idSet.has(from)) continue;
    for (const to of tos) {
      if (to === from) continue;
      if (!idSet.has(to)) continue;
      // Each directed edge contributes 1 unit of affinity in BOTH
      // directions — an A→B and a B→A collapse to 2 total, which
      // biases mutually-coupled pairs (likely cycles) to cluster
      // harder than one-way imports.
      undirected.get(from)!.set(to, (undirected.get(from)!.get(to) ?? 0) + 1);
      undirected.get(to)!.set(from, (undirected.get(to)!.get(from) ?? 0) + 1);
    }
  }

  // ── Bucket ids by group ───────────────────────────────────────────
  // Stable alpha-sorted group list so the between-group pass has a
  // deterministic starting permutation. Rows without a groupOf entry
  // fall into the empty-string group.
  const groupBuckets = new Map<string, string[]>();
  const groupForRow = new Map<string, string>();
  for (const id of uniqIds) {
    const g = groupOf?.get(id) ?? "";
    groupForRow.set(id, g);
    if (!groupBuckets.has(g)) groupBuckets.set(g, []);
    groupBuckets.get(g)!.push(id);
  }

  // ── Within-group ordering ─────────────────────────────────────────
  const withinOrdered = new Map<string, string[]>();
  for (const [groupId, members] of groupBuckets) {
    const ordered = greedyOrderWithin(members, undirected, groupForRow, groupId);
    withinOrdered.set(groupId, ordered);
  }

  // ── Between-group ordering ────────────────────────────────────────
  // Summary graph: groupA ↔ groupB weight = sum of edges between their
  // rows. Same greedy heuristic applied to this condensed node set.
  const groupIds = [...groupBuckets.keys()].sort(tieBreakString);
  if (groupIds.length === 1) {
    // Single-group fast path — nothing to reorder.
    const sole = groupIds[0];
    return sole !== undefined ? (withinOrdered.get(sole) ?? []) : [];
  }

  const groupAdj = new Map<string, Map<string, number>>();
  for (const g of groupIds) groupAdj.set(g, new Map());
  for (const [from, neighbours] of undirected) {
    const fg = groupForRow.get(from);
    if (fg === undefined) continue;
    for (const [to, w] of neighbours) {
      const tg = groupForRow.get(to);
      if (tg === undefined) continue;
      if (fg === tg) continue;
      // `undirected` is symmetric and already double-counts bidir
      // edges, so sum directly — every cross-group pair appears twice
      // (from→to and to→from views) which is fine, both orderings
      // would see the same totals.
      groupAdj.get(fg)!.set(tg, (groupAdj.get(fg)!.get(tg) ?? 0) + w);
    }
  }

  const groupOrder = greedyOrderList(groupIds, groupAdj);

  // ── Concatenate in group order ────────────────────────────────────
  const out: string[] = [];
  for (const g of groupOrder) {
    const bucket = withinOrdered.get(g);
    if (!bucket) continue;
    for (const id of bucket) out.push(id);
  }
  return out;
}

// ── internals ────────────────────────────────────────────────────────

/** Tie-break string comparator — stable alpha sort. */
function tieBreakString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Greedy order a set of ids using the given undirected adjacency.
 * 1. Seed on the highest-degree id (within the subset — we compute
 *    the subset degree, not the global one, to respect group scope).
 * 2. Repeatedly pick the unplaced id with the strongest affinity to
 *    the already-placed tail (sum of edge weights to placed members).
 *    Ties broken by subset degree desc, then alpha asc.
 */
function greedyOrderWithin(
  members: readonly string[],
  undirected: ReadonlyMap<string, ReadonlyMap<string, number>>,
  groupForRow: ReadonlyMap<string, string>,
  groupId: string,
): string[] {
  if (members.length <= 1) return [...members];

  const memberSet = new Set(members);
  // Subset degree: only count edges whose OTHER endpoint is in the
  // same group. This is what makes within-group clustering local —
  // otherwise a file with one intra-package edge and ten cross-package
  // edges would get seeded first, even though its within-package
  // affinity is weak.
  const subsetDegree = new Map<string, number>();
  for (const id of members) {
    const neigh = undirected.get(id);
    if (!neigh) {
      subsetDegree.set(id, 0);
      continue;
    }
    let d = 0;
    for (const [to, w] of neigh) {
      if (!memberSet.has(to)) continue;
      if (groupForRow.get(to) !== groupId) continue;
      d += w;
    }
    subsetDegree.set(id, d);
  }

  // Sort candidates alpha first so tie-breaks are deterministic when
  // we later pick the max by score.
  const sortedAlpha = [...members].sort(tieBreakString);

  // Seed — max subset degree, tie-break alpha asc.
  let seed = sortedAlpha[0]!;
  let seedDeg = subsetDegree.get(seed) ?? 0;
  for (const id of sortedAlpha) {
    const d = subsetDegree.get(id) ?? 0;
    if (d > seedDeg) {
      seed = id;
      seedDeg = d;
    }
  }

  const placed: string[] = [seed];
  const placedSet = new Set([seed]);
  const remaining = new Set(sortedAlpha.filter(id => id !== seed));

  while (remaining.size > 0) {
    let bestId: string | null = null;
    let bestAffinity = -1;
    let bestDegree = -1;

    for (const id of sortedAlpha) {
      if (!remaining.has(id)) continue;
      // Affinity = sum of edge weights to already-placed members of
      // the SAME group.
      const neigh = undirected.get(id);
      let aff = 0;
      if (neigh) {
        for (const p of placedSet) {
          const w = neigh.get(p);
          if (w !== undefined) aff += w;
        }
      }
      const deg = subsetDegree.get(id) ?? 0;
      // Prefer higher affinity; on ties prefer higher subset degree;
      // on further ties fall through (first-hit wins, which is alpha
      // asc because sortedAlpha drives the outer loop).
      if (
        aff > bestAffinity ||
        (aff === bestAffinity && deg > bestDegree)
      ) {
        bestId = id;
        bestAffinity = aff;
        bestDegree = deg;
      }
    }

    if (bestId === null) {
      // Disconnected — grab the first remaining in alpha order so the
      // permutation stays deterministic and complete.
      bestId = sortedAlpha.find(id => remaining.has(id)) ?? null;
    }
    if (bestId === null) break;

    placed.push(bestId);
    placedSet.add(bestId);
    remaining.delete(bestId);
  }

  return placed;
}

/**
 * Same greedy heuristic applied to a flat node list (no sub-group
 * scoping). Used for the between-group pass over the condensed group
 * graph.
 */
function greedyOrderList(
  nodes: readonly string[],
  adj: ReadonlyMap<string, ReadonlyMap<string, number>>,
): string[] {
  if (nodes.length <= 1) return [...nodes];

  const sortedAlpha = [...nodes].sort(tieBreakString);
  const degree = new Map<string, number>();
  for (const id of nodes) {
    const neigh = adj.get(id);
    let d = 0;
    if (neigh) for (const [, w] of neigh) d += w;
    degree.set(id, d);
  }

  let seed = sortedAlpha[0]!;
  let seedDeg = degree.get(seed) ?? 0;
  for (const id of sortedAlpha) {
    const d = degree.get(id) ?? 0;
    if (d > seedDeg) {
      seed = id;
      seedDeg = d;
    }
  }

  const placed: string[] = [seed];
  const placedSet = new Set([seed]);
  const remaining = new Set(sortedAlpha.filter(id => id !== seed));

  while (remaining.size > 0) {
    let bestId: string | null = null;
    let bestAffinity = -1;
    let bestDegree = -1;
    for (const id of sortedAlpha) {
      if (!remaining.has(id)) continue;
      const neigh = adj.get(id);
      let aff = 0;
      if (neigh) {
        for (const p of placedSet) {
          const w = neigh.get(p);
          if (w !== undefined) aff += w;
        }
      }
      const deg = degree.get(id) ?? 0;
      if (
        aff > bestAffinity ||
        (aff === bestAffinity && deg > bestDegree)
      ) {
        bestId = id;
        bestAffinity = aff;
        bestDegree = deg;
      }
    }
    if (bestId === null) {
      bestId = sortedAlpha.find(id => remaining.has(id)) ?? null;
    }
    if (bestId === null) break;
    placed.push(bestId);
    placedSet.add(bestId);
    remaining.delete(bestId);
  }

  return placed;
}
