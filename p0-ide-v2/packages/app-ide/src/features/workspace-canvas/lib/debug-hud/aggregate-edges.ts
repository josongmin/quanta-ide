// ------------
// Pure edge-aggregation helpers for the scene debug HUD: counts edges by
// layer/kind, exposes per-kind color + label lookup, and the scene-coverage
// percentage. No React, no store, no window access.
// ------------

import { deriveEdgeLayer } from "@quanta/canvas-engine";
import { KIND_STYLE, LAYER_STYLE } from "@quanta/canvas-pixi";
import {
  ALL_EDGE_KINDS,
  type EdgeKind,
  type EdgeLayer,
} from "../../store/render-settings-store";

// Short labels that fit in a debug chip without truncating the kind's
// meaning past the point of recognition. `taint-propagation` → `taint`
// is the only lossy shortening; everything else is just compact.
export const KIND_LABEL: Record<EdgeKind, string> = {
  import: "import", call: "call", reference: "ref", cfg: "cfg", inheritance: "inherit",
  "test-covers": "test-cov", clone: "clone",
  dataflow: "dataflow", effect: "effect", pdg: "pdg", alias: "alias",
  "feature-flag": "flag",
  "taint-propagation": "taint", sanitizer: "sanitize", race: "race", cycle: "cycle", finding: "finding",
  contract: "contract", "dead-edge": "dead", "runtime-divergence": "divergence",
  blast: "blast", impact: "impact", diff: "diff", dependency: "dep", witness: "witness",
  cochange: "cochange", "rename-pair": "rename", "supply-chain": "supply",
};

export const KINDS_BY_LAYER: Record<EdgeLayer, readonly EdgeKind[]> = {
  structural: ALL_EDGE_KINDS.filter(k => deriveEdgeLayer(k) === "structural"),
  flow: ALL_EDGE_KINDS.filter(k => deriveEdgeLayer(k) === "flow"),
  safety: ALL_EDGE_KINDS.filter(k => deriveEdgeLayer(k) === "safety"),
  impact: ALL_EDGE_KINDS.filter(k => deriveEdgeLayer(k) === "impact"),
};

export function kindColorHex(kind: EdgeKind): string {
  const style = KIND_STYLE[kind] ?? LAYER_STYLE[deriveEdgeLayer(kind)];
  return "#" + style.color.toString(16).padStart(6, "0");
}

export function scenePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export type LayerBreakdown = Record<
  EdgeLayer,
  { total: number; byKind: Record<string, number> }
>;

export function emptyLayerBreakdown(): LayerBreakdown {
  return {
    structural: { total: 0, byKind: {} },
    flow: { total: 0, byKind: {} },
    safety: { total: 0, byKind: {} },
    impact: { total: 0, byKind: {} },
  };
}

export function countByLayer(
  edges: readonly { kind: string; layer?: EdgeLayer }[],
): LayerBreakdown {
  const out = emptyLayerBreakdown();
  for (const e of edges) {
    // Fallback: if an older edge somehow lacks layer, skip the layer bucket.
    const layer = e.layer;
    if (!layer) continue;
    const bucket = out[layer];
    bucket.total += 1;
    bucket.byKind[e.kind] = (bucket.byKind[e.kind] ?? 0) + 1;
  }
  return out;
}
