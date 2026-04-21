import { detectArchViolations } from "@quanta/canvas-engine";
import type { ArchLayer } from "@quanta/canvas-engine";
import type {
  ArchLayerNode,
  ArchFlowEdge,
  ArchLayerLayout,
  BuildArchLayerLayoutOpts,
} from "./types";

// ── Layer palette (fixed — never hashed) ────────────────────────────
const LAYER_COLORS: Record<ArchLayer, string> = {
  domain:  "#6366f1",
  adapter: "#06b6d4",
  infra:   "#f59e0b",
  ui:      "#10b981",
  util:    "#8b5cf6",
  unknown: "#94a3b8",
};

// ── Column ordering (lower/more fundamental layers on the left) ──────
const COLUMN_ORDER: ArchLayer[] = ["util", "domain", "adapter", "infra", "ui", "unknown"];

const LAYER_LABELS: Record<ArchLayer, string> = {
  domain:  "domain",
  adapter: "adapter",
  infra:   "infra",
  ui:      "ui",
  util:    "util",
  unknown: "unknown",
};

const ARCH_KINDS = new Set(["import", "call", "reference"]);
const COLUMN_WIDTH = 28;

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value));
}

interface LayerStats {
  fileCount: number;
  totalLoc: number;
  outboundEdgeCount: number;
  inboundEdgeCount: number;
}

interface LayerPairAccum {
  edgeCount: number;
  weight: number;
}

/**
 * Allocates Y-slots within a column for Sankey ribbons.
 * Tracks how much space has been used on each side (outbound = right, inbound = left)
 * so ribbons are stacked vertically within the column height.
 */
class SlotAllocator {
  private usedLeft = 0;
  private usedRight = 0;

  constructor(
    private readonly centerY: number,
    private readonly nodeHeight: number,
  ) {}

  /** Allocate a slot on the outbound (right) side. Returns ribbon center Y. */
  allocateRight(thickness: number): number {
    const start = this.centerY - this.nodeHeight / 2 + this.usedRight;
    const center = start + thickness / 2;
    this.usedRight += thickness;
    return center;
  }

  /** Allocate a slot on the inbound (left) side. Returns ribbon center Y. */
  allocateLeft(thickness: number): number {
    const start = this.centerY - this.nodeHeight / 2 + this.usedLeft;
    const center = start + thickness / 2;
    this.usedLeft += thickness;
    return center;
  }
}

export function buildArchLayerLayout({
  graph,
  width,
  height,
}: BuildArchLayerLayoutOpts): ArchLayerLayout {
  // ── 1. Compute per-layer stats ─────────────────────────────────────
  const statsMap = new Map<ArchLayer, LayerStats>();

  for (const file of graph.files) {
    const layer = file.layer;
    if (!statsMap.has(layer)) {
      statsMap.set(layer, { fileCount: 0, totalLoc: 0, outboundEdgeCount: 0, inboundEdgeCount: 0 });
    }
    const s = statsMap.get(layer)!;
    s.fileCount += 1;
    s.totalLoc += file.loc;
  }

  // ── 2. Aggregate structural edges by layer pair ────────────────────
  const fileLayerOf = new Map<string, ArchLayer>();
  for (const file of graph.files) fileLayerOf.set(file.id, file.layer);

  const pairAccum = new Map<string, LayerPairAccum>();

  for (const edge of graph.fileEdges) {
    if (!ARCH_KINDS.has(edge.kind)) continue;
    const fromLayer = fileLayerOf.get(edge.from);
    const toLayer = fileLayerOf.get(edge.to);
    if (!fromLayer || !toLayer) continue;
    // Skip same-layer edges
    if (fromLayer === toLayer) continue;

    const key = `${fromLayer}→${toLayer}`;
    if (!pairAccum.has(key)) {
      pairAccum.set(key, { edgeCount: 0, weight: 0 });
    }
    const acc = pairAccum.get(key)!;
    acc.edgeCount += 1;
    acc.weight += edge.weight;

    // Accumulate directional edge counts on layer stats
    const fromStats = statsMap.get(fromLayer);
    if (fromStats) fromStats.outboundEdgeCount += 1;
    const toStats = statsMap.get(toLayer);
    if (toStats) toStats.inboundEdgeCount += 1;
  }

  // ── 3. Detect violations ──────────────────────────────────────────
  const violations = detectArchViolations(graph);

  // ── 4. Determine which layers are visible ─────────────────────────
  const visibleLayers = COLUMN_ORDER.filter(l => statsMap.has(l));

  if (visibleLayers.length === 0) {
    return { nodes: [], edges: [], totalViolations: 0, totalAllowed: 0, violatingPairs: [] };
  }

  // ── 5. Column layout ──────────────────────────────────────────────
  const colSpacing = width / (visibleLayers.length + 1);
  const centerY = height / 2;
  const maxNodeH = height * 0.55;

  const nodesByLayer = new Map<ArchLayer, ArchLayerNode>();

  for (let i = 0; i < visibleLayers.length; i++) {
    const layer = visibleLayers[i]!;
    const stats = statsMap.get(layer)!;
    const nodeHeight = clamp(60, maxNodeH, Math.sqrt(stats.fileCount + 1) * 40);
    const x = (i + 1) * colSpacing;
    const y = centerY - nodeHeight / 2;

    const node: ArchLayerNode = {
      layer,
      label: LAYER_LABELS[layer],
      fileCount: stats.fileCount,
      totalLoc: stats.totalLoc,
      outboundEdgeCount: stats.outboundEdgeCount,
      inboundEdgeCount: stats.inboundEdgeCount,
      color: LAYER_COLORS[layer],
      x,
      y,
      width: COLUMN_WIDTH,
      height: nodeHeight,
    };
    nodesByLayer.set(layer, node);
  }

  // ── 6. Slot allocators per column ─────────────────────────────────
  const allocators = new Map<ArchLayer, SlotAllocator>();
  for (const [layer, node] of nodesByLayer) {
    allocators.set(layer, new SlotAllocator(node.y + node.height / 2, node.height));
  }

  // ── 7. Build Sankey ribbons ────────────────────────────────────────
  const flowEdges: ArchFlowEdge[] = [];
  let totalViolations = 0;
  let totalAllowed = 0;
  const violatingPairsMap = new Map<string, { fromLayer: ArchLayer; toLayer: ArchLayer; count: number }>();

  for (const [pairKey, accum] of pairAccum) {
    if (accum.edgeCount === 0) continue;

    const arrowIdx = pairKey.indexOf("→");
    const fromLayer = pairKey.slice(0, arrowIdx) as ArchLayer;
    const toLayer = pairKey.slice(arrowIdx + "→".length) as ArchLayer;

    const fromNode = nodesByLayer.get(fromLayer);
    const toNode = nodesByLayer.get(toLayer);
    if (!fromNode || !toNode) continue;

    const isViolation = (violations.byPair.get(pairKey) ?? 0) > 0;
    const category = isViolation ? "violation" : "allowed";

    if (isViolation) {
      totalViolations += accum.edgeCount;
      if (!violatingPairsMap.has(pairKey)) {
        violatingPairsMap.set(pairKey, { fromLayer, toLayer, count: accum.edgeCount });
      } else {
        violatingPairsMap.get(pairKey)!.count += accum.edgeCount;
      }
    } else {
      totalAllowed += accum.edgeCount;
    }

    const thickness = clamp(2, 20, Math.log2(accum.edgeCount + 1) * 3);

    // Determine if this is a forward (left→right) or backward (right→left) flow
    const fromColIdx = visibleLayers.indexOf(fromLayer);
    const toColIdx = visibleLayers.indexOf(toLayer);
    const isForward = fromColIdx < toColIdx;

    const fromAllocator = allocators.get(fromLayer)!;
    const toAllocator = allocators.get(toLayer)!;

    let fromX: number;
    let toX: number;
    let fromY: number;
    let toY: number;

    if (isForward) {
      // Exit right edge of fromNode, enter left edge of toNode
      fromX = fromNode.x + fromNode.width / 2;
      toX = toNode.x - toNode.width / 2;
      fromY = fromAllocator.allocateRight(thickness);
      toY = toAllocator.allocateLeft(thickness);
    } else {
      // Backwards flow: exit left edge of fromNode, enter right edge of toNode
      fromX = fromNode.x - fromNode.width / 2;
      toX = toNode.x + toNode.width / 2;
      fromY = fromAllocator.allocateLeft(thickness);
      toY = toAllocator.allocateRight(thickness);
    }

    const midX = (fromX + toX) / 2;
    const path = `M ${fromX},${fromY} C ${midX},${fromY} ${midX},${toY} ${toX},${toY}`;

    flowEdges.push({
      id: pairKey,
      fromLayer,
      toLayer,
      category,
      weight: accum.weight,
      edgeCount: accum.edgeCount,
      path,
      fromY,
      toY,
      fromThickness: thickness,
      toThickness: thickness,
    });
  }

  const violatingPairs = [...violatingPairsMap.values()].sort((a, b) => b.count - a.count);

  return {
    nodes: [...nodesByLayer.values()],
    edges: flowEdges,
    totalViolations,
    totalAllowed,
    violatingPairs,
  };
}
