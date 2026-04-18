import type { WorkspaceGraph, ArchLayer } from "./types";

// Architecture dependency rules (Clean Architecture / Hexagonal):
//   domain   — depends on: util
//   adapter  — depends on: domain, util
//   infra    — depends on: domain, adapter, util
//   ui       — depends on: domain, adapter, util         (not infra)
//   util     — depends on: (nothing)
//   unknown  — no rule (treat as permissive — ambiguous layer isn't a defect).
//
// An edge is a violation when `from.layer` depends on `to.layer` against
// these rules. Structural kinds only (import / call / reference) — flow /
// safety / impact edges aren't architectural dependencies, they're
// analyzer-derived relations and don't trip arch rules.

const ALLOWED: Record<ArchLayer, ReadonlySet<ArchLayer>> = {
  domain:  new Set<ArchLayer>(["domain", "util"]),
  adapter: new Set<ArchLayer>(["adapter", "domain", "util"]),
  infra:   new Set<ArchLayer>(["infra", "domain", "adapter", "util"]),
  ui:      new Set<ArchLayer>(["ui", "domain", "adapter", "util"]),
  util:    new Set<ArchLayer>(["util"]),
  unknown: new Set<ArchLayer>(["domain", "adapter", "infra", "ui", "util", "unknown"]),
};

const ARCH_KINDS = new Set(["import", "call", "reference"]);

export interface ArchViolationsResult {
  /** Edge IDs that violate the dependency rules. */
  violatingEdgeIds: ReadonlySet<string>;
  /** Count by (fromLayer→toLayer) pair for HUD summary. */
  byPair: ReadonlyMap<string, number>;
}

export function detectArchViolations(graph: Pick<WorkspaceGraph, "files" | "fileEdges">): ArchViolationsResult {
  const layerOf = new Map<string, ArchLayer>();
  for (const f of graph.files) layerOf.set(f.id, f.layer);

  const violating = new Set<string>();
  const byPair = new Map<string, number>();

  for (const e of graph.fileEdges) {
    if (!ARCH_KINDS.has(e.kind)) continue;
    const fromLayer = layerOf.get(e.from);
    const toLayer = layerOf.get(e.to);
    if (!fromLayer || !toLayer) continue;
    const allowed = ALLOWED[fromLayer];
    if (!allowed.has(toLayer)) {
      violating.add(e.id);
      const key = `${fromLayer}→${toLayer}`;
      byPair.set(key, (byPair.get(key) ?? 0) + 1);
    }
  }

  return { violatingEdgeIds: violating, byPair };
}
