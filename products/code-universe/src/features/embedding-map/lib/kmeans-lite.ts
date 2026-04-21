// kmeans-lite
// --------------------------------------------------------------------
// Simple k-means clustering for 2D points. Fully deterministic — no
// Math.random, no date/time. Seeds are chosen by picking the point
// closest to each of k evenly-spaced angles from the centroid.
//
// Initialization: k seed points chosen by picking the point closest to
// each of k evenly-spaced angles from the overall centroid. This gives
// well-spread initial centroids without needing a random seed.
//
// Iterations: up to 20, stops early if assignments don't change.

const MAX_ITER = 20;

export interface KmeansResult {
  /** point id → cluster id (0-indexed) */
  assignments: Map<string, number>;
  /** one centroid per cluster */
  centroids: Array<{ cx: number; cy: number }>;
}

/**
 * Deterministic k-means clustering on 2D points.
 *
 * If k ≥ n, every point becomes its own cluster and k is clamped to n.
 * Returns stable assignments across identical calls (no randomness).
 */
export function kmeansLite(
  points: Array<{ id: string; x: number; y: number }>,
  k: number,
): KmeansResult {
  const n = points.length;

  if (n === 0) {
    return { assignments: new Map(), centroids: [] };
  }

  // Clamp k to number of points.
  const effectiveK = Math.max(1, Math.min(k, n));

  if (effectiveK === 1) {
    // Single cluster: all points get cluster 0.
    const assignments = new Map<string, number>();
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      assignments.set(p.id, 0);
      sumX += p.x;
      sumY += p.y;
    }
    return {
      assignments,
      centroids: [{ cx: sumX / n, cy: sumY / n }],
    };
  }

  // ── Initialization: evenly-spaced angular seeds ───────────────────
  // Compute overall centroid.
  let centX = 0;
  let centY = 0;
  for (const p of points) {
    centX += p.x;
    centY += p.y;
  }
  centX /= n;
  centY /= n;

  // Sort points by id for deterministic seed selection.
  const sorted = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // For each of k evenly-spaced angles, pick the closest point.
  const seedIndices: number[] = [];
  for (let i = 0; i < effectiveK; i++) {
    const angle = (i / effectiveK) * 2 * Math.PI;
    const targetX = centX + Math.cos(angle);
    const targetY = centY + Math.sin(angle);

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < sorted.length; j++) {
      // Skip already-chosen seeds to ensure diversity.
      if (seedIndices.includes(j)) continue;
      const p = sorted[j]!;
      const dx = p.x - targetX;
      const dy = p.y - targetY;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = j;
      }
    }
    seedIndices.push(bestIdx);
  }

  // Initialize centroid positions from seeds.
  let centroids: Array<{ cx: number; cy: number }> = seedIndices.map(idx => ({
    cx: sorted[idx]!.x,
    cy: sorted[idx]!.y,
  }));

  // ── Iterative refinement ──────────────────────────────────────────
  let assignments = new Map<string, number>();
  let prevAssignmentStr = "";

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Assignment step: assign each point to nearest centroid.
    const newAssignments = new Map<string, number>();
    for (const p of sorted) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const cx2 = centroids[c]!.cx;
        const cy2 = centroids[c]!.cy;
        const dx = p.x - cx2;
        const dy = p.y - cy2;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      newAssignments.set(p.id, bestCluster);
    }

    // Check for convergence: assignments unchanged.
    const assignmentStr = sorted.map(p => newAssignments.get(p.id)).join(",");
    assignments = newAssignments;
    if (assignmentStr === prevAssignmentStr) break;
    prevAssignmentStr = assignmentStr;

    // Update step: recompute centroids.
    const sums = centroids.map(() => ({ sumX: 0, sumY: 0, count: 0 }));
    for (const p of sorted) {
      const c = newAssignments.get(p.id) ?? 0;
      const s = sums[c]!;
      s.sumX += p.x;
      s.sumY += p.y;
      s.count += 1;
    }

    centroids = sums.map((s, c) => {
      if (s.count === 0) {
        // Empty cluster: keep the old centroid.
        return centroids[c]!;
      }
      return { cx: s.sumX / s.count, cy: s.sumY / s.count };
    });
  }

  return { assignments, centroids };
}
