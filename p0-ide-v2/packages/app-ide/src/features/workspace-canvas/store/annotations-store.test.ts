import { describe, it, expect, beforeEach } from "vitest";
import {
  annotationsStore,
  getAnnotationAabb,
  type PenGeometry,
  type FrameGeometry,
  type ConnectorGeometry,
} from "./annotations-store";

describe("annotations-store", () => {
  beforeEach(() => {
    annotationsStore.reset();
  });

  it("adds and removes an annotation", () => {
    const id = annotationsStore.add({
      kind: "pen",
      geometry: { points: [[0, 0], [10, 10]], color: "#000", strokeWidth: 2 } as PenGeometry,
    });
    expect(annotationsStore.list().length).toBe(1);
    annotationsStore.remove(id);
    expect(annotationsStore.list().length).toBe(0);
  });

  it("sets and clears the active tool (ephemeral)", () => {
    annotationsStore.setTool("pen");
    expect(annotationsStore.getState().activeTool).toBe("pen");
    annotationsStore.setTool("none");
    expect(annotationsStore.getState().activeTool).toBe("none");
  });

  it("persists color changes", () => {
    annotationsStore.setPenColor("#ff00aa");
    expect(annotationsStore.getState().penColor).toBe("#ff00aa");
  });

  it("computes AABB for pen geometry", () => {
    const geom: PenGeometry = {
      points: [[5, 10], [25, 30], [0, 50]],
      color: "#000",
      strokeWidth: 2,
    };
    const ann = { id: "x", kind: "pen" as const, createdAt: 0, geometry: geom };
    const aabb = getAnnotationAabb(ann);
    expect(aabb).toEqual({ x: 0, y: 10, w: 25, h: 40 });
  });

  it("translates an annotation by (dx, dy)", () => {
    const id = annotationsStore.add({
      kind: "pen",
      geometry: { points: [[0, 0], [10, 10]], color: "#000", strokeWidth: 2 } as PenGeometry,
    });
    annotationsStore.translate(id, 5, -3);
    const pen = annotationsStore.list().find(a => a.id === id);
    expect(pen).toBeTruthy();
    const g = pen!.geometry as PenGeometry;
    expect(g.points).toEqual([[5, -3], [15, 7]]);
  });

  it("translates only annotations contained within bounds", () => {
    const inside = annotationsStore.add({
      kind: "pen",
      geometry: { points: [[10, 10], [20, 20]], color: "#000", strokeWidth: 2 } as PenGeometry,
    });
    const outside = annotationsStore.add({
      kind: "pen",
      geometry: { points: [[200, 200], [300, 300]], color: "#000", strokeWidth: 2 } as PenGeometry,
    });
    annotationsStore.translateWithin({ x: 0, y: 0, w: 100, h: 100 }, 50, 50);
    const inP = annotationsStore.list().find(a => a.id === inside)!.geometry as PenGeometry;
    const outP = annotationsStore.list().find(a => a.id === outside)!.geometry as PenGeometry;
    expect(inP.points).toEqual([[60, 60], [70, 70]]);
    expect(outP.points).toEqual([[200, 200], [300, 300]]);
  });

  it("keeps connector anchor offsets consistent after translate", () => {
    const id = annotationsStore.add({
      kind: "connector",
      geometry: {
        fromAnchor: { kind: "free", x: 0, y: 0 },
        toAnchor: { kind: "free", x: 100, y: 50 },
        color: "#000",
        strokeWidth: 2,
      } as ConnectorGeometry,
    });
    annotationsStore.translate(id, 10, 20);
    const c = annotationsStore.list().find(a => a.id === id)!.geometry as ConnectorGeometry;
    expect(c.fromAnchor).toMatchObject({ x: 10, y: 20 });
    expect(c.toAnchor).toMatchObject({ x: 110, y: 70 });
  });

  it("bringToFront moves an annotation to the end of the list", () => {
    const a = annotationsStore.add({
      kind: "frame",
      geometry: { x: 0, y: 0, w: 10, h: 10, label: "A", color: "#000" } as FrameGeometry,
    });
    const b = annotationsStore.add({
      kind: "frame",
      geometry: { x: 0, y: 0, w: 10, h: 10, label: "B", color: "#000" } as FrameGeometry,
    });
    const c = annotationsStore.add({
      kind: "frame",
      geometry: { x: 0, y: 0, w: 10, h: 10, label: "C", color: "#000" } as FrameGeometry,
    });
    annotationsStore.bringToFront(a);
    const ids = annotationsStore.list().map(x => x.id);
    expect(ids).toEqual([b, c, a]);
  });
});
