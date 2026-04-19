import type { FileNode, Rect, WorkspaceLayout } from "@quanta/canvas-engine";

// Base inflation padding applied to the innermost folder wrapper. Outer
// ancestor frames step this up per depth level (see PAD_PER_DEPTH) so
// nested frames visibly stack without touching the child cards.
// PAD_PER_DEPTH must be large enough that each outer tier's label sits
// clearly above/left of the inner tier's label — otherwise sibling frame
// labels collide at the top-left corner.
const PAD_INNER = 28;
const PAD_PER_DEPTH = 56;

export interface FolderRect {
  /** Full folder path (e.g. "src/features/workspace-canvas"). */
  path: string;
  /** Inflated bounding rect enclosing every descendant file card. */
  rect: Rect;
  /** Number of descendant files measured into the rect. */
  fileCount: number;
  /** Distance from the root — 0 = top-level, 1 = second tier, etc. */
  depth: number;
  /** Distance from the deepest descendant folder — 0 = innermost wrapper,
   *  higher = outer. Drives per-tier label size / stroke intensity. */
  rdepth: number;
}

/**
 * Post-process a layout into a list of nested folder wrapper rects.
 *
 * Every ancestor directory on the file's path produces its own frame —
 * top-level package down to the innermost folder — so users can see the
 * full hierarchy, not just the leaf parent. A folder is skipped only when
 * it contains fewer than two measured files (single-file wrappers are
 * visual noise). Inflation padding grows per depth so nested frames don't
 * collide with their children.
 *
 * Sorted by depth ascending so outer (shallower) frames render first and
 * inner frames paint on top — callers that layer DOM nodes can rely on
 * natural source order.
 *
 * Pure function — layout placement is not altered; this is strictly an
 * overlay computation consumed by `FolderFrame`.
 */
export function computeFolderRects(
  files: readonly FileNode[],
  layout: WorkspaceLayout,
): FolderRect[] {
  // folderPath → list of member file ids (all descendants, not only direct
  // children — nested frames enclose every leaf under the ancestor).
  const groups = new Map<string, FileNode[]>();
  const maxDepthByPath = new Map<string, number>();

  for (const f of files) {
    // FileNode.id is the canonical file path (see canvas-engine types).
    const parts = f.id.split("/");
    parts.pop(); // drop filename
    if (parts.length === 0) continue; // root file — no folder to frame

    // Enroll the file into every ancestor folder, from top-level down.
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      let list = groups.get(folder);
      if (!list) {
        list = [];
        groups.set(folder, list);
      }
      list.push(f);
      const depth = parts.length - 1; // this file's innermost folder depth
      const prev = maxDepthByPath.get(folder);
      if (prev === undefined || depth > prev) maxDepthByPath.set(folder, depth);
    }
  }

  const out: FolderRect[] = [];
  for (const [folder, members] of groups) {
    if (members.length < 2) continue; // solo file — skip framing
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (const f of members) {
      const r = layout.fileRects.get(f.id);
      if (!r) continue;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
      count++;
    }
    if (count < 2) continue;

    const depth = folder.split("/").length - 1;
    const deepest = maxDepthByPath.get(folder) ?? depth;
    const rdepth = deepest - depth; // 0 = innermost wrapper
    const pad = PAD_INNER + rdepth * PAD_PER_DEPTH;

    out.push({
      path: folder,
      depth,
      rdepth,
      rect: {
        x: minX - pad,
        y: minY - pad,
        w: maxX - minX + pad * 2,
        h: maxY - minY + pad * 2,
      },
      fileCount: count,
    });
  }

  // Outer frames first so inner frames paint on top in natural DOM order.
  out.sort((a, b) => a.depth - b.depth);
  return out;
}
