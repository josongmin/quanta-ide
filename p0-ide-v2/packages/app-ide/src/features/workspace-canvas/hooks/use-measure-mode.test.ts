import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ArchLayer,
  EdgeKind,
  EdgeLayer,
  FileEdge,
  FileNode,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import { useMeasureMode } from "./use-measure-mode";
import { featureFlagsStore } from "../store/feature-flags-store";

function file(id: string, layer: ArchLayer = "domain"): FileNode {
  return {
    id,
    name: id,
    layer,
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function edge(id: string, from: string, to: string): FileEdge {
  const kind: EdgeKind = "import";
  const layer: EdgeLayer = "structural";
  return { id, from, to, kind, layer, weight: 1 };
}

function makeGraph(files: FileNode[], fileEdges: FileEdge[]): WorkspaceGraph {
  return { files, fileEdges, comments: [] };
}

function keydown(key: string, target?: EventTarget | null): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  if (target) Object.defineProperty(e, "target", { value: target, configurable: true });
  return e;
}

function keyup(key: string): KeyboardEvent {
  return new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true });
}

describe("use-measure-mode", () => {
  beforeEach(() => {
    featureFlagsStore.setFlag("devmode.measure", true);
  });

  afterEach(() => {
    featureFlagsStore.setFlag("devmode.measure", false);
  });

  it("tryCaptureSelection returns false when M is not held", () => {
    const g = makeGraph([file("a"), file("b")], []);
    const { result } = renderHook(() => useMeasureMode(g));
    let captured = false;
    act(() => { captured = result.current.tryCaptureSelection("a"); });
    expect(captured).toBe(false);
    expect(result.current.phase).toBe("none");
  });

  it("holding M and picking two files advances to showing-results", () => {
    const g = makeGraph(
      [file("a"), file("b")],
      [edge("e1", "a", "b")],
    );
    const { result } = renderHook(() => useMeasureMode(g));
    act(() => { window.dispatchEvent(keydown("m")); });
    act(() => {
      const ok = result.current.tryCaptureSelection("a");
      expect(ok).toBe(true);
    });
    expect(result.current.phase).toBe("first-picked");
    expect(result.current.measureA).toBe("a");
    act(() => {
      const ok = result.current.tryCaptureSelection("b");
      expect(ok).toBe(true);
    });
    expect(result.current.phase).toBe("showing-results");
    expect(result.current.measureB).toBe("b");
    expect(result.current.result).not.toBeNull();
    expect(result.current.result!.directEdges).toBeGreaterThanOrEqual(1);
    act(() => { window.dispatchEvent(keyup("m")); });
  });

  it("M keydown inside an INPUT does NOT arm mHeld", () => {
    const g = makeGraph([file("a"), file("b")], []);
    const { result } = renderHook(() => useMeasureMode(g));
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => { window.dispatchEvent(keydown("m", input)); });
    // tryCaptureSelection should still report not-held.
    let captured = false;
    act(() => { captured = result.current.tryCaptureSelection("a"); });
    expect(captured).toBe(false);
    expect(result.current.phase).toBe("none");
    document.body.removeChild(input);
  });

  it("Escape resets measure state back to none", () => {
    const g = makeGraph([file("a"), file("b")], []);
    const { result } = renderHook(() => useMeasureMode(g));
    act(() => { window.dispatchEvent(keydown("m")); });
    act(() => { result.current.tryCaptureSelection("a"); });
    expect(result.current.phase).toBe("first-picked");
    act(() => { window.dispatchEvent(keydown("Escape")); });
    expect(result.current.phase).toBe("none");
    expect(result.current.measureA).toBeNull();
    act(() => { window.dispatchEvent(keyup("m")); });
  });

  it("disabling the feature flag mid-session clears the overlay", () => {
    const g = makeGraph([file("a"), file("b")], []);
    const { result, rerender } = renderHook(() => useMeasureMode(g));
    act(() => { window.dispatchEvent(keydown("m")); });
    act(() => { result.current.tryCaptureSelection("a"); });
    expect(result.current.phase).toBe("first-picked");
    act(() => { featureFlagsStore.setFlag("devmode.measure", false); });
    rerender();
    expect(result.current.phase).toBe("none");
    act(() => { window.dispatchEvent(keyup("m")); });
  });
});
