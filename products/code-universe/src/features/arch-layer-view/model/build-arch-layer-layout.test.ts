import { describe, it, expect } from "vitest";
import type { FileEdge, FileNode, WorkspaceGraph } from "@quanta/canvas-engine";
import { buildArchLayerLayout } from "./build-arch-layer-layout";

// ── Test helpers ─────────────────────────────────────────────────────

function makeFile(
  id: string,
  layer: FileNode["layer"] = "domain",
  loc = 100,
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer,
    riskScore: 0,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  kind: FileEdge["kind"] = "import",
  weight = 1,
): FileEdge {
  return { id, from, to, kind, layer: "structural", weight };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VP = { width: 1200, height: 800 };

// ── Tests ─────────────────────────────────────────────────────────────

describe("buildArchLayerLayout — empty graph", () => {
  it("returns empty nodes and edges for an empty graph", () => {
    const layout = buildArchLayerLayout({ graph: makeGraph([]), ...VP });
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.totalViolations).toBe(0);
    expect(layout.totalAllowed).toBe(0);
  });
});

describe("buildArchLayerLayout — same-layer edge skipped", () => {
  it("skips edges where from and to are in the same layer (domain→domain)", () => {
    const files = [makeFile("a.ts", "domain"), makeFile("b.ts", "domain")];
    const edges = [makeEdge("e1", "a.ts", "b.ts", "import")];
    const layout = buildArchLayerLayout({ graph: makeGraph(files, edges), ...VP });
    // Only one visible layer column, no cross-layer edges
    expect(layout.edges).toHaveLength(0);
    expect(layout.nodes).toHaveLength(1);
    expect(layout.nodes[0]!.layer).toBe("domain");
  });
});

describe("buildArchLayerLayout — allowed edge (domain → util)", () => {
  it("produces one allowed flow edge for a legal domain→util import", () => {
    const files = [makeFile("core.ts", "domain"), makeFile("utils.ts", "util")];
    const edges = [makeEdge("e1", "core.ts", "utils.ts", "import")];
    const layout = buildArchLayerLayout({ graph: makeGraph(files, edges), ...VP });
    expect(layout.edges).toHaveLength(1);
    const edge = layout.edges[0]!;
    expect(edge.fromLayer).toBe("domain");
    expect(edge.toLayer).toBe("util");
    expect(edge.category).toBe("allowed");
    expect(layout.totalAllowed).toBe(1);
    expect(layout.totalViolations).toBe(0);
    expect(layout.violatingPairs).toHaveLength(0);
  });
});

describe("buildArchLayerLayout — violation edge (domain → infra)", () => {
  it("marks a domain→infra import as a violation and includes it in violatingPairs", () => {
    const files = [makeFile("core.ts", "domain"), makeFile("db.ts", "infra")];
    const edges = [makeEdge("e1", "core.ts", "db.ts", "import")];
    const layout = buildArchLayerLayout({ graph: makeGraph(files, edges), ...VP });
    expect(layout.edges).toHaveLength(1);
    const edge = layout.edges[0]!;
    expect(edge.fromLayer).toBe("domain");
    expect(edge.toLayer).toBe("infra");
    expect(edge.category).toBe("violation");
    expect(layout.totalViolations).toBe(1);
    expect(layout.totalAllowed).toBe(0);
    expect(layout.violatingPairs).toHaveLength(1);
    expect(layout.violatingPairs[0]!.fromLayer).toBe("domain");
    expect(layout.violatingPairs[0]!.toLayer).toBe("infra");
    expect(layout.violatingPairs[0]!.count).toBe(1);
  });
});

describe("buildArchLayerLayout — edge weight accumulation", () => {
  it("accumulates edgeCount and weight for 3 edges from domain→adapter", () => {
    const files = [
      makeFile("a.ts", "domain"),
      makeFile("b.ts", "domain"),
      makeFile("c.ts", "domain"),
      makeFile("adapter1.ts", "adapter"),
      makeFile("adapter2.ts", "adapter"),
      makeFile("adapter3.ts", "adapter"),
    ];
    const edges = [
      makeEdge("e1", "a.ts", "adapter1.ts", "import", 2),
      makeEdge("e2", "b.ts", "adapter2.ts", "call", 3),
      makeEdge("e3", "c.ts", "adapter3.ts", "reference", 5),
    ];
    const layout = buildArchLayerLayout({ graph: makeGraph(files, edges), ...VP });
    // domain→adapter is allowed (adapter can be depended on by infra/ui, but domain→adapter is a violation)
    // Actually per rules: domain can only depend on util — so domain→adapter IS a violation
    const edge = layout.edges.find(e => e.fromLayer === "domain" && e.toLayer === "adapter");
    expect(edge).toBeDefined();
    expect(edge!.edgeCount).toBe(3);
    expect(edge!.weight).toBe(10); // 2 + 3 + 5
  });
});
