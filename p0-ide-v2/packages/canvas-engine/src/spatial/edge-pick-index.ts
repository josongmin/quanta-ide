import type { FileEdge } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "../layout/types";

export interface EdgePickIndex {
  pickAt(worldX: number, worldY: number, maxWorldPx: number): FileEdge | null;
  build(edges: readonly FileEdge[], layout: WorkspaceLayout, samples?: number): void;
  clear(): void;
}

const DEFAULT_SAMPLES = 16;

function sampleBezier(
  route: BezierRoute,
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * route.x1 + b * route.cx1 + c * route.cx2 + d * route.x2,
    y: a * route.y1 + b * route.cy1 + c * route.cy2 + d * route.y2,
  };
}

class EdgePickIndexImpl implements EdgePickIndex {
  private xs: Float32Array = new Float32Array(0);
  private ys: Float32Array = new Float32Array(0);
  private edgeIdx: Int32Array = new Int32Array(0);
  private edges: FileEdge[] = [];
  private pointCount = 0;

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

    const denom = N - 1;
    for (let i = 0; i < kept.length; i++) {
      const route = routes[i];
      const base = i * N;
      for (let j = 0; j < N; j++) {
        const t = j / denom;
        const p = sampleBezier(route, t);
        this.xs[base + j] = p.x;
        this.ys[base + j] = p.y;
        this.edgeIdx[base + j] = i;
      }
    }
  }

  pickAt(worldX: number, worldY: number, maxWorldPx: number): FileEdge | null {
    if (this.pointCount === 0) return null;
    const maxSq = maxWorldPx * maxWorldPx;
    let bestSq = Infinity;
    let bestEdge: FileEdge | null = null;
    const xs = this.xs;
    const ys = this.ys;
    const idx = this.edgeIdx;
    const edges = this.edges;
    for (let p = 0; p < this.pointCount; p++) {
      const dx = xs[p] - worldX;
      const dy = ys[p] - worldY;
      const dSq = dx * dx + dy * dy;
      if (dSq >= bestSq) continue;
      if (dSq > maxSq) continue;
      const edge = edges[idx[p]];
      if (dSq < bestSq) {
        bestSq = dSq;
        bestEdge = edge;
      } else if (dSq === bestSq && bestEdge && edge.id < bestEdge.id) {
        bestEdge = edge;
      }
    }
    if (!bestEdge) return null;
    let tieEdge = bestEdge;
    for (let p = 0; p < this.pointCount; p++) {
      const dx = xs[p] - worldX;
      const dy = ys[p] - worldY;
      const dSq = dx * dx + dy * dy;
      if (dSq === bestSq) {
        const edge = edges[idx[p]];
        if (edge.id < tieEdge.id) tieEdge = edge;
      }
    }
    return tieEdge;
  }

  clear(): void {
    this.xs = new Float32Array(0);
    this.ys = new Float32Array(0);
    this.edgeIdx = new Int32Array(0);
    this.edges = [];
    this.pointCount = 0;
  }
}

export function createEdgePickIndex(): EdgePickIndex {
  return new EdgePickIndexImpl();
}
