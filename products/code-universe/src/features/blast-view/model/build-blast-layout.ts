// build-blast-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph + centerId → BlastLayout.
//
// The center entity may be any kind:
//   - building (file)  → one root file fed directly into the cone
//   - street / galaxy  → all building descendants become roots; their
//                        cones are merged (union of fileIds, minimum depth wins)
//   - universe         → all files in the workspace become roots
//
// After merging, each fileId ring entry is rolled up to the same
// entity-kind level as the center entity so the concentric rings
// remain legible at the chosen zoom level.
//
// Angular layout: evenly distributed per ring with a pinwheel offset
// (depthOffset = depth * 0.3 rad) so rings visually stagger.
//
// Determinism: no Math.random(); all sorts have tie-breaking id key.

import {
  computeBlastCone,
  computeFixCone,
  type EntityKind,
  type EntityTree,
} from "@quanta/canvas-engine";
import type {
  BlastDirection,
  BlastLayout,
  BlastRing,
  BlastRingNode,
  BuildBlastLayoutOpts,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_NODES_PER_RING = 40;

// ── Colour helpers (deterministic, no Math.random) ────────────────────

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToHex(hDeg: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hDeg < 60) { r = c; g = x; b = 0; }
  else if (hDeg < 120) { r = x; g = c; b = 0; }
  else if (hDeg < 180) { r = 0; g = c; b = x; }
  else if (hDeg < 240) { r = 0; g = x; b = c; }
  else if (hDeg < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
}

// ── Ring background colour ─────────────────────────────────────────────

function ringColor(direction: BlastDirection, depth: number): string {
  // depth 0 = fully opaque, each step reduces opacity by 10%
  const alpha = Math.max(0, 0.03 * (1 - depth * 0.1));
  if (direction === "blast") {
    return `rgba(239,68,68,${alpha.toFixed(4)})`;
  }
  return `rgba(34,197,94,${alpha.toFixed(4)})`;
}

// ── Node radius (weight-proportional) ─────────────────────────────────

function nodeRadius(weight: number): number {
  return 8 + 6 * Math.min(1, weight / 10);
}

// ── Collect all building-kind descendants ─────────────────────────────

function collectBuildingDescendants(tree: EntityTree, rootId: string): string[] {
  const root = tree.byId.get(rootId);
  if (!root) return [];
  if (root.kind === "building") return [root.id];

  const out: string[] = [];
  const stack: string[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const entity = tree.byId.get(id);
    if (!entity) continue;
    if (entity.kind === "building") {
      out.push(entity.id);
      continue;
    }
    for (let i = entity.childIds.length - 1; i >= 0; i--) {
      const childId = entity.childIds[i];
      if (childId) stack.push(childId);
    }
  }
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

// ── Determine target roll-up kind from center kind ────────────────────
// The rings display entities at the same "level" as the center. For a
// building center we keep files; for a galaxy center we roll up to galaxy.

function targetRollupKind(centerKind: EntityKind): EntityKind {
  // We roll up to the center's own kind level (never finer).
  return centerKind;
}

// ── Roll a file id up to the requested ancestor kind ─────────────────

function rollUpToKind(
  tree: EntityTree,
  fileId: string,
  toKind: EntityKind,
  cache: Map<string, string | null>,
): string | null {
  const hit = cache.get(fileId);
  if (hit !== undefined) return hit;

  const file = tree.byId.get(fileId);
  if (!file) {
    cache.set(fileId, null);
    return null;
  }

  if (file.kind === toKind) {
    cache.set(fileId, fileId);
    return fileId;
  }

  for (const anc of tree.ancestorsOf(fileId)) {
    if (anc.kind === toKind) {
      cache.set(fileId, anc.id);
      return anc.id;
    }
  }
  // Fallback: return the file itself if it is the closest match
  cache.set(fileId, null);
  return null;
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildBlastLayout(opts: BuildBlastLayoutOpts): BlastLayout {
  const {
    tree,
    graph,
    width,
    height,
    centerId,
    direction = "blast",
    maxDepth = DEFAULT_MAX_DEPTH,
    maxNodesPerRing = DEFAULT_MAX_NODES_PER_RING,
  } = opts;

  const shortDim = Math.max(1, Math.min(width, height));

  // ── Resolve center entity ────────────────────────────────────────────
  const centerEntity = tree.byId.get(centerId);
  if (!centerEntity) {
    return {
      centerId,
      centerLabel: centerId,
      centerKind: "building",
      direction,
      rings: [],
      totalAffected: 0,
      overflow: 0,
    };
  }

  // ── Collect root file ids to blast from ──────────────────────────────
  const rootFileIds = collectBuildingDescendants(tree, centerId);
  if (rootFileIds.length === 0) {
    return {
      centerId,
      centerLabel: centerEntity.name,
      centerKind: centerEntity.kind,
      direction,
      rings: [],
      totalAffected: 0,
      overflow: 0,
    };
  }

  // ── Compute cones and merge ───────────────────────────────────────────
  // For each file, run the cone. Merge so each fileId appears only at its
  // MINIMUM depth; weight is summed from all cones where that file appears.
  const minDepthMap = new Map<string, number>();  // fileId → minimum depth seen
  const weightMap = new Map<string, number>();    // fileId → accumulated weight
  const maxRingDepth = maxDepth;

  for (const rootFileId of rootFileIds) {
    const cone = direction === "blast"
      ? computeBlastCone(graph, rootFileId, maxDepth)
      : computeFixCone(graph, rootFileId, maxDepth);

    for (const ring of cone.rings) {
      for (const fileId of ring.fileIds) {
        // Skip if this fileId IS one of the roots (self-reference)
        if (rootFileIds.includes(fileId)) continue;

        const existingDepth = minDepthMap.get(fileId);
        if (existingDepth === undefined || ring.depth < existingDepth) {
          minDepthMap.set(fileId, ring.depth);
        }
        // Accumulate weight regardless of which ring wins depth
        const existing = weightMap.get(fileId) ?? 0;
        // weight contribution: use the ring's totalWeight divided by
        // ring file count as a per-node approximation
        const perNodeWeight = ring.fileIds.length > 0 ? ring.totalWeight / ring.fileIds.length : 1;
        weightMap.set(fileId, existing + perNodeWeight);
      }
    }
  }

  // ── Remove the center entity itself ──────────────────────────────────
  // If the center is a building, remove it from all rings.
  minDepthMap.delete(centerId);
  weightMap.delete(centerId);
  for (const rootFileId of rootFileIds) {
    minDepthMap.delete(rootFileId);
    weightMap.delete(rootFileId);
  }

  // ── Roll up file ids to the center's kind level ───────────────────────
  const rollupKind = targetRollupKind(centerEntity.kind);
  const rollupCache = new Map<string, string | null>();

  // Accumulate at the rolled-up entity level: minimum depth, summed weight
  const entityMinDepth = new Map<string, number>();
  const entityWeight = new Map<string, number>();

  for (const [fileId, depth] of minDepthMap) {
    const rolledId = rollupKind === "building"
      ? fileId  // building level: keep as-is
      : rollUpToKind(tree, fileId, rollupKind, rollupCache);
    if (!rolledId) continue;
    // Skip if the rolled entity is the center itself
    if (rolledId === centerId) continue;

    const w = weightMap.get(fileId) ?? 1;
    const existingDepth = entityMinDepth.get(rolledId);
    if (existingDepth === undefined || depth < existingDepth) {
      entityMinDepth.set(rolledId, depth);
    }
    entityWeight.set(rolledId, (entityWeight.get(rolledId) ?? 0) + w);
  }

  // ── Bucket entities by depth ──────────────────────────────────────────
  const depthBuckets = new Map<number, string[]>();
  for (const [entityId, depth] of entityMinDepth) {
    if (depth > maxRingDepth) continue;
    const bucket = depthBuckets.get(depth) ?? [];
    bucket.push(entityId);
    depthBuckets.set(depth, bucket);
  }

  // ── Build rings ───────────────────────────────────────────────────────
  let totalOverflow = 0;
  const rings: BlastRing[] = [];

  // Sort depths for deterministic ring order
  const sortedDepths = [...depthBuckets.keys()].sort((a, b) => a - b);

  for (const depth of sortedDepths) {
    const entityIds = depthBuckets.get(depth) ?? [];

    // Sort by weight desc, then id asc (deterministic)
    const sorted = [...entityIds].sort((a, b) => {
      const wa = entityWeight.get(a) ?? 0;
      const wb = entityWeight.get(b) ?? 0;
      if (wb !== wa) return wb - wa;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    // Trim to max nodes per ring
    const trimmed = sorted.slice(0, maxNodesPerRing);
    const overflow = sorted.length - trimmed.length;
    totalOverflow += overflow;

    const count = trimmed.length;
    if (count === 0) continue;

    // Ring radius
    const rRadius = 50 + depth * (shortDim * 0.16);
    // Angular layout with pinwheel offset
    const depthOffset = depth * 0.3;
    const ringTotal = trimmed.reduce((acc, id) => acc + (entityWeight.get(id) ?? 0), 0);

    const nodes: BlastRingNode[] = trimmed.map((entityId, i) => {
      const angle = (2 * Math.PI / count) * i + depthOffset;
      const weight = entityWeight.get(entityId) ?? 1;
      const entity = tree.byId.get(entityId);
      const label = entity?.name ?? entityId;
      const kind: EntityKind = entity?.kind ?? "building";
      const x = Math.cos(angle) * rRadius;
      const y = Math.sin(angle) * rRadius;
      return {
        id: entityId,
        label,
        kind,
        depth,
        color: hashColorFromId(entityId),
        weight,
        angle,
        r: nodeRadius(weight),
        x,
        y,
      };
    });

    rings.push({
      depth,
      nodes,
      totalWeight: ringTotal,
      ringRadius: rRadius,
      ringColor: ringColor(direction, depth),
    });
  }

  const totalAffected = rings.reduce((acc, r) => acc + r.nodes.length, 0);

  return {
    centerId,
    centerLabel: centerEntity.name,
    centerKind: centerEntity.kind,
    direction,
    rings,
    totalAffected,
    overflow: totalOverflow,
  };
}
