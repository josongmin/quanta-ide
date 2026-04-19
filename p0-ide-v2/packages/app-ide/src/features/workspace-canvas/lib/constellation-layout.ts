import type {
  ArchLayer,
  FileNode,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import { detectArchViolations } from "@quanta/canvas-engine";

// Constellation layout (R1)
// -------------------------------------------------------------------
// Figma-style lane layout for the Constellation zoom level: files are
// grouped into horizontal lanes by architectural layer, packed inside
// their lane by centrality (highest degree → leftmost slot), and the
// cross-lane edges that *violate* the dependency rules are surfaced
// as red arcs. Everything here is pure — the React component turns
// the output into SVG.
//
// Why this scope:
//   * `FileNode.layer` already carries `ArchLayer`, and
//     `detectArchViolations` already knows the rule table.
//   * Putting lane math in a pure module keeps the component
//     renderable on any graph snapshot (historical / filtered) without
//     state coupling.
//
// Lane ordering: top to bottom reflects the "outside-in" view —
// `ui`/`adapter` at the top (external surface), `domain` in the
// middle (core rules), `infra` below it (concrete boundaries),
// `util` at the bottom. `unknown` is appended so files that the
// analyzer couldn't classify aren't hidden.

export const LANE_ORDER: readonly ArchLayer[] = [
  "ui",
  "adapter",
  "domain",
  "infra",
  "util",
  "unknown",
] as const;

export const LANE_COLOR: Record<ArchLayer, string> = {
  ui:      "#d97706",
  adapter: "#4f46e5",
  domain:  "#db2777",
  infra:   "#16a34a",
  util:    "#6b7280",
  unknown: "#475569",
};

export interface ConstellationFileSlot {
  fileId: string;
  name: string;
  layer: ArchLayer;
  /** Horizontal slot index within lane (0..count-1). */
  slot: number;
  /** Width-relative position (0..1). */
  x: number;
  /** Degree used for ordering. */
  degree: number;
  riskScore: number;
  /** True when this file owns at least one outgoing violation edge. */
  hasViolation: boolean;
}

export interface ConstellationLane {
  layer: ArchLayer;
  count: number;
  /** Violations with `from` in this lane. */
  outboundViolations: number;
  /** Total outbound arch edges (structural import/call/reference). */
  outboundTotal: number;
  files: readonly ConstellationFileSlot[];
}

export interface ConstellationEdge {
  id: string;
  from: string;
  to: string;
  fromLayer: ArchLayer;
  toLayer: ArchLayer;
  kind: string;
  violating: boolean;
}

export interface ConstellationLayout {
  lanes: readonly ConstellationLane[];
  edges: readonly ConstellationEdge[];
  /** Total violation count across the graph. */
  violationCount: number;
  /** (from→to) → count for the violation summary pill row. */
  byPair: ReadonlyMap<string, number>;
}

/**
 * Compute a lane layout from the current graph. `maxPerLane` caps how
 * many files we plot per lane so extremely dense layers (usually util)
 * don't drown the viz. Over-cap files are not returned — the lane
 * header advertises the raw count so users can tell there's more.
 */
export function computeConstellationLayout(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges">,
  opts: { maxPerLane?: number } = {},
): ConstellationLayout {
  const maxPerLane = Math.max(4, opts.maxPerLane ?? 16);

  // Degree map — undirected.
  const degree = new Map<string, number>();
  for (const e of graph.fileEdges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  const arch = detectArchViolations(graph);
  const violatingFrom = new Set<string>();
  for (const e of graph.fileEdges) {
    if (arch.violatingEdgeIds.has(e.id)) violatingFrom.add(e.from);
  }

  // Group files by layer, ordered by degree descending. Deterministic
  // tiebreak on id so the layout doesn't jitter across identical graphs.
  const byLayer = new Map<ArchLayer, FileNode[]>();
  for (const f of graph.files) {
    const arr = byLayer.get(f.layer) ?? [];
    arr.push(f);
    byLayer.set(f.layer, arr);
  }

  const laneOutbound = new Map<ArchLayer, { total: number; violating: number }>();
  for (const layer of LANE_ORDER) {
    laneOutbound.set(layer, { total: 0, violating: 0 });
  }
  const ARCH_KINDS = new Set(["import", "call", "reference"]);
  const fileById = new Map(graph.files.map(f => [f.id, f] as const));
  for (const e of graph.fileEdges) {
    if (!ARCH_KINDS.has(e.kind)) continue;
    const from = fileById.get(e.from);
    if (!from) continue;
    const bucket = laneOutbound.get(from.layer);
    if (!bucket) continue;
    bucket.total += 1;
    if (arch.violatingEdgeIds.has(e.id)) bucket.violating += 1;
  }

  const lanes: ConstellationLane[] = LANE_ORDER.map(layer => {
    const files = byLayer.get(layer) ?? [];
    files.sort((a, b) => {
      const da = degree.get(a.id) ?? 0;
      const db = degree.get(b.id) ?? 0;
      if (db !== da) return db - da;
      return a.id < b.id ? -1 : 1;
    });
    const visible = files.slice(0, maxPerLane);
    const denom = Math.max(1, visible.length - 1);
    const slots: ConstellationFileSlot[] = visible.map((f, i) => ({
      fileId: f.id,
      name: f.name,
      layer: f.layer,
      slot: i,
      x: visible.length <= 1 ? 0.5 : i / denom,
      degree: degree.get(f.id) ?? 0,
      riskScore: f.riskScore,
      hasViolation: violatingFrom.has(f.id),
    }));
    const bucket = laneOutbound.get(layer) ?? { total: 0, violating: 0 };
    return {
      layer,
      count: files.length,
      outboundTotal: bucket.total,
      outboundViolations: bucket.violating,
      files: slots,
    };
  });

  // Only render edges whose BOTH endpoints are visible. Keeps the arc
  // layer bounded — a monorepo with 500 util files would otherwise
  // push 1000+ arcs per frame which won't read anyway.
  const visibleIds = new Set<string>();
  for (const lane of lanes) for (const slot of lane.files) visibleIds.add(slot.fileId);

  const edges: ConstellationEdge[] = [];
  for (const e of graph.fileEdges) {
    if (!ARCH_KINDS.has(e.kind)) continue;
    if (!visibleIds.has(e.from) || !visibleIds.has(e.to)) continue;
    const from = fileById.get(e.from);
    const to = fileById.get(e.to);
    if (!from || !to) continue;
    if (from.layer === to.layer) continue; // same-lane edges skipped
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      fromLayer: from.layer,
      toLayer: to.layer,
      kind: e.kind,
      violating: arch.violatingEdgeIds.has(e.id),
    });
  }

  return {
    lanes,
    edges,
    violationCount: arch.violatingEdgeIds.size,
    byPair: arch.byPair,
  };
}
