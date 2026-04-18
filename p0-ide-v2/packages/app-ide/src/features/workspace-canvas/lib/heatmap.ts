import type { WorkspaceLayout, WorkspaceGraph, Rect } from "@quanta/canvas-engine";

export interface HeatCell {
  x: number;
  y: number;
  w: number;
  h: number;
  heat: number;
}

export interface ComputeHeatmapOpts {
  includeCriticalEdges?: boolean;
}

// Risk heatmap is a coarse spatial density of where concerning code lives.
// Gephi/Structure101 ship this so users can bee-line from the minimap to
// hot spots instead of hunting around in the main canvas. Pure + stable —
// callers memoize on `(layout, graph, gridCols, gridRows, opts)`.
export function computeRiskHeatmap(
  layout: WorkspaceLayout,
  graph: WorkspaceGraph,
  gridCols: number,
  gridRows: number,
  opts: ComputeHeatmapOpts = {},
): HeatCell[] {
  const tb = layout?.totalBounds;
  // totalBounds may be missing on partial/in-flight layouts — bail with an
  // empty heatmap rather than throwing or painting NaNs.
  if (!tb || tb.w <= 0 || tb.h <= 0) return [];
  if (gridCols <= 0 || gridRows <= 0) return [];

  const includeCriticalEdges = opts.includeCriticalEdges ?? true;

  const cellW = tb.w / gridCols;
  const cellH = tb.h / gridRows;
  const weights = new Float32Array(gridCols * gridRows);

  const idxOf = (cx: number, cy: number): number => cy * gridCols + cx;

  const clampCol = (c: number): number =>
    c < 0 ? 0 : c >= gridCols ? gridCols - 1 : c;
  const clampRow = (r: number): number =>
    r < 0 ? 0 : r >= gridRows ? gridRows - 1 : r;

  // File weights: blastCritical and taintCount are the two signals that
  // most strongly correlate with "navigate here first" in triage, so
  // weight them above raw riskScore (which is already aggregate).
  const fileRects = layout.fileRects;
  for (const file of graph.files) {
    const rect = fileRects.get(file.id);
    if (!rect) continue;
    const cx = rect.x + rect.w * 0.5;
    const cy = rect.y + rect.h * 0.5;
    const gx = clampCol(Math.floor((cx - tb.x) / cellW));
    const gy = clampRow(Math.floor((cy - tb.y) / cellH));
    const s = file.signals;
    const w = Math.max(
      file.riskScore,
      s.blastCritical * 30,
      s.taintCount * 15,
    );
    if (w > 0) weights[idxOf(gx, gy)] += w;
  }

  if (includeCriticalEdges) {
    const routes = layout.edgeRoutes;
    // Only `critical` severity edges contribute — medium/high are visible
    // as edge colour in the main canvas; the heatmap is a coarse hotspot
    // overlay, not a severity distribution chart.
    for (const edge of graph.fileEdges) {
      if (edge.severity !== "critical") continue;
      const route = routes.get(edge.id);
      let mx: number;
      let my: number;
      if (route) {
        mx = (route.x1 + route.x2) * 0.5;
        my = (route.y1 + route.y2) * 0.5;
      } else {
        const ra = fileRects.get(edge.from);
        const rb = fileRects.get(edge.to);
        if (!ra || !rb) continue;
        mx = (ra.x + ra.w * 0.5 + rb.x + rb.w * 0.5) * 0.5;
        my = (ra.y + ra.h * 0.5 + rb.y + rb.h * 0.5) * 0.5;
      }
      const gx = clampCol(Math.floor((mx - tb.x) / cellW));
      const gy = clampRow(Math.floor((my - tb.y) / cellH));
      weights[idxOf(gx, gy)] += 25;
    }
  }

  // Normalize by max, not sum — we want relative hotness, and a single
  // extreme file shouldn't wash out everything else (a sum-normalize
  // would).
  let maxW = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > maxW) maxW = weights[i];
  }
  if (maxW <= 0) return [];

  const out: HeatCell[] = [];
  const threshold = 0.02;
  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const w = weights[idxOf(gx, gy)];
      if (w <= 0) continue;
      const heat = w / maxW;
      if (heat <= threshold) continue;
      out.push({
        x: tb.x + gx * cellW,
        y: tb.y + gy * cellH,
        w: cellW,
        h: cellH,
        heat,
      });
    }
  }
  return out;
}

// Exposed for tests / alternate renderers — unused internally but kept
// so the shape of HeatCell can be consumed without re-importing Rect.
export type HeatCellRect = Pick<Rect, "x" | "y" | "w" | "h">;
