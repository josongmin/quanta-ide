import { describe, it, expect } from "vitest";
import type { FileNode } from "@quanta/canvas-engine";
import { synthesizeDemoEdges } from "./synthesize-demo-edges";

function mkFile(id: string, fnCount = 3): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 30,
    loc: 120,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: Array.from({ length: fnCount }, (_, i) => ({
      name: `${id}.fn${i}`,
      startLine: 10 + i * 20,
      endLine: 15 + i * 20,
      signalCount: 0,
      complexity: 1,
    })),
  };
}

describe("synthesizeDemoEdges", () => {
  const files = Array.from({ length: 30 }, (_, i) => mkFile(`src/file${i}.ts`));

  it("produces at least one edge of every non-import demo kind", () => {
    const edges = synthesizeDemoEdges(files, []);
    const kinds = new Set(edges.map(e => e.kind));
    const expected = [
      "call", "reference", "cfg", "inheritance", "test-covers", "clone",
      "dataflow", "effect", "pdg", "alias", "feature-flag",
      "taint-propagation", "sanitizer", "race", "cycle", "finding",
      "contract", "dead-edge", "runtime-divergence",
      "blast", "impact", "diff", "dependency", "witness",
      "cochange", "rename-pair", "supply-chain",
    ];
    for (const k of expected) expect(kinds.has(k as never)).toBe(true);
  });

  it("is deterministic for the same file id set", () => {
    const a = synthesizeDemoEdges(files, []);
    const b = synthesizeDemoEdges(files, []);
    expect(a.length).toBe(b.length);
    expect(a.map(e => e.id).sort()).toEqual(b.map(e => e.id).sort());
  });

  it("preserves existing edges and does not duplicate them", () => {
    const existing = [
      {
        id: "e:keep", from: files[0].id, to: files[1].id,
        kind: "import" as const, layer: "structural" as const, weight: 1,
      },
    ];
    const out = synthesizeDemoEdges(files, existing);
    const imports = out.filter(e => e.kind === "import");
    expect(imports).toEqual(existing);
  });
});
