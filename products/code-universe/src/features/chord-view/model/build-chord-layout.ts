import type { Entity, EntityTree, FileEdge } from "@quanta/canvas-engine";
import { pixiKindColor } from "../../../shared/ui/tokens";
import type {
  BuildChordLayoutOpts,
  ChordEdge,
  ChordGroup,
  ChordLayout,
  ChordLeaf,
} from "./types";

// build-chord-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph → ChordLayout. Files ("building" kind)
// become leaves on a ring; a parent entity ("galaxy" by default, or
// "street") becomes an arc grouping its leaves. Dependency edges come
// from `graph.fileEdges`; endpoints outside the leaf set are dropped.
//
// Angular allocation:
//   - Each active group gets an arc proportional to sqrt(leafCount) —
//     same damping as the mind-map, which prevents a single 100-file
//     package from swallowing the circle while keeping a 2-file package
//     visibly smaller than a 20-file one.
//   - Gaps of GAP_ANGLE between adjacent groups keep the ring reading
//     as segmented rather than continuous.
//   - Within a group, leaves are distributed evenly with a small inner
//     pad at each end so the first/last leaf doesn't butt against the
//     gap.
//
// pathFromRoot (MVP single-ring):
//   [root, groupCentre, leaf]
//     root       = (0, 0)
//     groupCentre= midpoint of the arc at innerRadius * 0.5, i.e. the
//                  group's angular centre pulled inward half-way. This
//                  is the LCA "hub" edges should bend toward.
//     leaf       = (x, y) on the innerRadius circle.
// For cross-group edges, the LCA is the universe root, so a bundled
// edge leaves the from-leaf, travels inward past its group hub, passes
// through origin, then fans back out through the to-group hub to the
// to-leaf. For same-group edges the LCA is the group itself, so the
// curve stays near the rim.
//
// Determinism: every sort has a secondary id tie-break. No Math.random,
// no date/time, no Map iteration over caller-provided data we didn't
// rebuild.

// ── Layout constants ─────────────────────────────────────────────────
/** Inner radius as a fraction of `min(width, height)`. 42% matches the
 *  mind-map outer ring fraction — lets the two views swap without a
 *  jarring zoom jump. */
const INNER_RADIUS_FRAC = 0.42;
/** Minimum inner radius in CSS px — tiny viewports still need room
 *  for labels. */
const INNER_RADIUS_MIN = 120;
/** Label band outside the ring. The layout's practical outer extent
 *  is `innerRadius + LEAF_LABEL_BAND`. */
const LEAF_LABEL_BAND = 100;
/** Gap between adjacent groups — 2° in radians. Reads as segmented. */
const GAP_ANGLE = (Math.PI / 180) * 2;
/** Inner padding within a group, as a fraction of the group's arc —
 *  keeps the first/last leaf from butting into the inter-group gap. */
const GROUP_INNER_PAD_FRAC = 0.1;
/** Group-hub radial position as a fraction of innerRadius. 0.5 puts
 *  the LCA hub halfway between origin and the rim — gives bundled
 *  splines a visible "neck" without crowding the centre. */
const GROUP_HUB_FRAC = 0.5;

// ── Determinism helpers ──────────────────────────────────────────────

/** Stable string hash — deterministic across runs. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generate a distinct palette colour for a group id. Rotates hue in
 *  HSL by a hash of the id; keeps saturation/lightness tame so the
 *  colours sit well next to the neutral greys of the rest of the UI. */
function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
}

function hslToHex(h: number, s: number, l: number): string {
  // Standard HSL→RGB. Kept local so we don't pull a dep for one call.
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
  const toHex = (v: number): string => {
    const n = Math.round((v + m) * 255);
    return n.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Blend a hashed palette hue with the kind's canonical colour, so
 *  every "galaxy" group still lives in the same hue family while
 *  different packages remain distinguishable. */
function groupColor(_kind: Entity["kind"], id: string): string {
  // For now: use the id-hashed palette outright so distinct packages
  // stand apart (the whole point of the chord view). The kind anchor
  // is available via `pixiKindColor` if we later want a blended tint.
  void pixiKindColor;
  return hashColorFromId(id);
}

// ── Main entry ───────────────────────────────────────────────────────

export function buildChordLayout(opts: BuildChordLayoutOpts): ChordLayout {
  const { tree, graph, width, height } = opts;
  const leafKind = opts.leafKind ?? "galaxy";
  const groupBy = opts.groupBy ?? "galaxy";
  const scopeId = opts.scopeId ?? null;

  if (scopeId !== null && !tree.byId.has(scopeId)) {
    throw new Error(`scopeId "${scopeId}" not found in tree`);
  }

  const shortDim = Math.max(1, Math.min(width, height));
  const innerRadius = Math.max(INNER_RADIUS_MIN, INNER_RADIUS_FRAC * shortDim);
  const outerExtent = innerRadius + LEAF_LABEL_BAND;

  // ── Collect leaves under scope ────────────────────────────────────
  const leafEntities = collectLeaves(tree, scopeId, leafKind);
  if (leafEntities.length === 0) {
    return {
      groups: [],
      leaves: [],
      edges: [],
      innerRadius,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    };
  }

  // ── Assign each leaf to a group ───────────────────────────────────
  // In galaxy leaf mode each galaxy IS its own group (one leaf per arc
  // = classic package-to-package chord). In building leaf mode we walk
  // up to the requested groupBy ancestor. Leaves without a matching
  // ancestor fall back to the nearest container so flat workspaces
  // don't silently drop files at the repo root.
  const leafToGroup = new Map<string, Entity>();
  const groupsById = new Map<string, Entity>();
  for (const leaf of leafEntities) {
    const group = leafKind === "galaxy" ? leaf : findGroupAncestor(tree, leaf, groupBy);
    if (!group) continue;
    leafToGroup.set(leaf.id, group);
    groupsById.set(group.id, group);
  }

  // ── Sort groups: by parent, then by leaf count desc, then name ────
  const groupList = [...groupsById.values()];
  const leavesByGroup = new Map<string, Entity[]>();
  for (const leaf of leafEntities) {
    const g = leafToGroup.get(leaf.id);
    if (!g) continue;
    const arr = leavesByGroup.get(g.id) ?? [];
    arr.push(leaf);
    leavesByGroup.set(g.id, arr);
  }
  groupList.sort((a, b) => {
    // Cluster groups by their parent id so sibling packages/dirs land
    // next to each other on the ring — readability win when the ring
    // has a dozen groups.
    const pa = a.parentId ?? "";
    const pb = b.parentId ?? "";
    if (pa !== pb) return pa < pb ? -1 : 1;
    // Within a parent: leaf count desc, then name asc, then id asc.
    const la = leavesByGroup.get(a.id)?.length ?? 0;
    const lb = leavesByGroup.get(b.id)?.length ?? 0;
    if (la !== lb) return lb - la;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  // ── Allocate angular spans ────────────────────────────────────────
  const gapTotal = GAP_ANGLE * groupList.length;
  const availArc = Math.max(0, 2 * Math.PI - gapTotal);
  const spanWeights = groupList.map(g => Math.sqrt((leavesByGroup.get(g.id)?.length ?? 0) + 1));
  const totalSpanWeight = spanWeights.reduce((acc, w) => acc + w, 0) || 1;

  const groups: ChordGroup[] = [];
  const leaves: ChordLeaf[] = [];
  // Groups start at 12 o'clock (-π/2) and sweep counter-clockwise so
  // the visual "first group" is up-top when the user's eye lands.
  let cursor = -Math.PI / 2;

  const rootOrigin = { x: 0, y: 0 };

  for (let gIdx = 0; gIdx < groupList.length; gIdx++) {
    const group = groupList[gIdx];
    if (!group) continue;
    const weight = spanWeights[gIdx] ?? 1;
    const rawSpan = (availArc * weight) / totalSpanWeight;
    const startAngle = cursor;
    const endAngle = cursor + rawSpan;
    cursor = endAngle + GAP_ANGLE;

    const groupLeaves = (leavesByGroup.get(group.id) ?? []).slice();
    // Alphabetical within a group so users can scan the ring. Id
    // tie-break keeps this bit-stable across runs.
    groupLeaves.sort((a, b) => {
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });

    const color = groupColor(group.kind, group.id);
    const leafIdsInAngularOrder: string[] = [];

    const innerPad = rawSpan * GROUP_INNER_PAD_FRAC * 0.5;
    const usableStart = startAngle + innerPad;
    const usableSpan = Math.max(0, rawSpan - innerPad * 2);
    const count = groupLeaves.length;
    // Group hub sits at the arc's angular midpoint, pulled inward.
    const hubAngle = (startAngle + endAngle) / 2;
    const hubRadius = innerRadius * GROUP_HUB_FRAC;
    const hubPoint = {
      x: Math.cos(hubAngle) * hubRadius,
      y: Math.sin(hubAngle) * hubRadius,
    };

    for (let i = 0; i < count; i++) {
      const leaf = groupLeaves[i];
      if (!leaf) continue;
      // Even angular step. With count=1 we centre the single leaf on
      // the arc's middle so it doesn't pile on the starting edge.
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = count === 1 ? (startAngle + endAngle) / 2 : usableStart + t * usableSpan;
      const x = Math.cos(angle) * innerRadius;
      const y = Math.sin(angle) * innerRadius;
      leaves.push({
        id: leaf.id,
        label: leaf.name,
        groupId: group.id,
        angle,
        x,
        y,
        // Extension point — with nested groups, more hub points slot
        // in between `rootOrigin` and the leaf's own group hub.
        pathFromRoot: [rootOrigin, hubPoint, { x, y }],
      });
      leafIdsInAngularOrder.push(leaf.id);
    }

    groups.push({
      id: group.id,
      label: group.name,
      kind: group.kind,
      startAngle,
      endAngle,
      depth: 0,
      color,
      leafIds: leafIdsInAngularOrder,
    });
  }

  // ── Edges: roll each file edge up to the leafKind level, then
  // accumulate into directed pairs. In galaxy mode a single ribbon
  // between two packages carries the TOTAL file-import count between
  // them, which is the whole point of the package-coupling view. In
  // building mode the rollup is a pass-through (file id === leaf id).
  const leafIdSet = new Set(leaves.map(l => l.id));
  const rollupCache = new Map<string, string | null>();
  const chordEdges: ChordEdge[] = [];
  const edgeAcc = new Map<string, { fromId: string; toId: string; category: ChordEdge["category"]; weight: number }>();
  for (const e of graph.fileEdges) {
    const fromLeaf = rollupToLeaf(tree, e.from, leafKind, rollupCache);
    const toLeaf = rollupToLeaf(tree, e.to, leafKind, rollupCache);
    if (!fromLeaf || !toLeaf) continue;
    if (fromLeaf === toLeaf) continue; // intra-leaf edge — not a chord between nodes
    if (!leafIdSet.has(fromLeaf) || !leafIdSet.has(toLeaf)) continue;
    const key = `${fromLeaf}→${toLeaf}`;
    const existing = edgeAcc.get(key);
    const category = mapKindToCategory(e.kind);
    if (existing) {
      existing.weight += e.weight || 1;
    } else {
      edgeAcc.set(key, {
        fromId: fromLeaf,
        toId: toLeaf,
        category,
        weight: e.weight || 1,
      });
    }
  }
  // Sort the accumulator deterministically before minting ids so a
  // re-run produces the same edge id list.
  const edgeEntries = [...edgeAcc.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [, agg] of edgeEntries) {
    chordEdges.push({
      id: `chord-edge:${agg.fromId}→${agg.toId}`,
      fromId: agg.fromId,
      toId: agg.toId,
      category: agg.category,
      weight: agg.weight,
    });
  }

  // ── Bounds ─────────────────────────────────────────────────────────
  // Practical bounds = the label band — ensures the SVG viewport is
  // sized to include text, not just the inner ring.
  const bounds = {
    minX: -outerExtent,
    minY: -outerExtent,
    maxX: outerExtent,
    maxY: outerExtent,
  };

  return {
    groups,
    leaves,
    edges: chordEdges,
    innerRadius,
    bounds,
  };
}

// ── Internals ────────────────────────────────────────────────────────

/** Collect entities of the requested kind under `scopeId` (or under
 *  root if null). For `leafKind === "galaxy"` this yields packages;
 *  for `leafKind === "building"` it yields files. Walking stops at the
 *  target kind so a galaxy's own descendants aren't expanded. */
function collectLeaves(
  tree: EntityTree,
  scopeId: string | null,
  leafKind: "galaxy" | "building",
): Entity[] {
  const rootId = scopeId ?? tree.rootId;
  const root = tree.byId.get(rootId);
  if (!root) return [];
  const out: Entity[] = [];
  const stack: Entity[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === leafKind) {
      out.push(cur);
      continue;
    }
    // Push children in reverse so iteration follows insertion order —
    // not strictly required (we re-sort later) but keeps traversal
    // reproducible for debugging.
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  // Final sort by id so order is stable regardless of childIds layout.
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Map a file entity id to its leafKind-level ancestor id. Returns
 *  null when the file has no matching ancestor (shouldn't happen in
 *  practice — every file lives under some package — but guards the
 *  rollup against corrupt trees). Cached lookups amortise across the
 *  O(edges) loop. */
function rollupToLeaf(
  tree: EntityTree,
  fileId: string,
  leafKind: "galaxy" | "building",
  cache: Map<string, string | null>,
): string | null {
  const hit = cache.get(fileId);
  if (hit !== undefined) return hit;
  if (leafKind === "building") {
    const exists = tree.byId.has(fileId) ? fileId : null;
    cache.set(fileId, exists);
    return exists;
  }
  // galaxy mode — walk up to find the containing package.
  const file = tree.byId.get(fileId);
  if (!file) {
    cache.set(fileId, null);
    return null;
  }
  for (const anc of tree.ancestorsOf(fileId)) {
    if (anc.kind === leafKind) {
      cache.set(fileId, anc.id);
      return anc.id;
    }
  }
  cache.set(fileId, null);
  return null;
}

/** Find the nearest ancestor (inclusive of self) matching `groupBy`.
 *  Falls back to the nearest container ancestor when no such ancestor
 *  exists (e.g. a file at the repo root with no "galaxy" wrapper). */
function findGroupAncestor(
  tree: EntityTree,
  leaf: Entity,
  groupBy: "galaxy" | "street",
): Entity | undefined {
  const chain = tree.ancestorsOf(leaf.id);
  // ancestorsOf includes the node itself first; walk up for the target kind.
  for (const anc of chain) {
    if (anc.kind === groupBy) return anc;
  }
  // Fallback: the leaf's direct parent — still a useful grouping even
  // if it's not the requested kind. Filters out "universe" root since
  // that would collapse every leaf into one mega-arc.
  for (const anc of chain) {
    if (anc.id === leaf.id) continue;
    if (anc.kind === "universe") continue;
    return anc;
  }
  return undefined;
}

function mapKindToCategory(kind: FileEdge["kind"]): ChordEdge["category"] {
  switch (kind) {
    case "import":
      return "import";
    case "call":
      return "call";
    case "dataflow":
      return "data-flow";
    case "cfg":
      return "control-flow";
    case "taint-propagation":
      return "taint";
    default:
      return "import";
  }
}
