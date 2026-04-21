// build-neighborhood-layout.ts
// ---------------------------------------------------------------
// Pure algorithm: WorkspaceGraph + opts → NeighborhoodLayout.
//
// Center selection:
//   - If selectedId is provided, use it as center.
//   - Otherwise pick the file with the highest total edge count
//     (sum of in + out) from graph.fileEdges.
//
// maxHops is fixed at 2.
//
// Positions:
//   - Center at (0, 0)
//   - Hop-1 nodes on a circle of radius 120
//   - Hop-2 nodes on a circle of radius 240
//   - Within each ring, nodes are angularly spaced by 2π/count.
//   - Sort by fileId for deterministic positions.
//
// Node radii: hop-0 = 18, hop-1 = 10, hop-2 = 7
// Node color: green → red gradient by riskScore; center always accent.
// Edges: only those whose both endpoints are in the neighborhood set.

import { computeNeighborhood } from "@quanta/canvas-engine";
import type { BuildNeighborhoodLayoutOpts, NeighborhoodEdge, NeighborhoodLayout, NeighborhoodNode } from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const MAX_HOPS = 2;
const RING_RADIUS: Readonly<Record<number, number>> = { 0: 0, 1: 120, 2: 240 };
const NODE_RADIUS: Readonly<Record<number, number>> = { 0: 18, 1: 10, 2: 7 };

// Accent for the center node (matches tokens.ts color.accent)
const ACCENT_COLOR = "#0d99ff";

// ── Color helpers ──────────────────────────────────────────────────────

/**
 * Interpolate a risk score (0..1) onto green → yellow → red.
 * 0 = safe green, 1 = critical red.
 */
function riskColor(riskScore: number): string {
  const clamped = Math.max(0, Math.min(1, riskScore));

  // Three stops: 0→green (#22a06b), 0.5→yellow (#e09321), 1→red (#e5484d)
  let r: number, g: number, b: number;
  if (clamped <= 0.5) {
    const t = clamped * 2;
    // green → yellow
    r = Math.round(0x22 + (0xe0 - 0x22) * t);
    g = Math.round(0xa0 + (0x93 - 0xa0) * t);
    b = Math.round(0x6b + (0x21 - 0x6b) * t);
  } else {
    const t = (clamped - 0.5) * 2;
    // yellow → red
    r = Math.round(0xe0 + (0xe5 - 0xe0) * t);
    g = Math.round(0x93 + (0x48 - 0x93) * t);
    b = Math.round(0x21 + (0x4d - 0x21) * t);
  }
  const hex = (v: number): string => v.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// ── Center selection ───────────────────────────────────────────────────

function pickCenterByEdgeCount(graph: { files: readonly { id: string }[]; fileEdges: readonly { from: string; to: string }[] }): string | null {
  if (graph.files.length === 0) return null;

  const counts = new Map<string, number>();
  for (const f of graph.files) counts.set(f.id, 0);
  for (const e of graph.fileEdges) {
    counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
    counts.set(e.to, (counts.get(e.to) ?? 0) + 1);
  }

  let bestId = graph.files[0]!.id;
  let bestCount = counts.get(bestId) ?? 0;
  for (const [id, count] of counts) {
    if (count > bestCount || (count === bestCount && id < bestId)) {
      bestCount = count;
      bestId = id;
    }
  }
  return bestId;
}

// ── Short name ────────────────────────────────────────────────────────

function shortName(filePath: string): string {
  const last = filePath.split("/").pop() ?? filePath;
  // Strip extension
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildNeighborhoodLayout(opts: BuildNeighborhoodLayoutOpts): NeighborhoodLayout {
  const { graph, selectedId } = opts;

  // Empty graph guard
  if (graph.files.length === 0) {
    return {
      center: "",
      nodes: [],
      edges: [],
      maxHops: MAX_HOPS,
      totalNodes: 0,
    };
  }

  // Resolve center
  const centerId = selectedId ?? pickCenterByEdgeCount(graph) ?? graph.files[0]!.id;

  // Compute neighborhood via engine
  const neighborhood = computeNeighborhood(graph, centerId, MAX_HOPS);

  // Build fileId → FileNode lookup
  const fileById = new Map(graph.files.map(f => [f.id, f]));

  // Group nodes by hop ring
  const hopBuckets = new Map<number, string[]>();
  for (const [fileId, hop] of neighborhood.hop) {
    const bucket = hopBuckets.get(hop) ?? [];
    bucket.push(fileId);
    hopBuckets.set(hop, bucket);
  }

  // Sort deterministically by fileId within each bucket
  for (const bucket of hopBuckets.values()) {
    bucket.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }

  // Build nodes
  const nodes: NeighborhoodNode[] = [];
  for (const [hop, fileIds] of hopBuckets) {
    const count = fileIds.length;
    const ringR = RING_RADIUS[hop] ?? 240 + (hop - 2) * 80;
    const nodeR = NODE_RADIUS[hop] ?? 5;

    for (let i = 0; i < count; i++) {
      const fileId = fileIds[i]!;
      const fileNode = fileById.get(fileId);
      const riskScore = fileNode?.riskScore ?? 0;

      // Center node gets accent; others get risk-based color
      const color = hop === 0 ? ACCENT_COLOR : riskColor(riskScore);

      const angle = count === 1 ? 0 : (2 * Math.PI * i) / count;
      const x = Math.cos(angle) * ringR;
      const y = Math.sin(angle) * ringR;

      nodes.push({
        fileId,
        fileName: fileNode?.name ?? shortName(fileId),
        hop,
        angle,
        x,
        y,
        radius: nodeR,
        color,
        riskScore,
      });
    }
  }

  // Build edges — only those entirely within the neighborhood
  const edgeById = new Map(graph.fileEdges.map(e => [e.id, e]));
  const edges: NeighborhoodEdge[] = [];
  for (const edgeId of neighborhood.edges) {
    const e = edgeById.get(edgeId);
    if (!e) continue;
    const isHighlighted =
      e.from === centerId ||
      e.to === centerId ||
      e.severity === "high" ||
      e.severity === "critical";

    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      isHighlighted,
      severity: e.severity,
    });
  }

  return {
    center: centerId,
    nodes,
    edges,
    maxHops: MAX_HOPS,
    totalNodes: nodes.length,
  };
}
