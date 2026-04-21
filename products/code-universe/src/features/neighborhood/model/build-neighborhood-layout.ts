// build-neighborhood-layout.ts
// ---------------------------------------------------------------
// Radial hierarchy layout:
//
//   Ring 0 (r=0):    center file
//   Ring 1 (r=160):  package hub nodes — one per unique directory
//   Ring 2 (r=320):  individual file nodes, fanned within their
//                    package's angular sector
//
// Sector allocation: proportional to each package's file count,
// so a package with many files gets more arc space. Ensures no
// overlap at the outer ring regardless of total file count.
//
// Edges:
//   - Tree edges (center→pkg, pkg→file): thin, dashed, structural
//   - Dependency edges (file↔file): colored by severity

import { computeNeighborhood, decodeSymbolId } from "@quanta/canvas-engine";
import type { SymbolNode, WorkspaceGraph } from "@quanta/canvas-engine";
import { inferFileExt } from "../../../shared/lib/file-ext";
import type { BuildNeighborhoodLayoutOpts, NeighborhoodEdge, NeighborhoodLayout, NeighborhoodNode } from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const MAX_HOPS  = 2;
const PKG_RING  = 160;   // radius for package hub nodes
const FILE_RING = 320;   // radius for individual file nodes
const CENTER_R  = 20;
const PKG_R     = 16;
const FILE_R_BASE = 7;
const ACCENT_COLOR = "#0d99ff";
const TWO_PI = Math.PI * 2;

// ── Helpers ────────────────────────────────────────────────────────────

function riskColor(score: number): string {
  const c = Math.max(0, Math.min(1, score));
  let r: number, g: number, b: number;
  if (c <= 0.5) {
    const t = c * 2;
    r = Math.round(0x22 + (0xe0 - 0x22) * t);
    g = Math.round(0xa0 + (0x93 - 0xa0) * t);
    b = Math.round(0x6b + (0x21 - 0x6b) * t);
  } else {
    const t = (c - 0.5) * 2;
    r = Math.round(0xe0 + (0xe5 - 0xe0) * t);
    g = Math.round(0x93 + (0x48 - 0x93) * t);
    b = Math.round(0x21 + (0x4d - 0x21) * t);
  }
  const h = (v: number) => v.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function parentDir(fileId: string): string {
  const idx = fileId.lastIndexOf("/");
  return idx >= 0 ? fileId.slice(0, idx) : "(root)";
}

function packageLabel(dir: string): string {
  if (!dir || dir === "(root)") return "(root)";
  return dir.split("/").pop() ?? dir;
}

function shortName(path: string): string {
  const last = path.split("/").pop() ?? path;
  // Preserve the real extension when the path already carries one; for
  // extension-less mock ids, infer a likely one so the neighborhood
  // reads as file names ("types.ts") rather than bare stems.
  if (/\.[a-z0-9]+$/i.test(last)) return last;
  return last + inferFileExt(path, last);
}

function pickCenter(graph: { files: readonly { id: string }[]; fileEdges: readonly { from: string; to: string }[] }): string | null {
  if (!graph.files.length) return null;
  const counts = new Map<string, number>();
  for (const f of graph.files) counts.set(f.id, 0);
  for (const e of graph.fileEdges) {
    counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
    counts.set(e.to,   (counts.get(e.to)   ?? 0) + 1);
  }
  let bestId = graph.files[0]!.id;
  let best   = counts.get(bestId) ?? 0;
  for (const [id, n] of counts) {
    if (n > best || (n === best && id < bestId)) { best = n; bestId = id; }
  }
  return bestId;
}

// ── Mock (no graph data) ───────────────────────────────────────────────

function mockLayout(): NeighborhoodLayout {
  const center = "src/store/appStore.ts";
  const packages = [
    { dir: "src/components", files: ["src/components/App.tsx", "src/components/NavBar.tsx", "src/components/UserList.tsx"], risk: [0.30, 0.25, 0.40] },
    { dir: "src/api",        files: ["src/api/client.ts", "src/api/authApi.ts"],                                            risk: [0.55, 0.60] },
    { dir: "src/domain",     files: ["src/domain/userService.ts", "src/domain/orderService.ts"],                            risk: [0.68, 0.45] },
    { dir: "src/utils",      files: ["src/utils/logger.ts"],                                                                risk: [0.15] },
  ];

  const totalFiles = packages.reduce((s, p) => s + p.files.length, 0);
  const nodes: NeighborhoodNode[] = [
    { fileId: center, fileName: "appStore", hop: 0, angle: 0, x: 0, y: 0, radius: CENTER_R, color: ACCENT_COLOR, riskScore: 0.4, isPackageGroup: false },
  ];
  const edges: NeighborhoodEdge[] = [];

  let cursor = -Math.PI / 2;
  for (const pkg of packages) {
    const span = TWO_PI * (pkg.files.length / totalFiles);
    const mid  = cursor + span / 2;
    const avgR = pkg.risk.reduce((a, b) => a + b, 0) / pkg.risk.length;
    const pkgId = `pkg:${pkg.dir}`;

    nodes.push({
      fileId: pkgId, fileName: packageLabel(pkg.dir),
      hop: 1, angle: mid,
      x: Math.cos(mid) * PKG_RING, y: Math.sin(mid) * PKG_RING,
      radius: PKG_R, color: riskColor(avgR), riskScore: avgR,
      isPackageGroup: true, packageId: pkg.dir,
      memberIds: pkg.files, memberCount: pkg.files.length,
    });
    edges.push({ id: `tree:${center}->${pkgId}`, from: center, to: pkgId, isHighlighted: false, isTreeEdge: true });

    const n = pkg.files.length;
    for (let i = 0; i < n; i++) {
      const pad  = span * 0.12;
      const fAngle = n === 1 ? mid : cursor + pad + ((span - 2 * pad) * i) / (n - 1);
      const risk = pkg.risk[i]!;
      nodes.push({
        fileId: pkg.files[i]!, fileName: shortName(pkg.files[i]!),
        hop: 2, angle: fAngle,
        x: Math.cos(fAngle) * FILE_RING, y: Math.sin(fAngle) * FILE_RING,
        radius: FILE_R_BASE + risk * 5, color: riskColor(risk), riskScore: risk,
        isPackageGroup: false, fileHop: 1,
      });
      edges.push({ id: `tree:${pkgId}->${pkg.files[i]!}`, from: pkgId, to: pkg.files[i]!, isHighlighted: false, isTreeEdge: true });
    }
    cursor += span;
  }

  return { center, nodes, edges, maxHops: MAX_HOPS, totalNodes: totalFiles };
}

// ── Symbol neighborhood projection ─────────────────────────────────────
// When a symbol is selected, we narrow the file-tier neighborhood to the
// set of files that contain a symbol reachable from the selected one via
// `graph.symbolEdges`. The renderer stays file-tier so the visual model
// is unchanged — the user just sees a stricter subset.
//
// Why project-to-files instead of rendering symbol nodes directly: the
// neighborhood layout's sector allocation and package grouping are tuned
// for file-count densities (20–200 files). Dropping 5–10 symbol dots on
// the same canvas alongside file halos would overcrowd the outer ring
// and read worse than the file projection at the same magnification.
// Symbol-tier rendering is a separate view (Phase 4) not a layout swap.
function projectSymbolNeighborhood(
  graph: WorkspaceGraph,
  symbolId: string,
  hops: number,
): { centerFileId: string; allowedFileIds: Set<string> } | null {
  const symbolNodes = graph.symbolNodes;
  const symbolEdges = graph.symbolEdges;
  if (!symbolNodes || !symbolEdges) return null;

  const decoded = decodeSymbolId(symbolId);
  if (!decoded) return null;

  const symbolById = new Map<string, SymbolNode>();
  for (const s of symbolNodes) symbolById.set(s.id, s);
  if (!symbolById.has(symbolId)) return null;

  const adj = new Map<string, Set<string>>();
  for (const e of symbolEdges) {
    const a = adj.get(e.from) ?? new Set<string>();
    a.add(e.to);
    adj.set(e.from, a);
    const b = adj.get(e.to) ?? new Set<string>();
    b.add(e.from);
    adj.set(e.to, b);
  }

  // Undirected BFS within `hops` — matches file-tier computeNeighborhood.
  const visited = new Set<string>([symbolId]);
  let frontier: string[] = [symbolId];
  for (let d = 0; d < hops; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      const peers = adj.get(id);
      if (!peers) continue;
      for (const p of peers) {
        if (visited.has(p)) continue;
        visited.add(p);
        next.push(p);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }

  const allowedFileIds = new Set<string>();
  for (const sid of visited) {
    const s = symbolById.get(sid);
    if (s) allowedFileIds.add(s.fileId);
  }
  // Always include the center file even if the symbol sits alone.
  allowedFileIds.add(decoded.fileId);
  return { centerFileId: decoded.fileId, allowedFileIds };
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildNeighborhoodLayout(opts: BuildNeighborhoodLayoutOpts): NeighborhoodLayout {
  const { graph, selectedId, selectedSymbolId } = opts;

  if (!graph.files.length) return mockLayout();

  // Symbol selection wins over file selection — the user asked for a
  // narrower view via the symbol click. `project...` returns null when
  // the graph has no symbol edges yet, in which case we silently fall
  // back to file-tier behavior instead of showing an empty halo.
  const symbolProjection = selectedSymbolId
    ? projectSymbolNeighborhood(graph, selectedSymbolId, MAX_HOPS)
    : null;

  const centerId = symbolProjection?.centerFileId
    ?? selectedId
    ?? pickCenter(graph)
    ?? graph.files[0]!.id;
  const nbr       = computeNeighborhood(graph, centerId, MAX_HOPS);
  const fileById  = new Map(graph.files.map(f => [f.id, f]));

  // ── 1. Collect all non-center neighborhood files ───────────────────
  const neighborFiles: Array<{ id: string; hop: number }> = [];
  for (const [fileId, hop] of nbr.hop) {
    if (hop > 0) neighborFiles.push({ id: fileId, hop });
  }
  // Symbol projection narrows the outer ring to only files that contain
  // a symbol reachable from the selected one. Files outside the symbol's
  // reach are dropped from the halo entirely.
  const neighborFilesFiltered = symbolProjection
    ? neighborFiles.filter(f => symbolProjection.allowedFileIds.has(f.id))
    : neighborFiles;
  // Sort for determinism
  neighborFilesFiltered.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // ── 2. Group by parent directory ─────────────────────────────────
  const pkgMap = new Map<string, { ids: string[]; hops: number[] }>();
  for (const { id, hop } of neighborFilesFiltered) {
    const dir = parentDir(id);
    const entry = pkgMap.get(dir) ?? { ids: [], hops: [] };
    entry.ids.push(id);
    entry.hops.push(hop);
    pkgMap.set(dir, entry);
  }

  // Sort packages by dir name for determinism
  const sortedPkgs = [...pkgMap.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const totalFiles = neighborFilesFiltered.length;

  // ── 3. Build nodes ────────────────────────────────────────────────
  const nodes: NeighborhoodNode[] = [];
  const centerFile = fileById.get(centerId);
  nodes.push({
    fileId: centerId,
    fileName: centerFile?.name ?? shortName(centerId),
    hop: 0, angle: 0, x: 0, y: 0,
    radius: CENTER_R, color: ACCENT_COLOR,
    riskScore: centerFile?.riskScore ?? 0,
    isPackageGroup: false,
  });

  const edges: NeighborhoodEdge[] = [];

  let cursor = -Math.PI / 2; // start at top

  for (const [dir, { ids, hops }] of sortedPkgs) {
    const n     = ids.length;
    const span  = totalFiles > 0 ? TWO_PI * (n / totalFiles) : TWO_PI / sortedPkgs.length;
    const mid   = cursor + span / 2;
    const pkgId = `pkg:${dir}`;

    const avgRisk = ids.reduce((s, id) => s + (fileById.get(id)?.riskScore ?? 0), 0) / n;

    // Package hub node
    nodes.push({
      fileId: pkgId,
      fileName: packageLabel(dir),
      hop: 1, angle: mid,
      x: Math.cos(mid) * PKG_RING,
      y: Math.sin(mid) * PKG_RING,
      radius: PKG_R,
      color: riskColor(avgRisk),
      riskScore: avgRisk,
      isPackageGroup: true,
      packageId: dir,
      memberIds: ids,
      memberCount: n,
    });

    // Tree edge: center → package
    edges.push({
      id: `tree:${centerId}->${pkgId}`,
      from: centerId, to: pkgId,
      isHighlighted: false, isTreeEdge: true,
    });

    // File nodes fanned within the sector
    const pad = n > 1 ? span * 0.10 : 0;
    for (let i = 0; i < n; i++) {
      const fileId   = ids[i]!;
      const fileHop  = hops[i]!;
      const fAngle   = n === 1 ? mid : cursor + pad + ((span - 2 * pad) * i) / (n - 1);
      const fileNode = fileById.get(fileId);
      const risk     = fileNode?.riskScore ?? 0;

      nodes.push({
        fileId,
        fileName: fileNode?.name ?? shortName(fileId),
        hop: 2, angle: fAngle,
        x: Math.cos(fAngle) * FILE_RING,
        y: Math.sin(fAngle) * FILE_RING,
        radius: FILE_R_BASE + risk * 4,
        color: riskColor(risk),
        riskScore: risk,
        isPackageGroup: false,
        fileHop,
      });

      // Tree edge: package → file
      edges.push({
        id: `tree:${pkgId}->${fileId}`,
        from: pkgId, to: fileId,
        isHighlighted: false, isTreeEdge: true,
      });
    }

    cursor += span;
  }

  // ── 4. Dependency edges (file↔file) ──────────────────────────────
  const visibleIds = new Set(nodes.map(n => n.fileId));
  const edgeById   = new Map(graph.fileEdges.map(e => [e.id, e]));

  for (const edgeId of nbr.edges) {
    const e = edgeById.get(edgeId);
    if (!e) continue;
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
    // Skip if either endpoint is a package hub (those are tree-edge only)
    if (e.from.startsWith("pkg:") || e.to.startsWith("pkg:")) continue;
    edges.push({
      id: e.id,
      from: e.from, to: e.to,
      isHighlighted: e.from === centerId || e.to === centerId || e.severity === "high" || e.severity === "critical",
      severity: e.severity,
      isTreeEdge: false,
    });
  }

  return { center: centerId, nodes, edges, maxHops: MAX_HOPS, totalNodes: totalFiles };
}
