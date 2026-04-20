import type { Entity, EntityTree } from "./types";
import type { FileNode, WorkspaceGraph } from "../graph/types";

// Entity signal rollup
// --------------------------------------------------------------------
// Aggregates the per-file `signals` + `riskScore` + `loc` up the
// entity tree so galaxy / street / building rects can paint the
// summary of everything they contain, not just their direct children.
// Files are the only signal bearers in the current graph model; all
// aggregate kinds derive their values from descendants.
//
// Reducers:
//   riskMax / riskSum / riskAvg — three views of risk aggregation.
//     Heatmap mode renders `riskMax` so one hotspot inside a big
//     package still draws attention.
//   taint / dead / archViolations / blast — summed counts.
//   cpxMax — max function complexity anywhere under the entity.
//   fileCount — count of `building` descendants (also useful for
//     weight-mode "Files").
//
// Runs in O(tree.size). Results are stable — the same graph always
// rolls up to the same values, so callers memoise on graph identity.

export interface EntitySignals {
  /** Max riskScore seen at or under the entity. 0 if no signals. */
  riskMax: number;
  /** Sum of riskScore (weighted by loc) for averaging. */
  riskSum: number;
  /** loc-weighted mean — useful for packages dominated by one big file. */
  riskAvg: number;
  taintCount: number;
  deadCount: number;
  archViolations: number;
  blastCritical: number;
  cpxMax: number;
  fileCount: number;
  locSum: number;
}

const EMPTY: EntitySignals = {
  riskMax: 0,
  riskSum: 0,
  riskAvg: 0,
  taintCount: 0,
  deadCount: 0,
  archViolations: 0,
  blastCritical: 0,
  cpxMax: 0,
  fileCount: 0,
  locSum: 0,
};

/**
 * Build the signal rollup map. Leaf (`building`) entities take their
 * values directly from the matching `FileNode`; every ancestor kind
 * aggregates over its descendants. Returns an empty Map-valued
 * rollup for any entity with no underlying FileNode.
 */
export function rollupEntitySignals(
  tree: EntityTree,
  graph: WorkspaceGraph,
): Map<string, EntitySignals> {
  const filesById = new Map<string, FileNode>();
  for (const f of graph.files) filesById.set(f.id, f);

  const out = new Map<string, EntitySignals>();

  // Post-order DFS: compute children first, then reduce into parent.
  // Iterative with explicit stack so 100k-node trees don't blow the
  // JS call stack (monorepo graphs can easily hit that).
  const rootId = tree.rootId;
  const stack: { id: string; visited: boolean }[] = [{ id: rootId, visited: false }];
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (!top) break;
    const entity = tree.byId.get(top.id);
    if (!entity) {
      stack.pop();
      continue;
    }
    if (!top.visited) {
      top.visited = true;
      // Push children to visit first.
      for (const cid of entity.childIds) {
        stack.push({ id: cid, visited: false });
      }
      continue;
    }
    // Second visit — reduce.
    stack.pop();
    out.set(entity.id, reduceEntity(entity, tree, filesById, out));
  }
  return out;
}

function reduceEntity(
  entity: Entity,
  _tree: EntityTree,
  filesById: Map<string, FileNode>,
  rollup: Map<string, EntitySignals>,
): EntitySignals {
  if (entity.childIds.length === 0) {
    // Leaf — look for a matching FileNode. `building` entities share
    // the `FileNode.id`; `floor`/`room` have synthetic ids and borrow
    // derived values from the enclosing file (below).
    const file = filesById.get(entity.id);
    if (file) return fromFile(file);
    // floor/room leaves fall back to rollup-of-ancestor's file when
    // reduced by their parents; standalone they contribute empty.
    return { ...EMPTY };
  }
  const agg: EntitySignals = { ...EMPTY };
  let weightedSum = 0;
  for (const cid of entity.childIds) {
    const c = rollup.get(cid);
    if (!c) continue;
    agg.riskMax = Math.max(agg.riskMax, c.riskMax);
    agg.riskSum += c.riskSum;
    agg.taintCount += c.taintCount;
    agg.deadCount += c.deadCount;
    agg.archViolations += c.archViolations;
    agg.blastCritical += c.blastCritical;
    agg.cpxMax = Math.max(agg.cpxMax, c.cpxMax);
    agg.fileCount += c.fileCount;
    agg.locSum += c.locSum;
    weightedSum += c.riskSum;
    void weightedSum; // already accumulated into agg.riskSum
  }
  agg.riskAvg = agg.locSum > 0 ? agg.riskSum / Math.max(1, agg.locSum) : 0;
  return agg;
}

function fromFile(file: FileNode): EntitySignals {
  const loc = Math.max(1, file.loc);
  return {
    riskMax: file.riskScore,
    riskSum: file.riskScore * loc,
    riskAvg: file.riskScore,
    taintCount: file.signals?.taintCount ?? 0,
    deadCount: file.signals?.deadCount ?? 0,
    archViolations: file.signals?.archViolations ?? 0,
    blastCritical: file.signals?.blastCritical ?? 0,
    cpxMax: file.signals?.cpxMax ?? 0,
    fileCount: 1,
    locSum: loc,
  };
}
