import { describe, it, expect } from "vitest";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
  FileMetrics,
} from "@quanta/canvas-engine";
import { createMockAiService } from "./mock-ai-service";
import type { Sticky } from "../store/stickies-store";

// Smoke tests for the deterministic mock implementation of AiService.
// The goal is not to pin every phrase or heuristic output to the byte
// but to lock the contract — returned types + at least one known-good
// translation / clustering / anomaly — so refactors inside the mock
// don't accidentally drop the public surface.

function makeSticky(id: string, text: string, overrides: Partial<Sticky> = {}): Sticky {
  const now = Date.now();
  return {
    id,
    x: 0,
    y: 0,
    width: 180,
    height: 120,
    text,
    color: "yellow",
    author: "you",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("mock-ai-service", () => {
  const svc = createMockAiService();

  it("naturalLanguageToDsl produces DSL for known phrases", async () => {
    const out = await svc.naturalLanguageToDsl("taint flows to DB", {
      edgeKinds: [],
      edgeLayers: [],
      files: [],
    });
    expect(out.dsl.length).toBeGreaterThan(0);
    expect(out.confidence).toBeGreaterThan(0);
    expect(typeof out.explanation).toBe("string");
  });

  it("naturalLanguageToDsl falls back to a broad filter for unrecognized phrases", async () => {
    const out = await svc.naturalLanguageToDsl("xylophone butterfly chart", {
      edgeKinds: [],
      edgeLayers: [],
      files: [],
    });
    expect(out.dsl).toBe("layer=safety or layer=impact");
    expect(out.confidence).toBeLessThan(0.6);
  });

  it("naturalLanguageToDsl returns empty dsl for empty query", async () => {
    const out = await svc.naturalLanguageToDsl("   ", {
      edgeKinds: [],
      edgeLayers: [],
      files: [],
    });
    expect(out.dsl).toBe("");
    expect(out.confidence).toBe(1);
  });

  it("clusterStickies groups stickies that share ≥2 tokens", async () => {
    const stickies: Sticky[] = [
      makeSticky("a", "refactor the login handler for security"),
      makeSticky("b", "improve login handler redirect"),
      makeSticky("c", "fix memory leak in parser loop"),
    ];
    const { clusters } = await svc.clusterStickies(stickies);
    // The "login/handler" pair must land in one cluster; the memory-leak
    // sticky ends up in the "other" bucket.
    const clustersByLabel = new Map(clusters.map(c => [c.label, c]));
    const loginCluster = [...clusters].find(c => c.stickyIds.includes("a"));
    expect(loginCluster).toBeTruthy();
    expect(loginCluster?.stickyIds).toContain("b");
    expect(clustersByLabel.get("other")?.stickyIds).toContain("c");
  });

  it("clusterStickies returns empty clusters for empty input", async () => {
    const out = await svc.clusterStickies([]);
    expect(out.clusters).toEqual([]);
  });

  it("detectAnomalies flags unreachable files", async () => {
    const graph: WorkspaceGraph = {
      files: [
        { id: "a", name: "a", layer: "domain", riskScore: 10, loc: 10, signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 }, functions: [] },
        { id: "b", name: "b", layer: "domain", riskScore: 10, loc: 10, signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 }, functions: [] },
      ],
      fileEdges: [
        { id: "e1", from: "a", to: "b", kind: "import", layer: "structural", weight: 1 },
      ],
      comments: [],
    };
    const perFile = new Map<string, FileMetrics>();
    perFile.set("a", { inDegree: 0, outDegree: 1, degree: 1 });
    perFile.set("b", { inDegree: 1, outDegree: 0, degree: 1 });
    const metrics: WorkspaceMetrics = {
      perFile,
      topByDegree: ["a", "b"],
      topByBetweenness: [],
      fileCount: 2,
      edgeCount: 1,
      computeMs: 0,
      betweennessSampled: false,
    };
    const { anomalies } = await svc.detectAnomalies(graph, metrics);
    // 'a' has no inbound and is not an "entry" layer (ui/adapter) → unreachable
    expect(anomalies.some(a => a.fileId === "a" && a.kind === "unreachable")).toBe(true);
  });

  it("generateTour returns empty steps without metrics", async () => {
    const graph: WorkspaceGraph = { files: [], fileEdges: [], comments: [] };
    const layout: WorkspaceLayout = {
      fileRects: new Map(),
      edgeRoutes: new Map(),
      aggregates: { commentsByFunction: new Map(), commentsByFile: new Map(), commentedLines: new Map() },
      totalBounds: { x: 0, y: 0, w: 0, h: 0 },
    };
    const { steps } = await svc.generateTour(graph, layout);
    expect(steps).toEqual([]);
  });
});
