// build-pathfinder-layout.ts
// ---------------------------------------------------------------
// Pure algorithm: WorkspaceGraph + opts → PathfinderLayout.
//
// Source / target selection:
//   - Default:
//       source = file with most OUTGOING edges
//       target = file with most INCOMING edges (≠ source)
//   - If selectedId provided:
//       source = selectedId
//       target = highest riskScore file ≠ source
//
// Path computation:
//   findPaths(graph, { sourceFileId, targetFileId, mode: "k-shortest", k: 3, directional: true })
//
// Layout (horizontal flow):
//   - Source at x=LEFT_X, vertically centered
//   - Target at x=RIGHT_X, vertically centered
//   - Intermediate nodes spread in columns by path position index
//   - Each path gets a distinct color (path 0=blue, 1=purple, 2=teal)
//   - Nodes on multiple paths get the first matched path color (pathMask encodes all)
//
// Determinism: sorts are stable by fileId as tie-breaker.

import { findPaths } from "@quanta/canvas-engine";
import type { BuildPathfinderLayoutOpts, PathfinderEdge, PathfinderLayout, PathfinderNode } from "./types";

// ── Constants ──────────────────────────────────────────────────────────

const PATH_COLORS = ["#0d99ff", "#7e4ed6", "#22a06b"] as const;

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;

// ── Source / target selection ─────────────────────────────────────────

function pickSourceTarget(
  graph: { files: readonly { id: string; riskScore: number }[]; fileEdges: readonly { from: string; to: string }[] },
  selectedId?: string,
): { sourceId: string; targetId: string } | null {
  if (graph.files.length < 2) return null;

  if (selectedId) {
    const source = graph.files.find(f => f.id === selectedId);
    if (!source) return null;

    // Target = highest riskScore file ≠ selectedId (stable sort by id for ties)
    const others = graph.files
      .filter(f => f.id !== selectedId)
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    const target = others[0];
    if (!target) return null;
    return { sourceId: selectedId, targetId: target.id };
  }

  // Count out-degree and in-degree
  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const f of graph.files) { outDeg.set(f.id, 0); inDeg.set(f.id, 0); }
  for (const e of graph.fileEdges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  // Source: highest out-degree (stable by id)
  const sortedByOut = [...graph.files].sort((a, b) => {
    const da = outDeg.get(a.id) ?? 0;
    const db = outDeg.get(b.id) ?? 0;
    if (db !== da) return db - da;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const sourceId = sortedByOut[0]?.id;
  if (!sourceId) return null;

  // Target: highest in-degree ≠ source (stable by id)
  const sortedByIn = [...graph.files]
    .filter(f => f.id !== sourceId)
    .sort((a, b) => {
      const da = inDeg.get(a.id) ?? 0;
      const db = inDeg.get(b.id) ?? 0;
      if (db !== da) return db - da;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const targetId = sortedByIn[0]?.id;
  if (!targetId) return null;

  return { sourceId, targetId };
}

// ── Short name helper ──────────────────────────────────────────────────

function shortName(filePath: string): string {
  const last = filePath.split("/").pop() ?? filePath;
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

// ── Position helpers ───────────────────────────────────────────────────

/**
 * Compute SVG positions for all nodes across paths.
 * Horizontal flow: source at LEFT, target at RIGHT.
 * Intermediate nodes are placed in columns by their position in the path
 * (normalized 0..1 along the path length), spread vertically.
 *
 * We collect unique intermediate nodes across all paths. Per column bucket
 * we stack nodes vertically centered around cy.
 */
function computePositions(
  paths: Array<{ nodeIds: string[] }>,
  sourceId: string,
  targetId: string,
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const LEFT_X = 60;
  const RIGHT_X = width - 60;
  const cy = height / 2;

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(sourceId, { x: LEFT_X, y: cy });
  positions.set(targetId, { x: RIGHT_X, y: cy });

  // Collect intermediate nodes with their normalized column positions
  // col_fraction = (index / (pathLen - 1)) where index is between source and target
  const colBuckets = new Map<number, Set<string>>(); // column index (1..N-1) → nodeIds

  const NUM_COLS = 5; // subdivision for intermediate column placement

  for (const path of paths) {
    const len = path.nodeIds.length;
    if (len <= 2) continue;
    // Intermediate nodes: indices 1..len-2
    for (let i = 1; i < len - 1; i++) {
      const nodeId = path.nodeIds[i];
      if (!nodeId || nodeId === sourceId || nodeId === targetId) continue;
      // Map position to a bucket 1..(NUM_COLS)
      const fraction = i / (len - 1);
      const col = Math.max(1, Math.min(NUM_COLS, Math.round(fraction * NUM_COLS)));
      const bucket = colBuckets.get(col) ?? new Set<string>();
      bucket.add(nodeId);
      colBuckets.set(col, bucket);
    }
  }

  // For each column, space nodes vertically
  const NODE_H = 36;

  for (const [col, nodeSet] of colBuckets) {
    const fraction = col / (NUM_COLS + 1);
    const x = LEFT_X + (RIGHT_X - LEFT_X) * fraction;
    const nodeArr = [...nodeSet].sort(); // deterministic
    const totalH = nodeArr.length * NODE_H;
    const startY = cy - totalH / 2 + NODE_H / 2;

    for (let i = 0; i < nodeArr.length; i++) {
      const nodeId = nodeArr[i]!;
      if (!positions.has(nodeId)) {
        positions.set(nodeId, { x, y: startY + i * NODE_H });
      }
    }
  }

  return positions;
}

// ── Main entry ─────────────────────────────────────────────────────────

export function buildPathfinderLayout(opts: BuildPathfinderLayoutOpts): PathfinderLayout {
  const { graph, selectedId } = opts;
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;

  // Empty guard
  if (graph.files.length < 2) {
    return {
      paths: [],
      nodes: [],
      edges: [],
      source: "",
      target: "",
      truncated: false,
      noPath: true,
    };
  }

  const pair = pickSourceTarget(graph, selectedId);
  if (!pair) {
    return {
      paths: [],
      nodes: [],
      edges: [],
      source: "",
      target: "",
      truncated: false,
      noPath: true,
    };
  }

  const { sourceId, targetId } = pair;

  // Compute paths
  const result = findPaths(graph, {
    sourceFileId: sourceId,
    targetFileId: targetId,
    mode: "k-shortest",
    k: 3,
    directional: true,
  });

  if (result.paths.length === 0) {
    return {
      paths: [],
      nodes: [],
      edges: [],
      source: sourceId,
      target: targetId,
      truncated: result.truncated,
      noPath: true,
    };
  }

  // Assign colors per path
  const coloredPaths = result.paths.map((p, i) => ({
    ...p,
    pathColor: PATH_COLORS[i] ?? PATH_COLORS[PATH_COLORS.length - 1]!,
  }));

  // Compute node / edge bit-masks
  const nodeMask = new Map<string, number>();
  const edgeMask = new Map<string, number>();

  for (let i = 0; i < coloredPaths.length; i++) {
    const bit = 1 << i;
    const path = coloredPaths[i]!;
    for (const nid of path.nodeIds) {
      nodeMask.set(nid, (nodeMask.get(nid) ?? 0) | bit);
    }
    for (const eid of path.edgeIds) {
      edgeMask.set(eid, (edgeMask.get(eid) ?? 0) | bit);
    }
  }

  // Collect all unique node/edge ids across paths
  const allNodeIds = new Set<string>();
  const allEdgeIds = new Set<string>();
  for (const path of coloredPaths) {
    for (const n of path.nodeIds) allNodeIds.add(n);
    for (const e of path.edgeIds) allEdgeIds.add(e);
  }

  // Build lookups
  const fileById = new Map(graph.files.map(f => [f.id, f]));
  const edgeById = new Map(graph.fileEdges.map(e => [e.id, e]));

  // Compute positions
  const positions = computePositions(coloredPaths, sourceId, targetId, width, height);

  // Build nodes
  const nodes: PathfinderNode[] = [...allNodeIds].map(fileId => {
    const f = fileById.get(fileId);
    const pos = positions.get(fileId) ?? { x: width / 2, y: height / 2 };
    const mask = nodeMask.get(fileId) ?? 0;
    return {
      fileId,
      fileName: f?.name ?? shortName(fileId),
      layer: f?.layer ?? "unknown",
      riskScore: f?.riskScore ?? 0,
      x: pos.x,
      y: pos.y,
      isOnPath: mask > 0,
      pathMask: mask,
    };
  });

  // Build edges
  const edges: PathfinderEdge[] = [...allEdgeIds].map(edgeId => {
    const e = edgeById.get(edgeId);
    const mask = edgeMask.get(edgeId) ?? 0;
    return {
      id: edgeId,
      from: e?.from ?? "",
      to: e?.to ?? "",
      isOnPath: mask > 0,
      pathMask: mask,
      weight: e?.weight ?? 1,
    };
  });

  return {
    paths: coloredPaths,
    nodes,
    edges,
    source: sourceId,
    target: targetId,
    truncated: result.truncated,
    noPath: false,
  };
}
