import type {
  Entity,
  EntityTree,
  FileEdge,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import { fileDisplayName } from "../../../shared/lib/file-ext";
import type {
  AggregatorKind,
  EntityWeightHint,
  MindMapEdge,
  MindMapGraph,
  MindMapNode,
} from "./types";

// build-mind-map
// --------------------------------------------------------------------
// Produce a radial (egocentric) mind-map graph around `centerId`. The
// centre sits at (0, 0); aggregators fan out on an inner ring; the
// entities behind each aggregator hang off a second ring. The whole
// graph is pure data — a downstream renderer paints the tapered bezier
// trunks and spokes without needing the source tree.
//
// Why pure-data: we want to unit-test the layout (angle ordering,
// weight → distance, cap handling, determinism) without a renderer
// in the loop, and we want to swap renderers later (SVG now, Pixi for
// huge graphs) without touching the algorithm.
//
// Aggregator policy:
//   - `parent-dir`, `children`, `siblings`, `callers`, `callees` are
//     computed from the tree + fileEdges available today.
//   - `external-deps`, `inheritance`, `data-relations` are reserved —
//     buckets always emit count=0 but stay in `aggregatorCounts` so
//     renderers have a stable enum to switch on as data pipelines
//     land.
//
// Determinism: every sort has an index tie-break so identical input →
// bit-identical output. No Math.random, no date/time, no Map iteration
// over data we didn't build ourselves.

// ── Layout constants ─────────────────────────────────────────────────
// Inner ring radius as a fraction of `min(width, height)`. 22% leaves
// room for the centre label + a little visual breathing space before
// the aggregator hub lands.
const R1_FRAC = 0.22;
// Outer ring radius — where the entity spokes terminate. Roughly
// double R1 keeps the spoke long enough to read a leaf label without
// the aggregator hub overlapping it.
const R2_FRAC = 0.48;
// Weight-to-inward-pull: reduced so entities stay on a more level ring.
const WEIGHT_PULL_FRAC = 0.04;
// Minimum R1 in CSS px. At very small viewports the ring would
// collapse onto the centre node; clamp so labels still fit.
const R1_MIN = 90;
// Minimum angular budget per entity — 15° keeps nodes legible even
// when several buckets share tight arc space.
const MIN_ENTITY_ARC = (2 * Math.PI) / 24; // 15° per entity
// Per-bucket cap. Capped at 6 so a single bucket never monopolises
// the full circle and node density stays comfortable.
const DEFAULT_CAP = 6;
// Golden angle ≈ 137.5°. Used as a gentle irregularity inside a
// bucket's arc so evenly-weighted siblings don't look like a clock
// face. Phyllotaxis, not rigid spacing.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ── Node sizing ──────────────────────────────────────────────────────
const CENTER_RADIUS = 32;
const AGGREGATOR_RADIUS = 22;
const ENTITY_RADIUS_BASE = 16;
const ENTITY_RADIUS_GAIN = 10; // → range 16..26 over weight ∈ [0,1]

// ── Angular priority ─────────────────────────────────────────────────
// Preferred order around the clock — `parent-dir` anchors the 12-o'clock
// slot (angle = -π/2), then we sweep counter-clockwise so the user's
// eye can read the chain "where I come from → who calls me → siblings
// → children → what I call" in a single scan. Missing aggregators get
// skipped without leaving a gap.
const PRIORITY_ORDER: readonly AggregatorKind[] = [
  "parent-dir",
  "callers",
  "siblings",
  "children",
  "callees",
  "inheritance",
  "external-deps",
  "data-relations",
];

// Full static list — used to seed `aggregatorCounts` with zeros so
// every key is always present in the returned record.
const ALL_AGGREGATORS: readonly AggregatorKind[] = [
  "parent-dir",
  "children",
  "siblings",
  "callers",
  "callees",
  "external-deps",
  "inheritance",
  "data-relations",
];

export interface BuildMindMapOpts {
  tree: EntityTree;
  graph: WorkspaceGraph;
  centerId: string;
  /** Viewport dimensions in CSS px — used to scale the radial radii so
   *  the graph fits without clipping. */
  width: number;
  height: number;
  /** Optional per-entity weight hints. Missing ids default to weight 0.5. */
  weights?: ReadonlyMap<string, EntityWeightHint>;
  /** Cap on entities per aggregator bucket. Buckets larger than this
   *  get truncated to the top-`cap` entities by weight; the overflow
   *  count is exposed via `aggregatorCounts` so the renderer can show
   *  "+N more" if it wants. Default 8. */
  entitiesPerAggregatorCap?: number;
}

export function buildMindMap(opts: BuildMindMapOpts): MindMapGraph {
  const { tree, graph, centerId, width, height } = opts;
  const cap = opts.entitiesPerAggregatorCap ?? DEFAULT_CAP;

  const centre = tree.byId.get(centerId);
  if (!centre) {
    throw new Error(`centerId "${centerId}" not found in tree`);
  }

  // Ring radii scale with the shorter viewport edge so rotation keeps
  // the graph inside the visible box regardless of aspect ratio.
  const shortDim = Math.max(1, Math.min(width, height));
  const R1 = Math.max(R1_MIN, R1_FRAC * shortDim);
  const R2 = Math.max(R1 + 40, R2_FRAC * shortDim); // keep a visible ring gap even at tiny viewports

  // ── Pass 1: collect raw buckets ────────────────────────────────────
  const rawBuckets = collectBuckets(tree, graph, centre);

  // ── Pass 2: weight every entity ────────────────────────────────────
  // Use caller-supplied hints when present; otherwise fall back to the
  // file-edge adjacency heuristic, normalised per bucket so a small
  // bucket isn't drowned out by a big one.
  const weightFor = makeWeightFn(opts.weights, graph);
  const weighted = new Map<AggregatorKind, WeightedEntity[]>();
  for (const [kind, entities] of rawBuckets) {
    const scored = entities.map((e, idx) => ({
      entity: e,
      weight: weightFor(e.id),
      /** Insertion index — a second tie-break key so identical weights
       *  never reorder across runs. */
      idx,
    }));
    normalisePerBucket(scored);
    weighted.set(kind, scored);
  }

  // ── aggregatorCounts: original (pre-cap) bucket sizes ──────────────
  const aggregatorCounts = {} as Record<AggregatorKind, number>;
  for (const kind of ALL_AGGREGATORS) {
    aggregatorCounts[kind] = weighted.get(kind)?.length ?? 0;
  }

  // ── Pass 3: trim buckets to the cap, ordered by weight ─────────────
  const trimmed = new Map<AggregatorKind, WeightedEntity[]>();
  for (const [kind, scored] of weighted) {
    const sorted = [...scored].sort(byWeightDesc);
    trimmed.set(kind, sorted.slice(0, cap));
  }

  // ── Pass 4: decide which aggregators actually get a node ───────────
  // Non-empty buckets always emit a hub. Reserved future aggregators
  // (always empty today) stay visible only through `aggregatorCounts`.
  //
  // Pair exception: `callers` + `callees` are semantic partners (fan-in
  // vs fan-out of the SAME edge set). Showing one without the other
  // reads as a bug — "does this file really have zero callers, or are
  // we just missing that side?". If EITHER side is populated, emit
  // BOTH hubs so the absent side is visibly zero instead of silently
  // hidden. `aggregatorCounts` already carries the real number so
  // renderers can show "0" in the pill sublabel.
  const hasCallers = (trimmed.get("callers")?.length ?? 0) > 0;
  const hasCallees = (trimmed.get("callees")?.length ?? 0) > 0;
  const forceCallPair = hasCallers || hasCallees;
  const activeAggregators: AggregatorKind[] = [];
  for (const kind of PRIORITY_ORDER) {
    const bucket = trimmed.get(kind);
    const populated = !!(bucket && bucket.length > 0);
    const forced = (kind === "callers" || kind === "callees") && forceCallPair;
    if (populated || forced) activeAggregators.push(kind);
  }

  // ── Pass 5: allocate angular spans ─────────────────────────────────
  // sqrt damping so a 100-entity bucket doesn't swamp a 2-entity
  // bucket. `+ 1` so a 1-entity bucket still gets ≈sqrt(2) > 1 weight,
  // not the raw value 1 that collapses next to siblings.
  const spanWeights = activeAggregators.map(kind => ({
    kind,
    w: Math.sqrt((trimmed.get(kind)?.length ?? 0) + 1),
  }));
  const totalSpanWeight = spanWeights.reduce((acc, sw) => acc + sw.w, 0) || 1;
  const aggregatorAngles = new Map<AggregatorKind, { centre: number; span: number }>();
  // Start at top (12 o'clock) and sweep clockwise so the PRIORITY_ORDER
  // reads "parent-dir → callers → ..." as the user scans.
  let cursor = -Math.PI / 2;
  for (const sw of spanWeights) {
    const span = (2 * Math.PI * sw.w) / totalSpanWeight;
    const centreAngle = cursor + span / 2;
    aggregatorAngles.set(sw.kind, { centre: centreAngle, span });
    cursor += span;
  }

  // ── Pass 6: emit nodes + edges ─────────────────────────────────────
  const nodes: MindMapNode[] = [];
  const edges: MindMapEdge[] = [];

  // Track entity ids we've already placed so the same entity can't
  // appear in two buckets simultaneously (which would cause React key
  // collisions + apparently-disconnected edges).
  const seenEntityIds = new Set<string>();

  // Centre node at origin.
  const centreNode: MindMapNode = {
    id: centre.id,
    kind: "center",
    entityId: centre.id,
    entityKind: centre.kind,
    label: fileDisplayName(centre),
    sublabel: centre.path || undefined,
    x: 0,
    y: 0,
    angle: 0,
    distance: 0,
    radius: CENTER_RADIUS,
    weight: 1,
  };
  nodes.push(centreNode);

  for (const kind of activeAggregators) {
    const slot = aggregatorAngles.get(kind);
    if (!slot) continue;
    // Empty buckets reach here only via the callers/callees pair force
    // (see Pass 4) — we still emit the hub + trunk so the absent side
    // reads as "zero", but skip the per-entity loop below.
    const bucket = trimmed.get(kind) ?? [];

    const aggregatorId = `agg:${kind}`;
    const aggX = Math.cos(slot.centre) * R1;
    const aggY = Math.sin(slot.centre) * R1;
    const aggregatorNode: MindMapNode = {
      id: aggregatorId,
      kind: "aggregator",
      aggregatorKind: kind,
      label: aggregatorLabel(kind),
      sublabel: String(aggregatorCounts[kind]),
      x: aggX,
      y: aggY,
      angle: slot.centre,
      distance: R1,
      radius: AGGREGATOR_RADIUS,
      weight: 1,
    };
    nodes.push(aggregatorNode);

    // Trunk edge: centre → aggregator. log2 so doubling a bucket adds
    // a fixed width step, not a linear one — keeps huge buckets from
    // producing absurd trunks.
    const trunkStart = 4 + 2 * Math.log2(aggregatorCounts[kind] + 1);
    edges.push({
      id: `e:center->${aggregatorId}`,
      fromId: centre.id,
      toId: aggregatorId,
      kind: "center-to-aggregator",
      widthStart: trunkStart,
      widthEnd: trunkStart * 0.6,
      weight: aggregatorCounts[kind],
    });

    // Angular span for entities inside this aggregator's fan — clamped
    // by the aggregator's allocated span (can't spread wider than the
    // slice we own) and by a per-entity minimum (so labels don't pile).
    const desiredArc = bucket.length * MIN_ENTITY_ARC;
    const entityArc = Math.min(slot.span * 0.85, desiredArc);
    // Leaf fan is centred on the aggregator angle. When the arc is
    // narrower than the allocated slot we get a visible wedge; when
    // equal, the bucket fills the whole slice.
    const arcStart = slot.centre - entityArc / 2;

    for (let i = 0; i < bucket.length; i++) {
      const item = bucket[i];
      if (!item) continue;
      const { entity, weight } = item;
      // Skip entities that already appear in a higher-priority bucket —
      // prevents the same node from being added twice (which causes React
      // key collisions and makes one set of spoke edges appear disconnected).
      if (seenEntityIds.has(entity.id)) continue;
      seenEntityIds.add(entity.id);
      // Phyllotactic offset within the arc — distributes siblings
      // irregularly so equal weights don't collapse into a clock face,
      // while still preserving deterministic ordering.
      const phyllo = (i * GOLDEN_ANGLE) % entityArc;
      const linear = bucket.length <= 1 ? entityArc / 2 : (i / (bucket.length - 1)) * entityArc;
      // Blend: mostly linear for predictability, a touch of
      // phyllotactic for visual softness (30%).
      const along = linear * 0.7 + phyllo * 0.3;
      const angle = arcStart + along;
      const distance = R2 - weight * WEIGHT_PULL_FRAC * shortDim;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const nodeId = entity.id;
      const entityNode: MindMapNode = {
        id: nodeId,
        kind: "entity",
        entityId: entity.id,
        entityKind: entity.kind,
        label: fileDisplayName(entity),
        sublabel: entity.path || undefined,
        x,
        y,
        angle,
        distance,
        radius: ENTITY_RADIUS_BASE + ENTITY_RADIUS_GAIN * clamp01(weight),
        weight,
      };
      nodes.push(entityNode);
      edges.push({
        id: `e:${aggregatorId}->${nodeId}`,
        fromId: aggregatorId,
        toId: nodeId,
        kind: "aggregator-to-entity",
        widthStart: 2.4,
        widthEnd: 1.2 + clamp01(weight) * 1.8,
        weight,
      });
    }
  }

  // ── Collision resolution ───────────────────────────────────────────
  // Run a simple O(n²) force-repulsion pass so overlapping nodes push
  // apart rather than stacking. Aggregators move very little (they're
  // anchored to their ring); entities move freely.
  resolveNodeCollisions(nodes);

  // ── Bounds ─────────────────────────────────────────────────────────
  let minX = -CENTER_RADIUS;
  let minY = -CENTER_RADIUS;
  let maxX = CENTER_RADIUS;
  let maxY = CENTER_RADIUS;
  for (const n of nodes) {
    if (n.x - n.radius < minX) minX = n.x - n.radius;
    if (n.y - n.radius < minY) minY = n.y - n.radius;
    if (n.x + n.radius > maxX) maxX = n.x + n.radius;
    if (n.y + n.radius > maxY) maxY = n.y + n.radius;
  }

  return {
    centerId: centre.id,
    nodes,
    edges,
    bounds: { minX, minY, maxX, maxY },
    aggregatorCounts,
  };
}

// ── Collision resolution ─────────────────────────────────────────────
//
// AABB-based. Each node's bounding box includes its label region (which
// sits BELOW the shape for entities and IS the shape for aggregator
// pills), so two nodes whose hexagons don't touch but whose labels
// would overlap still push apart.

/** Axis-aligned bounding half-extents around node center position.
 *  Returns {rx, ry, offsetY} — offsetY is how far the box is shifted
 *  down from n.(x,y); entity boxes extend further below than above
 *  because the label is rendered at y ≈ n.y + radius + 18. */
function nodeAabb(n: MindMapNode): { rx: number; ry: number; cy: number } {
  if (n.kind === "center") {
    const r = n.radius + 4;
    return { rx: r, ry: r, cy: n.y };
  }
  if (n.kind === "aggregator") {
    // Premium pill: [glyph | LABEL | count-badge] ≈ 110–140 px wide
    const labelLen = n.label.length;
    const pillW = Math.max(n.radius * 2 + 20, labelLen * 7 + 70);
    return { rx: pillW / 2 + 4, ry: n.radius + 6, cy: n.y };
  }
  // Entity: shape (height ≈ 2*radius) + label below (≈ 16 px)
  const labelW = n.label.length * 6.3;
  const rx = Math.max(n.radius, labelW / 2) + 4;
  const topExtent    = n.radius + 4;
  const bottomExtent = n.radius + 22; // includes label band below shape
  const ry = (topExtent + bottomExtent) / 2;
  const cy = n.y + (bottomExtent - topExtent) / 2;
  return { rx, ry, cy };
}

function resolveNodeCollisions(nodes: MindMapNode[]): void {
  const ITER = 120;
  const MAX_ENTITY_DRIFT = 70;

  const orig = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    if (n.kind !== "center") orig.set(n.id, { x: n.x, y: n.y });
  }

  for (let it = 0; it < ITER; it++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      if (a.kind === "center") continue;
      const ab = nodeAabb(a);

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        if (b.kind === "center") continue;
        const bb = nodeAabb(b);

        const dx = b.x - a.x;
        const dy = bb.cy - ab.cy;
        const minX = ab.rx + bb.rx;
        const minY = ab.ry + bb.ry;
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        // Movement weight — aggregators are ring-anchored (nudge only
        // 10%). Two entities split the push 50/50.
        const fa = a.kind === "aggregator" ? 0.10 : 0.5;
        const fb = b.kind === "aggregator" ? 0.10 : 0.5;

        // Resolve along axis of minimum penetration (cheapest escape).
        if (overlapX < overlapY) {
          const push = overlapX * 0.55 + 0.25;
          const sign = dx >= 0 ? 1 : -1;
          a.x -= sign * push * fa;
          b.x += sign * push * fb;
        } else {
          const push = overlapY * 0.55 + 0.25;
          const sign = dy >= 0 ? 1 : -1;
          a.y -= sign * push * fa;
          b.y += sign * push * fb;
        }
        moved = true;
      }
    }

    // Clamp drift so spokes stay visible + their aggregator reachable.
    for (const n of nodes) {
      if (n.kind !== "entity") continue;
      const o = orig.get(n.id);
      if (!o) continue;
      const ddx = n.x - o.x;
      const ddy = n.y - o.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd > MAX_ENTITY_DRIFT) {
        const s = MAX_ENTITY_DRIFT / dd;
        n.x = o.x + ddx * s;
        n.y = o.y + ddy * s;
      }
    }

    if (!moved) break; // early-exit once settled
  }

  // Keep entities outside the aggregator ring.
  for (const n of nodes) {
    if (n.kind !== "entity") continue;
    const d = Math.hypot(n.x, n.y);
    if (d < R1_MIN + 10 && d > 0.001) {
      const s = (R1_MIN + 10) / d;
      n.x *= s;
      n.y *= s;
    }
  }
}

// ── Internals ────────────────────────────────────────────────────────

interface WeightedEntity {
  entity: Entity;
  weight: number;
  /** Stable tie-break. Kept after re-sorts so identical weights never
   *  reorder across runs. */
  idx: number;
}

function byWeightDesc(a: WeightedEntity, b: WeightedEntity): number {
  if (b.weight !== a.weight) return b.weight - a.weight;
  // Tie-break on id so downstream order is independent of input
  // ordering — keeps determinism across different caller shapes.
  if (a.entity.id !== b.entity.id) return a.entity.id < b.entity.id ? -1 : 1;
  return a.idx - b.idx;
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function aggregatorLabel(kind: AggregatorKind): string {
  switch (kind) {
    case "parent-dir": return "Parents";
    case "children": return "Children";
    case "siblings": return "Siblings";
    case "callers": return "Callers";
    case "callees": return "Callees";
    case "external-deps": return "External";
    case "inheritance": return "Inheritance";
    case "data-relations": return "Data";
  }
}

/** Collect raw (pre-weight, pre-cap) bucket contents from tree + graph. */
function collectBuckets(
  tree: EntityTree,
  graph: WorkspaceGraph,
  centre: Entity,
): Map<AggregatorKind, Entity[]> {
  const out = new Map<AggregatorKind, Entity[]>();
  for (const k of ALL_AGGREGATORS) out.set(k, []);

  // parent-dir — ancestors excluding the centre itself and the
  // universe root (the root is the synthetic workspace container, not
  // a useful relationship).
  const ancestorsAll = tree.ancestorsOf(centre.id);
  const parentDir: Entity[] = [];
  for (const anc of ancestorsAll) {
    if (anc.id === centre.id) continue;
    if (anc.kind === "universe") continue;
    parentDir.push(anc);
  }
  out.set("parent-dir", parentDir);

  // children — direct descendants only. Drilling into a sub-tree is
  // the re-centre path, not a fan-out here.
  if (centre.childIds.length > 0) {
    const kids: Entity[] = [];
    for (const cid of centre.childIds) {
      const c = tree.byId.get(cid);
      if (c) kids.push(c);
    }
    out.set("children", kids);
  }

  // siblings — share centre's parent, minus the centre itself. Empty
  // when the centre is the universe root.
  if (centre.parentId) {
    const parent = tree.byId.get(centre.parentId);
    if (parent) {
      const sibs: Entity[] = [];
      for (const sid of parent.childIds) {
        if (sid === centre.id) continue;
        const s = tree.byId.get(sid);
        if (s) sibs.push(s);
      }
      out.set("siblings", sibs);
    }
  }

  // callers / callees — map every file-edge endpoint to the nearest
  // ancestor with the centre's kind; emit when the OTHER endpoint
  // matches the centre. Dedup by id so a file with 10 callers to the
  // same caller-file only contributes one entry.
  if (centre.kind === "building" || centre.kind === "floor" || centre.kind === "room") {
    // Edge endpoints are file ids; for building-centered graphs we
    // compare directly. For deeper kinds we'd need function-level
    // edges, which aren't in FileEdge today — leave those buckets
    // empty rather than fake up misleading spokes.
    if (centre.kind === "building") {
      const callers = collectEdgePeers(graph.fileEdges, tree, centre.id, "in");
      const callees = collectEdgePeers(graph.fileEdges, tree, centre.id, "out");
      out.set("callers", callers);
      out.set("callees", callees);
    }
  } else if (centre.kind === "street" || centre.kind === "galaxy") {
    // Roll file-edges up to the centre's kind. An edge A→B becomes a
    // peer when one endpoint is a descendant of the centre and the
    // other is NOT (otherwise it's an internal edge, which doesn't
    // represent an external fan-in/out relationship).
    const { callers, callees } = collectRolledEdgePeers(graph.fileEdges, tree, centre);
    out.set("callers", callers);
    out.set("callees", callees);
  }

  return out;
}

/** File-level edge peers — for building-kind centres. */
function collectEdgePeers(
  fileEdges: readonly FileEdge[],
  tree: EntityTree,
  centreId: string,
  direction: "in" | "out",
): Entity[] {
  const seen = new Map<string, Entity>();
  for (const edge of fileEdges) {
    const self = direction === "in" ? edge.to : edge.from;
    if (self !== centreId) continue;
    const peerId = direction === "in" ? edge.from : edge.to;
    if (peerId === centreId) continue; // self-loops don't count as relationships
    const peer = tree.byId.get(peerId);
    if (!peer) continue; // endpoint isn't in the tree — skip silently
    if (!seen.has(peer.id)) seen.set(peer.id, peer);
  }
  return [...seen.values()];
}

/** Roll file-level edges up to the centre's kind for container centres. */
function collectRolledEdgePeers(
  fileEdges: readonly FileEdge[],
  tree: EntityTree,
  centre: Entity,
): { callers: Entity[]; callees: Entity[] } {
  const inPeers = new Map<string, Entity>();
  const outPeers = new Map<string, Entity>();
  const centreKind = centre.kind;

  const ancestorAtKind = (fileId: string): Entity | undefined => {
    const chain = tree.ancestorsOf(fileId);
    for (const a of chain) if (a.kind === centreKind) return a;
    return undefined;
  };
  const isUnderCentre = (fileId: string): boolean => {
    for (const a of tree.ancestorsOf(fileId)) if (a.id === centre.id) return true;
    return false;
  };

  for (const edge of fileEdges) {
    const fromUnder = isUnderCentre(edge.from);
    const toUnder = isUnderCentre(edge.to);
    // Both-under = internal; neither-under = unrelated. Only a single
    // side touching the centre's sub-tree is a cross-boundary peer.
    if (fromUnder === toUnder) continue;
    if (toUnder) {
      // Fan-in: `from` is external, roll it to an entity of centre.kind.
      const peer = ancestorAtKind(edge.from);
      if (peer && peer.id !== centre.id && !inPeers.has(peer.id)) inPeers.set(peer.id, peer);
    } else {
      // Fan-out: `to` is external.
      const peer = ancestorAtKind(edge.to);
      if (peer && peer.id !== centre.id && !outPeers.has(peer.id)) outPeers.set(peer.id, peer);
    }
  }
  return { callers: [...inPeers.values()], callees: [...outPeers.values()] };
}

/** Weight function — hints first, then a file-edge adjacency heuristic. */
function makeWeightFn(
  hints: ReadonlyMap<string, EntityWeightHint> | undefined,
  graph: WorkspaceGraph,
): (id: string) => number {
  if (hints && hints.size > 0) {
    return (id: string): number => {
      const hint = hints.get(id);
      if (!hint) return 0.5;
      return clamp01(hint.weight);
    };
  }
  // Heuristic: raw adjacency count in fileEdges. Counts ALL edges
  // touching this id (both directions) — saturates via tanh so a file
  // with 1 edge vs 100 edges stays inside [0, 1] without clipping
  // everything above a threshold to exactly 1.0.
  const adj = new Map<string, number>();
  for (const e of graph.fileEdges) {
    adj.set(e.from, (adj.get(e.from) ?? 0) + 1);
    adj.set(e.to, (adj.get(e.to) ?? 0) + 1);
  }
  return (id: string): number => {
    const n = adj.get(id) ?? 0;
    return Math.tanh(n / 8); // 8-edge saturation constant — picked so a ~8-edge file lands near weight 0.76.
  };
}

/** Per-bucket weight normalisation — rescales so the bucket's max is
 *  at most 1.0 AND at least 0.25 (so a bucket of low-raw-weight
 *  entities still spreads visibly along the WEIGHT_PULL axis). */
function normalisePerBucket(scored: WeightedEntity[]): void {
  if (scored.length === 0) return;
  let max = 0;
  for (const s of scored) if (s.weight > max) max = s.weight;
  // If the bucket is entirely zeros (or all equal), leave the raw
  // weights alone — they'll all collapse to the same distance, which
  // is the correct semantic (no differentiation signal).
  if (max <= 0) return;
  const target = Math.max(max, 0.25);
  const gain = target / max;
  for (const s of scored) s.weight = clamp01(s.weight * gain);
}
