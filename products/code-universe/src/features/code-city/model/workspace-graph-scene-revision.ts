import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { CODE_CITY_MAX_BUILDINGS } from "./constants";

function hashU32(h: number, n: number): number {
  return Math.imul(h ^ n, 16777619) >>> 0;
}

/**
 * Stable revision string when the **picked Code City subset** of the workspace
 * graph is unchanged — avoids rebuilding the Three scene when parents pass a
 * new `graph` object reference with identical file/edge data.
 */
export function workspaceGraphContentRevision(graph: WorkspaceGraph): string {
  const files = [...graph.files].sort((a, b) => b.loc - a.loc).slice(0, CODE_CITY_MAX_BUILDINGS);
  let h = 2166136261;
  for (const f of files) {
    for (let i = 0; i < f.id.length; i++) h = hashU32(h, f.id.charCodeAt(i));
    for (let i = 0; i < f.name.length; i++) h = hashU32(h, f.name.charCodeAt(i));
    h = hashU32(h, f.loc | 0);
    h = hashU32(h, Math.round(f.riskScore * 1000) | 0);
    const s = f.signals;
    h = hashU32(h, s.taintCount | 0);
    h = hashU32(h, s.blastCritical | 0);
    h = hashU32(h, s.deadCount | 0);
    h = hashU32(h, s.archViolations | 0);
    h = hashU32(h, s.cpxMax | 0);
    for (const fn of f.functions) {
      h = hashU32(h, fn.complexity | 0);
      h = hashU32(h, fn.signalCount | 0);
      h = hashU32(h, fn.startLine | 0);
    }
  }
  const idSet = new Set(files.map(f => f.id));
  const edgeKeys = graph.fileEdges
    .filter(e => idSet.has(e.from) && idSet.has(e.to))
    .map(e => `${e.from}\0${e.to}`)
    .sort();
  for (const ek of edgeKeys) {
    for (let i = 0; i < ek.length; i++) h = hashU32(h, ek.charCodeAt(i));
  }
  return `${h.toString(36)}:${files.length}:${edgeKeys.length}`;
}
