// build-galaxy-3d-layout.ts
// ---------------------------------------------------------------
// Maps WorkspaceGraph → Galaxy3DLayout.
//
// Spatial structure:
//   1. Group files by parent directory (= package)
//   2. Place package centers on a Fibonacci sphere (r=200)
//   3. Scatter files within each package on a smaller sphere (r=30-55)
//      around the package center
//   4. Assign each package a vivid hue; tint file color by risk + pkg hue
//
// Deterministic: sorted packages, seeded Fibonacci distribution.

import { decodeSymbolId } from "@quanta/canvas-engine";
import type { SymbolNode, WorkspaceGraph } from "@quanta/canvas-engine";
import type { BuildGalaxy3DLayoutOpts, Galaxy3DEdge, Galaxy3DLayout, Galaxy3DNode } from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const PKG_ORBIT  = 210;  // radius for package cluster centers
const FILE_ORBIT = 45;   // radius of each cluster's local sphere
const TWO_PI     = Math.PI * 2;
const GOLDEN     = (1 + Math.sqrt(5)) / 2;

// Package hues (vivid, spaced for visual distinction)
const PKG_HUES = [195, 280, 60, 340, 140, 20, 260, 100, 310, 170, 40, 230] as const;

// ── Helpers ────────────────────────────────────────────────────────────

/** Evenly distributes n points on a unit sphere using Fibonacci lattice. */
function fibSphere(n: number): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi   = TWO_PI * i / GOLDEN;
    pts.push([
      Math.sin(theta) * Math.cos(phi),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(phi),
    ]);
  }
  return pts;
}

function parentDir(id: string): string {
  const idx = id.lastIndexOf("/");
  return idx >= 0 ? id.slice(0, idx) : "(root)";
}

function pkgLabel(dir: string): string {
  if (!dir || dir === "(root)") return "(root)";
  return dir.split("/").pop() ?? dir;
}

function shortName(path: string): string {
  const last = path.split("/").pop() ?? path;
  const dot  = last.lastIndexOf(".");
  return dot > 0 ? last.slice(0, dot) : last;
}

/** CSS hex → Three.js integer (0xRRGGBB) */
function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

/** HSL → #rrggbb. h in deg, s/l in 0..1. Needed because three.js
 *  consumes 0xRRGGBB ints; a raw "hsl(...)" string through parseInt
 *  yields NaN and the material silently falls back to black. */
function hslToHex(h: number, s: number, l: number): string {
  const hp = (((h % 360) + 360) % 360) / 60;
  const c  = (1 - Math.abs(2 * l - 1)) * s;
  const x  = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1)      { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else             { r = c;        b = x; }
  const m = l - c / 2;
  const toHex = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Colour a satellite from its bucket/hub hue. Risk modulates lightness
 *  only — hue stays inside the hub's colour family, so "files attached
 *  to the purple hub look purple, files attached to the cyan hub look
 *  cyan". Earlier versions blended a 0°→120° risk hue at 55% weight,
 *  which dragged every low-risk file toward green regardless of hub,
 *  breaking the group-identity read. Risk is already encoded via mesh
 *  radius (`2.4 + risk * 1.4`), so losing the hue-based red signal is a
 *  fair trade for a cleaner cluster colour. */
function blendColor(riskScore: number, pkgHue: number): string {
  const l = (62 - riskScore * 18) / 100; // safe 0.62 → risky 0.44
  return hslToHex(pkgHue, 0.78, l);
}

// ── Mock data ─────────────────────────────────────────────────────────

function mockLayout(): Galaxy3DLayout {
  const packages = [
    { dir: "src/store",      files: ["appStore.ts", "cartStore.ts", "userStore.ts", "uiStore.ts"],                  risks: [0.45, 0.60, 0.35, 0.20] },
    { dir: "src/api",        files: ["client.ts", "authApi.ts", "userApi.ts", "orderApi.ts", "paymentApi.ts"],       risks: [0.55, 0.62, 0.40, 0.50, 0.70] },
    { dir: "src/domain",     files: ["userService.ts", "orderService.ts", "paymentService.ts", "reportService.ts"], risks: [0.68, 0.72, 0.80, 0.55] },
    { dir: "src/components", files: ["App.tsx", "NavBar.tsx", "Dashboard.tsx", "UserList.tsx", "Modal.tsx"],         risks: [0.30, 0.25, 0.45, 0.35, 0.28] },
    { dir: "src/hooks",      files: ["useStore.ts", "useUser.ts", "useCart.ts", "useAuth.ts"],                       risks: [0.20, 0.18, 0.22, 0.30] },
    { dir: "src/infra",      files: ["db.ts", "cache.ts", "logger.ts", "config.ts"],                                 risks: [0.75, 0.60, 0.15, 0.10] },
    { dir: "src/utils",      files: ["helpers.ts", "validators.ts", "formatters.ts"],                                risks: [0.30, 0.22, 0.18] },
    { dir: "src/auth",       files: ["authService.ts", "session.ts", "jwt.ts"],                                      risks: [0.58, 0.45, 0.40] },
  ];

  const nodes: Galaxy3DNode[] = [];
  const edges: Galaxy3DEdge[] = [];
  const packageColorMap = new Map<string, number>();
  const pkgCenters = fibSphere(packages.length).map(([x, y, z]) => [x * PKG_ORBIT, y * PKG_ORBIT, z * PKG_ORBIT] as [number, number, number]);

  for (let pi = 0; pi < packages.length; pi++) {
    const pkg     = packages[pi]!;
    const [cx, cy, cz] = pkgCenters[pi]!;
    const pkgHue  = PKG_HUES[pi % PKG_HUES.length]!;
    const pkgInt  = hexToInt(`hsl(${pkgHue}, 70%, 50%)`);
    packageColorMap.set(pkg.dir, hexToInt(blendColor(0.3, pkgHue)));

    const fpts = fibSphere(pkg.files.length).map(([x, y, z]) => [x * FILE_ORBIT, y * FILE_ORBIT, z * FILE_ORBIT] as [number, number, number]);

    for (let fi = 0; fi < pkg.files.length; fi++) {
      const fileName = pkg.files[fi]!;
      const risk     = pkg.risks[fi] ?? 0.3;
      const [dx, dy, dz] = fpts[fi]!;
      const colorHex = blendColor(risk, pkgHue);
      nodes.push({
        fileId: `${pkg.dir}/${fileName}`,
        fileName: fileName.replace(/\.[^.]+$/, ""),
        packageId: pkg.dir, packageLabel: pkgLabel(pkg.dir),
        x: cx + dx, y: cy + dy, z: cz + dz,
        radius: 2.5 + risk * 2,
        colorHex, colorInt: hexToInt(colorHex),
        riskScore: risk, edgeCount: Math.round(3 + risk * 8),
      });
      void pkgInt;
    }
  }

  // Sample edges
  const ids = nodes.map(n => n.fileId);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, ids.length); j++) {
      if (Math.random() < 0.55) {
        edges.push({ from: ids[i]!, to: ids[j]!, highlighted: false });
      }
    }
  }

  return { nodes, edges, packageColorMap, center: null };
}

// ── Egocentric hub layout ─────────────────────────────────────────────
// Same shape as MindMap: center → aggregator hubs → satellite files.
// Buckets (callers / callees / siblings) classified from the file graph.
//
// Satellites fan out BEHIND each hub (further from centre along the
// hub's outward axis) in a petal-shaped disc so labels don't stack.

const HUB_ORBIT        = 180;   // distance from centre to each hub
const SAT_DEPTH_BASE   = 55;    // how far behind hub the first satellite sits
const SAT_DEPTH_STEP   = 45;    // extra depth scaled by index (furthest is ~100)
const SAT_SPREAD_MIN   = 28;    // perpendicular radius for inner files
const SAT_SPREAD_MAX   = 95;    // perpendicular radius for outer files
const BUCKET_CAP       = 12;    // max satellites per bucket
const CENTER_RADIUS    = 7;
const HUB_RADIUS       = 5.5;
const SYM_ORBIT        = 14;    // radius of symbol sub-sphere around a file
const SYM_CAP          = 8;     // max symbols per expanded file
const GOLDEN_ANGLE     = Math.PI * (3 - Math.sqrt(5));

/** Build an orthonormal basis (u, e1, e2) where u is the unit vector
 *  from origin to the hub — satellites are laid out on the (e1,e2) plane
 *  offset along +u so they appear "behind" the hub from origin's view. */
function hubBasis(hx: number, hy: number, hz: number): {
  ux: number; uy: number; uz: number;
  e1x: number; e1y: number; e1z: number;
  e2x: number; e2y: number; e2z: number;
} {
  const len = Math.hypot(hx, hy, hz) || 1;
  const ux = hx / len, uy = hy / len, uz = hz / len;
  // e1 = u × (safe world axis) — pick the axis u is least parallel to
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(uy) > 0.9) { ax = 1; ay = 0; az = 0; }
  // cross u × a
  let e1x = uy * az - uz * ay;
  let e1y = uz * ax - ux * az;
  let e1z = ux * ay - uy * ax;
  const e1len = Math.hypot(e1x, e1y, e1z) || 1;
  e1x /= e1len; e1y /= e1len; e1z /= e1len;
  // e2 = u × e1 — already unit because u and e1 are orthonormal
  const e2x = uy * e1z - uz * e1y;
  const e2y = uz * e1x - ux * e1z;
  const e2z = ux * e1y - uy * e1x;
  return { ux, uy, uz, e1x, e1y, e1z, e2x, e2y, e2z };
}

interface Bucket {
  kind: "callers" | "callees" | "siblings";
  label: string;
  colorInt: number;
  /** HSL hue (0..360) of colorInt. Pinned per bucket so satellite files
   *  can share the hub's colour family — earlier code indexed PKG_HUES
   *  by bucket order, which drifted whenever a bucket was empty (e.g.
   *  no callees → SIBLINGS took PKG_HUES[1]=280, making yellow-hub
   *  files render purple). */
  hue: number;
  files: { id: string; name: string; riskScore: number }[];
}

function buildEgocentricLayout(
  graph: WorkspaceGraph,
  centerId: string,
  expandedFileIds: ReadonlySet<string>,
): Galaxy3DLayout | null {
  const centerFile = graph.files.find(f => f.id === centerId);
  if (!centerFile) return null;

  const centerDir = parentDir(centerId);
  const fileById  = new Map(graph.files.map(f => [f.id, f]));

  // Classify into buckets
  const callerIds = new Set<string>();
  const calleeIds = new Set<string>();
  for (const e of graph.fileEdges) {
    if (e.to === centerId && e.from !== centerId) callerIds.add(e.from);
    if (e.from === centerId && e.to !== centerId) calleeIds.add(e.to);
  }
  const siblingIds = new Set<string>();
  for (const f of graph.files) {
    if (f.id === centerId) continue;
    if (parentDir(f.id) === centerDir) siblingIds.add(f.id);
  }

  const take = (ids: Set<string>) =>
    [...ids]
      .map(id => fileById.get(id))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .sort((a, b) => a.id < b.id ? -1 : 1)
      .slice(0, BUCKET_CAP)
      .map(f => ({ id: f.id, name: f.name, riskScore: f.riskScore }));

  const buckets: Bucket[] = [];
  const callers = take(callerIds);
  const callees = take(calleeIds);
  const siblings = take(siblingIds);
  // Hue values below are the HSL hue of each hub's colorInt. Keeping
  // them in sync is a manual contract — update both together.
  if (callers.length)  buckets.push({ kind: "callers",  label: "CALLERS",  colorInt: 0x4aa9d9, hue: 200, files: callers });
  if (callees.length)  buckets.push({ kind: "callees",  label: "CALLEES",  colorInt: 0xb078d9, hue: 275, files: callees });
  if (siblings.length) buckets.push({ kind: "siblings", label: "SIBLINGS", colorInt: 0xd9c24a, hue: 50,  files: siblings });

  if (buckets.length === 0) return null; // no context → caller falls back

  const nodes: Galaxy3DNode[] = [];
  const edges: Galaxy3DEdge[] = [];
  const packageColorMap = new Map<string, number>();
  /** fileId → HSL hue (deg). Feeds symbol expansion colouring so each
   *  symbol inherits its parent file's colour family instead of being
   *  hashed to an unrelated PKG_HUES entry. */
  const fileHueMap = new Map<string, number>();

  // Centre node — gold (#f5c060, hue ~38°)
  nodes.push({
    fileId: centerFile.id,
    fileName: centerFile.name,
    packageId: centerDir,
    packageLabel: pkgLabel(centerDir),
    x: 0, y: 0, z: 0,
    radius: CENTER_RADIUS,
    colorHex: "#f5c060",
    colorInt: hexToInt("#f5c060"),
    riskScore: centerFile.riskScore,
    edgeCount: callers.length + callees.length,
    kind: "center",
  });
  packageColorMap.set(centerDir, hexToInt("#f5c060"));
  fileHueMap.set(centerFile.id, 38);

  // Hubs on Fibonacci sphere at HUB_ORBIT
  const hubPts = fibSphere(buckets.length).map(([x, y, z]) =>
    [x * HUB_ORBIT, y * HUB_ORBIT, z * HUB_ORBIT] as [number, number, number],
  );

  for (let hi = 0; hi < buckets.length; hi++) {
    const bucket = buckets[hi]!;
    const [hx, hy, hz] = hubPts[hi]!;
    const hubId = `__hub__${bucket.kind}`;

    nodes.push({
      fileId: hubId,
      fileName: `${bucket.label} ${bucket.files.length}`,
      packageId: `__hub__${bucket.kind}`,
      packageLabel: bucket.label,
      x: hx, y: hy, z: hz,
      radius: HUB_RADIUS,
      colorHex: "#6b7a90",
      colorInt: bucket.colorInt,
      riskScore: 0,
      edgeCount: bucket.files.length,
      kind: "hub",
    });
    packageColorMap.set(`__hub__${bucket.kind}`, bucket.colorInt);

    // Trunk: centre → hub
    edges.push({ from: centerId, to: hubId, highlighted: true });

    // Satellites fan out BEHIND the hub along its outward axis.
    // Phyllotaxis (golden angle) for even angular distribution; sqrt(t)
    // radial falloff so file density is uniform across the petal disc;
    // slight depth ramp so labels separate along Z too.
    const basis = hubBasis(hx, hy, hz);
    const total = bucket.files.length;
    // Use the bucket's pinned hue so satellites share the hub's colour
    // family regardless of which buckets ended up populated.
    const pkgHue = bucket.hue;

    for (let si = 0; si < total; si++) {
      const f = bucket.files[si]!;
      const t = total > 1 ? si / (total - 1) : 0; // 0..1
      const angle = si * GOLDEN_ANGLE;
      const perp  = SAT_SPREAD_MIN + (SAT_SPREAD_MAX - SAT_SPREAD_MIN) * Math.sqrt((si + 0.5) / Math.max(1, total));
      const depth = SAT_DEPTH_BASE + t * SAT_DEPTH_STEP;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);

      const px = hx + basis.ux * depth + (basis.e1x * cosA + basis.e2x * sinA) * perp;
      const py = hy + basis.uy * depth + (basis.e1y * cosA + basis.e2y * sinA) * perp;
      const pz = hz + basis.uz * depth + (basis.e1z * cosA + basis.e2z * sinA) * perp;

      const colorHex = blendColor(f.riskScore, pkgHue);
      nodes.push({
        fileId: f.id,
        fileName: f.name,
        packageId: parentDir(f.id),
        packageLabel: pkgLabel(parentDir(f.id)),
        x: px, y: py, z: pz,
        radius: 2.4 + f.riskScore * 1.4,
        colorHex, colorInt: hexToInt(colorHex),
        riskScore: f.riskScore,
        edgeCount: 1,
        kind: "file",
      });
      fileHueMap.set(f.id, pkgHue);
      edges.push({ from: hubId, to: f.id, highlighted: false });
    }
  }

  // ── Symbol expansion ─────────────────────────────────────────────
  // For every visible file whose id is in expandedFileIds (center or
  // any satellite), spawn up to SYM_CAP symbol nodes on a small
  // Fibonacci shell around the file. After all symbol nodes are
  // placed, draw a symbol↔symbol edge for every graph.symbolEdges pair
  // whose endpoints are BOTH visible — this is what turns the
  // expansion into a real dependency view instead of a file decoration.
  if (expandedFileIds.size > 0 && graph.symbolNodes && graph.symbolNodes.length > 0) {
    // fileId → [x, y, z] for every currently-placed file-tier node
    // (center + satellites). Symbols anchor to one of these positions.
    const fileAnchor = new Map<string, [number, number, number]>();
    for (const n of nodes) {
      if (n.kind === "center" || n.kind === "file") {
        fileAnchor.set(n.fileId, [n.x, n.y, n.z]);
      }
    }

    const symsByFile = new Map<string, SymbolNode[]>();
    for (const s of graph.symbolNodes) {
      if (!fileAnchor.has(s.fileId)) continue;
      if (!expandedFileIds.has(s.fileId)) continue;
      const bucket = symsByFile.get(s.fileId) ?? [];
      bucket.push(s);
      symsByFile.set(s.fileId, bucket);
    }

    const visibleSymbolIds = new Set<string>();

    for (const [fileId, syms] of symsByFile) {
      const [ax, ay, az] = fileAnchor.get(fileId)!;
      // Deterministic ordering: most-connected first (callers+callees)
      // so the top symbols land on the front side of the parent
      // (closest to origin = easier to read).
      const sorted = [...syms].sort((a, b) => {
        const ac = (a.callers ?? 0) + (a.callees ?? 0);
        const bc = (b.callers ?? 0) + (b.callees ?? 0);
        if (ac !== bc) return bc - ac;
        return a.line - b.line;
      }).slice(0, SYM_CAP);

      const pts = fibSphere(sorted.length).map(([x, y, z]) =>
        [x * SYM_ORBIT, y * SYM_ORBIT, z * SYM_ORBIT] as [number, number, number],
      );
      // Inherit the parent file's hue — we recorded it during satellite
      // placement above. Falls back to a neutral blue if a symbol's file
      // somehow isn't in the map (e.g. centre hasn't expanded yet).
      const parentPkgHue = fileHueMap.get(fileId) ?? 210;

      for (let si = 0; si < sorted.length; si++) {
        const sym = sorted[si]!;
        const [dx, dy, dz] = pts[si]!;
        // Dim the symbol color vs the parent file so file-tier stays
        // the dominant silhouette; symbols read as detail, not peers.
        const risk = (sym.riskScore ?? 0) / 100;
        const colorHex = blendColor(risk, parentPkgHue);
        const symRadius = 1.3 + risk * 0.8;

        nodes.push({
          fileId: sym.id,
          fileName: sym.name,
          packageId: `__sym__${fileId}`,
          packageLabel: "symbol",
          x: ax + dx, y: ay + dy, z: az + dz,
          radius: symRadius,
          colorHex, colorInt: hexToInt(colorHex),
          riskScore: risk,
          edgeCount: (sym.callers ?? 0) + (sym.callees ?? 0),
          kind: "symbol",
          parentFileId: fileId,
          symbolKind: sym.kind,
        });
        visibleSymbolIds.add(sym.id);

        // Tree tether: parent file → its symbol. Keeps the expansion
        // visually grouped when the scene spins.
        edges.push({ from: fileId, to: sym.id, highlighted: false, tree: true });
      }
    }

    // Real symbol↔symbol dependency edges — the reason the expansion
    // exists. Only emit when BOTH endpoints are visible; otherwise the
    // edge would stub into empty space.
    if (graph.symbolEdges && visibleSymbolIds.size > 1) {
      for (const e of graph.symbolEdges) {
        if (!visibleSymbolIds.has(e.from) || !visibleSymbolIds.has(e.to)) continue;
        edges.push({ from: e.from, to: e.to, highlighted: true });
      }
    }
  }

  return { nodes, edges, packageColorMap, center: centerId };
}

// ── Full (flat) layout ───────────────────────────────────────────────
// Used when no file is selected; shows the whole workspace as before.

function buildFullLayout(graph: WorkspaceGraph, selectedId: string | undefined): Galaxy3DLayout {
  const pkgMap = new Map<string, string[]>();
  for (const f of graph.files) {
    const dir = parentDir(f.id);
    const arr = pkgMap.get(dir) ?? [];
    arr.push(f.id);
    pkgMap.set(dir, arr);
  }
  const sortedPkgs = [...pkgMap.entries()].sort(([a], [b]) => a < b ? -1 : 1);

  const nPkgs  = sortedPkgs.length;
  const pkgPts = fibSphere(nPkgs).map(([x, y, z]) => [x * PKG_ORBIT, y * PKG_ORBIT, z * PKG_ORBIT] as [number, number, number]);

  const fileById = new Map(graph.files.map(f => [f.id, f]));
  const edgeCountMap = new Map<string, number>();
  for (const e of graph.fileEdges) {
    edgeCountMap.set(e.from, (edgeCountMap.get(e.from) ?? 0) + 1);
    edgeCountMap.set(e.to,   (edgeCountMap.get(e.to)   ?? 0) + 1);
  }

  const nodes: Galaxy3DNode[] = [];
  const packageColorMap = new Map<string, number>();

  for (let pi = 0; pi < sortedPkgs.length; pi++) {
    const [dir, fileIds] = sortedPkgs[pi]!;
    const [cx, cy, cz]   = pkgPts[pi]!;
    const pkgHue = PKG_HUES[pi % PKG_HUES.length]!;
    packageColorMap.set(dir, hexToInt(blendColor(0.3, pkgHue)));

    const sorted = [...fileIds].sort();
    const fpts   = fibSphere(sorted.length).map(([x, y, z]) => {
      const r = Math.min(FILE_ORBIT * 1.5, FILE_ORBIT + sorted.length * 1.5);
      return [x * r, y * r, z * r] as [number, number, number];
    });

    for (let fi = 0; fi < sorted.length; fi++) {
      const fileId   = sorted[fi]!;
      const fileNode = fileById.get(fileId);
      const risk     = fileNode?.riskScore ?? 0;
      const ec       = edgeCountMap.get(fileId) ?? 0;
      const [dx, dy, dz] = fpts[fi]!;
      const colorHex = blendColor(risk, pkgHue);
      nodes.push({
        fileId,
        fileName: fileNode?.name ?? shortName(fileId),
        packageId: dir, packageLabel: pkgLabel(dir),
        x: cx + dx, y: cy + dy, z: cz + dz,
        radius: 1.8 + Math.sqrt(ec) * 0.7 + risk * 1.5,
        colorHex, colorInt: hexToInt(colorHex),
        riskScore: risk, edgeCount: ec,
        kind: "file",
      });
    }
  }

  const edges: Galaxy3DEdge[] = [];
  const fileIdSet = new Set(nodes.map(n => n.fileId));
  for (const e of graph.fileEdges) {
    if (!fileIdSet.has(e.from) || !fileIdSet.has(e.to)) continue;
    edges.push({
      from: e.from, to: e.to,
      highlighted: e.from === selectedId || e.to === selectedId ||
                   e.severity === "high" || e.severity === "critical",
    });
  }

  return { nodes, edges, packageColorMap, center: selectedId ?? null };
}

// ── Main entry ────────────────────────────────────────────────────────
//
// Galaxy mode is egocentric-only. Showing the full workspace produces
// an unreadable hairball (a thousand files × two thousand edges, all
// piled into one screen), so we never render that. If the user hasn't
// picked a file yet, the view renders an empty state + prompt — the
// canvas stays blank aside from the starfield. The full-graph fallback
// is deliberately not exported.

export function buildGalaxy3DLayout(opts: BuildGalaxy3DLayoutOpts): Galaxy3DLayout {
  const { graph, selectedId, expandedFileIds } = opts;

  if (!graph.files.length) return mockLayout();

  const expanded: ReadonlySet<string> = expandedFileIds ?? new Set<string>();

  if (selectedId) {
    // Symbol selections carry either the entity-tree path
    // `<fileId>#<symbol>` or the canonical `SymbolNode.id`
    // `<fileId>:<name>@<line>`. Promote both to the parent fileId so
    // the galaxy still centres on a real file instead of falling
    // through to the empty state.
    const decoded = decodeSymbolId(selectedId);
    const fileId = decoded
      ? decoded.fileId
      : selectedId.includes("#") ? selectedId.split("#")[0]! : selectedId;
    const ego = buildEgocentricLayout(graph, fileId, expanded);
    if (ego) return ego;
  }

  // Folder/package selection, no selection, or unknown id → empty layout.
  // The renderer shows a "select a file" overlay instead of dumping
  // every node into view. void buildFullLayout — intentionally unused.
  void buildFullLayout;
  return {
    nodes: [],
    edges: [],
    packageColorMap: new Map<string, number>(),
    center: null,
  };
}
