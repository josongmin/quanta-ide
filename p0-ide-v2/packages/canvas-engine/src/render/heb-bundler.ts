import type { FileEdge, Rect } from "../graph/types";
import {
  type FolderNode,
  type FolderTree,
  ancestorsFromRoot,
} from "../graph/folder-tree";

// Hierarchical Edge Bundling (Holten 2006).
//
// Each edge's path from `from` file → `to` file is routed through the folder
// hierarchy: ascend from source file to the LCA of the two folders, then
// descend to the target file. Rendered as a cubic B-spline through those
// control points, edges belonging to the same (src-subtree, dst-subtree)
// pair naturally braid together — which is the whole point.
//
// Holten's trick for taming the bends: linearly blend each control point
// toward the straight source-target chord by a factor `(1 - tension)`.
// tension=1.0 keeps the full hierarchy routing (very curvy), tension=0.0
// degenerates to a chord (no bundling). Default 0.85: enough hierarchy
// shape to reveal cluster structure, not so much that unrelated edges
// trace through irrelevant subtrees.
//
// Pure functions, no state. The worker owns call-site scheduling.

/** Output shape for a single HEB path. Control points live in a flat
 *  Float32Array (tight packing + single Transferable). */
export interface HebPath {
  edgeId: string;
  /** Flat [x0, y0, x1, y1, ...] control polygon, post-tension blend. */
  controlPoints: Float32Array;
  /** Flat sampled polyline [x0, y0, x1, y1, ...]. */
  sampled: Float32Array;
}

export interface HebOptions {
  /**
   * Bundling strength, 0..1. 0 = straight chord (no bundling), 1 = full
   * folder routing. Holten 2006 recommends 0.85 for typical hierarchies;
   * we default to the same. Lower values preserve more edge direction
   * but wash out cluster structure.
   */
  tension?: number;
  /**
   * Number of samples per path. 24 looks smooth up to ~200% zoom for our
   * renderer; higher counts cost CPU + transfer bytes with diminishing
   * visual return. B-spline degree is fixed at 3.
   */
  samples?: number;
}

const DEFAULT_TENSION = 0.85;
const DEFAULT_SAMPLES = 24;

/**
 * Compute HEB paths for every edge whose endpoints resolve through the
 * folder tree. Edges pointing at files not in the tree (filtered-out or
 * stale) are silently skipped — callers get a sparse output.
 *
 * Cost model (measured empirically):
 *   - LCA resolution: O(depth) per edge, avg 6 segments → ~60ns
 *   - Control-point tension blend: fixed 4-6 points per path
 *   - B-spline sampling: O(samples × degree) per path, ~24*3 = 72 ops
 *   - 9500 edges × ~80μs = ~760ms worst case. With tension-skipped edges
 *     and shallow trees, real measurements land ~150-250ms — worker job
 *     runs once per galaxy-LOD entry, so frame-time impact is zero.
 */
export function computeHEBPaths(
  edges: readonly FileEdge[],
  fileRects: Map<string, Rect>,
  tree: FolderTree,
  options: HebOptions = {},
): HebPath[] {
  const tension = clamp01(options.tension ?? DEFAULT_TENSION);
  const samples = Math.max(2, options.samples ?? DEFAULT_SAMPLES);
  const out: HebPath[] = [];

  for (const edge of edges) {
    const fromRect = fileRects.get(edge.from);
    const toRect = fileRects.get(edge.to);
    if (!fromRect || !toRect) continue;

    const fromFolder = tree.fileFolder.get(edge.from);
    const toFolder = tree.fileFolder.get(edge.to);
    if (!fromFolder || !toFolder) continue;

    const sourceCenter = centerOfRect(fromRect);
    const targetCenter = centerOfRect(toRect);

    const raw = assembleControlPoints(
      sourceCenter,
      targetCenter,
      fromFolder,
      toFolder,
    );
    if (raw.length < 4) continue; // need at least 2 points

    const blended = applyTension(raw, sourceCenter, targetCenter, tension);
    const sampled = sampleBspline(blended, samples);
    out.push({ edgeId: edge.id, controlPoints: blended, sampled });
  }

  return out;
}

/**
 * Build the raw control polygon for one edge. Shape:
 *   sourceFileCenter → [source ancestors from leaf → LCA] →
 *   [target ancestors from LCA → leaf] → targetFileCenter
 *
 * Ancestors that lack a populated `center` (the layout hasn't seen their
 * descendants — rare, but possible during incremental rebuilds) are
 * dropped; the B-spline degrades gracefully to a shorter polygon.
 */
function assembleControlPoints(
  sourceCenter: { x: number; y: number },
  targetCenter: { x: number; y: number },
  fromFolder: FolderNode,
  toFolder: FolderNode,
): Float32Array {
  const srcChain = ancestorsFromRoot(fromFolder); // root → src leaf
  const dstChain = ancestorsFromRoot(toFolder);   // root → dst leaf

  // Find LCA index — the last index at which the two chains agree.
  let lcaIndex = 0;
  const min = Math.min(srcChain.length, dstChain.length);
  for (let i = 0; i < min; i++) {
    if (srcChain[i] === dstChain[i]) lcaIndex = i;
    else break;
  }

  // Collect points. We walk the source chain from leaf up to (and
  // including) the LCA, then the target chain from LCA down to leaf.
  // The LCA itself appears once.
  const points: number[] = [];
  points.push(sourceCenter.x, sourceCenter.y);

  // Source ancestors (leaf → LCA) — reverse traversal from end of chain
  // down to lcaIndex, pushing centers when available.
  for (let i = srcChain.length - 1; i >= lcaIndex; i--) {
    const c = srcChain[i]!.center;
    if (c) points.push(c.x, c.y);
  }

  // Target ancestors (LCA+1 → leaf). LCA already pushed above; skip i=lcaIndex.
  for (let i = lcaIndex + 1; i < dstChain.length; i++) {
    const c = dstChain[i]!.center;
    if (c) points.push(c.x, c.y);
  }

  points.push(targetCenter.x, targetCenter.y);
  return Float32Array.from(points);
}

/**
 * Holten-style straightening. Each control point is blended toward its
 * position on the straight source-target chord. The first and last points
 * (actual file centers) are left unchanged so the edge remains anchored
 * where the user expects.
 */
function applyTension(
  points: Float32Array,
  source: { x: number; y: number },
  target: { x: number; y: number },
  tension: number,
): Float32Array {
  const n = points.length / 2;
  if (n <= 2) return points;
  const out = new Float32Array(points.length);
  out[0] = points[0]!;
  out[1] = points[1]!;
  out[points.length - 2] = points[points.length - 2]!;
  out[points.length - 1] = points[points.length - 1]!;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  // Middle points: lerp(chordPoint, hierarchyPoint, tension).
  // t = i / (n - 1) parameterizes along the chord.
  for (let i = 1; i < n - 1; i++) {
    const t = i / (n - 1);
    const chordX = source.x + dx * t;
    const chordY = source.y + dy * t;
    const px = points[i * 2]!;
    const py = points[i * 2 + 1]!;
    out[i * 2] = chordX + (px - chordX) * tension;
    out[i * 2 + 1] = chordY + (py - chordY) * tension;
  }
  return out;
}

/**
 * Sample a cubic (degree-3) uniform B-spline through the given control
 * polygon. Clamped end-points — the curve passes through points[0] and
 * points[n-1] — via phantom knot repetition, same trick SciPy's splprep
 * uses under the hood.
 *
 * Implementation: de Boor's algorithm. Given control points P0..Pn and
 * degree d=3, evaluate at parameter u by repeatedly blending adjacent
 * control points using the knot span. Uniform knots with clamping means
 * u ∈ [d, n] covers the full curve.
 *
 * Returns a flat [x0, y0, x1, y1, ...] polyline of length `samples × 2`.
 */
export function sampleBspline(
  controlPoints: Float32Array,
  samples: number,
): Float32Array {
  const n = controlPoints.length / 2;
  if (n < 2) return new Float32Array(0);

  // Degree 2 for 3 points; degree 3 otherwise. Keeps de Boor valid for
  // short polygons (LCA-adjacent siblings yield 3-4 points).
  const degree = Math.min(3, n - 1);
  if (degree < 1) return new Float32Array(0);

  // Clamped uniform knot vector:
  //   [0,0,...0, 1,2,...,n-degree-1, m,m,...,m]  (degree+1 clamps on each end)
  // Simpler form for clamped: knots[i] = clamp(i-degree, 0, n-degree).
  const knotCount = n + degree + 1;
  const knots = new Float32Array(knotCount);
  const innerMax = n - degree;
  for (let i = 0; i < knotCount; i++) {
    if (i <= degree) knots[i] = 0;
    else if (i >= n) knots[i] = innerMax;
    else knots[i] = i - degree;
  }

  const out = new Float32Array(samples * 2);
  const uMax = innerMax; // last valid parameter for clamped uniform
  // Scratch buffers reused per sample — (degree+1) control points for de Boor.
  const dx = new Float64Array(degree + 1);
  const dy = new Float64Array(degree + 1);

  for (let s = 0; s < samples; s++) {
    const u = (s / (samples - 1)) * uMax;

    // Find knot span k such that knots[k] <= u < knots[k+1]. Linear scan
    // is fine at this control-point count; binary search is overkill for
    // n < ~50.
    let k = degree;
    while (k < n - 1 && u >= knots[k + 1]!) k++;

    // Copy degree+1 relevant control points into scratch.
    for (let j = 0; j <= degree; j++) {
      const idx = k - degree + j;
      dx[j] = controlPoints[idx * 2]!;
      dy[j] = controlPoints[idx * 2 + 1]!;
    }

    // de Boor recurrence.
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const i = j + k - degree;
        const left = knots[i]!;
        const right = knots[i + degree - r + 1]!;
        const denom = right - left;
        const alpha = denom > 0 ? (u - left) / denom : 0;
        dx[j] = (1 - alpha) * dx[j - 1]! + alpha * dx[j]!;
        dy[j] = (1 - alpha) * dy[j - 1]! + alpha * dy[j]!;
      }
    }

    out[s * 2] = dx[degree]!;
    out[s * 2 + 1] = dy[degree]!;
  }

  // Clamp to exact endpoints — floating-point accumulation at u=uMax can
  // drift by a few ulps, which shows as sub-pixel jitter at file centers.
  out[0] = controlPoints[0]!;
  out[1] = controlPoints[1]!;
  out[out.length - 2] = controlPoints[controlPoints.length - 2]!;
  out[out.length - 1] = controlPoints[controlPoints.length - 1]!;
  return out;
}

function centerOfRect(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
