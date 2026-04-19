import type { FileEdge } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "../layout/types";

export interface EdgePickIndex {
  pickAt(worldX: number, worldY: number, maxWorldPx: number): FileEdge | null;
  build(edges: readonly FileEdge[], layout: WorkspaceLayout, samples?: number): void;
  clear(): void;
}

const DEFAULT_SAMPLES = 16;

// Target cell-count for the spatial grid. `pickAt` is then O(pointsInCell +
// neighborsInFilter) instead of O(totalPoints). With ~16 cells × 16 cells =
// ~256 cells, and ~160k points evenly distributed ≈ 625 points/cell, a typical
// pick only scans a 3×3 neighbourhood (≈5k points) — roughly 30× faster than
// the O(160k) linear scan it replaced. The constant is empirical: too small
// wastes cache builds; too large leaves cells too sparse to amortise the
// bbox traversal.
const TARGET_CELLS_PER_AXIS = 16;

function sampleBezier(
  route: BezierRoute,
  t: number,
  out: { x: number; y: number },
): void {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  out.x = a * route.x1 + b * route.cx1 + c * route.cx2 + d * route.x2;
  out.y = a * route.y1 + b * route.cy1 + c * route.cy2 + d * route.y2;
}

class EdgePickIndexImpl implements EdgePickIndex {
  private xs: Float32Array = new Float32Array(0);
  private ys: Float32Array = new Float32Array(0);
  private edgeIdx: Int32Array = new Int32Array(0);
  private edges: FileEdge[] = [];
  private pointCount = 0;

  // Grid spatial index.
  // --------------------------------------------------------------
  // Previously pickAt scanned every point in the flat Float32Array
  // (O(edges × samples)). For a full-graph build at ~10k edges × 16
  // samples that's ~160k point comparisons PER MOUSEMOVE. Hover traffic
  // during pan routinely fires 120+ Hz — ~19M compares/sec just to pick
  // the nearest edge, long enough to show up as dropped frames.
  //
  // The new grid stores a per-cell packed array of point indices. Build
  // time: O(N) single pass. Pick: O(9 × points-in-neighbourhood) via a
  // 3×3 cell window around the query point (plus a small `maxWorldPx`
  // expansion when the query falls near a cell boundary).
  //
  // All state is lazily allocated on first build; cleared by `clear()`.
  private gridMinX = 0;
  private gridMinY = 0;
  private gridCellW = 1;
  private gridCellH = 1;
  private gridCols = 0;
  private gridRows = 0;
  // Flat CSR-style layout: cellOffsets[c] .. cellOffsets[c+1] are the
  // range of indices in `cellPoints` that fall inside cell `c`. That
  // avoids per-cell array allocations (one big Int32Array vs. thousands
  // of JS arrays, which would dominate GC).
  private cellOffsets: Int32Array = new Int32Array(0);
  private cellPoints: Int32Array = new Int32Array(0);

  build(edges: readonly FileEdge[], layout: WorkspaceLayout, samples?: number): void {
    const N = Math.max(2, samples ?? DEFAULT_SAMPLES);
    const kept: FileEdge[] = [];
    const routes: BezierRoute[] = [];
    for (const e of edges) {
      const r = layout.edgeRoutes.get(e.id);
      if (!r) continue;
      kept.push(e);
      routes.push(r);
    }
    const total = kept.length * N;
    this.xs = new Float32Array(total);
    this.ys = new Float32Array(total);
    this.edgeIdx = new Int32Array(total);
    this.edges = kept;
    this.pointCount = total;

    if (total === 0) {
      // Nothing to index — zero the grid so pickAt returns null fast.
      this.gridCols = 0;
      this.gridRows = 0;
      this.cellOffsets = new Int32Array(0);
      this.cellPoints = new Int32Array(0);
      return;
    }

    // One-pass bezier sampling + running min/max for the grid bbox.
    const scratch = { x: 0, y: 0 };
    const denom = N - 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < kept.length; i++) {
      const route = routes[i];
      const base = i * N;
      for (let j = 0; j < N; j++) {
        sampleBezier(route, j / denom, scratch);
        this.xs[base + j] = scratch.x;
        this.ys[base + j] = scratch.y;
        this.edgeIdx[base + j] = i;
        if (scratch.x < minX) minX = scratch.x;
        if (scratch.x > maxX) maxX = scratch.x;
        if (scratch.y < minY) minY = scratch.y;
        if (scratch.y > maxY) maxY = scratch.y;
      }
    }

    // Build the grid. Cell size = span / TARGET_CELLS_PER_AXIS, floored
    // at 1 world-unit so degenerate single-point graphs don't collapse
    // to a zero-sized grid (NaN divisions).
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    this.gridCellW = Math.max(1, spanX / TARGET_CELLS_PER_AXIS);
    this.gridCellH = Math.max(1, spanY / TARGET_CELLS_PER_AXIS);
    this.gridCols = Math.max(1, Math.ceil(spanX / this.gridCellW));
    this.gridRows = Math.max(1, Math.ceil(spanY / this.gridCellH));
    this.gridMinX = minX;
    this.gridMinY = minY;

    const cellCount = this.gridCols * this.gridRows;
    // Two-pass CSR build: count per cell, prefix-sum, then scatter.
    const counts = new Int32Array(cellCount);
    const cellAssignments = new Int32Array(total);
    for (let p = 0; p < total; p++) {
      const cx = Math.min(this.gridCols - 1, Math.floor((this.xs[p] - minX) / this.gridCellW));
      const cy = Math.min(this.gridRows - 1, Math.floor((this.ys[p] - minY) / this.gridCellH));
      const c = cy * this.gridCols + cx;
      cellAssignments[p] = c;
      counts[c]++;
    }
    const offsets = new Int32Array(cellCount + 1);
    let acc = 0;
    for (let c = 0; c < cellCount; c++) {
      offsets[c] = acc;
      acc += counts[c];
    }
    offsets[cellCount] = acc;
    // Reuse `counts` as write cursors — saves another allocation.
    for (let c = 0; c < cellCount; c++) counts[c] = 0;
    const points = new Int32Array(total);
    for (let p = 0; p < total; p++) {
      const c = cellAssignments[p];
      points[offsets[c] + counts[c]] = p;
      counts[c]++;
    }
    this.cellOffsets = offsets;
    this.cellPoints = points;
  }

  pickAt(worldX: number, worldY: number, maxWorldPx: number): FileEdge | null {
    if (this.pointCount === 0) return null;
    const maxSq = maxWorldPx * maxWorldPx;

    // Compute the cell window that could possibly contain a hit. Any
    // point whose distance from `(worldX, worldY)` is ≤ maxWorldPx must
    // live in a cell whose extent overlaps the `(worldX ± maxWorldPx,
    // worldY ± maxWorldPx)` box — so we expand the initial query cell
    // by `ceil(maxWorldPx / cellSize)` in every direction.
    const cellW = this.gridCellW;
    const cellH = this.gridCellH;
    const expandCols = Math.max(1, Math.ceil(maxWorldPx / cellW));
    const expandRows = Math.max(1, Math.ceil(maxWorldPx / cellH));
    const centreCx = Math.floor((worldX - this.gridMinX) / cellW);
    const centreCy = Math.floor((worldY - this.gridMinY) / cellH);
    const minCx = Math.max(0, centreCx - expandCols);
    const maxCx = Math.min(this.gridCols - 1, centreCx + expandCols);
    const minCy = Math.max(0, centreCy - expandRows);
    const maxCy = Math.min(this.gridRows - 1, centreCy + expandRows);
    // If the query fell outside the grid and the expansion didn't reach
    // any cell, there can't be a hit.
    if (minCx > maxCx || minCy > maxCy) return null;

    let bestSq = Infinity;
    let bestEdge: FileEdge | null = null;
    const xs = this.xs;
    const ys = this.ys;
    const idx = this.edgeIdx;
    const edges = this.edges;
    const offsets = this.cellOffsets;
    const points = this.cellPoints;
    const cols = this.gridCols;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const c = cy * cols + cx;
        const from = offsets[c];
        const to = offsets[c + 1];
        for (let k = from; k < to; k++) {
          const p = points[k];
          const dx = xs[p] - worldX;
          const dy = ys[p] - worldY;
          const dSq = dx * dx + dy * dy;
          if (dSq > maxSq) continue;
          if (dSq < bestSq) {
            bestSq = dSq;
            bestEdge = edges[idx[p]];
          } else if (dSq === bestSq && bestEdge) {
            const edge = edges[idx[p]];
            if (edge.id < bestEdge.id) bestEdge = edge;
          }
        }
      }
    }
    return bestEdge;
  }

  clear(): void {
    this.xs = new Float32Array(0);
    this.ys = new Float32Array(0);
    this.edgeIdx = new Int32Array(0);
    this.edges = [];
    this.pointCount = 0;
    this.gridCols = 0;
    this.gridRows = 0;
    this.cellOffsets = new Int32Array(0);
    this.cellPoints = new Int32Array(0);
  }
}

export function createEdgePickIndex(): EdgePickIndex {
  return new EdgePickIndexImpl();
}
