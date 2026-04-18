import type { WorkspaceGraph, FileNode, Rect } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "./types";
import { FILE_CARD_W, FILE_CARD_H } from "./types";
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

interface DirNode {
  name: string;
  path: string;
  children: Map<string, DirNode>;
  files: FileNode[];
  box: { w: number; h: number };
  placements: Placement[];
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
  const totalArea = sorted.reduce((s, c) => s + c.area, 0);
  const maxChildW = sorted.reduce((m, c) => (c.w > m ? c.w : m), 0);
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
    const trialW = rowWidth(row) + DIR_PAD + c.w;
    if (trialW > longSide) {
      flushRow();
      row.push(c);
      continue;
    }
    const currentCost = rowCost(row, longSide);
    const trialCost = rowCost([...row, c], longSide);
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
