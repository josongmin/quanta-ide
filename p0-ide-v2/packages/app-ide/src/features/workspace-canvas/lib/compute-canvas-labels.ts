import type { FileNode, Rect, Viewport } from "@quanta/canvas-engine";
import type { FolderRect } from "./compute-folder-rects";

// Screen-space pad between the viewport edge and any clamped label.
const LABEL_VIEWPORT_PAD_PX = 8;
// Natural offsets from the folder rect's top-left corner (world px) —
// mirror the CSS defaults so the label sits just above the top border.
const LABEL_NATURAL_X = 16;
const LABEL_NATURAL_Y = -14;

// Label font sizes in CSS px. Because labels live inside the dom-layer's
// `transform: scale()`, one CSS px == one world px for layout purposes
// (the transform scales them uniformly). Matches workspace-canvas.css.
const FILE_STICKY_FONT = 11;
function fontSizeForFolder(rdepth: number): number {
  const d = Math.min(rdepth, 3);
  return d === 0 ? 15 : d === 1 ? 17 : d === 2 ? 19 : 21;
}

// Rough proportional-font width heuristic. We only need enough accuracy to
// flag overlaps, not to lay out text — a small over-estimate is fine.
function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55 + 20;
}
function estimateHeight(fontSize: number): number {
  return fontSize + 6;
}

interface Box {
  worldX: number;
  worldY: number;
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.worldX < b.worldX + b.w &&
    a.worldX + a.w > b.worldX &&
    a.worldY < b.worldY + b.h &&
    a.worldY + a.h > b.worldY
  );
}

export interface FolderLabelLayout extends Box {
  path: string;
  text: string;
  clamped: boolean;
  offscreen: boolean;
  hidden: boolean;
  depth: number;
}

export interface FileStickyLabelLayout extends Box {
  fileId: string;
  text: string;
  hidden: boolean;
  depth: number;
}

export interface CanvasLabels {
  folders: FolderLabelLayout[];
  files: FileStickyLabelLayout[];
}

/**
 * Single source of truth for every label pill painted over the canvas —
 * folder breadcrumbs and per-file sticky headers alike.
 *
 * Why one function: a folder's clamped full-path pill and a descendant
 * file's sticky pill both gravitate to the viewport's top-left when
 * their natural positions scroll off, so they collide. Resolving
 * "shallower loses" requires knowing about both kinds of labels at
 * once — any per-component implementation would see only half the
 * picture.
 *
 * Steps:
 *   1. Compute each folder's clamped position + label text (leaf or
 *      full path, depending on whether clamping fired).
 *   2. Compute a sticky label for every visible file whose intrinsic
 *      header has scrolled above the viewport top.
 *   3. Estimate each label's world-space bounding box.
 *   4. Any two labels whose boxes overlap: hide the one with fewer
 *      path segments (ties broken in favor of file labels, which are
 *      always the most specific disclosure).
 */
export function computeCanvasLabels(
  folderRects: readonly FolderRect[],
  visibleFiles: readonly FileNode[],
  fileRects: Map<string, Rect>,
  viewport: Viewport,
): CanvasLabels {
  const scale = viewport.scale || 1;
  const vLeft = -viewport.x / scale;
  const vTop = -viewport.y / scale;
  const vRight = (viewport.width - viewport.x) / scale;
  const vBottom = (viewport.height - viewport.y) / scale;
  const pad = LABEL_VIEWPORT_PAD_PX / scale;

  const folders: FolderLabelLayout[] = folderRects.map(fr => {
    const { rect, path, rdepth } = fr;
    const minLocalX = vLeft + pad - rect.x;
    const minLocalY = vTop + pad - rect.y;
    const maxLocalX = Math.max(LABEL_NATURAL_X, rect.w - 24);
    const maxLocalY = Math.max(LABEL_NATURAL_Y, rect.h - 24);
    const localX = Math.min(maxLocalX, Math.max(LABEL_NATURAL_X, minLocalX));
    const localY = Math.min(maxLocalY, Math.max(LABEL_NATURAL_Y, minLocalY));
    const clamped = localX !== LABEL_NATURAL_X || localY !== LABEL_NATURAL_Y;
    const offscreen =
      rect.x + rect.w < vLeft ||
      rect.x > vRight ||
      rect.y + rect.h < vTop ||
      rect.y > vBottom;
    const leaf = path.split("/").pop() ?? path;
    const text = clamped ? path : leaf;
    const fs = fontSizeForFolder(rdepth);
    return {
      path,
      text,
      worldX: rect.x + localX,
      worldY: rect.y + localY,
      clamped,
      offscreen,
      hidden: false,
      depth: path.split("/").length,
      w: estimateWidth(text, fs),
      h: estimateHeight(fs),
    };
  });

  const files: FileStickyLabelLayout[] = [];
  for (const f of visibleFiles) {
    const rect = fileRects.get(f.id);
    if (!rect) continue;
    const headerCovered = rect.y < vTop;
    const onScreen =
      rect.x + rect.w > vLeft &&
      rect.x < vRight &&
      rect.y + rect.h > vTop &&
      rect.y < vBottom;
    if (!headerCovered || !onScreen) continue;

    const worldX = Math.max(rect.x, vLeft) + pad;
    const maxY = rect.y + rect.h - 24;
    const worldY = Math.min(maxY, vTop + pad);
    files.push({
      fileId: f.id,
      text: f.id,
      worldX,
      worldY,
      hidden: false,
      depth: f.id.split("/").length,
      w: estimateWidth(f.id, FILE_STICKY_FONT),
      h: estimateHeight(FILE_STICKY_FONT),
    });
  }

  // Overlap pass. Walk every visible pair once (labels are few —
  // folderRects is <30 and file stickies only appear for files whose
  // header is covered). Hide the shallower label on any AABB overlap so
  // the user never sees stacked pills. Ties break to file labels (they
  // carry the most specific path — a folder-leaf pill is redundant
  // against a file pill that contains the same prefix).
  const all: Array<(FolderLabelLayout | FileStickyLabelLayout) & { __kind: "folder" | "file" }> = [];
  for (const f of folders) if (!f.offscreen) all.push(Object.assign(f, { __kind: "folder" as const }));
  for (const f of files) all.push(Object.assign(f, { __kind: "file" as const }));

  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.hidden) continue;
    for (let j = i + 1; j < all.length; j++) {
      const b = all[j];
      if (b.hidden) continue;
      if (!overlaps(a, b)) continue;
      let loser: typeof a;
      if (a.depth < b.depth) loser = a;
      else if (b.depth < a.depth) loser = b;
      else loser = a.__kind === "file" ? b : a; // equal depth → keep file
      loser.hidden = true;
      if (loser === a) break;
    }
  }

  return { folders, files };
}
