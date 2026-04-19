// Hierarchical Entity model
// --------------------------------------------------------------------
// The entity model the Code Universe presentation runs on. Unlike the
// legacy `FileNode` (the only first-class unit in the old canvas), an
// Entity can represent any scale — repo, package, directory, file,
// module, function. Each tier of the zoom ladder renders its own
// `visibleKind`, so the same workspace shows as six very different
// visualisations as the user zooms.
//
// Why separate from `FileNode`/`WorkspaceGraph`:
//   - `FileNode` is a terminal node (one file = one unit). To render a
//     package or directory as a first-class card we'd have to smuggle
//     aggregate state onto `FileNode`, which pollutes the leaf type.
//   - Edges at each tier require rollup: file-call edges have to
//     collapse into directory-call edges at street, package-call edges
//     at galaxy. An explicit `Entity.kind` makes that aggregation a
//     typed join.
//   - Layout at each tier wants different inputs (a hierarchical
//     treemap at universe; a force-directed cloud at room). Shared
//     `Entity` + per-tier layout keeps the engine open to growth.
//
// This model is additive — the existing `FileNode` graph stays the
// authoritative source. An Entity tree is `build`-ed from a graph on
// demand; stale trees are discarded with no cross-state to unwind.

/**
 * Ordered from outermost (universe) inward to innermost (room).
 * The ordering IS the zoom ladder: universe = most zoomed out,
 * room = most zoomed in. Tier switching walks one step up/down.
 */
export type EntityKind =
  | "universe" // the workspace / repo root
  | "galaxy"   // a package (top-level dir or pnpm workspace member)
  | "street"   // an intermediate directory
  | "building" // a file
  | "floor"    // a module / class inside a file
  | "room";    // a function or method

/** Topological depth of each kind — higher = deeper in the tree. */
export const ENTITY_DEPTH: Readonly<Record<EntityKind, number>> = {
  universe: 0,
  galaxy: 1,
  street: 2,
  building: 3,
  floor: 4,
  room: 5,
};

export interface EntityMetrics {
  /** Sum of lines of code at or below this entity. */
  loc?: number;
  /** Aggregated risk (max or weighted mean — impl decides). */
  riskScore?: number;
  /** Number of file-kind descendants. Undefined for `room`/`floor` leaves. */
  fileCount?: number;
  /** For non-leaf kinds: count of direct children of the most common child kind. */
  childCount?: number;
}

/**
 * A single node in the hierarchical entity tree. Leaf kinds (`room`,
 * `floor`) have no children; non-leaf kinds do. Sibling ordering is
 * deterministic — we use insertion order derived from the underlying
 * file path sort.
 */
export interface Entity {
  /** Stable id. For files we reuse the `FileNode.id` (path); for
   *  non-file kinds we synthesize `kind:path` (e.g. `galaxy:packages/ui-kit`). */
  id: string;
  kind: EntityKind;
  /** Human-readable display name — last path segment, fn name, etc. */
  name: string;
  /** Full workspace-relative path, including the entity itself. */
  path: string;
  /** Parent entity id. `null` only for the `universe` root. */
  parentId: string | null;
  /** Direct children ids, in stable order. Empty for leaves. */
  childIds: readonly string[];
  /** Optional rollup metrics. */
  metrics?: EntityMetrics;
}

/**
 * Full tree. Callers index by id via `byId`. Traversal helpers are on
 * the tree, not on individual nodes, so `Entity` stays a plain data
 * value — cheap to serialize, cache, and compare.
 */
export interface EntityTree {
  rootId: string;
  byId: ReadonlyMap<string, Entity>;
  /** Walk up the parent chain (including the node itself). */
  ancestorsOf(id: string): readonly Entity[];
  /** Direct children of a node. */
  childrenOf(id: string): readonly Entity[];
  /** All entities of a given kind, in tree order. */
  byKind(kind: EntityKind): readonly Entity[];
}
