// structural-projection
// --------------------------------------------------------------------
// Computes the 2D position for each entity using a structural feature
// vector projection.
//
// Feature vector per entity (6 dimensions, all normalized 0..1):
//   0: fanIn       — count of distinct files importing any file in this
//                    entity's subtree, normalized by max across all entities.
//   1: fanOut      — count of distinct files outside the entity's subtree
//                    that any file in the entity imports, normalized by max.
//   2: riskScore   — mean FileNode.riskScore across files in subtree,
//                    normalized by max.
//   3: loc         — total FileNode.loc, normalized by max.
//   4: taintScore  — sum of (signals.taintCount + signals.archViolations),
//                    normalized by max.
//   5: cpxScore    — max signals.cpxMax across files, normalized by max.
//
// Projection: two fixed unit projection vectors (golden-angle-derived,
// encoded as literals — never Math.random):
//
//   projX = [0.5257, -0.8507, 0.0000, 0.3090, -0.5878, 0.4755]
//   projY = [0.4472,  0.2764, -0.8944, 0.1382,  0.6882, -0.3090]
//
// Spread normalization: translate + scale so bounding box is centered
// at origin and max extent is ±0.85.
//
// Repulsion pass (deterministic): 3 passes of grid-based repulsion on
// a 10×10 grid to reduce overlap; fixed delta 0.05 per nudge; sorted
// by id for determinism.

// ── Fixed projection vectors (golden-angle-derived, deterministic) ──
const PROJ_X = [0.5257, -0.8507, 0.0000, 0.3090, -0.5878, 0.4755] as const;
const PROJ_Y = [0.4472, 0.2764, -0.8944, 0.1382, 0.6882, -0.3090] as const;

const SPREAD_MAX = 0.85;
const REPULSION_PASSES = 3;
const REPULSION_GRID = 10;
const REPULSION_DELTA = 0.05;

/** Dot product of a feature vector with a 6-component projection vector. */
function dot6(features: readonly number[], proj: readonly number[]): number {
  return (
    features[0]! * proj[0]! +
    features[1]! * proj[1]! +
    features[2]! * proj[2]! +
    features[3]! * proj[3]! +
    features[4]! * proj[4]! +
    features[5]! * proj[5]!
  );
}

/**
 * Project a set of 6-dim feature vectors into 2D space.
 *
 * Returns a Map from each entity id to its normalized (x, y) position
 * in [-0.85, 0.85] space.
 *
 * Deterministic: same input → same output every run. No Math.random.
 */
export function projectToEmbeddingSpace(
  featureVectors: Array<{ id: string; features: number[] }>,
): Map<string, { x: number; y: number }> {
  if (featureVectors.length === 0) return new Map();

  // ── 1. Raw projection via dot products ────────────────────────────
  const rawPositions: Array<{ id: string; x: number; y: number }> = featureVectors.map(fv => ({
    id: fv.id,
    x: dot6(fv.features, PROJ_X),
    y: dot6(fv.features, PROJ_Y),
  }));

  // ── 2. Spread normalization ────────────────────────────────────────
  // Find bounding box of raw positions.
  let minX = rawPositions[0]!.x;
  let maxX = rawPositions[0]!.x;
  let minY = rawPositions[0]!.y;
  let maxY = rawPositions[0]!.y;
  for (const p of rawPositions) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  // Translate to centre at origin, then scale to ±SPREAD_MAX.
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const scale = rangeX === 0 && rangeY === 0
    ? 1
    : SPREAD_MAX / Math.max(rangeX / 2, rangeY / 2, 1e-9);

  const positions: Array<{ id: string; x: number; y: number }> = rawPositions.map(p => ({
    id: p.id,
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }));

  // ── 3. Grid-based repulsion (deterministic, 3 passes) ─────────────
  // Sort by id before processing to ensure determinism.
  positions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (let pass = 0; pass < REPULSION_PASSES; pass++) {
    // Build grid cells: 10×10 over the [-1, 1] space.
    const cellSize = 2.0 / REPULSION_GRID;
    // Map from cell key to list of position indices.
    const cells = new Map<string, number[]>();
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!;
      // Clamp to grid range to avoid OOB keys.
      const gx = Math.min(REPULSION_GRID - 1, Math.max(0, Math.floor((p.x + 1) / cellSize)));
      const gy = Math.min(REPULSION_GRID - 1, Math.max(0, Math.floor((p.y + 1) / cellSize)));
      const key = `${gx},${gy}`;
      const cell = cells.get(key);
      if (cell) {
        cell.push(i);
      } else {
        cells.set(key, [i]);
      }
    }

    // For cells with >1 point, nudge overlapping points apart.
    // Sorted cell keys ensure deterministic iteration.
    const sortedKeys = [...cells.keys()].sort();
    for (const key of sortedKeys) {
      const indices = cells.get(key)!;
      if (indices.length < 2) continue;
      // Nudge each point away from the cell centroid.
      let centX = 0;
      let centY = 0;
      for (const idx of indices) {
        centX += positions[idx]!.x;
        centY += positions[idx]!.y;
      }
      centX /= indices.length;
      centY /= indices.length;
      for (const idx of indices) {
        const p = positions[idx]!;
        const dx = p.x - centX;
        const dy = p.y - centY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-9) {
          // Coincident: nudge in a deterministic direction based on index.
          const angle = (idx / indices.length) * 2 * Math.PI;
          p.x += Math.cos(angle) * REPULSION_DELTA;
          p.y += Math.sin(angle) * REPULSION_DELTA;
        } else {
          p.x += (dx / dist) * REPULSION_DELTA;
          p.y += (dy / dist) * REPULSION_DELTA;
        }
      }
    }
  }

  // ── 4. Return as Map ───────────────────────────────────────────────
  const result = new Map<string, { x: number; y: number }>();
  for (const p of positions) {
    result.set(p.id, { x: p.x, y: p.y });
  }
  return result;
}
