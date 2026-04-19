// Graph history — commit-ordered snapshots of the edge set so the UI can
// scrub a temporal slider or diff two snapshots (Structure101 evolution
// view / Sourcegraph code insights pattern).
//
// Data model: a `GraphHistory` carries a sparse list of snapshots ordered
// by timestamp ascending. Each snapshot either declares an absolute
// `edgeIds` set, or an `added`/`removed` delta relative to the previous
// snapshot. We materialize absolute sets lazily by walking forward from
// `baseIndex`. This keeps memory cheap for long histories (N commits ×
// delta ≪ N × full edge list) while still supporting random-access
// queries via the materialization helpers below.

export interface GraphSnapshot {
  timestamp: number;
  label: string;
  commitSha?: string;
  /** Edge ids added at this snapshot relative to the previous one. */
  added?: readonly string[];
  /** Edge ids removed at this snapshot relative to the previous one. */
  removed?: readonly string[];
  /** Absolute edge set. When present, overrides delta application. */
  edgeIds?: readonly string[];
  /** Author name at this snapshot. When absent, callers may derive
   *  deterministic placeholder authors by index. */
  author?: string;
  /** Author email — used when projecting into a HistorySource CommitMeta. */
  authorEmail?: string;
  /** Commit subject line. When absent, `label` is used as the display
   *  string. Populated for richer synthesized histories and for snapshots
   *  projected from a live HistorySource. */
  message?: string;
  /** Stats for the commit. When absent, proxied from delta sizes. */
  additions?: number;
  deletions?: number;
}

export interface GraphHistory {
  snapshots: readonly GraphSnapshot[];
  /** Anchor index whose `edgeIds` (or empty set) seeds delta application. */
  baseIndex?: number;
}

export interface SnapshotDiff {
  added: ReadonlySet<string>;
  removed: ReadonlySet<string>;
  unchanged: ReadonlySet<string>;
}

/**
 * Walk from `baseIndex` forward, applying each snapshot's add/remove delta
 * (or replacing the set entirely when `edgeIds` is declared), and return
 * the absolute edge id set at `snapshotIndex`. Index out of range yields
 * an empty set rather than throwing — temporal UIs poke at bounds often.
 */
export function materializeEdgeSet(
  history: GraphHistory,
  snapshotIndex: number,
): ReadonlySet<string> {
  const snaps = history.snapshots;
  if (snaps.length === 0 || snapshotIndex < 0 || snapshotIndex >= snaps.length) {
    return EMPTY_SET;
  }
  const base = history.baseIndex ?? 0;
  const seed = snaps[base];
  // Seed either from the baseline's absolute edgeIds or from its deltas
  // against an empty pre-base state.
  let acc: Set<string>;
  if (seed.edgeIds) {
    acc = new Set(seed.edgeIds);
  } else {
    acc = new Set<string>();
    if (seed.added) for (const id of seed.added) acc.add(id);
    if (seed.removed) for (const id of seed.removed) acc.delete(id);
  }
  if (snapshotIndex === base) return acc;

  // Forward walk. We do not support querying indices earlier than `base`
  // because deltas are forward-only; temporal UIs always anchor at 0.
  for (let i = base + 1; i <= snapshotIndex; i++) {
    const s = snaps[i];
    if (s.edgeIds) {
      acc = new Set(s.edgeIds);
      continue;
    }
    if (s.added) for (const id of s.added) acc.add(id);
    if (s.removed) for (const id of s.removed) acc.delete(id);
  }
  return acc;
}

/**
 * Compare the edge sets at indices A (earlier) and B (later or same).
 * Caller is free to pass A > B; the result's semantics flip naturally —
 * "added" always means "in B but not A".
 */
export function diffSnapshots(
  history: GraphHistory,
  aIndex: number,
  bIndex: number,
): SnapshotDiff {
  const a = materializeEdgeSet(history, aIndex);
  const b = materializeEdgeSet(history, bIndex);
  const added = new Set<string>();
  const removed = new Set<string>();
  const unchanged = new Set<string>();
  for (const id of b) {
    if (a.has(id)) unchanged.add(id);
    else added.add(id);
  }
  for (const id of a) {
    if (!b.has(id)) removed.add(id);
  }
  return { added, removed, unchanged };
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
