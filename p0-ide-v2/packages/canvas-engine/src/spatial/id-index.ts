/**
 * id-index — integer-indexed lookup helpers for hot-path spatial queries.
 *
 * The visible-query pipeline needs to test "is fileId X currently visible?"
 * thousands of times per frame (every comment, every edge endpoint). A
 * `Set<string>` for that check allocates per-frame; repeated calls under
 * a fast pan show up as the #1 GC-pressure source in the frame-timing
 * audit.
 *
 * This module replaces the Set with a reusable `Uint8Array` bitset keyed
 * by a stable integer index assigned per-graph. The index map is built
 * once per FileNode[] / FileEdge[] and cached; the bitset is owned by
 * the caller and reused across frames (`.fill(0)` at the top of each
 * call, zero allocation afterward).
 *
 * Why Uint8Array and not a packed bitset (1 bit per flag)? We need O(1)
 * set/test and mass-clear; `.fill(0)` on Uint8Array is vectorised on V8,
 * while bit-level packing requires `|=` / `&` shifts that lose to the
 * byte-indexed form at these sizes (<~100k entries).
 */

/**
 * Build a stable `id → index` map for an array of objects keyed by `id`.
 * Index assignment is insertion order. Returns a Map used by callers
 * to translate ids into bitset offsets. Callers typically memoize this
 * per-graph (WeakMap keyed on the source array).
 */
export function buildIdIndex<T extends { id: string }>(items: ReadonlyArray<T>): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    map.set(items[i].id, i);
  }
  return map;
}

/**
 * Ensure `buf` has at least `size` bytes. Returns the same buffer when
 * it already fits; otherwise allocates a new one (growth is a rare event
 * triggered only when the graph's file/edge count increases).
 *
 * The caller is responsible for zeroing the returned buffer (`fill(0)`)
 * before marking membership — we don't do it here because most callers
 * already need to zero on each frame regardless of whether the buffer
 * grew.
 */
export function ensureBitsetCapacity(buf: Uint8Array, size: number): Uint8Array {
  if (buf.length >= size) return buf;
  // Double-and-round-up growth: keeps the amortised allocation count
  // sub-linear if the graph gradually grows during a session.
  let capacity = buf.length > 0 ? buf.length : 64;
  while (capacity < size) capacity *= 2;
  return new Uint8Array(capacity);
}
