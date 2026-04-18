import type { WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import type { EdgeGeometryBatch } from "./messages";

export function runGeometryTask(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
): EdgeGeometryBatch {
  const edgeIds: string[] = [];
  // Count edges that have a route so we can pre-allocate
  let count = 0;
  for (const edge of graph.fileEdges) {
    if (layout.edgeRoutes.has(edge.id)) count++;
  }

  // 8 floats per edge: x1, y1, cx1, cy1, cx2, cy2, x2, y2
  const positions = new Float32Array(count * 8);
  let offset = 0;

  for (const edge of graph.fileEdges) {
    const route = layout.edgeRoutes.get(edge.id);
    if (!route) continue;

    positions[offset]     = route.x1;
    positions[offset + 1] = route.y1;
    positions[offset + 2] = route.cx1;
    positions[offset + 3] = route.cy1;
    positions[offset + 4] = route.cx2;
    positions[offset + 5] = route.cy2;
    positions[offset + 6] = route.x2;
    positions[offset + 7] = route.y2;
    offset += 8;

    edgeIds.push(edge.id);
  }

  return { positions, edgeIds };
}
