import type { WorkspaceGraph, FileNode, Rect } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "./types";
import { FILE_CARD_W, FILE_CARD_H } from "./types";
import { buildOrthogonalRoutes } from "./orthogonal-routing";
import { buildBundledEdges, buildFileToClusterMap } from "./edge-bundling";

/**
 * Directory-based squarified treemap layout.
 *
 * Design choice (see RFC-0006 discussion): we do NOT scale file cards by
 * treemap area — FILE_CARD_W × FILE_CARD_H is the *minimum* and we render
 * every file at that size. The treemap merely *positions* files inside
 * directory-shaped bounding boxes so that:
 *
 *   1. Files in the same directory are visually adjacent.
 *   2. The final total bounds have a ~1:1.5 aspect ratio instead of the
 *      1:100 strip that `gridLayout` produces at 5.9k nodes.
 *   3. Top-level directories (crates, tests/, etc.) give us natural
 *      supergalaxy-tier cluster boxes.
 *
 * Algorithm:
 *   - Parse `file.id` as a "/"-separated path → build directory tree.
 *   - For each *leaf* directory, pack its files into a near-square grid of
 *     fixed-size cards.
 *   - For each *inner* directory, squarify its children (leaf packs + sub-
 *     directory boxes) using the Bruls/Huijsen/van Wijk squarify algorithm
 *     (1999): iterate children largest-first, build rows that minimize the
 *     worst-case aspect ratio of boxes added to that row. When the next
 *     child would worsen the row's worst ratio, close the row and start a
 *     new one on the short side.
 *   - Recurse top-down to assign absolute (x, y) offsets.
 *
 * Aspect target: root container aims for width/height ≈ TARGET_ASPECT.
 */

// Soft minimum columns for tiny leaves. For leaves with many files the column
// count scales with sqrt(n) to keep the pack near-square.
const LEAF_COLS_MIN = 4;

// Padding between sibling boxes at every tree level (pixels).
const DIR_PAD = 240;

// Gap between cards inside a leaf directory.
const CARD_GAP_X = 100;
const CARD_GAP_Y = 60;

// Desired *realized* width : height for the final layout bounds. Large
// repos should render landscape (≈1.5) so the minimap fits a 180×110
// viewport and the canvas feels editor-like rather than column-like.
const TARGET_ASPECT = 1.5;

// longSide budget multiplier — see squarify() for derivation. Because
// children are fixed-size and inter-cell padding eats row width more
// than column height (padding adds DIR_PAD per child along the row
// axis, only once per row stack along the column axis), the realized
// bounds aspect is systematically *narrower* than the input ratio used
// to pick longSide. Empirically, longSide = sqrt(area * k) with k ≈ 2.3
// produces bounds with aspect ≈ 1.5 for our 1k–6k-file range. A cleaner
// fix would be to iterate on longSide until bounds converge, but the
// constant ladder is within tolerance and avoids O(n²) layout retries.
const LONGSIDE_BUDGET_K = 2.3;

// Outer padding around the whole layout.
const OUTER_PAD = 48;

// Enable a one-time dev assertion on the final root aspect ratio.
const DEV_ASSERT_ASPECT = true;

// ── directory tree ─────────────────────────────────────────────────────

interface DirNode {
  name: string;
  path: string;          // "/"-joined path from root (empty for root)
  children: Map<string, DirNode>;
  files: FileNode[];     // files directly inside this directory
  // Filled in during sizing pass:
  box: { w: number; h: number };
  // Cached placements of children (absolute offsets inside this dir's box).
  // Computed during sizing, consumed during positioning.
  placements: Placement[];
  // Filled in during positioning pass:
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

// Packs `n` cards of FILE_CARD_W × FILE_CARD_H into a near-square grid.
function leafBox(n: number): { w: number; h: number; cols: number } {
  if (n <= 0) return { w: 0, h: 0, cols: 0 };
  const ideal = Math.sqrt((n * (FILE_CARD_H + CARD_GAP_Y)) / (FILE_CARD_W + CARD_GAP_X));
  const cols = Math.max(LEAF_COLS_MIN, Math.min(n, Math.round(ideal)));
  const rows = Math.ceil(n / cols);
  const w = cols * FILE_CARD_W + (cols - 1) * CARD_GAP_X;
  const h = rows * FILE_CARD_H + (rows - 1) * CARD_GAP_Y;
  return { w, h, cols };
}

// ── squarified treemap (Bruls/Huijsen/van Wijk 1999) ───────────────────

interface Child {
  area: number;   // Intrinsic area (w * h) — used to compute normalized area.
  w: number;      // Intrinsic width.
  h: number;      // Intrinsic height.
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

/**
 * Aspect cost of a prospective row given a target long-side (= container
 * width budget). Intuition: a good row fills as much of longSide as
 * possible without overflowing. We measure how far rowW is from longSide:
 * fill ratio = rowW / longSide. Cost = |log(fill)| so underfilled and
 * overfilled rows are both penalized (though overflow is caught separately
 * with a hard limit).
 *
 * Additionally we weight by row height relative to tallest child height
 * so that jagged stacks (mixing very tall and short rows) incur cost.
 */
function rowCost(rowCs: Child[], longSide: number): number {
  if (rowCs.length === 0) return Infinity;
  let rowW = 0;
  let rowH = 0;
  for (const c of rowCs) {
    rowW += c.w + DIR_PAD;
    if (c.h > rowH) rowH = c.h;
  }
  rowW = Math.max(rowW - DIR_PAD, 1);
  rowH = Math.max(rowH, 1);
  const fill = rowW / longSide;
  // Underfill (fill < 1) is what we primarily optimize against.
  return Math.abs(Math.log(fill));
}

/**
 * Squarified treemap for fixed-size children (Bruls/Huijsen/van Wijk 1999,
 * adapted to rectangles of intrinsic size).
 *
 * Strategy:
 *   1. Compute an "ideal" longSide = sqrt(totalArea * targetAspect) so
 *      that if we perfectly packed all area, the overall container would
 *      be ≈ targetAspect wide-to-tall.
 *   2. Enforce longSide ≥ max(child.w) so no child is forced into its
 *      own row for the wrong reason.
 *   3. Sort children largest-first (BHvW requirement).
 *   4. Greedily build rows along the long axis. For each child:
 *        - Try adding it to the current row.
 *        - If the child would push the row beyond longSide, flush first.
 *        - Otherwise, accept the child if doing so moves the row's
 *          aspect closer to targetAspect; else flush and start a new row.
 *   5. Rows stack along the short axis.
 *
 * Children are never stretched — we preserve each intrinsic w × h.
 *
 * For the ROW aspect target we use `targetAspect` too: every row,
 * viewed independently, should itself be roughly targetAspect wide —
 * that's what keeps stacked rows collectively near target.
 */
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
  const totalArea = sorted.reduce((s, c) => s + c.area, 0);
  const maxChildW = sorted.reduce((m, c) => (c.w > m ? c.w : m), 0);
  // longSide budget: sqrt(area * k) where k is calibrated so the
  // realized bounds aspect ≈ targetAspect after padding. See
  // LONGSIDE_BUDGET_K for details; `longsideK` can be adjusted by the
  // aspect-refinement pass to nudge the realized ratio closer to target.
  const longSide = Math.max(
    Math.sqrt(totalArea * targetAspect * (longsideK / 1.5)),
    maxChildW,
  );

  const placements: Placement[] = [];
  let cursorY = 0;
  let row: Child[] = [];

  const rowWidth = (rs: Child[]): number => {
    let w = 0;
    for (const r of rs) w += r.w + DIR_PAD;
    return Math.max(w - DIR_PAD, 0);
  };

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
  };

  for (const c of sorted) {
    if (row.length === 0) {
      row.push(c);
      continue;
    }
    // Hard overflow: never let a row exceed the long-side budget.
    const trialW = rowWidth(row) + DIR_PAD + c.w;
    if (trialW > longSide) {
      flushRow();
      row.push(c);
      continue;
    }
    const currentCost = rowCost(row, longSide);
    const trialCost = rowCost([...row, c], longSide);
    // Accept if adding the child moves the row's aspect closer to target.
    if (trialCost <= currentCost) {
      row.push(c);
    } else {
      flushRow();
      row.push(c);
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
  for (const child of dir.children.values()) sizeDir(child, longsideK);

  const childBoxes: Child[] = [];
  for (const child of dir.children.values()) {
    childBoxes.push({
      area: child.box.w * child.box.h,
      w: child.box.w,
      h: child.box.h,
      node: child,
      isLeaf: false,
    });
  }

  if (dir.files.length > 0) {
    const { w, h } = leafBox(dir.files.length);
    const leafHolder = makeDir("__files__", `${dir.path}/__files__`);
    leafHolder.files = dir.files;
    leafHolder.box = { w, h };
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

  // Choose per-level target aspect. At root we want TARGET_ASPECT; deeper
  // levels use 1.0 (near-square) so individual clusters don't inherit the
  // root's widescreen bias.
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
    const n = dir.files.length;
    const { cols } = leafBox(n);
    for (let i = 0; i < n; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const fx = originX + col * (FILE_CARD_W + CARD_GAP_X);
      const fy = originY + row * (FILE_CARD_H + CARD_GAP_Y);
      fileRects.set(dir.files[i].id, {
        x: fx,
        y: fy,
        w: FILE_CARD_W,
        h: FILE_CARD_H,
      });
    }
    return;
  }

  // Use cached placements from the sizing pass — guarantees identical
  // geometry between the two passes (prior bug: re-running the pack here
  // could produce slightly different placements because the child list
  // iteration order was fragile).
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
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
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
}

/**
 * Opt-in feature flags for expensive post-layout passes. Keep all defaults
 * `false` so callers pay nothing until a renderer consumes the data.
 * `computeOrthoRoutes` in particular costs ~50ms on a 5k-edge graph and
 * was previously running unconditionally — pure waste while the renderer
 * only consumes bezier routes.
 */
export interface TreemapOptions {
  computeOrthoRoutes?: boolean;
  computeBundledEdges?: boolean;
}

export function treemapLayout(
  graph: WorkspaceGraph,
  opts: TreemapOptions = {},
): TreemapResult {
  const t0 = (typeof performance !== "undefined" ? performance.now() : Date.now());

  const root = buildDirTree(graph.files);

  sizeDir(root);

  const fileRects = new Map<string, Rect>();
  positionDir(root, OUTER_PAD, OUTER_PAD, fileRects);

  // Cluster rects — one per *top-level* directory (with drill-through
  // when a single top-level dir dominates).
  const topLevel: DirNode[] = [];
  for (const child of root.children.values()) {
    if (child.name === "__files__") continue;
    topLevel.push(child);
  }

  const countFiles = (d: DirNode): { n: number; loc: number } => {
    let n = d.files.length;
    let loc = d.files.reduce((s, f) => s + f.loc, 0);
    for (const c of d.children.values()) {
      const sub = countFiles(c);
      n += sub.n;
      loc += sub.loc;
    }
    return { n, loc };
  };

  const totalFiles = graph.files.length;
  let clusterSource: DirNode[];
  // Track which dir level the *clusters* came from so superclusters can be
  // derived as one level up from that — i.e., the parents of clusters.
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

  // ── Superclusters — one tier above clusters (parents of clusters). ──
  // For quanta-v2 (topLevel = [crates, tests], no drill): superclusters
  // == topLevel == 2 boxes.
  // For a future MSA monorepo where drill-through went through a single
  // `services/` dominant top-level into clusterSource = [payment, order,
  // …], superclusters should be the services themselves so we don't get a
  // single-box universe. We accomplish this by mirroring the cluster drill
  // logic: pick topLevel directly, unless that would yield exactly one box
  // that matches what we drilled into — in which case emit its children
  // (= clusterSource siblings' parents) so the universe tier has ≥ 2 boxes
  // whenever possible.
  let superclusterSource: DirNode[] = topLevel;
  if (
    clusterDrilledInto &&
    superclusterSource.length === 1 &&
    superclusterSource[0] === clusterDrilledInto
  ) {
    // Single dominant top-level that we drilled through — use its
    // children (== cluster parents) so universe has multiple boxes.
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

  // Edge routes — bezier (existing renderer expects this shape).
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

  // Orthogonal routes — parallel to bezier, data-only for now (renderer
  // integration deferred).
  const edgeRoutesOrtho = buildOrthogonalRoutes(graph.fileEdges, fileRects);

  // Cluster-level bundled edges — used by future supergalaxy renderer.
  const fileToCluster = buildFileToClusterMap(graph.files, fileRects, clusters);
  const bundledEdges = buildBundledEdges(graph.fileEdges, fileToCluster, clusters);

  // Total bounds.
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

  // Dev assertion — helps catch regressions in the squarify pass.
  if (DEV_ASSERT_ASPECT && totalBounds.h > 0) {
    const aspect = totalBounds.w / totalBounds.h;
    const elapsed = ((typeof performance !== "undefined" ? performance.now() : Date.now()) - t0);
    // Using console.info so Vite dev overlay doesn't surface it as a warning.
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
  };
}
