import type { FileNode, FileEdge, ArchLayer } from "@quanta/canvas-engine";

// Mock LLM hover summary — in production this will be replaced by a live call
// to a code-understanding model, but the shape (one short sentence that
// consolidates shallow analyzer facts) is already useful on its own and
// deterministic enough to test. Each layer has a dedicated template so the
// resulting line reads like the model has "noticed" the file's role instead
// of just reciting stats.

export interface HoverSummaryInput {
  file: FileNode;
  /** Subset of fileEdges whose `from` equals this file — outbound imports. */
  outbound: readonly FileEdge[];
  /** Subset of fileEdges whose `to` equals this file — inbound callers. */
  inbound: readonly FileEdge[];
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function importsList(edges: readonly FileEdge[]): string {
  const names = new Set<string>();
  for (const e of edges) {
    if (e.kind !== "import") continue;
    const n = basename(e.to).replace(/\.[^.]+$/, "");
    names.add(n);
    if (names.size >= 3) break;
  }
  if (names.size === 0) return "no imports";
  const arr = [...names];
  return `imports { ${arr.join(", ")} }`;
}

function riskBand(riskScore: number): string {
  if (riskScore >= 0.7) return "high-risk";
  if (riskScore >= 0.4) return "medium-risk";
  return "low-risk";
}

function template(layer: ArchLayer): (f: FileNode, inb: number, outb: number, imp: string) => string {
  switch (layer) {
    case "domain":
      return (f, inb, _out, imp) =>
        `${riskBand(f.riskScore)} domain model · ${f.functions.length} fns · called by ${inb} sites · ${imp}`;
    case "adapter":
      return (f, inb, out, imp) =>
        `adapter shim · ${f.functions.length} fns · ${inb} inbound / ${out} outbound · ${imp}`;
    case "infra":
      return (f, _inb, out, imp) =>
        `${riskBand(f.riskScore)} infra surface · ${f.loc.toLocaleString()} loc · ${out} outbound deps · ${imp}`;
    case "ui":
      return (f, inb, _out, imp) =>
        `ui module · ${f.functions.length} components · ${inb} consumers · ${imp}`;
    case "util":
      return (f, inb, _out, imp) =>
        `util file, pure-ish · ${f.functions.length} functions · ${inb} callers · ${imp}`;
    case "unknown":
      return (f, inb, out, imp) =>
        `file · ${f.loc.toLocaleString()} loc · ${inb} in / ${out} out · ${imp}`;
  }
}

/**
 * Produce a single-sentence mock summary for a file. Deterministic: given the
 * same FileNode + edges, returns the same string — so tests can assert it.
 */
export function mockHoverSummary(input: HoverSummaryInput): string {
  const { file, inbound, outbound } = input;
  const imp = importsList(outbound);
  return template(file.layer)(file, inbound.length, outbound.length, imp);
}
