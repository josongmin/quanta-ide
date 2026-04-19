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
  private samplesPerEdge = 0;
  // Longest gap between consecutive bezier samples on any edge. Used to
  // pad the cell-window expansion in `pickAt` so a segment whose nearer
  // endpoint sits in a far cell is still considered.
  private maxSegmentLength = 0;

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
    this.samplesPerEdge = N;

    if (total === 0) {
      // Nothing to index — zero the grid so pickAt returns null fast.
      this.gridCols = 0;
      this.gridRows = 0;
      this.cellOffsets = new Int32Array(0);
      this.cellPoints = new Int32Array(0);
      this.maxSegmentLength = 0;
      return;
    }

    // One-pass bezier sampling + running min/max for the grid bbox + the
    // longest inter-sample segment (drives the pickAt search expansion).
    const scratch = { x: 0, y: 0 };
    const denom = N - 1;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let maxSegSq = 0;
    for (let i = 0; i < kept.length; i++) {
      const route = routes[i];
      const base = i * N;
      let prevX = 0, prevY = 0;
      for (let j = 0; j < N; j++) {
        sampleBezier(route, j / denom, scratch);
        this.xs[base + j] = scratch.x;
        this.ys[base + j] = scratch.y;
        this.edgeIdx[base + j] = i;
        if (scratch.x < minX) minX = scratch.x;
        if (scratch.x > maxX) maxX = scratch.x;
        if (scratch.y < minY) minY = scratch.y;
        if (scratch.y > maxY) maxY = scratch.y;
        if (j > 0) {
          const dx = scratch.x - prevX;
          const dy = scratch.y - prevY;
          const segSq = dx * dx + dy * dy;
          if (segSq > maxSegSq) maxSegSq = segSq;
        }
        prevX = scratch.x;
        prevY = scratch.y;
      }
    }
    this.maxSegmentLength = Math.sqrt(maxSegSq);

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

    // Compute the cell window that could contain a hit. We test
    // point-to-segment distance, where a segment connects sample j to
    // sample j+1 of the same edge. A segment hit can be entered from
    // EITHER endpoint, so the search must reach any cell containing the
    // first endpoint of any segment whose body is within maxWorldPx.
    // That's `maxWorldPx + maxSegmentLength` from the query point.
    //
    // Without this padding, picking would silently fail at high zoom:
    // a small `maxWorldPx` (8 screen px / scale) collapses the cell
    // window to 1×1, and a segment crossing that single cell whose
    // endpoints both live in neighbour cells is invisible — which is
    // exactly the "edges only clickable at certain zoom levels" bug.
    const cellW = this.gridCellW;
    const cellH = this.gridCellH;
    const reach = maxWorldPx + this.maxSegmentLength;
    const expandCols = Math.max(1, Math.ceil(reach / cellW));
    const expandRows = Math.max(1, Math.ceil(reach / cellH));
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
    const N = this.samplesPerEdge;

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const c = cy * cols + cx;
        const from = offsets[c];
        const to = offsets[c + 1];
        for (let k = from; k < to; k++) {
          const p = points[k];
          // Test the segment that STARTS at this sample. The last
          // sample of an edge has no following segment — a segment
          // ending at it is owned by sample p-1 (which, if it belongs
          // to a nearby edge, will get visited from its own cell
          // entry). This guarantees each segment is tested at most once.
          if (((p + 1) % N) === 0) continue;
          const ax = xs[p];
          const ay = ys[p];
          const bx = xs[p + 1];
          const by = ys[p + 1];
          const sx = bx - ax;
          const sy = by - ay;
          const len2 = sx * sx + sy * sy;
          let dSq: number;
          if (len2 === 0) {
            const dx = ax - worldX;
            const dy = ay - worldY;
            dSq = dx * dx + dy * dy;
          } else {
            // Project (worldX,worldY) onto segment, clamped to [0,1].
            let t = ((worldX - ax) * sx + (worldY - ay) * sy) / len2;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            const px = ax + t * sx;
            const py = ay + t * sy;
            const dx = px - worldX;
            const dy = py - worldY;
            dSq = dx * dx + dy * dy;
          }
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
    this.samplesPerEdge = 0;
    this.maxSegmentLength = 0;
    this.gridCols = 0;
    this.gridRows = 0;
    this.cellOffsets = new Int32Array(0);
    this.cellPoints = new Int32Array(0);
  }
}

export function createEdgePickIndex(): EdgePickIndex {
  return new EdgePickIndexImpl();
}
