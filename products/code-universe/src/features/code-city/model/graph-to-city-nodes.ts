import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { CodeNode } from "./types";
import { CODE_CITY_MAX_BUILDINGS } from "./constants";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Project workspace file graph into the metaphorical fields used by the
 * 3D city renderer (building height, risk fire, dependency wires, …).
 */
export function buildCodeCityNodesFromGraph(graph: WorkspaceGraph): CodeNode[] {
  const files = [...graph.files].sort((a, b) => b.loc - a.loc);
  const picked = files.slice(0, CODE_CITY_MAX_BUILDINGS);
  const idSet = new Set(picked.map(f => f.id));

  return picked.map(file => {
    const outEdges = graph.fileEdges.filter(
      e => e.from === file.id && idSet.has(e.to),
    );
    const deps = [...new Set(outEdges.map(e => e.to))].slice(0, 16);
    const outDeg = outEdges.length;
    const coupling = clamp01(outDeg / 18);
    // Scanner uses 0–1; some fixtures use 0–100.
    const risk = clamp01(file.riskScore > 1 ? file.riskScore / 100 : file.riskScore);
    const dead = file.signals.deadCount;
    const arch = file.signals.archViolations;
    const cpx = file.signals.cpxMax;
    const fnCpx = file.functions.reduce((m, fn) => Math.max(m, fn.complexity), 0);
    const complexity = Math.max(cpx, fnCpx, file.functions.length * 2);

    const type: CodeNode["type"] =
      file.name.endsWith(".tsx") || file.name.endsWith(".jsx")
        ? "module"
        : file.functions.some(f => f.name === "default" || f.name.includes("class"))
          ? "class"
          : "function";

    const isGodClass = file.loc > 2800 || file.functions.length > 22;
    const techDebt = clamp01((arch + dead * 2 + (complexity / 120)) / 12);
    const blastRadius = clamp01(
      risk * 0.6 + (file.signals.blastCritical / 8) * 0.4 + coupling * 0.15,
    );

    return {
      id: file.id,
      name: file.name || file.id,
      type,
      loc: Math.max(50, file.loc),
      risk,
      solidViolations: arch,
      spaghettiFactor: clamp01(outDeg / 14),
      testCoverage: dead > 3 ? 0.08 : dead > 0 ? 0.35 : 0.72,
      techDebt,
      isDead: dead > 4,
      memoryLeak: false,
      busFactor: dead > 6 ? 0 : 2,
      complexity,
      duplication: clamp01(file.functions.length > 30 ? 0.35 : 0.12),
      coupling,
      aiGenerated: complexity > 55 && risk > 0.45,
      isGodClass,
      dependencies: deps,
      securityLeak: file.signals.taintCount > 0,
      heuristicLevel: arch > 2 ? 0.45 : 0.15,
      ifNesting: Math.min(50, Math.floor(complexity / 10 + arch)),
      blastRadius,
    } satisfies CodeNode;
  });
}

/** File id with highest risk in the picked set — drives special drone styling. */
export function pickMaliciousBuildingId(nodes: CodeNode[]): string | null {
  if (nodes.length === 0) return null;
  let id = nodes[0].id;
  let r = -1;
  for (const n of nodes) {
    if (n.risk > r) {
      r = n.risk;
      id = n.id;
    }
  }
  return id;
}
