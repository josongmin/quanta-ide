import { describe, it, expect, beforeEach } from "vitest";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  FileNode,
  FileEdge,
  Rect,
} from "@quanta/canvas-engine";
import { TEMPLATES, applyTemplate } from "./templates";
import { pagesStore } from "../store/pages-store";
import { bookmarksStore } from "../store/bookmarks-store";

// Templates hit the pages + bookmarks stores. Reset both before each test
// so bookmark/page counts from prior cases don't leak.

function makeFile(id: string, extras: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 1,
    loc: 10,
    signals: {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
    ...extras,
  };
}

function makeLayout(
  fileRects: ReadonlyArray<readonly [string, Rect]>,
): WorkspaceLayout {
  return {
    fileRects: new Map(fileRects),
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 1000, h: 1000 },
  };
}

describe("templates", () => {
  beforeEach(() => {
    pagesStore.resetToDefault();
    bookmarksStore.reset();
  });

  it("TEMPLATES exposes at least one entry with the required shape", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
    for (const t of TEMPLATES) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.label).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(typeof t.steps).toBe("string");
    }
  });

  it("each template id is unique", () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applyTemplate throws on an unknown id", () => {
    expect(() => applyTemplate("template.does-not-exist", null, null)).toThrow();
  });

  it("applyTemplate with null graph/layout still creates the page (no seeds)", () => {
    const { pageId, bookmarkIds, seeded } = applyTemplate("template.security", null, null);
    expect(typeof pageId).toBe("string");
    expect(pageId.length).toBeGreaterThan(0);
    expect(bookmarkIds).toEqual([]);
    expect(seeded).toBe(0);
  });

  it("architecture template seeds one bookmark per supercluster", () => {
    const layout: WorkspaceLayout = {
      ...makeLayout([]),
      superclusters: [
        { id: "svc/a", rect: { x: 0, y: 0, w: 100, h: 100 }, fileCount: 5, locSum: 200 },
        { id: "svc/b", rect: { x: 200, y: 0, w: 100, h: 100 }, fileCount: 3, locSum: 150 },
      ],
    };
    const graph: WorkspaceGraph = {
      files: [makeFile("a.ts"), makeFile("b.ts")],
      fileEdges: [],
      comments: [],
    };
    const { seeded, bookmarkIds, pageId } = applyTemplate("template.architecture", graph, layout);
    expect(seeded).toBe(2);
    expect(bookmarkIds.length).toBe(2);
    // Each bookmark was actually persisted under the new page.
    const forPage = bookmarksStore.getState().bookmarks.filter(b => b.pageId === pageId);
    expect(forPage.length).toBe(2);
  });

  it("postmortem template seeds an Origin + affected bookmarks from risk ranking", () => {
    const files: FileNode[] = [
      makeFile("low.ts", { riskScore: 1 }),
      makeFile("mid1.ts", { riskScore: 20 }),
      makeFile("mid2.ts", { riskScore: 30 }),
      makeFile("origin.ts", { riskScore: 99 }),
    ];
    const layout = makeLayout([
      ["origin.ts", { x: 0, y: 0, w: 50, h: 50 }],
      ["mid1.ts", { x: 60, y: 0, w: 50, h: 50 }],
      ["mid2.ts", { x: 120, y: 0, w: 50, h: 50 }],
      ["low.ts", { x: 180, y: 0, w: 50, h: 50 }],
    ]);
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const { seeded } = applyTemplate("template.postmortem", graph, layout);
    // Origin + up to 3 affected = 4 total.
    expect(seeded).toBeGreaterThan(0);
    expect(seeded).toBeLessThanOrEqual(4);
  });

  it("applyTemplate returns a fresh pageId per call", () => {
    const a = applyTemplate("template.onboarding", null, null);
    const b = applyTemplate("template.onboarding", null, null);
    expect(a.pageId).not.toBe(b.pageId);
  });

  it("security template does not throw on a graph with no safety edges", () => {
    const files = [makeFile("a.ts"), makeFile("b.ts")];
    const layout = makeLayout([
      ["a.ts", { x: 0, y: 0, w: 50, h: 50 }],
      ["b.ts", { x: 60, y: 0, w: 50, h: 50 }],
    ]);
    const edges: FileEdge[] = [
      { id: "e1", from: "a.ts", to: "b.ts", kind: "call", layer: "structural", weight: 1 },
    ];
    const graph: WorkspaceGraph = { files, fileEdges: edges, comments: [] };
    expect(() => applyTemplate("template.security", graph, layout)).not.toThrow();
  });
});
