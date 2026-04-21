// build-author-territory-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → AuthorTerritoryResult.
//
// Algorithm:
//   1. Guard: if graph.blame is absent/empty → return { hasBlame: false }.
//   2. For each file, find its blame entry with max committedAt → author.
//      Files with no blame entry → author = "unknown".
//   3. Group files by author.
//   4. Assign author colors via FNV-1a hash → 8-hue palette (HSL, step 45°).
//   5. Author territory area ∝ totalLoc; laid out in row-wise strips
//      sorted by totalLoc descending.
//   6. Within each territory, pack files as nested treemap rectangles
//      (squarified variant: sort files by loc desc, fill row by row).
//   7. File color: blend author base color (70%) + age tint (older=darker).
//
// All sorts carry a stable id tie-break for determinism.

import type { FileNode } from "@quanta/canvas-engine";
import type {
  AuthorFile,
  AuthorGroup,
  AuthorTerritoryLayout,
  AuthorTerritoryResult,
  BuildAuthorTerritoryLayoutOpts,
} from "./types";

// ── Color helpers ─────────────────────────────────────────────────────

/** Stable FNV-1a string hash — deterministic. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** HSL → CSS hex string. */
function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number): string =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Pick an author color from 8-hue palette using FNV-1a hash of name. */
function authorColor(author: string): string {
  const hueIndex = hashString(author) % 8;
  const hue = hueIndex * 45; // 0,45,90,135,180,225,270,315
  return hslToHex(hue, 55, 52);
}

/** Parse hex #rrggbb to [r,g,b] 0..255 */
function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Blend two hex colors: t=0 → colorA, t=1 → colorB */
function blendColors(colorA: string, colorB: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(colorA);
  const [br, bg, bb] = hexToRgb(colorB);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ── Age tint ──────────────────────────────────────────────────────────
// ageMs / SIX_MONTHS, clamped 0–1: 0 = recent (bright), 1 = old (dark)
const SIX_MONTHS_MS = 6 * 30 * 24 * 3600 * 1000;

function ageTint(ageMs: number): number {
  return Math.min(1, Math.max(0, ageMs / SIX_MONTHS_MS));
}

/** Blend author base color with age: recent = brighter, old = darker. */
function fileColor(authorBase: string, ageMs: number): string {
  // Darken toward a neutral dark by mixing with #222222
  const t = ageTint(ageMs) * 0.45; // max 45% dark blend
  return blendColors(authorBase, "#222222", t);
}

// ── Simple treemap packer ─────────────────────────────────────────────
// Lays out items in row strips; each row filled until aspect ratio degrades.
// Items are placed left-to-right within each row.

interface PackItem {
  id: string;
  area: number;
}

interface PackRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function squarifyStrip(
  items: PackItem[],
  x: number,
  y: number,
  w: number,
  h: number,
): PackRect[] {
  const out: PackRect[] = [];
  if (items.length === 0 || w <= 0 || h <= 0) return out;

  const totalArea = items.reduce((s, it) => s + it.area, 0);
  let remaining = [...items];
  let cx = x;
  let cy = y;
  let remW = w;
  let remH = h;

  while (remaining.length > 0) {
    const availArea = (remW * remH);
    let rowItems: PackItem[] = [];
    let rowArea = 0;
    let bestWorst = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining.slice(0, i + 1);
      const candArea = candidate.reduce((s, it) => s + it.area, 0);
      // Normalise to available area
      const scale = availArea > 0 ? availArea / (totalArea || 1) : 0;
      const scaledArea = candArea * scale;

      const isHorizontal = remW >= remH;
      const rowDim = isHorizontal ? remH : remW;
      const rowLen = rowDim > 0 ? scaledArea / rowDim : 0;

      let worst = 0;
      for (const it of candidate) {
        const itScaled = it.area * scale;
        const itLen = rowLen > 0 ? itScaled / rowLen : 0;
        const aspect = rowLen > itLen
          ? (rowLen / (itLen || 1))
          : ((itLen || 1) / rowLen);
        if (aspect > worst) worst = aspect;
      }

      if (worst < bestWorst) {
        bestWorst = worst;
        rowItems = candidate;
        rowArea = candArea;
      } else {
        break; // aspect ratio degrades — stop growing row
      }
    }

    if (rowItems.length === 0) {
      // fallback: take first item
      rowItems = [remaining[0]!];
      rowArea = rowItems[0]!.area;
    }

    const scale = availArea > 0 ? availArea / (totalArea || 1) : 0;
    const scaledRowArea = rowArea * scale;
    const isHorizontal = remW >= remH;

    if (isHorizontal) {
      const rowH = remH > 0 ? scaledRowArea / remW : 0;
      let ox = cx;
      for (const it of rowItems) {
        const itW = scaledRowArea > 0 ? (it.area / rowArea) * remW : 0;
        out.push({ id: it.id, x: ox, y: cy, w: Math.max(1, itW), h: Math.max(1, rowH) });
        ox += itW;
      }
      cy += rowH;
      remH -= rowH;
    } else {
      const rowW = remW > 0 ? scaledRowArea / remH : 0;
      let oy = cy;
      for (const it of rowItems) {
        const itH = scaledRowArea > 0 ? (it.area / rowArea) * remH : 0;
        out.push({ id: it.id, x: cx, y: oy, w: Math.max(1, rowW), h: Math.max(1, itH) });
        oy += itH;
      }
      cx += rowW;
      remW -= rowW;
    }

    remaining = remaining.slice(rowItems.length);
  }

  return out;
}

// ── Author territory layout ────────────────────────────────────────────
// Authors sorted by totalLoc descending, placed in horizontal strips.
// Strip height ∝ author's share of total LoC.

const TITLE_RESERVE = 56; // px reserved for title + subtitle at top
const PADDING = 6;        // inter-territory gap
const FILE_PAD = 3;       // inner file-rect margin

// ── Mock data (shown when no git blame is connected) ─────────────────

function mockAuthorTerritoryLayout(
  width: number,
  height: number,
  now: number,
): AuthorTerritoryResult {
  const DAY = 86_400_000;
  const TITLE_RES = 56;
  const PAD = 6;
  const totalH = height - TITLE_RES - PAD * 2;
  const W = width - PAD * 2;
  const X0 = PAD;
  const authors = [
    { name: "alice",  color: "#0d99ff", share: 0.45, files: [
      { name: "userService.ts",  loc: 320, risk: 0.62, age: 8  * DAY, layer: "domain"  as const },
      { name: "authStore.ts",    loc: 240, risk: 0.45, age: 14 * DAY, layer: "domain"  as const },
      { name: "UserProfile.tsx", loc: 180, risk: 0.30, age: 3  * DAY, layer: "ui"      as const },
    ]},
    { name: "bob",    color: "#22a06b", share: 0.35, files: [
      { name: "apiClient.ts",    loc: 210, risk: 0.55, age: 22 * DAY, layer: "adapter" as const },
      { name: "paymentSvc.ts",   loc: 180, risk: 0.71, age: 5  * DAY, layer: "infra"   as const },
      { name: "logger.ts",       loc: 100, risk: 0.20, age: 45 * DAY, layer: "util"    as const },
    ]},
    { name: "carol",  color: "#e09321", share: 0.20, files: [
      { name: "reportEngine.ts", loc: 190, risk: 0.48, age: 30 * DAY, layer: "domain"  as const },
      { name: "db.ts",           loc: 100, risk: 0.66, age: 60 * DAY, layer: "infra"   as const },
    ]},
  ];

  let curY = TITLE_RES + PAD;
  const groups: AuthorGroup[] = [];
  const allFiles: AuthorFile[] = [];

  for (const a of authors) {
    const terrH = Math.floor(totalH * a.share) - PAD;
    const territory = { x: X0, y: curY, w: W, h: terrH };
    const totalLoc = a.files.reduce((s, f) => s + f.loc, 0);
    const avgRisk = a.files.reduce((s, f) => s + f.risk, 0) / a.files.length;

    // Pack files left to right
    const files: AuthorFile[] = [];
    let fx = X0 + 4;
    const fy = curY + 4;
    const fh = terrH - 8;
    for (const f of a.files) {
      const fw = Math.max(6, Math.floor((f.loc / totalLoc) * (W - 8)));
      files.push({
        fileId: `src/${f.name}`,
        fileName: f.name,
        layer: f.layer,
        loc: f.loc,
        riskScore: f.risk,
        author: a.name,
        lastEditedAt: now - f.age,
        ageMs: f.age,
        x: fx, y: fy, w: fw, h: fh,
        color: a.color,
      });
      allFiles.push(files[files.length - 1]!);
      fx += fw + 2;
    }

    groups.push({ author: a.name, files, totalLoc, avgRisk, color: a.color, territory });
    curY += terrH + PAD;
  }

  return { hasBlame: true, groups, allFiles };
}

export function buildAuthorTerritoryLayout(
  opts: BuildAuthorTerritoryLayoutOpts,
): AuthorTerritoryResult {
  const { graph, width, height, now = Date.now() } = opts;

  // ── 1. Guard ───────────────────────────────────────────────────────
  if (!graph.blame || Object.keys(graph.blame).length === 0) {
    return mockAuthorTerritoryLayout(width, height, now);
  }

  const blame = graph.blame;

  // ── 2. Map each file → author (most recent blame entry) ───────────
  const fileById = new Map<string, FileNode>();
  for (const f of graph.files) fileById.set(f.id, f);

  interface FileBlameInfo { author: string; lastEditedAt: number }
  const blameInfo = new Map<string, FileBlameInfo>();

  for (const f of graph.files) {
    const fb = blame[f.id];
    if (!fb || fb.entries.length === 0) {
      blameInfo.set(f.id, { author: "unknown", lastEditedAt: 0 });
      continue;
    }
    // Most recent entry by committedAt
    let maxAt = -Infinity;
    let dominantAuthor = "unknown";
    for (const entry of fb.entries) {
      if (entry.committedAt > maxAt) {
        maxAt = entry.committedAt;
        dominantAuthor = entry.author;
      }
    }
    blameInfo.set(f.id, { author: dominantAuthor, lastEditedAt: maxAt });
  }

  // ── 3. Group files by author ───────────────────────────────────────
  const groupMap = new Map<string, FileNode[]>();
  for (const f of graph.files) {
    const info = blameInfo.get(f.id)!;
    const arr = groupMap.get(info.author) ?? [];
    arr.push(f);
    groupMap.set(info.author, arr);
  }

  // ── 4. Build author entries, sorted by totalLoc descending ─────────
  interface AuthorEntry {
    author: string;
    files: FileNode[];
    totalLoc: number;
    avgRisk: number;
    color: string;
  }

  const entries: AuthorEntry[] = [];
  for (const [author, files] of groupMap) {
    const totalLoc = files.reduce((s, f) => s + f.loc, 0);
    const avgRisk =
      files.length > 0
        ? files.reduce((s, f) => s + f.riskScore, 0) / files.length
        : 0;
    entries.push({
      author,
      files,
      totalLoc,
      avgRisk,
      color: authorColor(author),
    });
  }
  // Stable sort: totalLoc desc, then author name asc
  entries.sort((a, b) => {
    if (b.totalLoc !== a.totalLoc) return b.totalLoc - a.totalLoc;
    return a.author < b.author ? -1 : a.author > b.author ? 1 : 0;
  });

  const grandTotalLoc = entries.reduce((s, e) => s + e.totalLoc, 0);

  // ── 5. Lay out territory rects in horizontal strips ────────────────
  const layoutW = width - PADDING * 2;
  const layoutH = height - TITLE_RESERVE - PADDING * 2;
  const layoutX = PADDING;
  const layoutY = TITLE_RESERVE + PADDING;

  // Build territory rects proportional to totalLoc
  const territoryItems: PackItem[] = entries.map(e => ({
    id: e.author,
    area: grandTotalLoc > 0 ? (e.totalLoc / grandTotalLoc) * layoutW * layoutH : layoutW * layoutH / entries.length,
  }));

  const territoryRects = squarifyStrip(
    territoryItems,
    layoutX,
    layoutY,
    layoutW,
    layoutH,
  );

  const territoryByAuthor = new Map<string, PackRect>();
  for (const r of territoryRects) territoryByAuthor.set(r.id, r);

  // ── 6. Within each territory, pack file rects ─────────────────────
  const allFiles: AuthorFile[] = [];
  const groups: AuthorGroup[] = [];

  const LABEL_H = 36; // reserved at top of territory for author label

  for (const entry of entries) {
    const tr = territoryByAuthor.get(entry.author);
    if (!tr) continue;

    // Sort files by loc desc (stable id tie-break)
    const sortedFiles = [...entry.files].sort((a, b) => {
      if (b.loc !== a.loc) return b.loc - a.loc;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    const innerX = tr.x + FILE_PAD;
    const innerY = tr.y + LABEL_H;
    const innerW = tr.w - FILE_PAD * 2;
    const innerH = tr.h - LABEL_H - FILE_PAD;

    const fileItems: PackItem[] = sortedFiles.map(f => ({
      id: f.id,
      area: Math.max(1, f.loc),
    }));

    const fileRects = squarifyStrip(fileItems, innerX, innerY, Math.max(1, innerW), Math.max(1, innerH));
    const rectById = new Map<string, PackRect>();
    for (const r of fileRects) rectById.set(r.id, r);

    const authorFiles: AuthorFile[] = [];
    for (const f of sortedFiles) {
      const r = rectById.get(f.id) ?? { x: innerX, y: innerY, w: 4, h: 4 };
      const info = blameInfo.get(f.id) ?? { author: entry.author, lastEditedAt: 0 };
      const ageMs = info.lastEditedAt > 0 ? Math.max(0, now - info.lastEditedAt) : SIX_MONTHS_MS;
      const color = fileColor(entry.color, ageMs);

      const af: AuthorFile = {
        fileId: f.id,
        fileName: f.name,
        layer: f.layer,
        loc: f.loc,
        riskScore: f.riskScore,
        author: entry.author,
        lastEditedAt: info.lastEditedAt,
        ageMs,
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        color,
      };
      authorFiles.push(af);
      allFiles.push(af);
    }

    groups.push({
      author: entry.author,
      files: authorFiles,
      totalLoc: entry.totalLoc,
      avgRisk: entry.avgRisk,
      color: entry.color,
      territory: { x: tr.x, y: tr.y, w: tr.w, h: tr.h },
    });
  }

  const result: AuthorTerritoryLayout = { groups, allFiles, hasBlame: true };
  return result;
}
