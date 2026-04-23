import type { WorkspaceGraph, FileNode, FunctionBlock } from "../graph/types";
import type { Entity, EntityKind, EntityTree } from "./types";

// build-entity-tree
// --------------------------------------------------------------------
// Project a `WorkspaceGraph` into an `EntityTree`. Tree shape is
// derived entirely from file paths (not from import edges or LOD
// config), which keeps the build a single O(files × avg-path-depth)
// pass. Edges from `graph.fileEdges` are NOT consumed here — edge
// rollup per tier is a separate module (`tier/edge-rollup`), built
// lazily when a tier switch asks for it.
//
// Path → kind mapping:
//   ""                        → universe
//   "<pkg>"                   → galaxy      (top-level segment)
//   "<pkg>/<dir>/..."         → street      (intermediate segments)
//   "<...>/<file>.<ext>"      → building
//   (module/room come from FileNode.functions — Phase 3B)
//
// Future: pluggable `packageDetector` (monorepo-aware) — for now,
// every top-level segment is a `galaxy`. Mono-package repos end up
// with a single `galaxy` child under the universe root, which is
// fine semantically (the user zooms past it quickly).

export interface BuildEntityTreeOpts {
  /** Display name for the universe root. Defaults to "workspace". */
  workspaceName?: string;
}

export function buildEntityTree(
  graph: WorkspaceGraph,
  opts: BuildEntityTreeOpts = {},
): EntityTree {
  const workspaceName = opts.workspaceName ?? "workspace";
  const byId = new Map<string, Entity>();
  const childrenIndex = new Map<string, string[]>(); // parentId → ordered child ids
  const byKind = new Map<EntityKind, Entity[]>();

  const universeId = "universe:";
  const rootEntity: Entity = {
    id: universeId,
    kind: "universe",
    name: workspaceName,
    path: "",
    parentId: null,
    childIds: [],
  };
  byId.set(universeId, rootEntity);
  childrenIndex.set(universeId, []);

  // Files are pre-sorted by path so sibling order is deterministic
  // across rebuilds. Without this, Map iteration order (insertion)
  // would leak raw graph ordering, which varies per backend.
  const files = [...graph.files].sort((a, b) => a.id.localeCompare(b.id));

  for (const file of files) {
    walkAndAttach(file, byId, childrenIndex);
  }

  // Second pass: materialise `childIds` from the scratch index and
  // populate `byKind`. Separating the walk from the materialisation
  // lets the walk mutate freely without Entity `readonly childIds`
  // needing reconstruction on every insertion.
  for (const [parentId, kids] of childrenIndex) {
    const parent = byId.get(parentId);
    if (!parent) continue;
    const withKids: Entity = { ...parent, childIds: kids };
    byId.set(parentId, withKids);
  }
  for (const entity of byId.values()) {
    const list = byKind.get(entity.kind);
    if (list) list.push(entity);
    else byKind.set(entity.kind, [entity]);
  }

  return {
    rootId: universeId,
    byId,
    ancestorsOf(id) {
      const out: Entity[] = [];
      let cur: Entity | undefined = byId.get(id);
      while (cur) {
        out.push(cur);
        cur = cur.parentId ? byId.get(cur.parentId) : undefined;
      }
      return out;
    },
    childrenOf(id) {
      const parent = byId.get(id);
      if (!parent) return [];
      const out: Entity[] = [];
      for (const childId of parent.childIds) {
        const child = byId.get(childId);
        if (child) out.push(child);
      }
      return out;
    },
    byKind(kind) {
      return byKind.get(kind) ?? [];
    },
  };
}

// Internal — walk one file, attach it to the tree, create any
// missing galaxy/street ancestors along the way.
function walkAndAttach(
  file: FileNode,
  byId: Map<string, Entity>,
  childrenIndex: Map<string, string[]>,
): void {
  const segments = file.id.split("/").filter(Boolean);
  if (segments.length === 0) return;

  let parentId = "universe:";
  let parentPath = "";

  // Ancestors: top segment → galaxy, intermediate → street, last → building.
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === undefined) continue;
    const isLast = i === segments.length - 1;
    const nextPath = parentPath ? `${parentPath}/${seg}` : seg;

    let kind: EntityKind;
    if (isLast) kind = "building";
    else if (i === 0) kind = "galaxy";
    else kind = "street";

    const id = isLast ? file.id : `${kind}:${nextPath}`;

    if (!byId.has(id)) {
      const entity: Entity = {
        id,
        kind,
        name: isLast ? file.name : seg,
        path: nextPath,
        parentId,
        childIds: [],
        // Metrics are left undefined here for non-leaf ancestors;
        // rollup is a separate pass (Phase 3B+) so this walk stays
        // allocation-lean for very large workspaces.
        metrics: isLast
          ? { loc: file.loc, riskScore: file.riskScore, fileCount: 1 }
          : undefined,
      };
      byId.set(id, entity);
      childrenIndex.set(id, []);
      const siblings = childrenIndex.get(parentId);
      if (siblings) siblings.push(id);
    }

    parentId = id;
    parentPath = nextPath;
  }

  // After the path walk, if the file has functions, descend another
  // two levels: one synthetic `floor` per file (the body) holding one
  // `room` per FunctionBlock. Without this, the Code Universe ladder
  // top-tier (floor/room) would be empty — the product's whole
  // reason-to-exist.
  //
  // We emit exactly one floor per file, not multiple, because
  // FunctionBlock carries no class/section information today.
  // Heuristic grouping (by line-gap, class-prefix match) lands in a
  // later phase once there's a clear signal source.
  if (file.functions.length > 0) {
    emitFunctions(file, byId, childrenIndex);
  }
}

function emitFunctions(
  file: FileNode,
  byId: Map<string, Entity>,
  childrenIndex: Map<string, string[]>,
): void {
  const buildingId = file.id;
  const floorId = `floor:${file.id}`;
  const floorEntity: Entity = {
    id: floorId,
    kind: "floor",
    name: file.name,
    path: `${file.id}#body`,
    parentId: buildingId,
    childIds: [],
    metrics: {
      loc: file.loc,
      fileCount: 0,
      childCount: file.functions.length,
    },
  };
  byId.set(floorId, floorEntity);
  childrenIndex.set(floorId, []);
  const buildingSiblings = childrenIndex.get(buildingId);
  if (buildingSiblings) buildingSiblings.push(floorId);

  // Room ordering mirrors source order — sorted by startLine so the
  // tree traversal reflects how the file reads top-to-bottom.
  const fns = [...file.functions].sort((a, b) => a.startLine - b.startLine);
  for (const fn of fns) {
    const roomId = roomIdFor(file, fn);
    if (byId.has(roomId)) continue;
    const rloc = Math.max(1, fn.endLine - fn.startLine + 1);
    const roomEntity: Entity = {
      id: roomId,
      kind: "room",
      name: fn.name,
      path: `${file.id}#${fn.name}@${fn.startLine}`,
      parentId: floorId,
      childIds: [],
      metrics: {
        loc: rloc,
        // Use complexity as a proxy for risk at the function grain —
        // high-cpx rooms draw hotter in the palette until richer
        // metrics land.
        riskScore: Math.min(100, fn.complexity * 10),
      },
    };
    byId.set(roomId, roomEntity);
    childrenIndex.set(roomId, []);
    const floorSiblings = childrenIndex.get(floorId);
    if (floorSiblings) floorSiblings.push(roomId);
  }
}

// Room id format — file id plus function name + startLine so two
// methods with the same name (overloads, decorated variants) get
// distinct entities. Stable across rebuilds as long as the source
// hasn't moved.
function roomIdFor(file: FileNode, fn: FunctionBlock): string {
  return `room:${file.id}#${fn.name}@${fn.startLine}`;
}
