// build-service-topo-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → ServiceTopoLayout.
//
// Algorithm:
//   1. Group files by package prefix (first path segment before "/"):
//      "ce" → "canvas-engine", "cu" → "code-universe", "ide" → "ide-shell".
//      Any other prefix → use the prefix as-is.
//   2. Create a NamedGraph for each package (only that package's files and
//      internal edges).
//   3. Identify cross-package file edges where from.split("/")[0] !==
//      to.split("/")[0].
//   4. Map cross-package edges to JoinEdge: "call"→"rpc", "import"→"api-call",
//      others→"api-call".
//   5. Call joinGraphs(packages, joinEdges) — validates the API contract;
//      the merged graph is not directly used for layout.
//   6. Place 3 service nodes in an equilateral triangle:
//        canvas-engine  → bottom-center
//        code-universe  → top-left
//        ide-shell      → top-right
//   7. ServiceNode.radius ∝ sqrt(fileCount) * BASE_RADIUS.
//      ServiceNode.color by dominant layer.
//   8. Cross-package edges: weight = sum of individual edge weights.
//   9. SVG cubic bezier paths: from arc edge of source to arc edge of target,
//      with control points offset perpendicularly for curvature.

import type { ArchLayer, FileEdge, FileNode, WorkspaceGraph } from "@quanta/canvas-engine";
import { joinGraphs } from "@quanta/canvas-engine";
import type { JoinEdge, NamedGraph } from "@quanta/canvas-engine";
import type {
  BuildServiceTopoLayoutOpts,
  ServiceEdge,
  ServiceNode,
  ServiceTopoLayout,
} from "./types";

// ── Package prefix map ─────────────────────────────────────────────────

const PREFIX_TO_LABEL: Record<string, string> = {
  ce:  "canvas-engine",
  cu:  "code-universe",
  ide: "ide-shell",
};

function prefixOf(fileId: string): string {
  return fileId.split("/")[0] ?? fileId;
}

function graphIdFromPrefix(prefix: string): string {
  return PREFIX_TO_LABEL[prefix] ?? prefix;
}

// ── Layer → color ──────────────────────────────────────────────────────

const LAYER_COLORS: Record<ArchLayer, string> = {
  domain:  "#7e4ed6",
  adapter: "#0d99ff",
  ui:      "#22a06b",
  infra:   "#e09321",
  util:    "#a0a0a5",
  unknown: "#cdcdcd",
};

// Pixi color ints for NamedGraph — matching the token palette
const LAYER_PIXI_COLORS: Record<ArchLayer, number> = {
  domain:  0x7e4ed6,
  adapter: 0x0d99ff,
  ui:      0x22a06b,
  infra:   0xe09321,
  util:    0xa0a0a5,
  unknown: 0xcdcdcd,
};

function dominantLayer(files: FileNode[]): ArchLayer {
  if (files.length === 0) return "unknown";
  const counts = new Map<ArchLayer, number>();
  for (const f of files) {
    counts.set(f.layer, (counts.get(f.layer) ?? 0) + 1);
  }
  let best: ArchLayer = "unknown";
  let bestCount = 0;
  for (const [layer, count] of counts) {
    if (count > bestCount || (count === bestCount && layer < best)) {
      best = layer;
      bestCount = count;
    }
  }
  return best;
}

function layerBreakdown(files: FileNode[]): Partial<Record<ArchLayer, number>> {
  if (files.length === 0) return {};
  const counts = new Map<ArchLayer, number>();
  for (const f of files) {
    counts.set(f.layer, (counts.get(f.layer) ?? 0) + 1);
  }
  const out: Partial<Record<ArchLayer, number>> = {};
  for (const [layer, count] of counts) {
    out[layer] = count / files.length;
  }
  return out;
}

// ── Edge kind mapping ──────────────────────────────────────────────────

type ServiceKind = "rpc" | "api-call" | "queue" | "shared-db";

function edgeKindToServiceKind(kind: FileEdge["kind"]): ServiceKind {
  switch (kind) {
    case "call":
      return "rpc";
    case "import":
      return "api-call";
    default:
      return "api-call";
  }
}

function edgeKindToJoinKind(kind: FileEdge["kind"]): JoinEdge["kind"] {
  switch (kind) {
    case "call":
      return "rpc";
    case "import":
      return "api-call";
    default:
      return "api-call";
  }
}

const SERVICE_KIND_COLOR: Record<ServiceKind, string> = {
  rpc:       "#0d99ff",
  "api-call": "#22a06b",
  queue:     "#e09321",
  "shared-db": "#7e4ed6",
};

// ── Equilateral triangle positions ────────────────────────────────────

interface TrianglePos { x: number; y: number }

/**
 * Returns positions for 3 service nodes in an equilateral triangle.
 * "canvas-engine" → bottom-center
 * "code-universe" → top-left
 * "ide-shell"     → top-right
 */
function equilateralPositions(
  cx: number,
  cy: number,
  r: number,
): Record<string, TrianglePos> {
  // bottom-center = 270° (pointing down), top-left = 150°, top-right = 30°
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  return {
    "canvas-engine": { x: cx + r * Math.cos(toRad(270)), y: cy + r * Math.sin(toRad(270)) },
    "code-universe": { x: cx + r * Math.cos(toRad(210)), y: cy + r * Math.sin(toRad(210)) },
    "ide-shell":     { x: cx + r * Math.cos(toRad(330)), y: cy + r * Math.sin(toRad(330)) },
  };
}

// ── Node radius ────────────────────────────────────────────────────────

const BASE_RADIUS = 12;
const RADIUS_SCALE = 6;

function nodeRadius(fileCount: number): number {
  return Math.max(BASE_RADIUS, Math.round(BASE_RADIUS + Math.sqrt(fileCount) * RADIUS_SCALE));
}

// ── Bezier path between two circles ───────────────────────────────────

/**
 * Build a cubic bezier SVG path from the edge of circle A to the edge of
 * circle B, with control points offset perpendicularly.
 */
function bezierPath(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): string {
  // Direction vector A→B
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  // Start/end on the circle surfaces
  const sx = ax + nx * ar;
  const sy = ay + ny * ar;
  const ex = bx - nx * br;
  const ey = by - ny * br;

  // Perpendicular offset for curvature
  const perpX = -ny;
  const perpY = nx;
  const curve = len * 0.22;

  const c1x = sx + nx * len * 0.33 + perpX * curve;
  const c1y = sy + ny * len * 0.33 + perpY * curve;
  const c2x = ex - nx * len * 0.33 + perpX * curve;
  const c2y = ey - ny * len * 0.33 + perpY * curve;

  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

// ── Main entry ─────────────────────────────────────────────────────────

// ── Mock data (shown when graph has no files) ─────────────────────────

function mockServiceTopoLayout(width: number, height: number): ServiceTopoLayout {
  const cx = width / 2;
  const cy = height / 2 + 20;
  const triR = Math.min(width, height) * 0.28;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const nodeSpecs = [
    { id: "canvas-engine", label: "canvas-engine", color: "#7e4ed6", deg: 270, files: 42, loc: 8200, risk: 0.38, layer: "domain"  as const, breakdown: { domain: 0.45, adapter: 0.25, util: 0.30 } as Partial<Record<ArchLayer, number>> },
    { id: "code-universe",  label: "code-universe",  color: "#0d99ff", deg: 210, files: 68, loc: 14500, risk: 0.55, layer: "ui" as const, breakdown: { ui: 0.55, domain: 0.30, infra: 0.15 } as Partial<Record<ArchLayer, number>> },
    { id: "ide-shell",      label: "ide-shell",      color: "#22a06b", deg: 330, files: 24, loc: 4800, risk: 0.30, layer: "adapter" as const, breakdown: { adapter: 0.60, util: 0.40 } as Partial<Record<ArchLayer, number>> },
  ];

  const nodes: ServiceNode[] = nodeSpecs.map(n => ({
    graphId: n.id,
    label: n.label,
    color: n.color,
    fileCount: n.files,
    loc: n.loc,
    riskScore: n.risk,
    archLayer: n.layer,
    x: cx + triR * Math.cos(toRad(n.deg)),
    y: cy + triR * Math.sin(toRad(n.deg)),
    radius: Math.max(12, Math.round(12 + Math.sqrt(n.files) * 6)),
    layerBreakdown: n.breakdown,
  }));

  const nodeMap = new Map(nodes.map(n => [n.graphId, n]));

  const edgeSpecs: Array<{ from: string; to: string; weight: number; kind: ServiceEdge["kind"] }> = [
    { from: "code-universe",  to: "canvas-engine", weight: 28, kind: "api-call"  },
    { from: "ide-shell",      to: "canvas-engine", weight: 12, kind: "rpc"       },
    { from: "ide-shell",      to: "code-universe", weight: 6,  kind: "api-call"  },
  ];

  const KIND_COLORS_LOCAL: Record<ServiceEdge["kind"], string> = {
    "api-call":  "#22a06b",
    "rpc":       "#0d99ff",
    "queue":     "#e09321",
    "shared-db": "#7e4ed6",
  };

  const edges: ServiceEdge[] = edgeSpecs.map(spec => {
    const fn_ = nodeMap.get(spec.from)!;
    const tn_ = nodeMap.get(spec.to)!;
    const dx = tn_.x - fn_.x, dy = tn_.y - fn_.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx_ = dx / len, ny_ = dy / len;
    const sx = fn_.x + nx_ * fn_.radius, sy = fn_.y + ny_ * fn_.radius;
    const ex = tn_.x - nx_ * tn_.radius, ey = tn_.y - ny_ * tn_.radius;
    const perp = len * 0.22;
    const px = -ny_, py = nx_;
    const c1x = sx + nx_ * len * 0.33 + px * perp, c1y = sy + ny_ * len * 0.33 + py * perp;
    const c2x = ex - nx_ * len * 0.33 + px * perp, c2y = ey - ny_ * len * 0.33 + py * perp;
    const path = `M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${ex.toFixed(2)} ${ey.toFixed(2)}`;
    return { from: spec.from, to: spec.to, weight: spec.weight, kind: spec.kind, isCrossGraph: true, color: KIND_COLORS_LOCAL[spec.kind], path };
  });

  return { nodes, edges, totalFiles: 134 };
}

export function buildServiceTopoLayout(
  opts: BuildServiceTopoLayoutOpts,
): ServiceTopoLayout {
  const { graph, width = 800, height = 600 } = opts;

  if (graph.files.length === 0) return mockServiceTopoLayout(width, height);

  // ── 1. Group files by package prefix ────────────────────────────────
  const packageFiles = new Map<string, FileNode[]>();
  for (const f of graph.files) {
    const prefix = prefixOf(f.id);
    const graphId = graphIdFromPrefix(prefix);
    const arr = packageFiles.get(graphId) ?? [];
    arr.push(f);
    packageFiles.set(graphId, arr);
  }

  // ── 2. Create NamedGraphs ────────────────────────────────────────────
  const namedGraphs: NamedGraph[] = [];

  for (const [graphId, files] of packageFiles) {
    const dominant = dominantLayer(files);
    const color = LAYER_PIXI_COLORS[dominant];

    // Internal edges: both from and to belong to this graphId
    const fileIds = new Set(files.map(f => f.id));
    const internalEdges = graph.fileEdges.filter(
      e => fileIds.has(e.from) && fileIds.has(e.to),
    );

    const subGraph: WorkspaceGraph = {
      files,
      fileEdges: internalEdges,
      comments: [],
    };

    namedGraphs.push({ graphId, label: graphId, color, graph: subGraph });
  }

  // Stable sort by graphId for determinism
  namedGraphs.sort((a, b) => (a.graphId < b.graphId ? -1 : a.graphId > b.graphId ? 1 : 0));

  // ── 3. Identify cross-package edges ─────────────────────────────────
  const crossEdges = graph.fileEdges.filter(e => {
    const fromPrefix = prefixOf(e.from);
    const toPrefix   = prefixOf(e.to);
    return fromPrefix !== toPrefix;
  });

  // ── 4. Map to JoinEdges ──────────────────────────────────────────────
  const joinEdges: JoinEdge[] = crossEdges.map(e => ({
    fromGraphId: graphIdFromPrefix(prefixOf(e.from)),
    fromFileId:  e.from,
    toGraphId:   graphIdFromPrefix(prefixOf(e.to)),
    toFileId:    e.to,
    kind:        edgeKindToJoinKind(e.kind),
    weight:      e.weight,
    severity:    e.severity,
  }));

  // ── 5. Call joinGraphs (API validation) ─────────────────────────────
  // Result not used for rendering — purely validates the API contract.
  void joinGraphs(namedGraphs, joinEdges);

  // ── 6. Triangle layout ───────────────────────────────────────────────
  const cx = width / 2;
  const cy = height / 2 + 20; // slight downward shift for visual balance
  const triR = Math.min(width, height) * 0.28;

  const positions = equilateralPositions(cx, cy, triR);

  // ── 7. Build ServiceNodes ────────────────────────────────────────────
  const nodes: ServiceNode[] = namedGraphs.map(ng => {
    const files = ng.graph.files;
    const totalLoc = files.reduce((s, f) => s + f.loc, 0);
    const avgRisk  = files.length > 0
      ? files.reduce((s, f) => s + f.riskScore, 0) / files.length
      : 0;
    const dominant = dominantLayer(files);
    const pos = positions[ng.graphId] ?? { x: cx, y: cy };
    const r = nodeRadius(files.length);

    return {
      graphId: ng.graphId,
      label: ng.graphId,
      color: LAYER_COLORS[dominant],
      fileCount: files.length,
      loc: totalLoc,
      riskScore: Math.round(avgRisk * 10) / 10,
      archLayer: dominant,
      x: pos.x,
      y: pos.y,
      radius: r,
      layerBreakdown: layerBreakdown(files),
    };
  });

  const nodeById = new Map<string, ServiceNode>();
  for (const n of nodes) nodeById.set(n.graphId, n);

  // ── 8+9. Build ServiceEdges (aggregated cross-package) ────────────────
  // Aggregate by (from, to) pair — sum weights, track dominant kind.
  interface EdgeAgg {
    weight: number;
    kindCounts: Map<ServiceKind, number>;
  }
  const edgeAgg = new Map<string, EdgeAgg>();

  for (const e of crossEdges) {
    const fromGid = graphIdFromPrefix(prefixOf(e.from));
    const toGid   = graphIdFromPrefix(prefixOf(e.to));
    if (fromGid === toGid) continue;
    const key = `${fromGid}→${toGid}`;
    const agg = edgeAgg.get(key) ?? { weight: 0, kindCounts: new Map() };
    agg.weight += e.weight;
    const sk = edgeKindToServiceKind(e.kind);
    agg.kindCounts.set(sk, (agg.kindCounts.get(sk) ?? 0) + 1);
    edgeAgg.set(key, agg);
  }

  const serviceEdges: ServiceEdge[] = [];
  for (const [key, agg] of edgeAgg) {
    const [fromGid, toGid] = key.split("→") as [string, string];
    const fromNode = nodeById.get(fromGid);
    const toNode   = nodeById.get(toGid);
    if (!fromNode || !toNode) continue;

    // Dominant kind (max count, stable tie-break)
    let dominantKind: ServiceKind = "api-call";
    let maxCount = 0;
    for (const [k, c] of agg.kindCounts) {
      if (c > maxCount || (c === maxCount && k < dominantKind)) {
        dominantKind = k;
        maxCount = c;
      }
    }

    const path = bezierPath(
      fromNode.x, fromNode.y, fromNode.radius,
      toNode.x,   toNode.y,   toNode.radius,
    );

    serviceEdges.push({
      from:        fromGid,
      to:          toGid,
      weight:      agg.weight,
      kind:        dominantKind,
      isCrossGraph: true,
      color:       SERVICE_KIND_COLOR[dominantKind],
      path,
    });
  }

  // Stable sort edges by (from, to)
  serviceEdges.sort((a, b) => {
    const ka = `${a.from}→${a.to}`;
    const kb = `${b.from}→${b.to}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return {
    nodes,
    edges: serviceEdges,
    totalFiles: graph.files.length,
  };
}
