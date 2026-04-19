import { describe, it, expect } from "vitest";
import type { FileNode, Rect, Viewport } from "@quanta/canvas-engine";
import type { FolderRect } from "./compute-folder-rects";
import { computeCanvasLabels } from "./compute-canvas-labels";

// Only covers the algorithmic core worth regression-guarding: overlap
// resolution (deepest wins) + upgrade-descendant-on-ancestor-hide, plus
// the file-vs-folder tie-break. The leaf-name baseline stays as a sanity
// that the natural-position branch wires through at all; everything else
// (clamp text switch, offscreen flag, sticky visibility gate, no-overlap
// negative case) was trivial one-line conditionals or redundant coverage.
//
// Measurement runs in jsdom where Canvas2D is a stub, so the helper
// exercises its proportional-font fallback path — close enough for
// overlap logic; real browser uses measureText for tight bounds.

function fileNode(id: string): FileNode {
  const name = id.split("/").pop() ?? id;
  return {
    id,
    name,
    layer: "domain",
    riskScore: 0,
    loc: 0,
    signals: { domains: [], effects: [], risks: [] },
    functions: [],
  } as unknown as FileNode;
}

function viewport(x: number, y: number, scale = 1, width = 800, height = 600): Viewport {
  return { x, y, scale, width, height };
}

function fileRect(x: number, y: number, w = 200, h = 300): Rect {
  return { x, y, w, h };
}

function folderRect(path: string, rect: Rect, depth: number, rdepth: number): FolderRect {
  return { path, rect, fileCount: 2, depth, rdepth };
}

describe("computeCanvasLabels", () => {
  it("uses the leaf segment when a folder is fully on-screen", () => {
    const folders = [folderRect("src/features/canvas", { x: 100, y: 100, w: 400, h: 400 }, 2, 0)];
    const { folders: out } = computeCanvasLabels(folders, [], new Map(), viewport(0, 0));
    expect(out[0].text).toBe("canvas");
    expect(out[0].clamped).toBe(false);
    expect(out[0].hidden).toBe(false);
  });

  it("hides the shallower label when two overlap and transfers full-path context to the survivor", () => {
    // Outer folder scrolls off, so its clamped label shows the full path.
    // Inner folder is visible but sits at the viewport corner, natural
    // label still overlaps. Outer should hide; inner should upgrade
    // from leaf to full path so the disclosure isn't lost.
    const outer = folderRect("a/b", { x: -500, y: -500, w: 2000, h: 2000 }, 1, 1);
    const inner = folderRect("a/b/c", { x: -10, y: -10, w: 300, h: 300 }, 2, 0);
    const { folders } = computeCanvasLabels([outer, inner], [], new Map(), viewport(0, 0));
    const outerOut = folders.find(f => f.path === "a/b")!;
    const innerOut = folders.find(f => f.path === "a/b/c")!;
    expect(outerOut.hidden).toBe(true);
    expect(innerOut.hidden).toBe(false);
    expect(innerOut.text).toBe("a/b/c"); // upgraded from "c"
    expect(innerOut.clamped).toBe(true);
  });

  it("keeps the file sticky and hides a shallower folder label on overlap", () => {
    // Folder and a descendant file both gravitate to the viewport corner.
    // File pill wins (deeper path). Folder pill hidden.
    const folder = folderRect("a/b/c", { x: -500, y: -500, w: 2000, h: 2000 }, 2, 0);
    const file = fileNode("a/b/c/leaf.ts");
    const fileRects = new Map<string, Rect>([[file.id, fileRect(-10, -10, 300, 400)]]);
    const { folders, files } = computeCanvasLabels([folder], [file], fileRects, viewport(0, 0));
    expect(folders[0].hidden).toBe(true);
    expect(files[0].hidden).toBe(false);
    expect(files[0].text).toBe(file.id);
  });
});
