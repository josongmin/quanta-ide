import { describe, it, expect } from "vitest";
import { detectDrift } from "./detect-drift";
import type { FileEdge, FileNode, ArchLayer } from "./types";

function mkFile(id: string, layer: ArchLayer): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer,
    riskScore: 0,
    loc: 50,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function mkEdge(from: string, to: string): FileEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    kind: "import",
    layer: "structural",
    weight: 1,
  };
}

describe("detectDrift", () => {
  it("reports no findings when snapshots are identical", () => {
    const files = [mkFile("a", "domain"), mkFile("b", "domain")];
    const edges = [mkEdge("a", "b")];
    expect(detectDrift({ files, fileEdges: edges }, { files, fileEdges: edges })).toEqual([]);
  });

  it("surfaces layer-escalation for util pulled in by infra/ui", () => {
    const before = {
      files: [mkFile("u", "util"), mkFile("d", "domain")],
      fileEdges: [mkEdge("d", "u")],
    };
    const after = {
      files: [mkFile("u", "util"), mkFile("inf", "infra"), mkFile("ui", "ui")],
      fileEdges: [mkEdge("inf", "u"), mkEdge("ui", "u")],
    };
    const findings = detectDrift(before, after);
    const esc = findings.find(f => f.fileId === "u" && f.kind === "layer-escalation");
    expect(esc).toBeDefined();
    expect(esc?.severity).toBe("high"); // 2 offending layers
    expect(esc?.detail).toContain("infra");
    expect(esc?.detail).toContain("ui");
  });

  it("detects fanout-explosion when degree grows >2x AND by >5", () => {
    // Before: file "hub" has 3 incoming; After: 10 incoming → ratio >2 and delta 7.
    const before = {
      files: [
        mkFile("hub", "domain"),
        mkFile("a", "domain"), mkFile("b", "domain"), mkFile("c", "domain"),
      ],
      fileEdges: [mkEdge("a", "hub"), mkEdge("b", "hub"), mkEdge("c", "hub")],
    };
    const afterFiles = [mkFile("hub", "domain")];
    const afterEdges: FileEdge[] = [];
    for (let i = 0; i < 10; i++) {
      const id = `f${i}`;
      afterFiles.push(mkFile(id, "domain"));
      afterEdges.push(mkEdge(id, "hub"));
    }
    const findings = detectDrift(before, { files: afterFiles, fileEdges: afterEdges });
    const f = findings.find(x => x.fileId === "hub" && x.kind === "fanout-explosion");
    expect(f).toBeDefined();
    expect(f?.after.degree).toBe(10);
    expect(f?.before.degree).toBe(3);
  });

  it("does NOT report fanout-explosion when delta is ≤5 even if ratio is big", () => {
    // 1 → 3: ratio 3× but delta only 2.
    const before = {
      files: [mkFile("n", "domain"), mkFile("a", "domain")],
      fileEdges: [mkEdge("a", "n")],
    };
    const after = {
      files: [mkFile("n", "domain"), mkFile("a", "domain"), mkFile("b", "domain"), mkFile("c", "domain")],
      fileEdges: [mkEdge("a", "n"), mkEdge("b", "n"), mkEdge("c", "n")],
    };
    const findings = detectDrift(before, after).filter(x => x.kind === "fanout-explosion");
    expect(findings.length).toBe(0);
  });

  it("marks a file that joins a new SCC in B", () => {
    const before = {
      files: [mkFile("a", "domain"), mkFile("b", "domain"), mkFile("c", "domain")],
      fileEdges: [mkEdge("a", "b"), mkEdge("b", "c")],
      sccs: [], // no cycles
    };
    const after = {
      files: [mkFile("a", "domain"), mkFile("b", "domain"), mkFile("c", "domain")],
      fileEdges: [mkEdge("a", "b"), mkEdge("b", "c"), mkEdge("c", "a")],
      sccs: [["a", "b", "c"]],
    };
    const findings = detectDrift(before, after);
    const cycleFinds = findings.filter(f => f.kind === "new-cycle-member");
    expect(cycleFinds.length).toBe(3);
    expect(cycleFinds.every(f => f.severity === "medium")).toBe(true); // size 3
  });

  it("sorts by severity desc, then fileId asc", () => {
    // Two high-severity findings for different files
    const before = {
      files: [mkFile("z-util", "util"), mkFile("a-util", "util"), mkFile("d", "domain")],
      fileEdges: [mkEdge("d", "z-util"), mkEdge("d", "a-util")],
    };
    const after = {
      files: [
        mkFile("z-util", "util"),
        mkFile("a-util", "util"),
        mkFile("i1", "infra"),
        mkFile("i2", "infra"),
        mkFile("ux", "ui"),
      ],
      fileEdges: [
        mkEdge("i1", "z-util"), mkEdge("ux", "z-util"),
        mkEdge("i1", "a-util"), mkEdge("ux", "a-util"),
      ],
    };
    const findings = detectDrift(before, after).filter(f => f.kind === "layer-escalation");
    expect(findings.length).toBe(2);
    expect(findings[0].fileId).toBe("a-util");
    expect(findings[1].fileId).toBe("z-util");
  });
});
