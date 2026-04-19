import { describe, it, expect } from "vitest";
import type {
  WorkspaceLayout,
  WorkspaceFileView,
  FileNode,
  FileEdge,
  Rect,
} from "@quanta/canvas-engine";
import { toMermaidDiagram, toDotGraph } from "./export-helpers";

function makeFile(id: string, name = id, layer: FileNode["layer"] = "domain"): FileNode {
  return {
    id,
    name,
    layer,
    riskScore: 0,
    loc: 1,
    signals: {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
  };
}

function makeLayout(): WorkspaceLayout {
  return {
    fileRects: new Map<string, Rect>(),
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}

function makeScene(files: FileNode[], edges: FileEdge[]): {
  layout: WorkspaceLayout;
  visible: WorkspaceFileView;
} {
  return {
    layout: makeLayout(),
    visible: { files, edges, comments: [], kind: "files" },
  };
}

describe("toMermaidDiagram", () => {
  it("empty scene still emits a valid flowchart header", () => {
    const out = toMermaidDiagram(makeScene([], []));
    expect(out.startsWith("flowchart TD")).toBe(true);
    // No subgraph blocks when there are no files.
    expect(out).not.toContain("subgraph");
  });

  it("groups files by ArchLayer into subgraphs", () => {
    const scene = makeScene(
      [makeFile("src/a.ts", "a.ts", "domain"), makeFile("src/b.ts", "b.ts", "ui")],
      [],
    );
    const out = toMermaidDiagram(scene);
    expect(out).toContain("subgraph");
    expect(out).toContain("[domain]");
    expect(out).toContain("[ui]");
  });

  it("emits one arrow per visible edge with the kind label", () => {
    const a = makeFile("src/a.ts", "a", "domain");
    const b = makeFile("src/b.ts", "b", "domain");
    const edge: FileEdge = {
      id: "e1", from: a.id, to: b.id, kind: "call", layer: "structural", weight: 1,
    };
    const out = toMermaidDiagram(makeScene([a, b], [edge]));
    expect(out).toContain("|call|");
    expect(out).toContain("-->");
  });

  it("edge layers map to different arrow styles", () => {
    const a = makeFile("a.ts", "a", "domain");
    const b = makeFile("b.ts", "b", "domain");
    const safetyEdge: FileEdge = {
      id: "e1", from: "a.ts", to: "b.ts", kind: "taint-propagation", layer: "safety", weight: 1,
    };
    const flowEdge: FileEdge = {
      id: "e2", from: "b.ts", to: "a.ts", kind: "dataflow", layer: "flow", weight: 1,
    };
    const out = toMermaidDiagram(makeScene([a, b], [safetyEdge, flowEdge]));
    // Safety uses dashed `-.->` and flow uses thick `==>`.
    expect(out).toContain("-.->");
    expect(out).toContain("==>");
  });

  it("drops edges whose endpoints aren't in the visible file set", () => {
    const a = makeFile("a.ts");
    const dangling: FileEdge = {
      id: "e1", from: "a.ts", to: "ghost.ts", kind: "call", layer: "structural", weight: 1,
    };
    const out = toMermaidDiagram(makeScene([a], [dangling]));
    // Only the node line for a.ts remains.
    expect(out).not.toContain("ghost");
  });

  it("sanitizes ids with slashes and dots", () => {
    const f = makeFile("src/path/to/file.ts", "file.ts");
    const out = toMermaidDiagram(makeScene([f], []));
    // Mermaid ids must not contain raw slashes / dots.
    expect(out).toContain("nsrc_path_to_file_ts");
  });
});

describe("toDotGraph", () => {
  it("empty scene still emits a valid digraph wrapper", () => {
    const out = toDotGraph(makeScene([], []));
    expect(out.startsWith("digraph workspace {")).toBe(true);
    expect(out.trim().endsWith("}")).toBe(true);
    expect(out).toContain("rankdir=LR;");
  });

  it("groups files into clusters by layer", () => {
    const scene = makeScene(
      [makeFile("a.ts", "a", "domain"), makeFile("b.ts", "b", "infra")],
      [],
    );
    const out = toDotGraph(scene);
    expect(out).toContain("subgraph cluster_");
    expect(out).toContain(`label="domain"`);
    expect(out).toContain(`label="infra"`);
  });

  it("emits one `->` edge per visible edge with a label and colour", () => {
    const a = makeFile("a.ts");
    const b = makeFile("b.ts");
    const edge: FileEdge = {
      id: "e1", from: "a.ts", to: "b.ts", kind: "call", layer: "structural", weight: 1,
    };
    const out = toDotGraph(makeScene([a, b], [edge]));
    expect(out).toContain("->");
    expect(out).toContain(`label="call"`);
    // structural layer uses grey `#4b5563`.
    expect(out).toContain("#4b5563");
  });

  it("safety edges carry the red colour + dashed style", () => {
    const a = makeFile("a.ts");
    const b = makeFile("b.ts");
    const edge: FileEdge = {
      id: "e1", from: "a.ts", to: "b.ts", kind: "taint-propagation", layer: "safety", weight: 1,
    };
    const out = toDotGraph(makeScene([a, b], [edge]));
    expect(out).toContain("#dc2626");
    expect(out).toContain("style=dashed");
  });
});
