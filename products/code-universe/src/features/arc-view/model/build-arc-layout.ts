// build-arc-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph → ArcLayout.
//
// Algorithm overview:
//   1. Collect nodes of `nodeKind` under `scopeId`.
//   2. Roll up file edges to the nodeKind level (same cache pattern as
//      chord-view's rollupToLeaf).  Skip self-loops and edges outside
//      the node set.
//   3. Run Tarjan's SCC (findStronglyConnectedComponents) on a synthetic
//      graph built from rolled-up edges.  Record which nodeIds are in
//      non-trivial SCCs.
//   4. Trim: sort by (inCycle desc, connectivity desc, id asc) and keep
//      top maxNodes.  Record overflow.
//   5. Kahn's BFS topological sort.  Nodes unreachable due to cycles are
//      appended alphabetically.
//   6. Edge direction: isBackward = topoIndex[from] > topoIndex[to].
//   7. Positions: nodeSpacing + x per node; arc height proportional to
//      span.
//   8. Colors: deterministic hash per id.
//   9. Sublabel: "N files" for galaxy, "N LoC" for building.
//
// Determinism: no Math.random, no Date, no Map iteration over
// caller-supplied data without an explicit re-sort step.

import type { Entity, EntityTree, FileEdge } from "@quanta/canvas-engine";
import { findStronglyConnectedComponents } from "@quanta/canvas-engine";
import type { ArcEdge, ArcLayout, ArcNode, BuildArcLayoutOpts } from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_MAX_NODES = 60;
const MAX_NODE_SPACING = 80;

// Maximum arc height as a fraction of the half-height available for
// arcs above (or below) the centre baseline.
const ARC_HEIGHT_FRAC = 0.42;
const ARC_HEIGHT_MIN = 20;

// ── Determinism helpers ───────────────────────────────────────────────

/** FNV-1a 32-bit hash — stable across runs, no random component. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
}

// ── Collect nodes ─────────────────────────────────────────────────────

/**
 * Walk the entity tree and collect all entities of the given kind under
 * `scopeId` (or root if null).  Walking stops at the target kind, so
 * a galaxy's sub-directories are not expanded when nodeKind="galaxy".
 */
function collectNodes(
  tree: EntityTree,
  scopeId: string | null,
  nodeKind: "galaxy" | "building",
): Entity[] {
  const rootId = scopeId ?? tree.rootId;
  const root = tree.byId.get(rootId);
  if (!root) return [];
  const out: Entity[] = [];
  const stack: Entity[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === nodeKind) {
      out.push(cur);
      continue;
    }
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  // Sort by id for stability regardless of tree insertion order.
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

// ── Edge rollup ───────────────────────────────────────────────────────

/**
 * Walk from a file id up the ancestor chain until we find an entity of
 * the requested nodeKind.  Returns null when no ancestor matches.
 * Results are memoised in `cache` to amortise across the O(|edges|) loop.
 */
function rollupToNode(
  tree: EntityTree,
  fileId: string,
  nodeKind: "galaxy" | "building",
  cache: Map<string, string | null>,
): string | null {
  const hit = cache.get(fileId);
  if (hit !== undefined) return hit;

  if (nodeKind === "building") {
    const result = tree.byId.has(fileId) ? fileId : null;
    cache.set(fileId, result);
    return result;
  }

  // galaxy mode — walk ancestors.
  const file = tree.byId.get(fileId);
  if (!file) {
    cache.set(fileId, null);
    return null;
  }
  for (const anc of tree.ancestorsOf(fileId)) {
    if (anc.kind === nodeKind) {
      cache.set(fileId, anc.id);
      return anc.id;
    }
  }
  cache.set(fileId, null);
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildArcLayout(opts: BuildArcLayoutOpts): ArcLayout {
  const { tree, graph, width, height } = opts;
  const nodeKind = opts.nodeKind ?? "galaxy";
  const scopeId = opts.scopeId ?? null;
  const maxNodes = opts.maxNodes ?? DEFAULT_MAX_NODES;

  // ── 1. Collect nodes ───────────────────────────────────────────────
  const nodeEntities = collectNodes(tree, scopeId, nodeKind);
  if (nodeEntities.length === 0) {
    return {
      nodes: [],
      edges: [],
      sccCount: 0,
      cycleEdgeCount: 0,
      nodeSpacing: MAX_NODE_SPACING,
      overflow: 0,
    };
  }

  const nodeIdSet = new Set(nodeEntities.map(e => e.id));

  // ── 2. Roll up edges ───────────────────────────────────────────────
  // Accumulate: key = "fromId→toId", value = aggregated weight.
  const rollupCache = new Map<string, string | null>();
  const edgeAcc = new Map<string, { fromId: string; toId: string; weight: number }>();

  for (const e of graph.fileEdges) {
    const fromNode = rollupToNode(tree, e.from, nodeKind, rollupCache);
    const toNode = rollupToNode(tree, e.to, nodeKind, rollupCache);
    if (!fromNode || !toNode) continue;
    if (fromNode === toNode) continue; // skip self-loops at node level
    if (!nodeIdSet.has(fromNode) || !nodeIdSet.has(toNode)) continue;
    const key = `${fromNode}→${toNode}`;
    const existing = edgeAcc.get(key);
    if (existing) {
      existing.weight += e.weight || 1;
    } else {
      edgeAcc.set(key, { fromId: fromNode, toId: toNode, weight: e.weight || 1 });
    }
  }

  // Sort accumulator deterministically before further processing.
  const rolledEdges = [...edgeAcc.values()].sort((a, b) => {
    const ka = `${a.fromId}→${a.toId}`;
    const kb = `${b.fromId}→${b.toId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  // ── 3. SCC detection ──────────────────────────────────────────────
  // Build a synthetic FileEdge array from the rolled-up edges so we can
  // pass it to findStronglyConnectedComponents which expects
  // Pick<WorkspaceGraph, "fileEdges">.
  const syntheticEdges: Array<Pick<FileEdge, "from" | "to" | "kind" | "id" | "layer" | "weight">> =
    rolledEdges.map((re, i) => ({
      id: `arc-scc-${i}`,
      from: re.fromId,
      to: re.toId,
      kind: "import" as const,
      layer: "structural" as const,
      weight: re.weight,
    }));

  const sccResult = findStronglyConnectedComponents({ fileEdges: syntheticEdges });
  const cycleNodeIds = new Set<string>();
  const nodeToSccIndex = new Map<string, number>();
  for (const [nodeId, sccIdx] of sccResult.componentOf.entries()) {
    cycleNodeIds.add(nodeId);
    nodeToSccIndex.set(nodeId, sccIdx);
  }
  const sccCount = sccResult.components.length;

  // ── 4. Connectivity map for trim-sort ────────────────────────────
  // connectivity = in-degree + out-degree of rolled-up edges.
  const connectivity = new Map<string, number>();
  for (const e of rolledEdges) {
    connectivity.set(e.fromId, (connectivity.get(e.fromId) ?? 0) + 1);
    connectivity.set(e.toId, (connectivity.get(e.toId) ?? 0) + 1);
  }

  // ── 4. Trim ───────────────────────────────────────────────────────
  // Sort: inCycle desc, connectivity desc, id asc (deterministic tie-break).
  const sortedEntities = [...nodeEntities].sort((a, b) => {
    const aInCycle = cycleNodeIds.has(a.id) ? 1 : 0;
    const bInCycle = cycleNodeIds.has(b.id) ? 1 : 0;
    if (aInCycle !== bInCycle) return bInCycle - aInCycle; // cycle nodes first
    const aC = connectivity.get(a.id) ?? 0;
    const bC = connectivity.get(b.id) ?? 0;
    if (aC !== bC) return bC - aC; // higher connectivity first
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const overflow = Math.max(0, sortedEntities.length - maxNodes);
  const keptEntities = sortedEntities.slice(0, maxNodes);
  const keptIdSet = new Set(keptEntities.map(e => e.id));

  // Filter edges to kept nodes only.
  const keptEdges = rolledEdges.filter(e => keptIdSet.has(e.fromId) && keptIdSet.has(e.toId));

  // ── 5. Topological sort (Kahn's BFS) ──────────────────────────────
  // Build adjacency and in-degree for kept nodes only.
  const adj = new Map<string, string[]>();    // from → [to, ...]
  const inDeg = new Map<string, number>();

  for (const entity of keptEntities) {
    adj.set(entity.id, []);
    inDeg.set(entity.id, 0);
  }
  for (const e of keptEdges) {
    adj.get(e.fromId)!.push(e.toId);
    inDeg.set(e.toId, (inDeg.get(e.toId) ?? 0) + 1);
  }
  // Sort each adjacency list for determinism.
  for (const [, neighbours] of adj) {
    neighbours.sort();
  }

  // Kahn's BFS: seed with zero in-degree nodes (sorted alphabetically).
  const queue: string[] = keptEntities
    .filter(e => (inDeg.get(e.id) ?? 0) === 0)
    .map(e => e.id)
    .sort();

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const v = queue.shift()!;
    topoOrder.push(v);
    const neighbours = (adj.get(v) ?? []).slice().sort(); // stable sort
    for (const w of neighbours) {
      const deg = (inDeg.get(w) ?? 0) - 1;
      inDeg.set(w, deg);
      if (deg === 0) {
        // Insert in alphabetical order to keep the BFS deterministic
        // when multiple nodes reach in-degree 0 at the same step.
        const insertAt = queue.findIndex(q => q > w);
        if (insertAt === -1) queue.push(w);
        else queue.splice(insertAt, 0, w);
      }
    }
  }

  // Nodes not yet in topoOrder (cycle members that Kahn can't schedule)
  // are appended alphabetically.
  const inTopo = new Set(topoOrder);
  const remaining = keptEntities
    .filter(e => !inTopo.has(e.id))
    .map(e => e.id)
    .sort();
  topoOrder.push(...remaining);

  // Build index lookup: nodeId → position in topoOrder.
  const topoIndex = new Map<string, number>();
  for (let i = 0; i < topoOrder.length; i++) {
    topoIndex.set(topoOrder[i]!, i);
  }

  // ── 7. Positions ──────────────────────────────────────────────────
  const nodeCount = keptEntities.length;
  const nodeSpacing = Math.min(MAX_NODE_SPACING, width / (nodeCount + 1));
  // Plot height available for arcs in one direction (above or below centre).
  const plotHalfHeight = (height - 40) / 2;
  const arcHeightMax = plotHalfHeight * ARC_HEIGHT_FRAC;

  // ── 8. Build ArcNodes ─────────────────────────────────────────────
  const entityById = new Map<string, Entity>(nodeEntities.map(e => [e.id, e]));
  const arcNodes: ArcNode[] = topoOrder.map((nodeId, i) => {
    const entity = entityById.get(nodeId)!;
    const inCycle = cycleNodeIds.has(nodeId);
    const sccIndex = nodeToSccIndex.get(nodeId);

    let sublabel: string;
    if (nodeKind === "galaxy") {
      const fileCount = entity.metrics?.fileCount ?? 0;
      sublabel = `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
    } else {
      const loc = entity.metrics?.loc ?? 0;
      sublabel = `${loc} LoC`;
    }

    return {
      id: nodeId,
      label: entity.name,
      kind: entity.kind,
      index: i,
      x: (i + 1) * nodeSpacing,
      color: hashColorFromId(nodeId),
      inCycle,
      sccIndex,
      sublabel,
    };
  });

  // ── 6 & 9. Build ArcEdges (direction + height) ────────────────────
  // Deduplicate rolled-up edges by (fromId, toId) — they were already
  // deduplicated above in edgeAcc, so this is a 1:1 map.
  const arcEdges: ArcEdge[] = [];
  let cycleEdgeCount = 0;

  // Sort for deterministic id assignment.
  const sortedKeptEdges = [...keptEdges].sort((a, b) => {
    const ka = `${a.fromId}→${a.toId}`;
    const kb = `${b.fromId}→${b.toId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  for (const e of sortedKeptEdges) {
    const fromIdx = topoIndex.get(e.fromId) ?? 0;
    const toIdx = topoIndex.get(e.toId) ?? 0;
    const isBackward = fromIdx > toIdx;
    if (isBackward) cycleEdgeCount++;

    const span = Math.abs(toIdx - fromIdx);
    const rawHeight = span * nodeSpacing * 0.5;
    const arcHeight = Math.min(arcHeightMax, Math.max(ARC_HEIGHT_MIN, rawHeight));

    arcEdges.push({
      id: `arc-edge:${e.fromId}→${e.toId}`,
      fromId: e.fromId,
      toId: e.toId,
      isBackward,
      weight: e.weight,
      height: arcHeight,
    });
  }

  return {
    nodes: arcNodes,
    edges: arcEdges,
    sccCount,
    cycleEdgeCount,
    nodeSpacing,
    overflow,
  };
}
