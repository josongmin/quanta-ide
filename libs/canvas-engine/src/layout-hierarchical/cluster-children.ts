import type { Entity } from "../entity/types";

// cluster-children
// --------------------------------------------------------------------
// Sibling reordering pass for the hierarchical packer. The packer
// itself (squarified) sorts by area, but siblings with identical or
// near-identical area still get placed in the order the caller hands
// them over, meaning a parent's `childIds` sequence (which is
// path-sorted alphabetical — see build-entity-tree) decides adjacency.
//
// Pure alphabetical adjacency scatters semantically-related families:
// `admissibility.rs`, `admissibility_rules.rs`, and `delta_admissibility.rs`
// end up interleaved with everything else starting with A and D. This
// module groups siblings that share a name stem so cluster mates sit
// next to each other when the packer consumes them.
//
// The clustering is a pre-layout reordering, not a structural change:
// the returned sequence is a permutation of the input. Rect containment,
// the tree topology, and the HierarchicalLayout contract are unchanged.
// A future renderer can call `clusterChildren` itself to surface faint
// cluster boundaries (gutters, labels) without recomputing the grouping.

/**
 * Minimum number of direct children a parent must have before
 * clustering kicks in. Below this threshold, alphabetical ordering is
 * fine — shuffling 3 or 4 siblings around is pure churn.
 */
export const CLUSTER_MIN_CHILDREN = 8;

/**
 * Minimum stem length for a prefix to count as a real cluster key.
 * `a`, `ab`, or a lone digit aren't distinctive enough; we'd rather
 * push those into the catch-all bucket.
 */
const STEM_MIN_CHARS = 3;

/**
 * Minimum members for a cluster to survive. Single-member clusters
 * are demoted to the catch-all bucket so the layout doesn't fragment
 * into dozens of 1-tile clusters.
 */
const CLUSTER_MIN_MEMBERS = 2;

const OTHER_KEY = "__other__";

/**
 * Extract a prefix stem from an entity's display name.
 *
 * Rules (applied in order):
 *   1. Lowercase the name for matching (case-folded).
 *   2. Split on the first separator among `-`, `_`, `.`.
 *   3. If no separator is present, split on the first camelCase
 *      boundary (lowercase→uppercase transition in the ORIGINAL name).
 *   4. Strip a leading run of digits (so `01-intro.md` and
 *      `02-setup.md` both stem to `intro` / `setup`, not the digits).
 *   5. If the resulting stem is shorter than `STEM_MIN_CHARS`,
 *      return `null` — the entity will land in the `other` bucket.
 *
 * Directories (no extension) stem the same way as files, so a folder
 * named `auth` clusters with a sibling file `auth.ts` — both yield
 * stem `auth`.
 */
export function stemOf(name: string): string | null {
  if (!name) return null;

  // camelCase boundary in the ORIGINAL (case-preserving) name. Done
  // before lowercasing so `userService` → `user`, not the whole word.
  let camelIdx = -1;
  for (let i = 1; i < name.length; i++) {
    const prev = name.charCodeAt(i - 1);
    const cur = name.charCodeAt(i);
    // lowercase ASCII → uppercase ASCII transition
    if (prev >= 0x61 && prev <= 0x7a && cur >= 0x41 && cur <= 0x5a) {
      camelIdx = i;
      break;
    }
  }

  const lower = name.toLowerCase();
  const sepRe = /[-_.]/g;
  const isDigitRun = (s: string) =>
    s.length > 0 && /^[0-9]+$/.test(s);

  // Walk segments from the start, skipping leading all-digit chunks
  // so `01-intro.md` keys on `intro` and `02_setup.md` keys on
  // `setup`. If EVERY segment is digits (e.g. `123.ts`), we never
  // find a valid stem — fall through and return null.
  let cursor = 0;
  // eslint-disable-next-line no-constant-condition
  while (cursor < lower.length) {
    sepRe.lastIndex = cursor;
    const match = sepRe.exec(lower);
    const segEnd = match ? match.index : lower.length;
    const segment = lower.slice(cursor, segEnd);
    if (!isDigitRun(segment) && segment.length > 0) {
      // Apply camelCase boundary to this segment only — but the
      // boundary we recorded earlier was for the ORIGINAL name. Only
      // use it if it falls inside this segment.
      let end = segEnd;
      if (camelIdx >= cursor && camelIdx < segEnd) end = camelIdx;
      const stem = lower.slice(cursor, end);
      if (stem.length < STEM_MIN_CHARS) return null;
      return stem;
    }
    if (!match) break;
    cursor = match.index + 1;
  }
  return null;
}

/**
 * Reorder `entities` so siblings that share a name stem sit adjacent
 * to each other. The returned array is a permutation of the input.
 *
 * Ordering contract:
 *   - Clusters with ≥ `CLUSTER_MIN_MEMBERS` members are kept.
 *   - Single-member clusters (and entities with too-short stems) are
 *     merged into the `other` bucket.
 *   - Within each cluster, entities keep their ORIGINAL input order
 *     (stable — so callers upstream of this function still control
 *     fine-grained ordering inside a group).
 *   - Clusters are emitted in order: biggest first (by member count),
 *     tie-broken by stem alphabetical. The `other` bucket always
 *     comes last, regardless of size.
 *
 * If `entities.length` is below `CLUSTER_MIN_CHILDREN` the input is
 * returned unchanged — small folders don't benefit from clustering
 * and we'd rather avoid gratuitous reordering.
 *
 * Two calls with the same input produce byte-identical output
 * (stable sort + deterministic tie-breakers).
 */
export function clusterChildren(
  entities: readonly Entity[],
): readonly Entity[] {
  if (entities.length < CLUSTER_MIN_CHILDREN) return entities;

  // Pass 1: assign every entity a stem key (or OTHER_KEY if none).
  // Keep original index alongside so we can restore stable order
  // within a cluster at emit time.
  interface Tagged {
    entity: Entity;
    stem: string;
    originalIndex: number;
  }
  const tagged: Tagged[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!e) continue;
    const s = stemOf(e.name);
    tagged.push({ entity: e, stem: s ?? OTHER_KEY, originalIndex: i });
  }

  // Pass 2: bucket by stem. Promote single-member buckets into OTHER.
  const buckets = new Map<string, Tagged[]>();
  for (const t of tagged) {
    let list = buckets.get(t.stem);
    if (!list) {
      list = [];
      buckets.set(t.stem, list);
    }
    list.push(t);
  }
  const otherBucket: Tagged[] = buckets.get(OTHER_KEY) ?? [];
  buckets.delete(OTHER_KEY);
  for (const [stem, list] of [...buckets]) {
    if (list.length < CLUSTER_MIN_MEMBERS) {
      for (const t of list) otherBucket.push(t);
      buckets.delete(stem);
    }
  }

  // Pass 3: order clusters deterministically — biggest first, then
  // alphabetical. Move `other` to the end regardless.
  const orderedKeys = [...buckets.keys()].sort((a, b) => {
    const la = buckets.get(a)!.length;
    const lb = buckets.get(b)!.length;
    if (la !== lb) return lb - la;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  // Pass 4: emit. Within each bucket, restore original input order
  // (stable) so upstream sort decisions inside a cluster survive.
  const out: Entity[] = [];
  const emit = (bucket: Tagged[]) => {
    const sorted = [...bucket].sort((a, b) => a.originalIndex - b.originalIndex);
    for (const t of sorted) out.push(t.entity);
  };
  for (const key of orderedKeys) emit(buckets.get(key)!);
  if (otherBucket.length > 0) emit(otherBucket);

  return out;
}
