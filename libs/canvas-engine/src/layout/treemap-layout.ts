import type { WorkspaceGraph, FileNode, Rect } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "./types";
import { FILE_CARD_W, computeFileHeight } from "./types";
import { buildOrthogonalRoutes } from "./orthogonal-routing";
import { buildBundledEdges, buildFileToClusterMap } from "./edge-bundling";
import { aggregateClusterEdges, routeClusterEdges } from "./cluster-edge-aggregate";
import type { ClusterEdge } from "./cluster-edge-aggregate";
import { enrichLayout } from "./enrich-layout";

/**
 * Directory-based squarified treemap (Bruls/Huijsen/van Wijk 1999).
 * Fixed-size cards — the treemap positions; it does not scale. Root
 * bounds aim for TARGET_ASPECT so minimap+canvas feel landscape.
 */

const LEAF_COLS_MIN = 4;
const DIR_PAD = 240;
const CARD_GAP_X = 100;
const CARD_GAP_Y = 60;
const TARGET_ASPECT = 1.5;
// Why 2.3: fixed-size children + row padding makes realized bounds
// narrower than the naive sqrt(area * aspect) would imply. Constant
// ladder stays within tolerance and avoids O(n²) layout retries.
const LONGSIDE_BUDGET_K = 2.3;
const OUTER_PAD = 48;
const DEV_ASSERT_ASPECT = true;

// ── directory tree ─────────────────────────────────────────────────────

interface LeafFilePlacement {
  file: FileNode;
  x: number;
  y: number;
  h: number;
}

interface DirNode {
  name: string;
  path: string;
  children: Map<string, DirNode>;
  files: FileNode[];
  box: { w: number; h: number };
  placements: Placement[];
  leafPlacements: LeafFilePlacement[];
  pos: { x: number; y: number };
}

function makeDir(name: string, path: string): DirNode {
  return {
    name,
    path,
    children: new Map(),
    files: [],
    box: { w: 0, h: 0 },
    placements: [],
    leafPlacements: [],
    pos: { x: 0, y: 0 },
  };
}

function buildDirTree(files: FileNode[]): DirNode {
  const root = makeDir("", "");
  for (const f of files) {
    const parts = f.id.split("/");
    const fileName = parts.pop() ?? f.id;
    let node = root;
    let acc = "";
    for (const part of parts) {
      acc = acc === "" ? part : `${acc}/${part}`;
      let child = node.children.get(part);
      if (!child) {
        child = makeDir(part, acc);
        node.children.set(part, child);
      }
      node = child;
    }
    void fileName;
    node.files.push(f);
  }
  return root;
}

// ── leaf packing ───────────────────────────────────────────────────────
//
// Shortest-column masonry keyed on real LoC-based card heights. Treating
// every card as `FILE_CARD_H` (the old behavior) made the layout assume
// 720px tall slots while the renderer draws variable heights from
// `computeFileHeight(loc)` — a single 500-LoC file wants ~8500px, which
// overflowed into whatever was below it. We now place each file in the
// currently-shortest column so tall files are balanced by short ones and
// no folder ends up with an absurdly long vertical drop.
//
// Files are placed largest-first (desc by LoC) so the tallest cards anchor
// the column skyline and smaller cards infill the ragged bottom — this is
// the same pattern as `gridLayout` and matches the existing `ground tier`
// paper-skyline aesthetic.

function packLeaf(files: readonly FileNode[]): {
  w: number;
  h: number;
  cols: number;
  placements: LeafFilePlacement[];
} {
  const n = files.length;
  if (n === 0) return { w: 0, h: 0, cols: 0, placements: [] };

  const heights = files.map(f => computeFileHeight(f.loc ?? 0));
  let totalH = 0;
  for (const h of heights) totalH += h;

  // Choose cols so the packed leaf box roughly matches TARGET_ASPECT (w/h).
  // With uniform col width (FILE_CARD_W + CARD_GAP_X) and total vertical
  // ink `totalH`, solving w/h = TARGET_ASPECT yields cols² ≈ TARGET_ASPECT
  // · totalH / FILE_CARD_W. Floor at LEAF_COLS_MIN so tiny folders still
  // spread; cap at n so we never allocate empty columns.
  const idealCols = Math.sqrt((TARGET_ASPECT * totalH) / FILE_CARD_W);
  const cols = Math.max(LEAF_COLS_MIN, Math.min(n, Math.round(idealCols) || 1));

  // Desc-by-height order — preserves original indices so callers can emit
  // placements in file order if desired (we don't care here).
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => heights[b] - heights[a]);

  const columnTops = new Array<number>(cols).fill(0);
  const placements: LeafFilePlacement[] = new Array(n);

  for (const i of order) {
    let col = 0;
    let minTop = columnTops[0];
    for (let c = 1; c < cols; c++) {
      if (columnTops[c] < minTop) {
        minTop = columnTops[c];
        col = c;
      }
    }
    const x = col * (FILE_CARD_W + CARD_GAP_X);
    const y = columnTops[col];
    placements[i] = { file: files[i], x, y, h: heights[i] };
    columnTops[col] = y + heights[i] + CARD_GAP_Y;
  }

  const w = cols * FILE_CARD_W + (cols - 1) * CARD_GAP_X;
  let tallest = 0;
  for (const top of columnTops) if (top > tallest) tallest = top;
  // Subtract the trailing CARD_GAP_Y that the last card's +GAP accumulated.
  const h = Math.max(0, tallest - CARD_GAP_Y);
  return { w, h, cols, placements };
}

// ── squarified treemap (Bruls/Huijsen/van Wijk 1999) ───────────────────

interface Child {
  area: number;
  w: number;
  h: number;
  node: DirNode;
  isLeaf: boolean;
}

interface Placement {
  node: DirNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

// In-place row cost. Avoids the per-trial `[...row, c]` allocation in the
// squarify hot loop by letting callers pass an optional additional child
// which is folded in without spreading the array.
function rowCost(row: Child[], newChild: Child | null, longSide: number): number {
  const len = row.length + (newChild ? 1 : 0);
  if (len === 0) return Infinity;
  let rowW = 0;
  for (const c of row) rowW += c.w + DIR_PAD;
  if (newChild) rowW += newChild.w + DIR_PAD;
  rowW = Math.max(rowW - DIR_PAD, 1);
  const fill = rowW / longSide;
  return Math.abs(Math.log(fill));
}

function squarify(
  children: Child[],
  targetAspect: number,
  longsideK: number,
): { placements: Placement[]; w: number; h: number } {
  if (children.length === 0) return { placements: [], w: 0, h: 0 };
  if (children.length === 1) {
    const c = children[0];
    return {
      placements: [{ node: c.node, x: 0, y: 0, w: c.w, h: c.h }],
      w: c.w,
      h: c.h,
    };
  }

  const sorted = [...children].sort((a, b) => b.area - a.area);
  // Fuse totalArea + maxChildW into one pass over sorted[].
  let totalArea = 0;
  let maxChildW = 0;
  for (const c of sorted) {
    totalArea += c.area;
    if (c.w > maxChildW) maxChildW = c.w;
  }
  const longSide = Math.max(
    Math.sqrt(totalArea * targetAspect * (longsideK / 1.5)),
    maxChildW,
  );

  const placements: Placement[] = [];
  let cursorY = 0;
  let row: Child[] = [];
  // Incremental running sum of `c.w + DIR_PAD` for the current row; the
  // effective row width is `max(rowSum - DIR_PAD, 0)`. Replaces the per-
  // iteration `rowWidth(row)` scan.
  let rowSum = 0;

  const flushRow = (): void => {
    if (row.length === 0) return;
    let rowMaxH = 0;
    for (const c of row) if (c.h > rowMaxH) rowMaxH = c.h;
    let cursorX = 0;
    for (const c of row) {
      placements.push({ node: c.node, x: cursorX, y: cursorY, w: c.w, h: c.h });
      cursorX += c.w + DIR_PAD;
    }
    cursorY += rowMaxH + DIR_PAD;
    row = [];
    rowSum = 0;
  };

  for (const c of sorted) {
    if (row.length === 0) {
      row.push(c);
      rowSum += c.w + DIR_PAD;
      continue;
    }
    // Current row width without the extra trailing DIR_PAD.
    const currentW = Math.max(rowSum - DIR_PAD, 0);
    const trialW = currentW + DIR_PAD + c.w;
    if (trialW > longSide) {
      flushRow();
      row.push(c);
      rowSum += c.w + DIR_PAD;
      continue;
    }
    const currentCost = rowCost(row, null, longSide);
    const trialCost = rowCost(row, c, longSide);
    if (trialCost <= currentCost) {
      row.push(c);
      rowSum += c.w + DIR_PAD;
    } else {
      flushRow();
      row.push(c);
      rowSum += c.w + DIR_PAD;
    }
  }
  flushRow();

  let w = 0;
  let h = 0;
  for (const p of placements) {
    if (p.x + p.w > w) w = p.x + p.w;
    if (p.y + p.h > h) h = p.y + p.h;
  }
  return { placements, w, h };
}

// ── sizing pass (bottom-up) ────────────────────────────────────────────

function sizeDir(dir: DirNode, longsideK: number): void {
  // Recurse + build childBoxes in a single pass. The recursion populates
  // child.box bottom-up, so by the time we push the Child record the box
  // is already final.
  const childBoxes: Child[] = [];
  for (const child of dir.children.values()) {
    sizeDir(child, longsideK);
    childBoxes.push({
      area: child.box.w * child.box.h,
      w: child.box.w,
      h: child.box.h,
      node: child,
      isLeaf: false,
    });
  }

  if (dir.files.length > 0) {
    const { w, h, placements } = packLeaf(dir.files);
    const leafHolder = makeDir("__files__", `${dir.path}/__files__`);
    leafHolder.files = dir.files;
    leafHolder.box = { w, h };
    leafHolder.leafPlacements = placements;
    childBoxes.push({
      area: w * h,
      w,
      h,
      node: leafHolder,
      isLeaf: true,
    });
    dir.children.set("__files__", leafHolder);
    dir.files = [];
  }

  if (childBoxes.length === 0) {
    dir.box = { w: 0, h: 0 };
    dir.placements = [];
    return;
  }

  const { placements, w, h } = squarify(childBoxes, TARGET_ASPECT, longsideK);
  dir.box = { w, h };
  dir.placements = placements;
}

// ── positioning pass (top-down) ────────────────────────────────────────

function positionDir(
  dir: DirNode,
  originX: number,
  originY: number,
  fileRects: Map<string, Rect>,
): void {
  dir.pos = { x: originX, y: originY };

  if (dir.name === "__files__") {
    for (const p of dir.leafPlacements) {
      fileRects.set(p.file.id, {
        x: originX + p.x,
        y: originY + p.y,
        w: FILE_CARD_W,
        h: p.h,
      });
    }
    return;
  }

  // Cached placements — re-running squarify here could drift (iteration-order bug).
  for (const p of dir.placements) {
    positionDir(p.node, originX + p.x, originY + p.y, fileRects);
  }
}

// ── cluster rect extraction ────────────────────────────────────────────

function dirBounds(dir: DirNode, fileRects: Map<string, Rect>): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (d: DirNode): void => {
    for (const f of d.files) {
      const r = fileRects.get(f.id);
      if (!r) continue;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      const rx = r.x + r.w;
      const ry = r.y + r.h;
      if (rx > maxX) maxX = rx;
      if (ry > maxY) maxY = ry;
    }
    for (const c of d.children.values()) visit(c);
  };
  visit(dir);
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ── public entry point ─────────────────────────────────────────────────

export interface ClusterInfo {
  id: string;
  rect: Rect;
  fileCount: number;
  locSum: number;
}

export interface TreemapResult extends WorkspaceLayout {
  clusterRects: Map<string, Rect>;
  clusters: ClusterInfo[];
  superclusterRects: Map<string, Rect>;
  superclusters: ClusterInfo[];
  /** Populated when `opts.aggregateClusterEdges !== false`. */
  clusterEdges?: ClusterEdge[];
}

/**
 * Opt-in feature flags — keep defaults off for costly passes so callers
 * pay only for what a renderer actually consumes.
 */
export interface TreemapOptions {
  computeOrthoRoutes?: boolean;
  computeBundledEdges?: boolean;
  /** Default `true` — supergalaxy renderer depends on this. */
  aggregateClusterEdges?: boolean;
  /** Default `true` — galaxy tier needs degree-scaled dot sizing. */
  computeMetrics?: boolean;
  /** Brandes exact-run threshold. Default 500. */
  betweennessExactThreshold?: number;
}

export function treemapLayout(
  graph: WorkspaceGraph,
  opts: TreemapOptions = {},
): TreemapResult {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());

  const root = buildDirTree(graph.files);

  sizeDir(root, LONGSIDE_BUDGET_K);

  const fileRects = new Map<string, Rect>();
  positionDir(root, OUTER_PAD, OUTER_PAD, fileRects);

  // Clusters = top-level dirs, with drill-through when a single top-level
  // dir dominates (e.g., monorepo with everything under `src/`).
  const topLevel: DirNode[] = [];
  for (const child of root.children.values()) {
    if (child.name === "__files__") continue;
    topLevel.push(child);
  }

  // Memoize per DirNode so cluster + supercluster passes don't re-walk
  // overlapping subtrees. For N files across K clusters this drops the
  // work from O(N·K) to O(N).
  const countFilesMemo = new WeakMap<DirNode, { n: number; loc: number }>();
  const countFiles = (d: DirNode): { n: number; loc: number } => {
    const hit = countFilesMemo.get(d);
    if (hit) return hit;
    let n = d.files.length;
    let loc = 0;
    for (const f of d.files) loc += f.loc;
    for (const c of d.children.values()) {
      const sub = countFiles(c);
      n += sub.n;
      loc += sub.loc;
    }
    const result = { n, loc };
    countFilesMemo.set(d, result);
    return result;
  };

  const totalFiles = graph.files.length;
  let clusterSource: DirNode[];
  let clusterDrilledInto: DirNode | null = null;
  if (topLevel.length === 1) {
    clusterDrilledInto = topLevel[0];
    clusterSource = [...topLevel[0].children.values()].filter(c => c.name !== "__files__");
  } else {
    const dominant = topLevel.find(t => {
      const { n } = countFiles(t);
      return n > totalFiles * 0.9;
    });
    if (dominant) {
      clusterDrilledInto = dominant;
      clusterSource = [...dominant.children.values()].filter(c => c.name !== "__files__");
    } else {
      clusterSource = topLevel;
    }
  }

  const clusterRects = new Map<string, Rect>();
  const clusters: ClusterInfo[] = [];

  for (const cluster of clusterSource) {
    const rect = dirBounds(cluster, fileRects);
    if (!rect) continue;
    const { n, loc } = countFiles(cluster);
    clusterRects.set(cluster.path, rect);
    clusters.push({ id: cluster.path, rect, fileCount: n, locSum: loc });
  }

  // Superclusters (universe tier) — parents-of-clusters. Fall through to
  // drilled-into children when topLevel is the single dominant dir so the
  // universe always has ≥2 boxes (MSA monorepo case).
  let superclusterSource: DirNode[] = topLevel;
  if (
    clusterDrilledInto &&
    superclusterSource.length === 1 &&
    superclusterSource[0] === clusterDrilledInto
  ) {
    superclusterSource = [...clusterDrilledInto.children.values()].filter(
      c => c.name !== "__files__",
    );
  }

  const superclusterRects = new Map<string, Rect>();
  const superclusters: ClusterInfo[] = [];
  for (const sc of superclusterSource) {
    const rect = dirBounds(sc, fileRects);
    if (!rect) continue;
    const { n, loc } = countFiles(sc);
    superclusterRects.set(sc.path, rect);
    superclusters.push({ id: sc.path, rect, fileCount: n, locSum: loc });
  }

  const edgeRoutes = new Map<string, BezierRoute>();
  for (const edge of graph.fileEdges) {
    const fromRect = fileRects.get(edge.from);
    const toRect = fileRects.get(edge.to);
    if (!fromRect || !toRect) continue;
    const x1 = fromRect.x + fromRect.w;
    const y1 = fromRect.y + fromRect.h / 2;
    const x2 = toRect.x;
    const y2 = toRect.y + toRect.h / 2;
    const dx = (x2 - x1) * 0.4;
    edgeRoutes.set(edge.id, {
      x1, y1,
      cx1: x1 + dx, cy1: y1,
      cx2: x2 - dx, cy2: y2,
      x2, y2,
    });
  }

  const edgeRoutesOrtho = opts.computeOrthoRoutes
    ? buildOrthogonalRoutes(graph.fileEdges, fileRects)
    : undefined;

  const bundledEdges = opts.computeBundledEdges
    ? (() => {
        const fileToCluster = buildFileToClusterMap(graph.files, fileRects, clusters);
        return buildBundledEdges(graph.fileEdges, fileToCluster, clusters);
      })()
    : undefined;

  // Default-on: supergalaxy renderer depends on this shape.
  const aggregateEdges = opts.aggregateClusterEdges !== false;
  let clusterEdges: ClusterEdge[] | undefined;
  if (aggregateEdges && clusters.length > 0) {
    const clusterOf = buildFileToClusterMap(graph.files, fileRects, clusters);
    const raw = aggregateClusterEdges({ fileEdges: graph.fileEdges, clusterOf });
    clusterEdges = routeClusterEdges(raw, clusters);
  }

  let maxX = 0, maxY = 0;
  for (const r of fileRects.values()) {
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  const totalBounds: Rect = {
    x: 0,
    y: 0,
    w: maxX + OUTER_PAD,
    h: maxY + OUTER_PAD,
  };

  if (DEV_ASSERT_ASPECT && totalBounds.h > 0) {
    const aspect = totalBounds.w / totalBounds.h;
    const elapsed = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
    // eslint-disable-next-line no-console
    console.info(
      `[treemapLayout] files=${graph.files.length} aspect=${aspect.toFixed(3)} ` +
      `bounds=${totalBounds.w.toFixed(0)}×${totalBounds.h.toFixed(0)} took=${elapsed.toFixed(1)}ms`,
    );
  }

  const aggregates = {
    commentsByFunction: new Map<string, number>(),
    commentsByFile: new Map<string, number>(),
    commentedLines: new Map<string, Set<number>>(),
  };

  const enriched = enrichLayout(graph, {
    computeMetrics: opts.computeMetrics,
    betweennessExactThreshold: opts.betweennessExactThreshold,
  });

  return {
    fileRects,
    edgeRoutes,
    aggregates,
    totalBounds,
    clusterRects,
    clusters,
    superclusterRects,
    superclusters,
    edgeRoutesOrtho,
    bundledEdges,
    clusterEdges,
    ...enriched,
  };
}
