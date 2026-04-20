import type { EntitySignals, EntityTree } from "@quanta/canvas-engine";
import type { FileNode, WorkspaceGraph } from "@quanta/canvas-engine";
import { LAYER_COLOR, riskColor } from "./risk-gradient";
import type { ColorMode } from "../model/store";

// Build a per-entity fill-colour Map driven by the active colour mode.
// Returned as a `ReadonlyMap<string, number>` of Pixi hex ints so the
// scene can look up `fill = map.get(id) ?? palette[kind].fill` without
// branching on mode inside the draw loop.
//
// `heat` mode mixes three signal counts into a normalised intensity
// so one kind of alert can't drown out the others: archViolations are
// usually rare but severe, dead code is common but shallow — the
// weights below roughly equalise their visual weight on a typical
// repo. Tune in situ if the empirical distribution shifts.

const HEAT_WEIGHTS = {
  archViolations: 10,
  taintCount: 2,
  deadCount: 1,
  blastCritical: 6,
  cpxMax: 0.2,
};

export function computeColorOverrides(
  mode: ColorMode,
  tree: EntityTree,
  graph: WorkspaceGraph,
  signals: ReadonlyMap<string, EntitySignals>,
): ReadonlyMap<string, number> | null {
  if (mode === "palette") return null; // scene uses its default palette
  const out = new Map<string, number>();
  switch (mode) {
    case "risk": {
      for (const entity of tree.byId.values()) {
        const s = signals.get(entity.id);
        if (!s) continue;
        out.set(entity.id, riskColor(s.riskMax));
      }
      break;
    }
    case "layer": {
      // Layer colour lives on FileNode — for aggregate entities we
      // pick the MAJORITY layer across descendants so a pkg painted
      // "domain" reads correctly even if a stray util/test file leaks
      // a different layer inside it.
      const filesById = indexFiles(graph);
      const majority = majorityLayer(tree, filesById);
      for (const entity of tree.byId.values()) {
        const layer = majority.get(entity.id) ?? "unknown";
        out.set(entity.id, LAYER_COLOR[layer] ?? LAYER_COLOR.unknown!);
      }
      break;
    }
    case "heat": {
      // Pre-compute the max combined-score across all entities so we
      // can normalise into [0, 100] for the risk gradient — reusing
      // the same ramp keeps the colour vocabulary consistent.
      let maxScore = 1;
      const scored = new Map<string, number>();
      for (const entity of tree.byId.values()) {
        const s = signals.get(entity.id);
        if (!s) continue;
        const score =
          s.archViolations * HEAT_WEIGHTS.archViolations +
          s.taintCount * HEAT_WEIGHTS.taintCount +
          s.deadCount * HEAT_WEIGHTS.deadCount +
          s.blastCritical * HEAT_WEIGHTS.blastCritical +
          s.cpxMax * HEAT_WEIGHTS.cpxMax;
        scored.set(entity.id, score);
        if (score > maxScore) maxScore = score;
      }
      for (const [id, score] of scored) {
        const normalised = (score / maxScore) * 100;
        out.set(id, riskColor(normalised));
      }
      break;
    }
  }
  return out;
}

function indexFiles(graph: WorkspaceGraph): Map<string, FileNode> {
  const m = new Map<string, FileNode>();
  for (const f of graph.files) m.set(f.id, f);
  return m;
}

function majorityLayer(
  tree: EntityTree,
  filesById: Map<string, FileNode>,
): Map<string, string> {
  const out = new Map<string, string>();
  // Post-order: each entity inherits the most common layer across
  // its descendant FileNodes.
  visit(tree.rootId);
  return out;

  function visit(id: string): Map<string, number> {
    const entity = tree.byId.get(id);
    if (!entity) return new Map();
    const counts = new Map<string, number>();
    if (entity.childIds.length === 0) {
      const f = filesById.get(entity.id);
      if (f) counts.set(f.layer, 1);
      out.set(id, pickMajority(counts));
      return counts;
    }
    for (const cid of entity.childIds) {
      const sub = visit(cid);
      for (const [k, v] of sub) counts.set(k, (counts.get(k) ?? 0) + v);
    }
    out.set(id, pickMajority(counts));
    return counts;
  }
}

function pickMajority(counts: Map<string, number>): string {
  let best = "unknown";
  let bestN = -1;
  for (const [k, v] of counts) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}
