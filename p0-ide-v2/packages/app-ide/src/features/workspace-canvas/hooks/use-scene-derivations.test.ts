import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ArchLayer,
  EdgeKind,
  EdgeLayer,
  FileEdge,
  FileNode,
  GraphHistory,
  Trace,
  TracePack,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import {
  useActiveTrace,
  useCrossGraphFlash,
  useTemporalEdgeSets,
} from "./use-scene-derivations";
import { interactionStore } from "../store/interaction-store";

function file(id: string, graphId?: string, layer: ArchLayer = "domain"): FileNode {
  return {
    id,
    name: id,
    layer,
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
    graphId,
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  graphId?: string,
  crossGraph?: boolean,
): FileEdge {
  const kind: EdgeKind = "import";
  const layer: EdgeLayer = "structural";
  return { id, from, to, kind, layer, weight: 1, graphId, crossGraph };
}

function makeGraph(files: FileNode[], fileEdges: FileEdge[], extras: Partial<WorkspaceGraph> = {}): WorkspaceGraph {
  return { files, fileEdges, comments: [], ...extras };
}

describe("use-scene-derivations", () => {
  beforeEach(() => {
    interactionStore.setTemporalMode("off");
    interactionStore.setActiveTrace(null);
  });

  afterEach(() => {
    interactionStore.setTemporalMode("off");
    interactionStore.setActiveTrace(null);
  });

  describe("useTemporalEdgeSets", () => {
    it("returns undefined sets when temporal mode is off", () => {
      const g = makeGraph([], []);
      const { result } = renderHook(() => useTemporalEdgeSets(g));
      expect(result.current.temporalEdgeSet).toBeUndefined();
      expect(result.current.diffAdded).toBeUndefined();
      expect(result.current.diffRemoved).toBeUndefined();
    });

    it("returns undefined in live mode when graph has no history", () => {
      const g = makeGraph([], []);
      act(() => { interactionStore.setTemporalMode("live"); });
      const { result } = renderHook(() => useTemporalEdgeSets(g));
      expect(result.current.temporalEdgeSet).toBeUndefined();
    });

    it("materializes live-mode edge set at the selected snapshot", () => {
      const history: GraphHistory = {
        snapshots: [
          { timestamp: 1, label: "c1", edgeIds: ["e1", "e2"] },
          { timestamp: 2, label: "c2", added: ["e3"], removed: ["e1"] },
        ],
      };
      const g = makeGraph([], [], { history });
      act(() => {
        interactionStore.setTemporalMode("live");
        interactionStore.setSnapshotIndex(1);
      });
      const { result } = renderHook(() => useTemporalEdgeSets(g));
      const set = result.current.temporalEdgeSet;
      expect(set).toBeDefined();
      expect(set && Array.from(set).sort()).toEqual(["e2", "e3"]);
    });
  });

  describe("useActiveTrace", () => {
    it("returns null when no trace selected", () => {
      const g = makeGraph([], []);
      const { result } = renderHook(() => useActiveTrace(g));
      expect(result.current.activeTrace).toBeNull();
      expect(result.current.traceEdgeSet).toBeUndefined();
    });

    it("returns the matching trace and keyed edge set when id is set", () => {
      const trace: Trace = {
        id: "t1",
        label: "Login",
        capturedAt: 1,
        totalMs: 10,
        spans: [],
        edges: [{ from: "a", to: "b", callCount: 1, totalDurationMs: 1 }],
      };
      const traces: TracePack = { traces: [trace] };
      const g = makeGraph([], [], { traces });
      act(() => { interactionStore.setActiveTrace("t1"); });
      const { result } = renderHook(() => useActiveTrace(g));
      expect(result.current.activeTrace?.id).toBe("t1");
      expect(result.current.traceEdgeSet?.has("a→b")).toBe(true);
    });

    it("returns null when trace id does not exist in pack", () => {
      const traces: TracePack = { traces: [] };
      const g = makeGraph([], [], { traces });
      act(() => { interactionStore.setActiveTrace("missing"); });
      const { result } = renderHook(() => useActiveTrace(g));
      expect(result.current.activeTrace).toBeNull();
      expect(result.current.traceEdgeSet).toBeUndefined();
    });
  });

  describe("useCrossGraphFlash", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns undefined when no graph flash active", () => {
      const g = makeGraph([file("a")], [edge("e1", "a", "a")]);
      const { result } = renderHook(() => useCrossGraphFlash(g));
      expect(result.current).toBeUndefined();
    });

    it("includes cross-graph edges whose endpoints resolve to the flashed graph", () => {
      const files = [file("a", "repo-a"), file("b", "repo-b"), file("c", "repo-a")];
      const edges = [
        edge("e1", "a", "b", undefined, true),    // a(repo-a) → b(repo-b)
        edge("e2", "c", "c", undefined, false),   // not cross-graph
        edge("e3", "b", "a", "repo-b", true),     // edge's own graphId matches
      ];
      const g = makeGraph(files, edges);
      act(() => { interactionStore.flashGraph("repo-b", 2000); });
      const { result } = renderHook(() => useCrossGraphFlash(g));
      const out = result.current;
      expect(out).toBeDefined();
      expect(out?.has("e1")).toBe(true);
      expect(out?.has("e3")).toBe(true);
      expect(out?.has("e2")).toBe(false);
    });
  });
});
