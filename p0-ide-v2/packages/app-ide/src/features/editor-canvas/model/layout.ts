import type {
  CanvasEdge,
  CanvasGraph,
  ExternalFileGroup,
  ExternalNode,
  FileGroup,
  LineMarker,
} from "@quanta/app-ide/entities/canvas";

// ── Layout constants ────────────────────────────────────────────────
const LINE_H = 20;
/** Gutter width (line-number + marker area). Shared with EdgeLayer. */
export const CODE_PAD_X = 52;
const CODE_PAD_RIGHT = 16;
/** Monospace character width. Shared with EdgeLayer. */
export const CODE_FONT_W = 7.5;
const FILE_PAD_X = 20;
const FILE_PAD_Y = 16;
const FILE_HEADER_H = 44;
const INSIGHT_BAR_H = 120;
const EXT_W = 210;
const EXT_H = 56;
const EXT_NODE_H = 40;
const EXT_V_GAP = 20;
const EXT_GROUP_HEADER_H = 24;
const EXT_GROUP_PAD_X = 10;
const EXT_GROUP_PAD_Y = 8;
const EXT_NODE_IN_GROUP_GAP = 6;
const COL_GAP = 80;
const CANVAS_PAD = 48;

// ── Helpers ─────────────────────────────────────────────────────────

/** Item in the vertical layout list — either a file group or a standalone node. */
interface LayoutItem {
  idealY: number;
  h: number;
  y: number;
  kind: "group" | "standalone";
  /** Index into the pending group or standalone arrays. */
  ref: number;
}

/**
 * Position a list of external nodes vertically, grouping nodes that share
 * the same file into ExternalFileGroup containers.
 *
 * Alignment uses line-based Y positions rather than internal node centers.
 */
function positionExternals(
  externals: ExternalNode[],
  side: "left" | "right",
  x: number,
  lineY: (line: number) => number,
  edgeLineMap: Map<string, number[]>,
  outGroups: ExternalFileGroup[],
): void {
  if (externals.length === 0) return;

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

  function avgLineCenter(extNodes: ExternalNode[]): number | undefined {
    const centers: number[] = [];
    for (const ext of extNodes) {
      const lines = edgeLineMap.get(ext.id);
      if (lines) {
        for (const l of lines) centers.push(lineY(l));
      }
    }
    if (centers.length === 0) return undefined;
    return centers.reduce((a, b) => a + b, 0) / centers.length;
  }

  // File groups
  for (let i = 0; i < pendingGroups.length; i++) {
    const pg = pendingGroups[i];
    const center = avgLineCenter(pg.nodes);
    const idealY = center !== undefined ? center - pg.h / 2 : CANVAS_PAD;
    items.push({ idealY, h: pg.h, y: idealY, kind: "group", ref: i });
  }

  // Standalone nodes
  for (let i = 0; i < standaloneNodes.length; i++) {
    const ext = standaloneNodes[i];
    const lines = edgeLineMap.get(ext.id);
    let idealY: number;
    if (lines && lines.length > 0) {
      const avgCenter = lines.map(lineY).reduce((a, b) => a + b, 0) / lines.length;
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

// ── Main layout ─────────────────────────────────────────────────────

/**
 * Source-code-centric canvas layout engine.
 *
 * [Left externals] ← edges → [File group with code pane] ← edges → [Right externals]
 *
 * External nodes are aligned vertically with the code LINES they connect to
 * (determined by the edges array), not by internal graph node positions.
 */
export function layoutGraph(
  file: {
    name: string; riskScore: number; loc: number; owner: string;
    cpxMax: number; cpxBudgetPct: number; blast: number; blastCritical: number;
    taintCount: number; archViolations: number; deadCount: number;
  },
  source: string,
  lineMarkers: LineMarker[],
  externalNodes: ExternalNode[],
  edges: CanvasEdge[],
): CanvasGraph {
  // ── 1. Calculate code pane dimensions ──────────────────────────────
  const lines = source.split("\n");
  const maxLineLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
  const codeW = CODE_PAD_X + maxLineLen * CODE_FONT_W + CODE_PAD_RIGHT;
  const codeH = lines.length * LINE_H;

  // ── 2. File group wraps code pane ──────────────────────────────────
  const fileGroup: FileGroup = {
    name: file.name,
    riskScore: file.riskScore,
    loc: file.loc,
    owner: file.owner,
    cpxMax: file.cpxMax,
    cpxBudgetPct: file.cpxBudgetPct,
    blast: file.blast,
    blastCritical: file.blastCritical,
    taintCount: file.taintCount,
    archViolations: file.archViolations,
    deadCount: file.deadCount,
    x: 0,
    y: CANVAS_PAD,
    w: codeW + FILE_PAD_X * 2,
    h: FILE_HEADER_H + INSIGHT_BAR_H + FILE_PAD_Y + codeH + FILE_PAD_Y,
  };

  // ── 3. Partition external nodes ────────────────────────────────────
  const leftExternals = externalNodes.filter((e) => e.side === "left");
  const rightExternals = externalNodes.filter((e) => e.side === "right");

  // ── 4. File group X position ───────────────────────────────────────
  const hasLeft = leftExternals.length > 0;
  fileGroup.x = hasLeft ? CANVAS_PAD + EXT_W + COL_GAP : CANVAS_PAD;

  // ── 5. Code pane absolute position ─────────────────────────────────
  const codePaneX = fileGroup.x + FILE_PAD_X;
  const codePaneY = fileGroup.y + FILE_HEADER_H + INSIGHT_BAR_H + FILE_PAD_Y;

  const codePane = {
    source,
    x: codePaneX,
    y: codePaneY,
    w: codeW,
    h: codeH,
    lineHeight: LINE_H,
  };

  // ── 6. Line-to-Y mapping ──────────────────────────────────────────
  function lineY(line: number): number {
    return codePaneY + (line - 1) * LINE_H + LINE_H / 2;
  }

  // Build extNodeId → line[] map from edges
  const edgeLineMap = new Map<string, number[]>();
  for (const edge of edges) {
    const list = edgeLineMap.get(edge.extNodeId);
    if (list) {
      list.push(edge.line);
    } else {
      edgeLineMap.set(edge.extNodeId, [edge.line]);
    }
  }

  // ── 7. Position external nodes aligned with connected lines ────────
  const externalFileGroups: ExternalFileGroup[] = [];

  positionExternals(leftExternals, "left", CANVAS_PAD, lineY, edgeLineMap, externalFileGroups);
  positionExternals(
    rightExternals,
    "right",
    fileGroup.x + fileGroup.w + COL_GAP,
    lineY,
    edgeLineMap,
    externalFileGroups,
  );

  // ── 8. Compute total canvas size ───────────────────────────────────
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

  return {
    fileGroup,
    codePane,
    lineMarkers,
    externalNodes,
    externalFileGroups,
    edges,
    width: maxRight + CANVAS_PAD,
    height: maxBottom + CANVAS_PAD,
  };
}
