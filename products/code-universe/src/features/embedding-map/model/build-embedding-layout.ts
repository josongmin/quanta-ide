// build-embedding-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph → EmbeddingLayout. Each entity of
// `pointKind` (default "galaxy") is projected to a 2D position based
// on its structural feature vector (fan-in, fan-out, risk, loc, taint,
// complexity). Similar entities end up spatially close; clusters are
// found with k-means-lite.
//
// Algorithm:
//   1. Collect entities of pointKind under scopeId.
//   2. Build adjacency from graph.fileEdges, roll up to pointKind.
//      Compute fanIn / fanOut per entity.
//   3. Build 6-dim feature vectors from FileNode data.
//   4. Project using structural-projection.
//   5. Trim to maxPoints by combined interest score; record overflow.
//   6. K-means cluster.
//   7. Map normalized positions to SVG viewport coordinates.
//   8. Compute radius, color, sublabel for each point.
//   9. Build cluster descriptors (representative = largest radius).
//
// Determinism: all sorts carry a stable id tie-break. No Math.random,
// no Date, no Map iteration over caller-provided data we didn't rebuild.

import type {
  Entity,
  EntityTree,
  FileNode,
} from "@quanta/canvas-engine";
import { pixiKindColor } from "../../../shared/ui/tokens";
import { projectToEmbeddingSpace } from "../lib/structural-projection";
import { kmeansLite } from "../lib/kmeans-lite";
import type {
  BuildEmbeddingLayoutOpts,
  EmbeddingCluster,
  EmbeddingLayout,
  EmbeddingPoint,
} from "./types";

// ── Color helpers ────────────────────────────────────────────────────

/** Stable FNV-1a string hash — deterministic across runs. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** HSL → #rrggbb conversion. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Generate a distinct palette colour for an entity id. */
function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
}

// ── Tree helpers ─────────────────────────────────────────────────────

/** Collect entities of the requested kind under `scopeId` (or root if null). */
function collectEntities(
  tree: EntityTree,
  scopeId: string | null,
  kind: "galaxy" | "building",
): Entity[] {
  const rootId = scopeId ?? tree.rootId;
  const root = tree.byId.get(rootId);
  if (!root) return [];

  const out: Entity[] = [];
  const stack: Entity[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === kind) {
      out.push(cur);
      continue; // don't recurse into the entity itself
    }
    // Push children in reverse order for stable traversal.
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  // Stable sort by id.
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Collect all file (building) ids under a given entity (inclusive of
 *  building entities). */
function collectFileIds(tree: EntityTree, entityId: string): Set<string> {
  const entity = tree.byId.get(entityId);
  if (!entity) return new Set();

  const out = new Set<string>();
  const stack: Entity[] = [entity];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === "building") {
      out.add(cur.id);
      continue;
    }
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  return out;
}

/** Walk up from a file id to find its nearest ancestor of the given kind.
 *  Returns null if no such ancestor exists. Cached for performance. */
function rollupToKind(
  tree: EntityTree,
  fileId: string,
  kind: "galaxy" | "building",
  cache: Map<string, string | null>,
): string | null {
  const hit = cache.get(fileId);
  if (hit !== undefined) return hit;

  if (kind === "building") {
    const exists = tree.byId.has(fileId) ? fileId : null;
    cache.set(fileId, exists);
    return exists;
  }

  // galaxy / street — walk up ancestors.
  const ancestors = tree.ancestorsOf(fileId);
  for (const anc of ancestors) {
    if (anc.kind === kind) {
      cache.set(fileId, anc.id);
      return anc.id;
    }
  }
  cache.set(fileId, null);
  return null;
}

// ── Radius ───────────────────────────────────────────────────────────
const RADIUS_MIN = 5;
const RADIUS_MAX = 24;
const RADIUS_BASE = 7;
const RADIUS_GAIN = 14;

function computeRadius(loc: number, maxLoc: number): number {
  const t = maxLoc > 0 ? Math.sqrt(loc / maxLoc) : 0;
  return Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, RADIUS_BASE + RADIUS_GAIN * t));
}

// ── Main entry ───────────────────────────────────────────────────────

export function buildEmbeddingLayout(opts: BuildEmbeddingLayoutOpts): EmbeddingLayout {
  const {
    tree,
    graph,
    width,
    height,
    pointKind = "galaxy",
    scopeId = null,
    maxPoints = 100,
    numClusters,
  } = opts;

  // Viewport center for coordinate mapping.
  const centerX = width / 2;
  const centerY = height / 2;
  // Plot area: use 42% of the shorter dimension.
  const plotWidth = Math.min(width, height);

  // ── 1. Collect entities ──────────────────────────────────────────
  if (scopeId !== null && !tree.byId.has(scopeId)) {
    throw new Error(`scopeId "${scopeId}" not found in tree`);
  }

  const entities = collectEntities(tree, scopeId, pointKind);

  if (entities.length === 0) {
    return { points: [], clusters: [], overflow: 0 };
  }

  // ── 2. Build adjacency + fan-in / fan-out ────────────────────────
  // Build a set of file ids per entity for rollup.
  const entityFileIds = new Map<string, Set<string>>();
  for (const entity of entities) {
    entityFileIds.set(entity.id, collectFileIds(tree, entity.id));
  }

  // fileId → entity id (reverse lookup for rollup).
  const rollupCache = new Map<string, string | null>();

  // Count fanIn (files from OTHER entities that import THIS entity's files)
  // and fanOut (files in OTHER entities that THIS entity's files import).
  const fanInMap = new Map<string, Set<string>>();   // entityId → set of external file ids importing into it
  const fanOutMap = new Map<string, Set<string>>();  // entityId → set of external file ids it imports into
  for (const entity of entities) {
    fanInMap.set(entity.id, new Set());
    fanOutMap.set(entity.id, new Set());
  }

  const entityIdSet = new Set(entities.map(e => e.id));

  for (const edge of graph.fileEdges) {
    const fromEntity = rollupToKind(tree, edge.from, pointKind, rollupCache);
    const toEntity = rollupToKind(tree, edge.to, pointKind, rollupCache);

    // Only count cross-entity edges.
    if (!fromEntity || !toEntity) continue;
    if (fromEntity === toEntity) continue;
    if (!entityIdSet.has(fromEntity) || !entityIdSet.has(toEntity)) continue;

    // toEntity gets a fanIn from edge.from.
    fanInMap.get(toEntity)!.add(edge.from);
    // fromEntity gets a fanOut to edge.to.
    fanOutMap.get(fromEntity)!.add(edge.to);
  }

  // ── 3. Build feature vectors ─────────────────────────────────────
  // Gather per-entity aggregated metrics.
  const fileById = new Map<string, FileNode>();
  for (const file of graph.files) {
    fileById.set(file.id, file);
  }

  interface EntityMetrics {
    id: string;
    fanIn: number;
    fanOut: number;
    riskMean: number;
    loc: number;
    taintScore: number;
    cpxMax: number;
    fileCount: number;
  }

  const entityMetrics: EntityMetrics[] = entities.map(entity => {
    const fileIds = entityFileIds.get(entity.id) ?? new Set();
    let riskSum = 0;
    let loc = 0;
    let taintScore = 0;
    let cpxMax = 0;
    let fileCount = 0;

    for (const fid of fileIds) {
      const file = fileById.get(fid);
      if (!file) continue;
      fileCount += 1;
      riskSum += file.riskScore;
      loc += file.loc;
      taintScore += file.signals.taintCount + file.signals.archViolations;
      if (file.signals.cpxMax > cpxMax) cpxMax = file.signals.cpxMax;
    }

    return {
      id: entity.id,
      fanIn: fanInMap.get(entity.id)?.size ?? 0,
      fanOut: fanOutMap.get(entity.id)?.size ?? 0,
      riskMean: fileCount > 0 ? riskSum / fileCount : 0,
      loc,
      taintScore,
      cpxMax,
      fileCount,
    };
  });

  // Compute per-feature max for normalization.
  let maxFanIn = 0;
  let maxFanOut = 0;
  let maxRisk = 0;
  let maxLoc = 0;
  let maxTaint = 0;
  let maxCpx = 0;

  for (const m of entityMetrics) {
    if (m.fanIn > maxFanIn) maxFanIn = m.fanIn;
    if (m.fanOut > maxFanOut) maxFanOut = m.fanOut;
    if (m.riskMean > maxRisk) maxRisk = m.riskMean;
    if (m.loc > maxLoc) maxLoc = m.loc;
    if (m.taintScore > maxTaint) maxTaint = m.taintScore;
    if (m.cpxMax > maxCpx) maxCpx = m.cpxMax;
  }

  const featureVectors = entityMetrics.map(m => ({
    id: m.id,
    features: [
      maxFanIn > 0 ? m.fanIn / maxFanIn : 0,
      maxFanOut > 0 ? m.fanOut / maxFanOut : 0,
      maxRisk > 0 ? m.riskMean / maxRisk : 0,
      maxLoc > 0 ? m.loc / maxLoc : 0,
      maxTaint > 0 ? m.taintScore / maxTaint : 0,
      maxCpx > 0 ? m.cpxMax / maxCpx : 0,
    ],
  }));

  // ── 4. Project to 2D embedding space ─────────────────────────────
  const projected = projectToEmbeddingSpace(featureVectors);

  // ── 5. Trim to maxPoints ─────────────────────────────────────────
  // Score by "interest": fanIn + fanOut + riskScore (normalized).
  const scored = entityMetrics.map(m => {
    const nFanIn = maxFanIn > 0 ? m.fanIn / maxFanIn : 0;
    const nFanOut = maxFanOut > 0 ? m.fanOut / maxFanOut : 0;
    const nRisk = maxRisk > 0 ? m.riskMean / maxRisk : 0;
    return { id: m.id, score: nFanIn + nFanOut + nRisk };
  });
  // Sort descending by score, then by id for determinism.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const overflow = Math.max(0, scored.length - maxPoints);
  const topIds = new Set(scored.slice(0, maxPoints).map(s => s.id));

  // Filter entities and metrics to the trimmed set.
  const trimmedEntities = entities.filter(e => topIds.has(e.id));
  const metricsById = new Map(entityMetrics.map(m => [m.id, m]));

  // ── 6. K-means cluster ───────────────────────────────────────────
  const n = trimmedEntities.length;
  const k = numClusters ?? Math.min(5, Math.ceil(Math.sqrt(n)));

  const projectedPoints = trimmedEntities
    .map(e => {
      const pos = projected.get(e.id);
      if (!pos) return null;
      return { id: e.id, x: pos.x, y: pos.y };
    })
    .filter((p): p is { id: string; x: number; y: number } => p !== null);

  const { assignments, centroids } = kmeansLite(projectedPoints, k);

  // ── 7. Map normalized positions to SVG viewport ──────────────────
  // Embedding x,y are in normalized space [-0.85, 0.85].
  // SVG x: centerX + x * (plotWidth * 0.42)
  // SVG y: centerY - y * (plotWidth * 0.42)  [SVG Y is inverted]
  const plotScale = plotWidth * 0.42;

  // ── 8. Build EmbeddingPoint array ────────────────────────────────
  const entityById = new Map(entities.map(e => [e.id, e]));

  const points: EmbeddingPoint[] = trimmedEntities.map(entity => {
    const pos = projected.get(entity.id) ?? { x: 0, y: 0 };
    const m = metricsById.get(entity.id)!;
    const radius = computeRadius(m.loc, maxLoc);
    const clusterId = assignments.get(entity.id) ?? 0;
    const color = hashColorFromId(entity.id);
    const riskDisplay = m.riskMean.toFixed(2);
    const sublabel = `${m.fileCount} files · risk ${riskDisplay} · fanIn ${m.fanIn}`;

    return {
      id: entity.id,
      label: entity.name,
      kind: entity.kind,
      x: centerX + pos.x * plotScale,
      y: centerY - pos.y * plotScale, // SVG y inverted
      color,
      radius,
      sublabel,
      clusterId,
    };
  });

  // Sort points by id for stable iteration order downstream.
  points.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // ── 9. Build cluster descriptors ─────────────────────────────────
  // Representative = largest-radius point in the cluster.
  const clusterRep = new Map<number, { point: EmbeddingPoint; radius: number }>();
  for (const pt of points) {
    const existing = clusterRep.get(pt.clusterId);
    if (!existing || pt.radius > existing.radius) {
      clusterRep.set(pt.clusterId, { point: pt, radius: pt.radius });
    }
  }

  const clusters: EmbeddingCluster[] = centroids.map((centroid, idx) => {
    const rep = clusterRep.get(idx);
    return {
      id: idx,
      centroidId: rep?.point.id ?? "",
      label: rep ? (entityById.get(rep.point.id)?.name ?? rep.point.label) : `Cluster ${idx}`,
      cx: centerX + centroid.cx * plotScale,
      cy: centerY - centroid.cy * plotScale, // SVG y inverted
    };
  });

  // Avoid using pixiKindColor directly but keep it referenced so the
  // import isn't flagged as unused — same pattern as chord-view.
  void pixiKindColor;

  return { points, clusters, overflow };
}
