import type { FileNode, Rect } from "./types";

// Folder hierarchy tree extracted from FileNode path ids (e.g. `src/a/b.ts`).
//
// Used by Hierarchical Edge Bundling (Holten 2006): each file lives in a leaf
// folder; two files share an LCA (least common ancestor) that determines the
// control path through which their edge is routed. Routing edges through a
// shared ancestor — instead of drawing straight chord-like lines — makes the
// bundle structure pop out visually.
//
// Design notes:
//   - Root is synthetic, path = "" so all files share at least the root.
//   - Each intermediate folder node is keyed by its full slash-joined prefix
//     (e.g. `src`, `src/features`, `src/features/canvas`) for O(1) LCA
//     lookups during path assembly.
//   - `center` is nullable here and populated by the layout/HEB step once
//     fileRects are available. Keeping it optional means the same tree can
//     be reused across layout passes with only center values refreshed.

export interface FolderNode {
  /** Full folder path relative to the repo root. "" is the synthetic root. */
  path: string;
  /** Parent reference; undefined for the root. */
  parent?: FolderNode;
  /** Ordered children — deterministic, sorted by path segment. */
  children: FolderNode[];
  /** File ids whose immediate parent folder is this node. */
  fileIds: string[];
  /** Geometry center — bbox center of descendant fileRects. Populated by
   *  `fillFolderCenters`; remains undefined until then. */
  center?: { x: number; y: number };
  /** Depth from the root; root is 0. Useful for tension weighting. */
  depth: number;
}

export interface FolderTree {
  root: FolderNode;
  /** Flat path→node index for O(1) lookups. Includes root at path "". */
  byPath: Map<string, FolderNode>;
  /** FileId → its immediate-parent folder. Empty-string for root-level files. */
  fileFolder: Map<string, FolderNode>;
}

/**
 * Build a folder tree from a list of files. Pure — no layout dependency.
 *
 * Time: O(total path segments). For 2k files × avg 6-segment path ≈ 12k
 * string walks; well under 1ms on modern hardware.
 */
export function buildFolderTree(files: readonly FileNode[]): FolderTree {
  const root: FolderNode = {
    path: "",
    children: [],
    fileIds: [],
    depth: 0,
  };
  const byPath = new Map<string, FolderNode>();
  byPath.set("", root);
  const fileFolder = new Map<string, FolderNode>();

  for (const file of files) {
    const id = file.id;
    const lastSlash = id.lastIndexOf("/");
    if (lastSlash < 0) {
      // File at repo root. It sits directly under the synthetic root node.
      root.fileIds.push(id);
      fileFolder.set(id, root);
      continue;
    }
    const dir = id.slice(0, lastSlash);
    const segments = dir.split("/");

    let cursor = root;
    let accum = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      accum = accum.length === 0 ? seg : `${accum}/${seg}`;
      let child = byPath.get(accum);
      if (!child) {
        child = {
          path: accum,
          parent: cursor,
          children: [],
          fileIds: [],
          depth: cursor.depth + 1,
        };
        byPath.set(accum, child);
        cursor.children.push(child);
      }
      cursor = child;
    }
    cursor.fileIds.push(id);
    fileFolder.set(id, cursor);
  }

  // Sort children for deterministic traversal (hash-map order is insertion
  // order in JS, which leaks input ordering to the renderer).
  for (const node of byPath.values()) {
    if (node.children.length > 1) {
      node.children.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    }
  }

  return { root, byPath, fileFolder };
}

/**
 * Populate `center` on every folder node using the supplied file rects.
 * Bottom-up: leaf folders = bbox center of contained files; interior folders
 * = bbox center unifying child-folder bboxes and contained files.
 *
 * Folders with zero descendant rects receive no center and remain undefined —
 * the HEB bundler skips them rather than emit a NaN.
 */
export function fillFolderCenters(
  tree: FolderTree,
  fileRects: Map<string, Rect>,
): void {
  // DFS post-order — children first so parents can reuse their bboxes.
  // Iterative to avoid stack overflow on deep monorepos.
  const stack: Array<{ node: FolderNode; visited: boolean }> = [
    { node: tree.root, visited: false },
  ];
  // bbox per folder: [minX, minY, maxX, maxY]
  const bboxes = new Map<string, [number, number, number, number]>();

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    if (!frame.visited) {
      frame.visited = true;
      for (const child of frame.node.children) {
        stack.push({ node: child, visited: false });
      }
      continue;
    }
    stack.pop();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasContent = false;

    for (const fid of frame.node.fileIds) {
      const r = fileRects.get(fid);
      if (!r) continue;
      hasContent = true;
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
    }

    for (const child of frame.node.children) {
      const cb = bboxes.get(child.path);
      if (!cb) continue;
      hasContent = true;
      if (cb[0] < minX) minX = cb[0];
      if (cb[1] < minY) minY = cb[1];
      if (cb[2] > maxX) maxX = cb[2];
      if (cb[3] > maxY) maxY = cb[3];
    }

    if (hasContent) {
      bboxes.set(frame.node.path, [minX, minY, maxX, maxY]);
      frame.node.center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    } else {
      frame.node.center = undefined;
    }
  }
}

/**
 * Walk from a leaf folder up to (and including) the tree root, returning the
 * ancestor chain in root-first order.
 *
 * Example: `src/features/canvas` → [root, src, src/features, src/features/canvas]
 */
export function ancestorsFromRoot(node: FolderNode): FolderNode[] {
  const chain: FolderNode[] = [];
  let cursor: FolderNode | undefined = node;
  while (cursor) {
    chain.push(cursor);
    cursor = cursor.parent;
  }
  chain.reverse();
  return chain;
}

/**
 * Least Common Ancestor of two folder nodes. Returns the root when the two
 * ancestor chains diverge at the top. O(depth) — not O(depth^2) — because we
 * compare the chains once left-to-right.
 */
export function lcaOf(a: FolderNode, b: FolderNode): FolderNode {
  const ca = ancestorsFromRoot(a);
  const cb = ancestorsFromRoot(b);
  let i = 0;
  const min = ca.length < cb.length ? ca.length : cb.length;
  let lca = ca[0]!; // both chains start at the same root
  while (i < min && ca[i] === cb[i]) {
    lca = ca[i]!;
    i++;
  }
  return lca;
}
