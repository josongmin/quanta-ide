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
const FILE_STICKY_WEIGHT = 500;
const FOLDER_DEFAULT_WEIGHT = 700;
const FOLDER_CLAMPED_WEIGHT = 500;
// Horizontal padding baked into the pill (~px on each side — see CSS).
const LABEL_X_PADDING = 20;
function fontSizeForFolder(rdepth: number): number {
  const d = Math.min(rdepth, 3);
  return d === 0 ? 15 : d === 1 ? 17 : d === 2 ? 19 : 21;
}

// Lazy-initialised offscreen canvas for text measurement. Shared across
// calls — creating a <canvas> per measurement would burn GC on every
// pan frame. In non-browser environments (SSR, node unit tests) the
// context may be null; callers fall back to a proportional-font
// heuristic that's close enough for overlap detection.
let _measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (_measureCtx !== undefined) return _measureCtx;
  if (typeof document === "undefined") {
    _measureCtx = null;
    return null;
  }
  try {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d");
  } catch {
    _measureCtx = null;
  }
  return _measureCtx ?? null;
}

function measureTextWidth(text: string, fontSize: number, weight: number): number {
  const ctx = getMeasureCtx();
  if (ctx) {
    // Match the CSS font stack so measureText matches rendered width.
    // `Pretendard` is the project default; falling back to system-ui
    // keeps jsdom-equivalent browsers measuring a close approximation.
    ctx.font = `${weight} ${fontSize}px Pretendard, system-ui, sans-serif`;
    const measured = ctx.measureText(text).width;
    // Some jsdom-canvas shims return 0 — detect and fall through to the
    // heuristic rather than trust a nonsense box.
    if (measured > 0) return measured;
  }
  // Heuristic: proportional fonts average ~0.55 × font-size per char,
  // bolder runs slightly wider. Close enough to flag overlaps.
  const weightBoost = weight >= 600 ? 0.06 : 0;
  return text.length * fontSize * (0.55 + weightBoost);
}

function estimateWidth(text: string, fontSize: number, weight: number): number {
  return measureTextWidth(text, fontSize, weight) + LABEL_X_PADDING;
}
function estimateHeight(fontSize: number): number {
  return fontSize + 6;
}

// Labels with CSS `max-width: 60vw` truncate to an ellipsis; clamp the
// overlap-detection width to the same cap so a 500-char path doesn't
// claim the entire viewport and false-positive overlaps with everything.
// `vw` is window-based, so prefer window.innerWidth when available and
// fall back to the canvas container width for SSR / headless runs.
function maxCappedWidth(viewportWidth: number): number {
  const w = typeof window !== "undefined" && window.innerWidth > 0
    ? window.innerWidth
    : viewportWidth;
  return w * 0.6;
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
  const cappedMax = maxCappedWidth(viewport.width);

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
    const weight = clamped ? FOLDER_CLAMPED_WEIGHT : FOLDER_DEFAULT_WEIGHT;
    // Only clamped labels hit the `max-width: 60vw` CSS cap; natural
    // labels render at full text width. Non-cap path uses measured
    // width directly so overlap detection stays tight.
    const rawW = estimateWidth(text, fs, weight);
    const w = clamped ? Math.min(rawW, cappedMax) : rawW;
    return {
      path,
      text,
      worldX: rect.x + localX,
      worldY: rect.y + localY,
      clamped,
      offscreen,
      hidden: false,
      depth: path.split("/").length,
      w,
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
    // File sticky label always has `max-width: 60vw` in CSS, so cap here.
    const rawW = estimateWidth(f.id, FILE_STICKY_FONT, FILE_STICKY_WEIGHT);
    files.push({
      fileId: f.id,
      text: f.id,
      worldX,
      worldY,
      hidden: false,
      depth: f.id.split("/").length,
      w: Math.min(rawW, cappedMax),
      h: estimateHeight(FILE_STICKY_FONT),
    });
  }

  // Overlap pass. Walk every visible pair once (labels are few —
  // folderRects is <30 and file stickies only appear for files whose
  // header is covered). Hide the shallower label on any AABB overlap so
  // the user never sees stacked pills. Ties break to file labels: they
  // carry the most specific path — a folder-leaf pill is redundant
  // against a file pill that already contains the same prefix.
  interface Entry { label: FolderLabelLayout | FileStickyLabelLayout; isFile: boolean }
  const order: Entry[] = [];
  for (const f of folders) if (!f.offscreen) order.push({ label: f, isFile: false });
  for (const f of files) order.push({ label: f, isFile: true });

  // If hiding an ancestor folder's full-path label leaves only the
  // descendant's leaf-only pill visible, the user loses the ancestor
  // context. Upgrade the descendant to show its own full path so the
  // disclosure survives. Only fires when the loser actually carried
  // extra context (loser.path is a strict prefix of winner's path).
  function upgradeWinner(winner: Entry, loser: Entry): void {
    const loserPath = "path" in loser.label ? loser.label.path : loser.label.fileId;
    const winnerPath = "path" in winner.label ? winner.label.path : winner.label.fileId;
    if (winnerPath.length <= loserPath.length) return;
    if (!winnerPath.startsWith(loserPath + "/")) return;
    if (winner.label.text === winnerPath) return; // already full path
    if ("path" in winner.label) {
      winner.label.text = winnerPath;
      winner.label.clamped = true; // triggers --clamped CSS weight
    } else {
      winner.label.text = winnerPath;
    }
  }

  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    if (a.label.hidden) continue;
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j];
      if (b.label.hidden) continue;
      if (!overlaps(a.label, b.label)) continue;
      let loser: Entry;
      let winner: Entry;
      if (a.label.depth < b.label.depth) { loser = a; winner = b; }
      else if (b.label.depth < a.label.depth) { loser = b; winner = a; }
      else if (a.isFile) { loser = b; winner = a; } // equal depth → keep file
      else { loser = a; winner = b; }
      loser.label.hidden = true;
      upgradeWinner(winner, loser);
      if (loser === a) break;
    }
  }

  return { folders, files };
}
