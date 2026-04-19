// ------------
// Pure derivations used by the filter DSL / NL filter input: turns the
// workspace graph + edge-layer toggles into the lookup arrays the filter
// surface needs (enabled layers, present edge kinds, file-id list). No
// React, no store reads — callers wrap these in useMemo.
// ------------

import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { EdgeLayer } from "../../store/render-settings-store";

export function deriveEnabledLayers(
  edgeLayers: Record<EdgeLayer, boolean>,
): EdgeLayer[] {
  return (Object.entries(edgeLayers) as [EdgeLayer, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);
}

export function collectEdgeKindValues(
  graph: WorkspaceGraph | null,
): string[] {
  const set = new Set<string>();
  for (const e of graph?.fileEdges ?? []) set.add(e.kind);
  return [...set];
}

export function collectFileIds(
  graph: WorkspaceGraph | null,
): string[] {
  return (graph?.files ?? []).map(f => f.id);
}
