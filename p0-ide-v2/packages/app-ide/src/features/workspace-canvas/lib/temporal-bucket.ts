import type { GraphSnapshot } from "@quanta/canvas-engine";

// Temporal bucketing for the minimap strip.
// ─────────────────────────────────────────────────────────────────────
// Long histories (5000+ commits) blow past typical canvas widths when we
// paint one column per commit — the strip ends up wider than the viewport
// and pointer→commit mapping skews. We bucket consecutive commits into
// at most BUCKET_CAP columns so the strip always fits in a minimap-sized
// canvas, while preserving round-trip pointer↔commit mapping: a click on
// column X selects the *middle* commit of that bucket.
//
// Why 500? Minimap widths sit around 200–320 CSS px in our layouts.
// Rendering 500 columns comfortably covers 2× pixel density (retina) with
// sub-pixel detail, yet keeps total loop cost trivially under a frame even
// on very long histories. Dropping to ~300 gives marginally cheaper paint
// at the cost of collapsing week-sized stretches in repo histories that
// cross ~3k commits; 500 is the sweet spot between detail and budget.
export const BUCKET_CAP = 500;

export interface TemporalBucket {
  /** Inclusive index of first commit in this bucket. */
  startIndex: number;
  /** Inclusive index of last commit in this bucket. */
  endIndex: number;
  /** Commit index to select when this bucket is clicked — the middle one. */
  representativeIndex: number;
  /** Aggregated churn across the bucket (sum of per-commit churn). */
  churn: number;
}

export interface BucketLayout {
  readonly buckets: readonly TemporalBucket[];
  /** Peak per-bucket churn; drives color normalization. */
  readonly maxChurn: number;
}

function churnFor(s: GraphSnapshot): number {
  const a = s.added?.length ?? 0;
  const r = s.removed?.length ?? 0;
  if (a + r > 0) return a + r;
  // Absolute-set replacement — approximate density so the column still
  // registers rather than painting as "dead" green.
  return s.edgeIds ? Math.min(50, s.edgeIds.length) : 0;
}

/**
 * Bucket a snapshot list into at most `BUCKET_CAP` consecutive groups.
 * When `snapshots.length ≤ BUCKET_CAP` the result is a 1:1 mapping so the
 * caller can treat bucketed and unbucketed modes with the same code path.
 */
export function buildBuckets(snapshots: readonly GraphSnapshot[]): BucketLayout {
  const N = snapshots.length;
  if (N === 0) return { buckets: [], maxChurn: 1 };

  const bucketCount = Math.min(BUCKET_CAP, N);
  // ceil so the last bucket absorbs the remainder — avoids an off-by-one
  // short bucket at the tail that would paint a skinny column.
  const perBucket = Math.ceil(N / bucketCount);

  const buckets: TemporalBucket[] = [];
  let maxChurn = 0;

  for (let b = 0; b < bucketCount; b++) {
    const startIndex = b * perBucket;
    if (startIndex >= N) break;
    const endIndex = Math.min(N - 1, startIndex + perBucket - 1);

    let sum = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      sum += churnFor(snapshots[i]);
    }
    if (sum > maxChurn) maxChurn = sum;

    buckets.push({
      startIndex,
      endIndex,
      // Middle commit so click→commit is the visual center of the column;
      // keeps scrub behavior intuitive around bucket boundaries.
      representativeIndex: (startIndex + endIndex) >> 1,
      churn: sum,
    });
  }

  return { buckets, maxChurn: Math.max(1, maxChurn) };
}

/**
 * Map a commit index to the bucket that contains it. Uses arithmetic
 * (not a scan) because buckets are uniform in size except the tail.
 */
export function bucketIndexForCommit(
  commitIndex: number,
  totalCommits: number,
  bucketCount: number,
): number {
  if (bucketCount <= 0 || totalCommits <= 0) return 0;
  const perBucket = Math.ceil(totalCommits / bucketCount);
  const raw = Math.floor(commitIndex / perBucket);
  return Math.max(0, Math.min(bucketCount - 1, raw));
}
