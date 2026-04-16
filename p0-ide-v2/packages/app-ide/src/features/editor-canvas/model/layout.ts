import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ClassGroup,
  ExternalFileGroup,
  ExternalNode,
  FileGroup,
  TaintChain,
} from "@quanta/app-ide/entities/canvas";

// ── Layout constants ────────────────────────────────────────────────
const NODE_W = 224;
const NODE_H = 68;
const METHOD_W = 210;
const METHOD_H = 64;
const METHOD_H_GAP = 16;
const METHOD_V_GAP = 20;
// Header area = glyph row(~32) + metrics(~22) + tags(~26) + bottom gap(~12) = ~92
const CLASS_HEADER_H = 92;
const CLASS_PAD_X = 18;
const CLASS_PAD_Y = 16;
const CLASS_MIN_W = 280;
const FILE_PAD_X = 32;
const FILE_PAD_Y = 28;
const FILE_HEADER_H = 44;
const INT_H_GAP = 36;
const INT_V_GAP = 64;
const EXT_W = 180;
const EXT_H = 56;
const EXT_NODE_H = 40;
const EXT_V_GAP = 16;
const COL_GAP = 140;
const CANVAS_PAD = 56;

// ── Taint chain layout constants ────────────────────────────────────
const CHAIN_NODE_W = 180;
const CHAIN_ENDPOINT_H = 52;
const CHAIN_BUNDLE_H = 44;
const CHAIN_GAP = 40;
const CHAIN_TRACK_GAP = 24;
const CHAIN_TOP_GAP = 48;

// ── External file group constants ───────────────────────────────────
const EXT_GROUP_HEADER_H = 28;
const EXT_GROUP_PAD_X = 10;
const EXT_GROUP_PAD_Y = 8;
const EXT_NODE_IN_GROUP_GAP = 6;

// ── Block abstraction for rank-based layout ─────────────────────────
interface LayoutBlock {
  id: string;
  kind: "class" | "standalone";
  w: number;
  h: number;
  x: number;
  y: number;
  /** Index into classGroups or standaloneNodes */
  ref: number;
}

/**
 * Calculate the rendered height of a node based on its content.
 * Must match the actual CSS rendering heights.
 */
function calcNodeHeight(node: CanvasNode): number {
  let h = 52; // base: head(28) + metrics(18) + bottom padding(6)

  // Count tags that will render
  let tagCount = 0;
  if (node.fn.taint === "sink" || node.fn.taint === "source") tagCount++;
  if (node.enrichment?.heat && (node.enrichment.heat.level === "hot" || node.enrichment.heat.level === "warm")) tagCount++;
  if (node.enrichment?.incidentMatch) tagCount++;
  if (node.enrichment?.hasBehaviorChange) tagCount++;

  if (tagCount > 0) {
    // Tags row: ~22px per row, ~3 tags fit per row in a 210px node
    const tagRows = Math.ceil(tagCount / 3);
    h += 4 + tagRows * 22;
  }

  // Hot path footer
  if (node.enrichment?.hotPath) h += 22;

  return h;
}

/**
 * 3-column canvas layout engine with class containment.
 *
 * [Left externals] -> [File group with classes + standalone nodes] -> [Right externals]
 *
 * 1. Layout methods inside each ClassGroup (2-column grid)
 * 2. Rank blocks (class groups + standalone nodes) via edge relaxation
 * 3. Position blocks centered horizontally per rank row
 * 4. Offset to absolute positions (file interior -> class interior -> methods)
 * 5. Position external nodes aligned with their connected internals
 * 6. Compute total canvas size
 */
export function layoutGraph(
  file: { name: string; riskScore: number; loc: number; owner: string },
  classGroups: ClassGroup[],
  standaloneFns: CanvasNode[],
  externalNodes: ExternalNode[],
  edges: CanvasEdge[],
  taintChains: TaintChain[],
): CanvasGraph {
  // ── 1. Layout methods inside each ClassGroup ────────────────────────
  for (const cls of classGroups) {
    const count = cls.methods.length;
    const methodsPerRow = Math.min(count, 2);

    // Calculate each method's actual height
    for (const m of cls.methods) {
      m.w = METHOD_W;
      m.h = calcNodeHeight(m);
    }

    // 2-column layout with variable row heights
    const rows = Math.ceil(count / 2);
    let contentH = 0;

    for (let row = 0; row < rows; row++) {
      const leftIdx = row * 2;
      const rightIdx = row * 2 + 1;
      const left = cls.methods[leftIdx];
      const right = rightIdx < count ? cls.methods[rightIdx] : undefined;
      const rowH = Math.max(left.h, right?.h ?? 0);

      left.x = CLASS_PAD_X;
      left.y = CLASS_HEADER_H + CLASS_PAD_Y + contentH;

      if (right) {
        right.x = CLASS_PAD_X + METHOD_W + METHOD_H_GAP;
        right.y = CLASS_HEADER_H + CLASS_PAD_Y + contentH;
      }

      contentH += rowH;
      if (row < rows - 1) contentH += METHOD_V_GAP;
    }

    const contentW = methodsPerRow * METHOD_W + (methodsPerRow - 1) * METHOD_H_GAP;
    cls.w = Math.max(contentW + CLASS_PAD_X * 2, CLASS_MIN_W);
    cls.h = CLASS_HEADER_H + CLASS_PAD_Y + contentH + CLASS_PAD_Y;
  }

  // ── 2. Build blocks for rank-based layout ───────────────────────────
  const blocks: LayoutBlock[] = [];

  for (let i = 0; i < classGroups.length; i++) {
    blocks.push({
      id: classGroups[i].id,
      kind: "class",
      w: classGroups[i].w,
      h: classGroups[i].h,
      x: 0,
      y: 0,
      ref: i,
    });
  }

  for (let i = 0; i < standaloneFns.length; i++) {
    standaloneFns[i].w = NODE_W;
    standaloneFns[i].h = calcNodeHeight(standaloneFns[i]);
    blocks.push({
      id: standaloneFns[i].id,
      kind: "standalone",
      w: NODE_W,
      h: standaloneFns[i].h,
      x: 0,
      y: 0,
      ref: i,
    });
  }

  // Build a set of all block IDs and a quick lookup for method -> class
  const blockIds = new Set(blocks.map((b) => b.id));
  const methodToClass = new Map<string, string>();
  for (const cls of classGroups) {
    for (const m of cls.methods) {
      methodToClass.set(m.id, cls.id);
    }
  }

  // ── 3. Assign ranks via relaxation ──────────────────────────────────
  // Classes at rank 0, standalone at rank 1
  const rank = new Map<string, number>();
  for (const b of blocks) {
    rank.set(b.id, b.kind === "class" ? 0 : 1);
  }

  // Resolve edge endpoints to block IDs (methods map to their class)
  function resolveToBlock(nodeId: string): string | undefined {
    if (blockIds.has(nodeId)) return nodeId;
    return methodToClass.get(nodeId);
  }

  // Only consider edges between internal blocks for ranking
  const internalEdges: { from: string; to: string }[] = [];
  for (const e of edges) {
    const fromBlock = resolveToBlock(e.from);
    const toBlock = resolveToBlock(e.to);
    if (fromBlock && toBlock && fromBlock !== toBlock) {
      internalEdges.push({ from: fromBlock, to: toBlock });
    }
  }

  let changed = true;
  let iterations = 0;
  const maxIterations = blocks.length * internalEdges.length + 1;
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (const e of internalEdges) {
      const rFrom = rank.get(e.from)!;
      const rTo = rank.get(e.to)!;
      if (rTo < rFrom + 1) {
        rank.set(e.to, rFrom + 1);
        changed = true;
      }
    }
  }

  // ── 4. Group by rank, sort within rank by line number ───────────────
  const rankGroups = new Map<number, LayoutBlock[]>();
  for (const b of blocks) {
    const r = rank.get(b.id) ?? 0;
    const group = rankGroups.get(r);
    if (group) group.push(b);
    else rankGroups.set(r, [b]);
  }

  const sortedRanks = [...rankGroups.keys()].sort((a, b) => a - b);

  // Sort within each rank by line number of the backing FunctionHeader
  const blockLine = new Map<string, number>();
  for (const cls of classGroups) blockLine.set(cls.id, cls.fn.line);
  for (const fn of standaloneFns) blockLine.set(fn.id, fn.fn.line);

  for (const group of rankGroups.values()) {
    group.sort((a, b) => (blockLine.get(a.id) ?? 0) - (blockLine.get(b.id) ?? 0));
  }

  // ── 5. Position blocks (relative to file group interior) ────────────
  let maxRowWidth = 0;
  for (const r of sortedRanks) {
    const group = rankGroups.get(r)!;
    const rowW = group.reduce((s, b) => s + b.w, 0) + (group.length - 1) * INT_H_GAP;
    if (rowW > maxRowWidth) maxRowWidth = rowW;
  }

  // Content width with minimum
  const contentWidth = Math.max(maxRowWidth, 300);

  // Calculate total internal height (varying row heights)
  let totalInternalHeight = 0;
  for (let ri = 0; ri < sortedRanks.length; ri++) {
    const group = rankGroups.get(sortedRanks[ri])!;
    const rowH = Math.max(...group.map((b) => b.h));
    totalInternalHeight += rowH;
    if (ri > 0) totalInternalHeight += INT_V_GAP;
  }

  // Position each block relative to the interior top-left (0,0)
  let cursorY = 0;
  for (let ri = 0; ri < sortedRanks.length; ri++) {
    const group = rankGroups.get(sortedRanks[ri])!;
    const rowW = group.reduce((s, b) => s + b.w, 0) + (group.length - 1) * INT_H_GAP;
    const rowH = Math.max(...group.map((b) => b.h));
    let cursorX = (contentWidth - rowW) / 2; // center-aligned

    for (const b of group) {
      b.x = cursorX;
      b.y = cursorY;
      cursorX += b.w + INT_H_GAP;
    }

    cursorY += rowH + INT_V_GAP;
  }

  // ── 6. Position taint chains INSIDE the file group (below methods) ──
  let chainsSectionH = 0;
  // Chain node positions are relative to file interior — will be offset to absolute later
  const chainRelativeY = totalInternalHeight + (taintChains.length > 0 ? CHAIN_TOP_GAP : 0);

  {
    let cy = chainRelativeY;
    for (const chain of taintChains) {
      chain.y = cy; // relative to file interior, will be offset later

      let cx = 0; // relative to file interior
      for (const cn of chain.nodes) {
        cn.w = CHAIN_NODE_W;
        cn.h = cn.kind === "bundle" ? CHAIN_BUNDLE_H : CHAIN_ENDPOINT_H;
        cn.x = cx;
        cn.y = cy;
        cx += cn.w + CHAIN_GAP;
      }

      const trackH = Math.max(CHAIN_ENDPOINT_H, CHAIN_BUNDLE_H);
      cy += trackH + CHAIN_TRACK_GAP;
    }
    if (taintChains.length > 0) {
      chainsSectionH = cy - chainRelativeY;
    }
  }

  // Ensure file group width accommodates chains
  let chainsMaxW = 0;
  for (const chain of taintChains) {
    const last = chain.nodes[chain.nodes.length - 1];
    if (last) {
      const w = last.x + last.w;
      if (w > chainsMaxW) chainsMaxW = w;
    }
  }

  const fileContentW = Math.max(contentWidth, chainsMaxW);

  // ── 7. Size file group ──────────────────────────────────────────────
  const fileGroup: FileGroup = {
    name: file.name,
    riskScore: file.riskScore,
    loc: file.loc,
    owner: file.owner,
    x: 0,
    y: CANVAS_PAD,
    w: fileContentW + FILE_PAD_X * 2,
    h: FILE_HEADER_H + FILE_PAD_Y + totalInternalHeight + (chainsSectionH > 0 ? CHAIN_TOP_GAP + chainsSectionH : 0) + FILE_PAD_Y,
  };

  // ── 8. Partition external nodes ─────────────────────────────────────
  const leftExternals = externalNodes.filter((e) => e.side === "left");
  const rightExternals = externalNodes.filter((e) => e.side === "right");

  // ── 9. File group X position ────────────────────────────────────────
  const hasLeft = leftExternals.length > 0;
  fileGroup.x = hasLeft ? CANVAS_PAD + EXT_W + COL_GAP : CANVAS_PAD;

  // ── 10. Offset to absolute positions ────────────────────────────────
  const interiorX = fileGroup.x + FILE_PAD_X;
  const interiorY = fileGroup.y + FILE_HEADER_H + FILE_PAD_Y;

  // Collect all internal nodes for external alignment
  const allInternalNodes: CanvasNode[] = [];

  for (const b of blocks) {
    if (b.kind === "class") {
      const cls = classGroups[b.ref];
      cls.x = b.x + interiorX;
      cls.y = b.y + interiorY;

      // Methods keep relative positions (relative to class container).
      // Push absolute-position proxies for external alignment only.
      for (const m of cls.methods) {
        allInternalNodes.push({
          ...m,
          x: m.x + cls.x,
          y: m.y + cls.y,
        });
      }
    } else {
      const node = standaloneFns[b.ref];
      node.x = b.x + interiorX;
      node.y = b.y + interiorY;
      allInternalNodes.push(node);
    }
  }

  // Offset taint chain nodes to absolute positions
  for (const chain of taintChains) {
    chain.y += interiorY;
    for (const cn of chain.nodes) {
      cn.x += interiorX;
      cn.y += interiorY;
    }
  }

  // ── 11. Position external nodes (grouped by file) ───────────────────
  const externalFileGroups: ExternalFileGroup[] = [];

  positionExternals(leftExternals, "left", CANVAS_PAD, allInternalNodes, externalFileGroups);
  positionExternals(
    rightExternals,
    "right",
    fileGroup.x + fileGroup.w + COL_GAP,
    allInternalNodes,
    externalFileGroups,
  );

  // ── 11. Compute total canvas size ───────────────────────────────────
  let maxRight = fileGroup.x + fileGroup.w;
  let maxBottom = fileGroup.y + fileGroup.h;

  for (const ext of externalNodes) {
    const right = ext.x + ext.w;
    const bottom = ext.y + ext.h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  for (const grp of externalFileGroups) {
    const right = grp.x + grp.w;
    const bottom = grp.y + grp.h;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  for (const n of allInternalNodes) {
    const bottom = n.y + n.h;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return {
    fileGroup,
    classGroups,
    nodes: standaloneFns,
    externalNodes,
    externalFileGroups,
    edges,
    taintChains,
    width: maxRight + CANVAS_PAD,
    height: maxBottom + CANVAS_PAD,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Item in the vertical layout list -- either a file group or a standalone node. */
interface LayoutItem {
  idealY: number;
  h: number;
  y: number;
  kind: "group" | "standalone";
  /** Index into the file group or standalone arrays for back-reference. */
  ref: number;
}

/**
 * Position a list of external nodes vertically, grouping nodes that share
 * the same file into ExternalFileGroup containers.
 *
 * Nodes without a file are positioned individually (standalone).
 */
function positionExternals(
  externals: ExternalNode[],
  side: "left" | "right",
  x: number,
  internalNodes: CanvasNode[],
  outGroups: ExternalFileGroup[],
): void {
  if (externals.length === 0) return;

  const internalById = new Map<string, CanvasNode>();
  for (const n of internalNodes) internalById.set(n.id, n);

  // ── Separate into file-grouped and standalone ─────────────────────
  const fileMap = new Map<string, ExternalNode[]>();
  const standaloneNodes: ExternalNode[] = [];

  for (const ext of externals) {
    if (ext.file) {
      const list = fileMap.get(ext.file);
      if (list) list.push(ext);
      else fileMap.set(ext.file, [ext]);
    } else {
      standaloneNodes.push(ext);
    }
  }

  // ── Build file groups ─────────────────────────────────────────────
  interface PendingGroup {
    fileName: string;
    nodes: ExternalNode[];
    h: number;
  }

  const pendingGroups: PendingGroup[] = [];

  for (const [fileName, groupNodes] of fileMap) {
    const groupH =
      EXT_GROUP_HEADER_H +
      EXT_GROUP_PAD_Y +
      groupNodes.length * EXT_NODE_H +
      (groupNodes.length - 1) * EXT_NODE_IN_GROUP_GAP +
      EXT_GROUP_PAD_Y;

    pendingGroups.push({ fileName, nodes: groupNodes, h: groupH });
  }

  // ── Compute ideal Y for each layout item ──────────────────────────
  const items: LayoutItem[] = [];

  // File groups
  for (let i = 0; i < pendingGroups.length; i++) {
    const pg = pendingGroups[i];
    const connectedCenters: number[] = [];
    for (const ext of pg.nodes) {
      for (const connId of ext.connectedTo) {
        const n = internalById.get(connId);
        if (n) connectedCenters.push(n.y + n.h / 2);
      }
    }

    let idealY: number;
    if (connectedCenters.length > 0) {
      const avgCenter =
        connectedCenters.reduce((a, b) => a + b, 0) /
        connectedCenters.length;
      idealY = avgCenter - pg.h / 2;
    } else {
      idealY = CANVAS_PAD;
    }

    items.push({ idealY, h: pg.h, y: idealY, kind: "group", ref: i });
  }

  // Standalone nodes
  for (let i = 0; i < standaloneNodes.length; i++) {
    const ext = standaloneNodes[i];
    const connectedCenters: number[] = [];
    for (const connId of ext.connectedTo) {
      const n = internalById.get(connId);
      if (n) connectedCenters.push(n.y + n.h / 2);
    }

    let idealY: number;
    if (connectedCenters.length > 0) {
      const avgCenter =
        connectedCenters.reduce((a, b) => a + b, 0) /
        connectedCenters.length;
      idealY = avgCenter - EXT_H / 2;
    } else {
      idealY = CANVAS_PAD;
    }

    items.push({ idealY, h: EXT_H, y: idealY, kind: "standalone", ref: i });
  }

  // ── Sort by ideal Y for top-down overlap resolution ───────────────
  items.sort((a, b) => a.idealY - b.idealY);

  // Ensure minimum Y is CANVAS_PAD
  if (items.length > 0 && items[0].y < CANVAS_PAD) {
    items[0].y = CANVAS_PAD;
  }

  // Resolve vertical overlaps
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const minY = prev.y + prev.h + EXT_V_GAP;
    if (items[i].y < minY) {
      items[i].y = minY;
    }
  }

  // ── Apply positions ───────────────────────────────────────────────
  for (const item of items) {
    if (item.kind === "group") {
      const pg = pendingGroups[item.ref];
      const grp: ExternalFileGroup = {
        id: `extgrp:${side}:${pg.fileName}`,
        fileName: pg.fileName,
        side,
        x,
        y: item.y,
        w: EXT_W,
        h: pg.h,
      };
      outGroups.push(grp);

      // Position individual nodes within the group
      for (let ni = 0; ni < pg.nodes.length; ni++) {
        const ext = pg.nodes[ni];
        ext.x = grp.x + EXT_GROUP_PAD_X;
        ext.y =
          grp.y +
          EXT_GROUP_HEADER_H +
          EXT_GROUP_PAD_Y +
          ni * (EXT_NODE_H + EXT_NODE_IN_GROUP_GAP);
        ext.w = EXT_W - EXT_GROUP_PAD_X * 2;
        ext.h = EXT_NODE_H;
      }
    } else {
      const ext = standaloneNodes[item.ref];
      ext.x = x;
      ext.y = item.y;
      ext.w = EXT_W;
      ext.h = EXT_H;
    }
  }
}
