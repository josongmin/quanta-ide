import { describe, it, expect } from "vitest";
import type { FileNode, Rect, Viewport } from "@quanta/canvas-engine";
import type { FolderRect } from "./compute-folder-rects";
import { computeCanvasLabels } from "./compute-canvas-labels";

// Covers the three invariants that matter:
//   (1) leaf-vs-full-path switch on clamping
//   (2) sticky file label gates on "header is off-screen, card is on-screen"
//   (3) overlap resolution: deepest wins, ancestor context transfers to
//       the survivor so the user never loses the path that was pinning them.
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

  it("switches to the full path when the folder's top-left clamps to the viewport edge", () => {
    const folders = [folderRect("src/features/canvas", { x: -200, y: -200, w: 800, h: 800 }, 2, 0)];
    const { folders: out } = computeCanvasLabels(folders, [], new Map(), viewport(0, 0));
    expect(out[0].clamped).toBe(true);
    expect(out[0].text).toBe("src/features/canvas");
  });

  it("marks a folder offscreen when its rect falls outside the viewport", () => {
    const folders = [folderRect("src/far-away", { x: 5000, y: 5000, w: 100, h: 100 }, 1, 0)];
    const { folders: out } = computeCanvasLabels(folders, [], new Map(), viewport(0, 0));
    expect(out[0].offscreen).toBe(true);
  });

  it("only emits a file sticky label when the card's header is covered but its body still shows", () => {
    const onlyHeaderOff = fileNode("src/a.ts");
    const fullyVisible = fileNode("src/b.ts");
    const fileRects = new Map<string, Rect>([
      ["src/a.ts", fileRect(50, -100, 300, 400)], // top above viewport, body visible
      ["src/b.ts", fileRect(50, 50, 300, 200)],   // fully in view, no sticky
    ]);
    const vp = viewport(0, 0, 1, 800, 600);
    const { files } = computeCanvasLabels([], [onlyHeaderOff, fullyVisible], fileRects, vp);
    expect(files.map(f => f.fileId)).toEqual(["src/a.ts"]);
    expect(files[0].text).toBe("src/a.ts");
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

  it("leaves both labels visible when they don't overlap", () => {
    const folders = [
      folderRect("a", { x: 0, y: 0, w: 100, h: 100 }, 0, 0),
      folderRect("b", { x: 400, y: 400, w: 100, h: 100 }, 0, 0),
    ];
    const { folders: out } = computeCanvasLabels(folders, [], new Map(), viewport(0, 0));
    expect(out.every(f => !f.hidden)).toBe(true);
  });
});
