import type { EntityKind, SymbolNodeKind } from "@quanta/canvas-engine";

/** Representative symbol preview attached to an entity node — a tiny
 *  "what's inside this file" strip that renders under the node's label.
 *  Answers "why does THIS file show up in my callers?" without a drill-in. */
export interface MindMapSymbolChip {
  /** Stable id for React keying. Usually the canvas-engine SymbolNode.id. */
  id: string;
  name: string;
  kind: SymbolNodeKind;
}

// Mind-map types
// --------------------------------------------------------------------
// Egocentric radial view of an entity's relationship graph. A single
// entity sits at the centre; at +1 depth a ring of "aggregator" virtual
// nodes groups the neighbours by relationship kind (parent dirs, call
// fan-in, fan-out, siblings, children, external deps, ...). Behind
// each aggregator, the actual entities for that relationship hang off
// on spokes. Edges are drawn as tapered bezier curves — thick at the
// centre end, thinning out at the leaf — so the eye reads "this is
// what touches the selection".
//
// The layout is computed in pure-data form by build-mind-map.ts; the
// SVG renderer consumes the resulting MindMapGraph without needing to
// know about the tree/workspace graph. This lets us test the layout
// deterministically and swap renderers later (Pixi for big graphs, a
// print-to-PDF dump, a minimap preview, etc.) with no core change.

/** Semantic groupings of +1 hop relationships. Each aggregator owns a
 *  bucket of entities with the same relationship kind to the centre.
 *  Future aggregators (external-deps, inheritance, data-relations)
 *  stay in the union so renderers can switch on a stable enum even
 *  while the data pipelines catch up — the builder just emits an
 *  empty bucket for missing sources. */
export type AggregatorKind =
  | "parent-dir"       // ancestors up the directory tree (immediate parent → root)
  | "children"         // direct descendants (only if the centre is a container)
  | "siblings"         // peer entities sharing the centre's parent
  | "callers"          // incoming edges (fan-in) — "who uses me?"
  | "callees"          // outgoing edges (fan-out) — "what do I use?"
  | "external-deps"    // lockfile/manifest deps (crates, npm, infra) — future
  | "inheritance"      // base classes / interfaces / traits — future
  | "data-relations";  // DB tables / schemas / data flow — future

/** One drawable node in the mind-map. Carries polar layout metadata
 *  (angle + radial distance) alongside cartesian coords so renderers
 *  can choose which to consume — cartesian is cheaper to paint,
 *  polar is cleaner for transitions on re-centre. */
export interface MindMapNode {
  /** Stable id. For entity nodes this is the underlying `Entity.id`; for
   *  aggregators it's `agg:<AggregatorKind>`. */
  id: string;
  kind: "center" | "aggregator" | "entity";
  /** Only set on `kind === "aggregator"`. */
  aggregatorKind?: AggregatorKind;
  /** Only set on `kind === "center" | "entity"`. The real entity id the
   *  node maps to; renderers use this for hit-testing + re-centering. */
  entityId?: string;
  /** Only set on `kind === "entity"`. Useful for per-kind icon / colour
   *  without forcing the renderer to look up the tree. */
  entityKind?: EntityKind;
  /** Display label. Short — aggregators use category names, entities
   *  use `Entity.name`, centre uses the same. */
  label: string;
  /** Optional secondary label (path for entities, bucket count for
   *  aggregators). Renderers may elide when space is tight. */
  sublabel?: string;
  /** Cartesian coords, viewport-centred. Origin is the centre node's
   *  position — positive x right, positive y down. */
  x: number;
  y: number;
  /** Polar metadata — handy for animated re-centring (interpolate the
   *  angle, not the cartesian, to keep nodes on smooth arcs). */
  angle: number;    // radians, 0 = east, CCW positive
  distance: number; // pixels from centre
  /** Visual radius (half-size for square rendering). Drives hit-test
   *  and label budget — bigger nodes can show sublabel, small ones
   *  only the primary label. */
  radius: number;
  /** Relationship strength to the centre — drives edge thickness and
   *  optional colour intensity. Normalised to [0, 1]. Aggregators
   *  always carry weight 1 (they're the backbone); entities get a
   *  fraction based on edge count / churn / LOC weight. */
  weight: number;
  /** Entity-only: top-N representative symbols inside this file. Renderer
   *  paints them as chips below the label so "file X is in the bucket
   *  because it holds functions Y, Z, ..." reads without a drill-in. */
  symbolPreview?: readonly MindMapSymbolChip[];
  /** Entity-only: total symbols in this file, so the renderer can append
   *  "+N" when `symbolPreview` was truncated. */
  symbolTotal?: number;
}

/** One drawable edge. Two kinds:
 *  - `center-to-aggregator`: thick trunk from centre node out to each
 *    aggregator hub. Renderers draw these first so they sit under the
 *    aggregator-to-entity spokes.
 *  - `aggregator-to-entity`: thin spoke from the aggregator to its
 *    entity bucket. */
export interface MindMapEdge {
  id: string;
  fromId: string;
  toId: string;
  kind: "center-to-aggregator" | "aggregator-to-entity";
  /** Stroke width at the `from` side, in CSS px. The variable-width
   *  bezier tapers from `widthStart` → `widthEnd` along the curve. */
  widthStart: number;
  widthEnd: number;
  /** Edge weight for sorting / layering. Higher-weight edges paint on
   *  top so dominant relationships win the z-order when bundles cross. */
  weight: number;
}

/** The full graph produced by `buildMindMap`. */
export interface MindMapGraph {
  /** Id of the centre entity. Stored separately from `nodes` so consumers
   *  can identify the focus node without scanning the array. */
  centerId: string;
  nodes: readonly MindMapNode[];
  edges: readonly MindMapEdge[];
  /** Axis-aligned bounding box covering every node; renderers use this
   *  to centre + scale the scene in the viewport. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Summary counts per aggregator — useful for badges / tooltips that
   *  need the bucket size even when the renderer elides some entities
   *  (e.g. a `+N more` affordance on crowded spokes). */
  aggregatorCounts: Readonly<Record<AggregatorKind, number>>;
}

/** Hint the layout engine can use to weight nodes. Callers plug this
 *  in so the layout doesn't have to re-derive LOC / edge count from
 *  the raw graph; keeps the builder pure data-in → data-out. */
export interface EntityWeightHint {
  /** Higher = more important. The layout uses this to push important
   *  entities closer to their aggregator and to scale their radius. */
  weight: number;
}
