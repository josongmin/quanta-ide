import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  FileNode,
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceMetrics,
} from "@quanta/canvas-engine";
import { useAnomalyDetectionRun } from "./use-anomaly-detection";
import { sceneStore } from "../store/scene-store";
import { aiAlertsStore } from "../store/ai-alerts-store";
import { featureFlagsStore } from "../store/feature-flags-store";
import type { AiService, Anomaly, DetectAnomaliesResult } from "../lib/ai-service";
import { getAiService, setAiService } from "../lib/ai-service-ref";

// Stub AI service — bypasses the real mock's 200ms wait + coupling math
// so assertions are deterministic and fast. Each test supplies its own
// `detectAnomaliesImpl`.
function stubService(
  detectAnomaliesImpl: (g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>,
): AiService {
  const noop = async () => { throw new Error("not used in this test"); };
  return {
    naturalLanguageToDsl: noop as never,
    clusterStickies: noop as never,
    generateTour: noop as never,
    detectAnomalies: detectAnomaliesImpl,
    attributeRegression: noop as never,
    predictFuture: noop as never,
    narrateCommit: noop as never,
    streamEdit: (async function* () { /* empty */ })() as never,
  };
}

function file(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function emptyMetrics(): WorkspaceMetrics {
  return {
    perFile: new Map(),
    topByDegree: [],
    topByBetweenness: [],
    fileCount: 0,
    edgeCount: 0,
    computeMs: 0,
    betweennessSampled: false,
  };
}

function layoutWithMetrics(metrics: WorkspaceMetrics): WorkspaceLayout {
  return {
    fileRects: new Map(),
    edgeRoutes: new Map(),
    aggregates: { commentsByFunction: new Map(), commentsByFile: new Map(), commentedLines: new Map() },
    totalBounds: { x: 0, y: 0, w: 0, h: 0 },
    metrics,
  };
}

describe("useAnomalyDetectionRun", () => {
  let originalService: AiService;

  beforeEach(() => {
    originalService = getAiService();
    aiAlertsStore.clear();
    // Graph + layout are wiped per test; alerts store starts empty.
    sceneStore.setGraph({ files: [], fileEdges: [], comments: [] });
  });

  afterEach(() => {
    setAiService(originalService);
    aiAlertsStore.clear();
    // Restore flag default.
    featureFlagsStore.setFlag("ai.anomalyAlerts", false);
  });

  it("does not call the service when the feature flag is off", async () => {
    const spy = vi.fn<(g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>>(
      async () => ({ anomalies: [] }),
    );
    setAiService(stubService(spy));
    featureFlagsStore.setFlag("ai.anomalyAlerts", false);

    renderHook(() => useAnomalyDetectionRun());
    await act(async () => { await Promise.resolve(); });

    expect(spy).not.toHaveBeenCalled();
    expect(aiAlertsStore.getState().anomalies).toHaveLength(0);
  });

  it("does not run when layout is null (no metrics yet)", async () => {
    const spy = vi.fn<(g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>>(
      async () => ({ anomalies: [] }),
    );
    setAiService(stubService(spy));
    featureFlagsStore.setFlag("ai.anomalyAlerts", true);

    renderHook(() => useAnomalyDetectionRun());
    await act(async () => { await Promise.resolve(); });

    expect(spy).not.toHaveBeenCalled();
  });

  it("runs and populates aiAlertsStore once metrics land", async () => {
    const anomalies: Anomaly[] = [
      { kind: "coupling-spike", fileId: "a", severity: "high", explanation: "test" },
    ];
    const spy = vi.fn<(g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>>(
      async () => ({ anomalies }),
    );
    setAiService(stubService(spy));
    featureFlagsStore.setFlag("ai.anomalyAlerts", true);

    const g: WorkspaceGraph = { files: [file("a")], fileEdges: [], comments: [] };
    sceneStore.setGraph(g);
    act(() => { sceneStore.setLayout(layoutWithMetrics(emptyMetrics())); });

    renderHook(() => useAnomalyDetectionRun());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(aiAlertsStore.getState().anomalies).toEqual(anomalies);
  });

  it("clears the alerts store when the flag flips off after a run", async () => {
    const spy = vi.fn<(g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>>(
      async () => ({ anomalies: [{ kind: "unreachable", fileId: "z", severity: "low", explanation: "x" }] }),
    );
    setAiService(stubService(spy));
    featureFlagsStore.setFlag("ai.anomalyAlerts", true);

    sceneStore.setGraph({ files: [file("z")], fileEdges: [], comments: [] });
    act(() => { sceneStore.setLayout(layoutWithMetrics(emptyMetrics())); });

    renderHook(() => useAnomalyDetectionRun());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(aiAlertsStore.getState().anomalies).toHaveLength(1);

    // Toggle the flag off — the effect should re-run and clear.
    act(() => { featureFlagsStore.setFlag("ai.anomalyAlerts", false); });
    expect(aiAlertsStore.getState().anomalies).toHaveLength(0);
  });

  it("handles service rejection by setting an empty anomaly list", async () => {
    const spy = vi.fn<(g: WorkspaceGraph, m: WorkspaceMetrics) => Promise<DetectAnomaliesResult>>(
      async () => { throw new Error("ai down"); },
    );
    setAiService(stubService(spy));
    featureFlagsStore.setFlag("ai.anomalyAlerts", true);

    sceneStore.setGraph({ files: [file("a")], fileEdges: [], comments: [] });
    act(() => { sceneStore.setLayout(layoutWithMetrics(emptyMetrics())); });

    renderHook(() => useAnomalyDetectionRun());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(aiAlertsStore.getState().anomalies).toEqual([]);
    expect(aiAlertsStore.getState().pending).toBe(false);
  });
});
