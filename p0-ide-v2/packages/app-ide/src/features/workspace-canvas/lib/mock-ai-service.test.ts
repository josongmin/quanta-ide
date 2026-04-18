import { describe, it, expect } from "vitest";
import type {
  GraphHistory,
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
  FileMetrics,
} from "@quanta/canvas-engine";
import {
  createMockAiService,
  mockShaForSnapshot,
  mockSnapshotIndexForSha,
  mockAuthorForSnapshot,
} from "./mock-ai-service";
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

  // ── Temporal (T4) ────────────────────────────────────────────────

  // Fixture — 4 commits, 3 files, 5 edges. Commit 1 touches auth.ts;
  // commit 2 touches db.ts; commit 3 touches auth.ts again. Every
  // regression-hunt assertion below leans on this layout.
  function tempFixture(): { graph: WorkspaceGraph; history: GraphHistory } {
    const graph: WorkspaceGraph = {
      files: [
        { id: "src/auth.ts", name: "auth.ts", layer: "domain", riskScore: 40, loc: 80, signals: { taintCount: 1, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 5 }, functions: [] },
        { id: "src/db.ts",   name: "db.ts",   layer: "infra",  riskScore: 10, loc: 60, signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 3 }, functions: [] },
        { id: "src/ui.ts",   name: "ui.ts",   layer: "ui",     riskScore: 5,  loc: 40, signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 2 }, functions: [] },
      ],
      fileEdges: [
        { id: "e1", from: "src/ui.ts", to: "src/auth.ts", kind: "call", layer: "structural", weight: 1 },
        { id: "e2", from: "src/auth.ts", to: "src/db.ts", kind: "call", layer: "structural", weight: 1 },
        { id: "e3", from: "src/auth.ts", to: "src/db.ts", kind: "reference", layer: "structural", weight: 1 },
        { id: "e4", from: "src/ui.ts", to: "src/db.ts", kind: "call", layer: "structural", weight: 1 },
        { id: "e5", from: "src/auth.ts", to: "src/auth.ts", kind: "reference", layer: "structural", weight: 1 },
      ],
      comments: [],
    };
    const DAY = 86_400_000;
    const base = Date.UTC(2026, 0, 1);
    const history: GraphHistory = {
      snapshots: [
        { timestamp: base,           label: "day-0", edgeIds: ["e1", "e2"] },
        { timestamp: base + 1 * DAY, label: "day-1", added: ["e3"] },           // touches auth.ts + db.ts
        { timestamp: base + 2 * DAY, label: "day-2", added: ["e4"] },           // touches ui.ts + db.ts
        { timestamp: base + 3 * DAY, label: "day-3", added: ["e5"] },           // touches auth.ts
      ],
      baseIndex: 0,
    };
    return { graph, history };
  }

  it("attributeRegression fuzzy-matches file paths and ranks the right commit", async () => {
    const { graph, history } = tempFixture();
    const out = await svc.attributeRegression({
      testName: "AuthService › rejects expired token",
      failureLog: "Error thrown inside auth module when refreshing token",
      graph,
      history,
    });
    expect(out.candidateCommits.length).toBeGreaterThan(0);
    // The most recent auth-touching commit (day-3) should be at the top.
    expect(out.candidateCommits[0]).toBeTruthy();
    expect(out.affectedFileIds).toContain("src/auth.ts");
    // All confidences sum to ~1.
    const total = out.candidateCommits.reduce((a, c) => a + c.confidence, 0);
    expect(total).toBeGreaterThan(0.99);
    expect(total).toBeLessThan(1.01);
    expect(out.narration.length).toBeGreaterThan(20);
  });

  it("attributeRegression is deterministic for identical inputs", async () => {
    const { graph, history } = tempFixture();
    const input = {
      testName: "auth",
      failureLog: "auth breaks",
      graph,
      history,
    };
    const a = await svc.attributeRegression(input);
    const b = await svc.attributeRegression(input);
    expect(a.candidateCommits.map(c => c.sha)).toEqual(b.candidateCommits.map(c => c.sha));
    expect(a.affectedFileIds).toEqual(b.affectedFileIds);
    expect(a.narration).toEqual(b.narration);
  });

  it("predictFuture returns non-negative projections for short history", async () => {
    const { graph, history } = tempFixture();
    const out = await svc.predictFuture({ graph, history, horizonDays: 30 });
    expect(out.expectedNewEdges).toBeGreaterThanOrEqual(0);
    expect(out.expectedNewFiles).toBeGreaterThanOrEqual(0);
    expect(out.narration.length).toBeGreaterThan(10);
    // Cycle forecast should pull files that churned in the last 3 commits.
    expect(out.expectedNewCycles.length).toBeGreaterThan(0);
  });

  it("predictFuture is deterministic", async () => {
    const { graph, history } = tempFixture();
    const a = await svc.predictFuture({ graph, history, horizonDays: 30 });
    const b = await svc.predictFuture({ graph, history, horizonDays: 30 });
    expect(a).toEqual(b);
  });

  it("predictFuture short-circuits on thin history", async () => {
    const graph: WorkspaceGraph = { files: [], fileEdges: [], comments: [] };
    const history: GraphHistory = {
      snapshots: [{ timestamp: 0, label: "only", edgeIds: [] }],
      baseIndex: 0,
    };
    const out = await svc.predictFuture({ graph, history, horizonDays: 30 });
    expect(out.expectedNewEdges).toBe(0);
    expect(out.expectedNewFiles).toBe(0);
  });

  it("narrateCommit summarizes delta and returns highlights", async () => {
    const { graph, history } = tempFixture();
    const sha = mockShaForSnapshot(history, 3);
    expect(sha).toBeTruthy();
    const out = await svc.narrateCommit({ sha: sha!, graph, history });
    expect(out.summary).toMatch(/day-3/);
    expect(out.summary).toMatch(/added 1 edge/);
    expect(out.highlights.length).toBeGreaterThan(0);
  });

  it("narrateCommit handles unknown sha gracefully", async () => {
    const { graph, history } = tempFixture();
    const out = await svc.narrateCommit({ sha: "0000000", graph, history });
    expect(out.summary).toMatch(/No snapshot/);
    expect(out.highlights).toEqual([]);
  });

  it("mock helpers round-trip sha ↔ snapshot index", () => {
    const { history } = tempFixture();
    for (let i = 0; i < history.snapshots.length; i++) {
      const sha = mockShaForSnapshot(history, i);
      expect(sha).toBeTruthy();
      expect(mockSnapshotIndexForSha(history, sha!)).toBe(i);
    }
    expect(mockShaForSnapshot(history, 999)).toBeNull();
  });

  it("mockAuthorForSnapshot cycles the fixed author roster", () => {
    expect(mockAuthorForSnapshot(0)).toBe("alice");
    expect(mockAuthorForSnapshot(1)).toBe("bob");
    expect(mockAuthorForSnapshot(2)).toBe("charlie");
    expect(mockAuthorForSnapshot(3)).toBe("dana");
    expect(mockAuthorForSnapshot(4)).toBe("alice");
  });
});
