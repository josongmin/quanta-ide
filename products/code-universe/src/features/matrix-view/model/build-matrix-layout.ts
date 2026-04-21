import type { Entity, EntityKind, EntityTree } from "@quanta/canvas-engine";
import { clusterRows } from "../lib/cluster-rows";
import type {
  BuildMatrixLayoutOpts,
  MatrixCell,
  MatrixLayout,
  MatrixRow,
} from "./types";

// build-matrix-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph → MatrixLayout. The workspace's
// "building"-kind entities (files) by default become rows AND columns
// of a square matrix. Import edges from `graph.fileEdges` light up
// cells; a clustering pass reorders the shared row/col sequence so
// dense blocks form along the diagonal. The SVG renderer in
// `ui/MatrixView.tsx` paints from this layout — all traversal happens
// here so the result is deterministic and testable without React.
//
// The important operations, in order:
//   1. Collect rows (optionally scoped to a subtree), mapped through
//      `rowKind`. Files without an ancestor of that kind fall back to
//      themselves when rowKind is "building", otherwise are rolled up
//      to the nearest matching ancestor. Rows without any mapping are
//      silently dropped.
//   2. Walk `graph.fileEdges`, rolling each endpoint up to its
//      rowKind ancestor. Phantom edges (endpoints outside the row
//      set) are dropped. Self-loops are dropped — a file importing
//      itself isn't a DSM cell.
//   3. Rank rows by (fan-in + fan-out) DESCENDING. If `maxRows` is
//      exceeded, keep the top-N and record the count of survivors
//      dropped as `overflow`.
//   4. Cluster — pass the kept ids + adjacency + group mapping to
//      `clusterRows`. The returned permutation becomes the final
//      row/col order.
//   5. Emit cells from the directional adjacency, stamping
//      `crossGroup` + `bidirectional` per cell. Weight is the raw
//      edge multiplicity.
//   6. Compute cell size from viewport — `floor((min(w,h) -
//      labelGutter*2) / rows.length)`, clamped to [3, 18]. Label
//      gutter is a flat 140 px, leaving room for truncated names.

// ── Constants ────────────────────────────────────────────────────────
const DEFAULT_ROW_KIND: BuildMatrixLayoutOpts["rowKind"] = "building";
const DEFAULT_MAX_ROWS = 200;
/** Left / top label gutter in px. 140 px holds ~22 chars of the xs
 *  font size before truncation, which is enough for typical file
 *  basenames and short package names. */
const LABEL_GUTTER_PX = 140;
/** Below 3 px the grid reads as noise even on a 4K display; above
 *  18 px individual cells start looking like buttons and the overall
 *  matrix wastes real estate. */
const CELL_MIN = 3;
const CELL_MAX = 18;

// ── Determinism helpers (hashed group palette) ───────────────────────
// Same hashing as chord-view so the two views share the same colour
// per group id — a user toggling between modes keeps the visual
// anchor on, say, pkg-ui-kit's hue.
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
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

// ── Main entry ───────────────────────────────────────────────────────

export function buildMatrixLayout(
  opts: BuildMatrixLayoutOpts,
): MatrixLayout & { overflow: number } {
  const { tree, graph, width, height } = opts;
  const rowKind: EntityKind = opts.rowKind ?? DEFAULT_ROW_KIND ?? "building";
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const scopeId = opts.scopeId ?? null;

  if (scopeId !== null && !tree.byId.has(scopeId)) {
    throw new Error(`scopeId "${scopeId}" not found in tree`);
  }

  // ── 1. Collect row entities ───────────────────────────────────────
  const rowEntities = collectRowEntities(tree, rowKind, scopeId);

  if (rowEntities.length === 0) {
    return emptyLayout(width, height);
  }

  // Quick lookup: file id → row entity id (the row this file rolls
  // up to). For rowKind="building" this is identity; for coarser
  // kinds it walks ancestors.
  const fileToRow = new Map<string, string>();
  for (const file of graph.files) {
    const fileEntity = tree.byId.get(file.id);
    if (!fileEntity) continue;
    const row = rollUpToKind(tree, fileEntity, rowKind);
    if (!row) continue;
    fileToRow.set(file.id, row.id);
  }

  const rowEntityById = new Map<string, Entity>();
  for (const e of rowEntities) rowEntityById.set(e.id, e);

  // ── 2. Build directional adjacency (row id → Set<row id>) with
  //      weight accumulators ───────────────────────────────────────
  // Using a nested Map<from, Map<to, weight>> so cycles can be
  // detected in O(1) (look up the reverse key) and weights collapse
  // cleanly when multiple FileEdge rows resolve to the same row pair.
  const adjWeighted = new Map<string, Map<string, number>>();
  for (const id of rowEntityById.keys()) adjWeighted.set(id, new Map());

  for (const e of graph.fileEdges) {
    const fromRow = fileToRow.get(e.from);
    const toRow = fileToRow.get(e.to);
    if (!fromRow || !toRow) continue;
    if (!rowEntityById.has(fromRow) || !rowEntityById.has(toRow)) continue;
    if (fromRow === toRow) continue; // self-loop — not a DSM cell
    const bucket = adjWeighted.get(fromRow)!;
    bucket.set(toRow, (bucket.get(toRow) ?? 0) + (e.weight || 1));
  }

  // ── 3. Connectivity scoring + maxRows trim ────────────────────────
  // fanOut[i] = sum of outgoing edge weights; fanIn[i] = incoming.
  // Connectivity = fanIn + fanOut. Tie-break alpha asc so dropping is
  // stable.
  const fanOut = new Map<string, number>();
  const fanIn = new Map<string, number>();
  for (const id of rowEntityById.keys()) {
    fanOut.set(id, 0);
    fanIn.set(id, 0);
  }
  for (const [from, tos] of adjWeighted) {
    for (const [to, w] of tos) {
      fanOut.set(from, (fanOut.get(from) ?? 0) + w);
      fanIn.set(to, (fanIn.get(to) ?? 0) + w);
    }
  }

  // Sort by connectivity desc, then alpha asc. The alpha tie-break
  // is what keeps the "which 200 do we keep" deterministic when a
  // long tail of zero-connectivity utilities all tie on score 0.
  const rankedIds = [...rowEntityById.keys()].sort((a, b) => {
    const sa = (fanIn.get(a) ?? 0) + (fanOut.get(a) ?? 0);
    const sb = (fanIn.get(b) ?? 0) + (fanOut.get(b) ?? 0);
    if (sa !== sb) return sb - sa;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  let keptIds: string[];
  let overflow = 0;
  if (rankedIds.length > maxRows) {
    keptIds = rankedIds.slice(0, maxRows);
    overflow = rankedIds.length - maxRows;
  } else {
    keptIds = rankedIds;
  }

  // Trim adjacency to kept ids so the clustering sees a consistent
  // world — an edge to a trimmed row would pull its source toward an
  // entity the matrix no longer shows.
  const keptSet = new Set(keptIds);
  const trimmedAdj = new Map<string, Set<string>>();
  for (const id of keptIds) trimmedAdj.set(id, new Set());
  for (const [from, tos] of adjWeighted) {
    if (!keptSet.has(from)) continue;
    for (const [to] of tos) {
      if (!keptSet.has(to)) continue;
      trimmedAdj.get(from)!.add(to);
    }
  }

  // ── 4. Cluster ────────────────────────────────────────────────────
  // groupOf: each row's ancestor up to either the next-coarser kind,
  // so files group by their containing street/galaxy and galaxies
  // group by the universe root (which collapses to a single group —
  // fine, between-group pass becomes a no-op).
  const groupOf = new Map<string, string>();
  for (const id of keptIds) {
    const e = rowEntityById.get(id);
    if (!e) continue;
    const group = findGroupAncestor(tree, e, rowKind);
    groupOf.set(id, group?.id ?? "");
  }

  // Feed clusterRows the ranked order so its deterministic
  // "first-seen" tie-break favours high-connectivity rows when all
  // affinities are zero.
  const clustered = clusterRows({
    ids: keptIds,
    adj: trimmedAdj,
    groupOf,
  });

  // ── 5. MatrixRow construction ─────────────────────────────────────
  const rowIndexOf = new Map<string, number>();
  for (let i = 0; i < clustered.length; i++) rowIndexOf.set(clustered[i]!, i);

  const groupLabelById = new Map<string, string>();
  for (const id of keptIds) {
    const groupId = groupOf.get(id) ?? "";
    if (groupLabelById.has(groupId)) continue;
    if (groupId === "") {
      groupLabelById.set("", "");
      continue;
    }
    const groupEntity = tree.byId.get(groupId);
    groupLabelById.set(groupId, groupEntity?.name ?? groupId);
  }

  const rows: MatrixRow[] = clustered.map((id, idx) => {
    const e = rowEntityById.get(id)!;
    const groupId = groupOf.get(id) ?? "";
    return {
      id,
      label: e.name,
      groupId,
      groupLabel: groupLabelById.get(groupId) ?? groupId,
      groupColor: groupId === "" ? "#8a8a8a" : hashColorFromId(groupId),
      kind: e.kind,
      index: idx,
    };
  });

  // ── 6. Cells ──────────────────────────────────────────────────────
  // Iterate adjWeighted (kept-row restricted via lookup) to emit one
  // cell per directed pair. `bidirectional` is a reverse-key probe.
  const cells: MatrixCell[] = [];
  for (const [from, tos] of adjWeighted) {
    const fromIdx = rowIndexOf.get(from);
    if (fromIdx === undefined) continue;
    const fromGroup = groupOf.get(from) ?? "";
    for (const [to, weight] of tos) {
      const toIdx = rowIndexOf.get(to);
      if (toIdx === undefined) continue;
      const toGroup = groupOf.get(to) ?? "";
      const reverse = adjWeighted.get(to)?.get(from);
      cells.push({
        id: `${from}→${to}`,
        fromId: from,
        toId: to,
        row: fromIdx,
        col: toIdx,
        weight,
        crossGroup: fromGroup !== toGroup,
        bidirectional: reverse !== undefined && reverse > 0,
      });
    }
  }
  // Deterministic cell order: row asc, col asc. Makes the test
  // output comparable by simple equality.
  cells.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

  // ── 7. Cell size + gutters + bounds ──────────────────────────────
  const shortDim = Math.max(1, Math.min(width, height));
  const usable = Math.max(0, shortDim - LABEL_GUTTER_PX * 2);
  const rawCell = rows.length > 0 ? Math.floor(usable / rows.length) : CELL_MAX;
  const cellSize = Math.min(CELL_MAX, Math.max(CELL_MIN, rawCell));

  // ── 8. Group boundaries (indices where a new group starts) ───────
  // 0 always included (top of the first group); duplicates for
  // within-group runs are skipped. Boundary at `rows.length` is
  // omitted — renderers draw lines INSIDE the grid, not along the
  // outer edge.
  const boundaries: number[] = [];
  let prevGroup: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const g = rows[i]!.groupId;
    if (g !== prevGroup) {
      boundaries.push(i);
      prevGroup = g;
    }
  }

  const totalPx = rows.length * cellSize;
  const bounds = {
    minX: 0,
    minY: 0,
    maxX: LABEL_GUTTER_PX + totalPx,
    maxY: LABEL_GUTTER_PX + totalPx,
  };

  return {
    rows,
    cells,
    cellSize,
    labelGutter: LABEL_GUTTER_PX,
    bounds,
    groupBoundaries: boundaries,
    overflow,
  };
}

// ── Internals ────────────────────────────────────────────────────────

/** Collect entities of `rowKind` under `scopeId` (or under the root
 *  if scopeId is null). Deterministic output via id sort. */
function collectRowEntities(
  tree: EntityTree,
  rowKind: EntityKind,
  scopeId: string | null,
): Entity[] {
  if (scopeId === null) {
    const all = tree.byKind(rowKind);
    // Already in tree order; sort by id for a fully deterministic
    // starting sequence, since the subsequent clustering consumes
    // this order.
    return [...all].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  // Scoped — collect descendants of rowKind under scopeId.
  const scopeRoot = tree.byId.get(scopeId);
  if (!scopeRoot) return [];
  const out: Entity[] = [];
  const stack: Entity[] = [scopeRoot];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === rowKind) {
      out.push(cur);
      // Don't descend below a matched row — the DSM is a single-kind
      // view, so a file's internal modules shouldn't add more rows.
      continue;
    }
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Walk up from a file to the ancestor entity of `rowKind`. Returns
 *  the file itself if `rowKind === "building"`. */
function rollUpToKind(
  tree: EntityTree,
  fileEntity: Entity,
  rowKind: EntityKind,
): Entity | undefined {
  if (fileEntity.kind === rowKind) return fileEntity;
  const chain = tree.ancestorsOf(fileEntity.id);
  for (const anc of chain) {
    if (anc.kind === rowKind) return anc;
  }
  return undefined;
}

/** Nearest ancestor one kind coarser than the row — drives the
 *  `groupOf` mapping. For rowKind="building" this is usually a
 *  street or galaxy; for rowKind="galaxy" everything rolls up to the
 *  universe so the whole matrix is one group (fine: between-group
 *  pass becomes a no-op). */
function findGroupAncestor(
  tree: EntityTree,
  row: Entity,
  rowKind: EntityKind,
): Entity | undefined {
  const chain = tree.ancestorsOf(row.id);
  // ancestorsOf includes the node itself first; start from the parent.
  for (const anc of chain) {
    if (anc.id === row.id) continue;
    if (anc.kind === "universe") return anc;
    // Prefer the first non-row-kind ancestor that's still a real
    // grouping container. For rowKind="building" this lands on the
    // parent street/galaxy. For rowKind="galaxy" it lands on the
    // universe.
    void rowKind;
    return anc;
  }
  return undefined;
}

function emptyLayout(
  width: number,
  height: number,
): MatrixLayout & { overflow: number } {
  const shortDim = Math.max(1, Math.min(width, height));
  // Pick a "nice" cell size even for empty so the component renders a
  // consistent backdrop — not critical because the renderer draws an
  // empty-state message, but keeps the shape stable.
  void shortDim;
  return {
    rows: [],
    cells: [],
    cellSize: CELL_MAX,
    labelGutter: LABEL_GUTTER_PX,
    bounds: { minX: 0, minY: 0, maxX: LABEL_GUTTER_PX, maxY: LABEL_GUTTER_PX },
    groupBoundaries: [],
    overflow: 0,
  };
}
