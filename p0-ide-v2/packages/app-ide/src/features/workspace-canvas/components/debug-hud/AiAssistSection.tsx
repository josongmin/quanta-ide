import { useCallback, useMemo, useState } from "react";
import { getAiService } from "../../lib/ai-service-ref";
import { useFeature } from "../../store/feature-flags-store";
import { useSceneStore, sceneStore } from "../../store/scene-store";
import { useAiAlerts, aiAlertsStore } from "../../store/ai-alerts-store";
import { stickiesStore, useStickiesStore } from "../../store/stickies-store";
import { interactionStore } from "../../store/interaction-store";
import { viewportStore } from "../../store/viewport-store";
import type { AnomalyKind, StickyCluster, TourStep } from "../../lib/ai-service";
import type { Sticky } from "../../store/stickies-store";

// Consolidated HUD surface for the Batch 6 AI features (excluding the
// NL filter which lives beside the DSL input). Three subsections:
//   - cluster stickies button + optional undo
//   - tour button + modal fallback
//   - anomaly listing with severity counts
//
// Each subsection gates on its own feature flag so toggling one off
// doesn't disable its siblings.

const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  "coupling-spike": "coupling spike",
  "cycle-gone-hot": "cycle hot",
  "unreachable": "unreachable",
  "owner-drift": "owner drift",
};

export function AiAssistSection() {
  const clusterOn = useFeature("ai.clusterStickies");
  const tourOn = useFeature("ai.repoTour");
  const anomaliesOn = useFeature("ai.anomalyAlerts");

  if (!clusterOn && !tourOn && !anomaliesOn) return null;

  return (
    <>
      <div className="ws-debug__divider">AI assist</div>
      {clusterOn && <ClusterStickiesSub />}
      {tourOn && <RepoTourSub />}
      {anomaliesOn && <AnomaliesSub />}
    </>
  );
}

// ── Cluster stickies ─────────────────────────────────────────────────

interface PositionSnapshot {
  id: string;
  x: number;
  y: number;
}

function ClusterStickiesSub() {
  const stickies = useStickiesStore(s => s.stickies);
  const [loading, setLoading] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<PositionSnapshot[] | null>(null);
  const [lastClusters, setLastClusters] = useState<readonly StickyCluster[] | null>(null);

  const run = useCallback(async () => {
    if (stickies.length === 0) return;
    setLoading(true);
    try {
      const svc = getAiService();
      const { clusters } = await svc.clusterStickies(stickies);
      // Snapshot old positions before we move anything, so undo restores
      // exactly where each sticky used to be.
      const snapshot: PositionSnapshot[] = stickies.map(s => ({ id: s.id, x: s.x, y: s.y }));
      setLastSnapshot(snapshot);
      setLastClusters(clusters);
      applyClusterLayout(stickies, clusters);
    } finally {
      setLoading(false);
    }
  }, [stickies]);

  const undo = useCallback(() => {
    if (!lastSnapshot) return;
    for (const p of lastSnapshot) stickiesStore.setPosition(p.id, p.x, p.y);
    setLastSnapshot(null);
    setLastClusters(null);
  }, [lastSnapshot]);

  return (
    <>
      <div className="ws-debug__row" style={{ gap: 4 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => void run()}
          disabled={loading || stickies.length < 2}
          title="Group similar stickies"
          style={{ flex: 1 }}
        >
          {loading ? "clustering…" : `AI cluster (${stickies.length})`}
        </button>
        {lastSnapshot && (
          <button
            type="button"
            className="ws-debug__chip"
            onClick={undo}
            title="Restore previous positions"
          >
            undo
          </button>
        )}
      </div>
      {lastClusters && lastClusters.length > 0 && (
        <div style={{ marginTop: 2, fontSize: 10, opacity: 0.8 }}>
          {lastClusters.map(c => (
            <div key={c.label}>
              <span style={{ opacity: 0.7 }}>· {c.label}:</span> {c.stickyIds.length} sticker
              {c.stickyIds.length === 1 ? "" : "s"}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Place each cluster's stickies in a loose grid centred near the
// existing centroid of that cluster's members. Deterministic: same
// input + same cluster output yields the same final positions.
function applyClusterLayout(
  stickies: readonly Sticky[],
  clusters: readonly StickyCluster[],
): void {
  const byId = new Map(stickies.map(s => [s.id, s]));
  const GAP_X = 24;
  const GAP_Y = 24;
  for (const c of clusters) {
    const members = c.stickyIds.map(id => byId.get(id)).filter((s): s is Sticky => !!s);
    if (members.length === 0) continue;
    // Centroid of current positions — keeps clusters near where the
    // user already placed their stickies instead of teleporting
    // everything to the origin.
    let cx = 0;
    let cy = 0;
    for (const s of members) { cx += s.x; cy += s.y; }
    cx /= members.length;
    cy /= members.length;
    const cols = Math.ceil(Math.sqrt(members.length));
    const cellW = (members[0]?.width ?? 180) + GAP_X;
    const cellH = (members[0]?.height ?? 120) + GAP_Y;
    const rows = Math.ceil(members.length / cols);
    const originX = cx - (cols * cellW) / 2;
    const originY = cy - (rows * cellH) / 2;
    members.forEach((s, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      stickiesStore.setPosition(s.id, originX + col * cellW, originY + row * cellH);
    });
  }
}

// ── Repo tour ────────────────────────────────────────────────────────

function RepoTourSub() {
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<readonly TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const run = useCallback(async () => {
    if (!graph || !layout) return;
    setLoading(true);
    try {
      const svc = getAiService();
      const { steps: resultSteps } = await svc.generateTour(graph, layout);
      setSteps(resultSteps);
      setStepIndex(0);
      if (resultSteps.length > 0) focusFile(resultSteps[0]);
    } finally {
      setLoading(false);
    }
  }, [graph, layout]);

  const advance = useCallback(() => {
    if (!steps) return;
    const nextIdx = stepIndex + 1;
    if (nextIdx >= steps.length) {
      setSteps(null);
      setStepIndex(0);
      return;
    }
    setStepIndex(nextIdx);
    focusFile(steps[nextIdx]);
  }, [steps, stepIndex]);

  const cancel = useCallback(() => {
    setSteps(null);
    setStepIndex(0);
  }, []);

  return (
    <>
      <div className="ws-debug__row" style={{ gap: 4 }}>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => void run()}
          disabled={loading || !layout}
          title="Generate a guided walk through the most important files"
          style={{ flex: 1 }}
        >
          {loading ? "planning tour…" : "AI tour"}
        </button>
      </div>
      {steps && steps.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.95 }}>
          <div style={{ opacity: 0.75 }}>
            step {stepIndex + 1} / {steps.length}
          </div>
          <div style={{ marginTop: 2 }}>{steps[stepIndex].narration}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <button
              type="button"
              className="ws-debug__chip"
              onClick={advance}
              style={{ flex: 1 }}
            >
              {stepIndex + 1 < steps.length ? "next →" : "finish"}
            </button>
            <button
              type="button"
              className="ws-debug__chip"
              onClick={cancel}
              title="Stop the tour"
            >
              stop
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function focusFile(step: TourStep): void {
  interactionStore.selectFile(step.fileId);
  interactionStore.setFocusHops(step.focusHops === 2 ? 2 : 1);
  // Pan so the file is roughly centred in the viewport.
  const layout = sceneStore.getState().layout;
  const rect = layout?.fileRects.get(step.fileId);
  if (!rect) return;
  const vp = viewportStore.getState().viewport;
  if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const nx = vp.width / 2 - cx * vp.scale;
  const ny = vp.height / 2 - cy * vp.scale;
  viewportStore.setViewport({ ...vp, x: nx, y: ny });
}

// ── Anomalies ────────────────────────────────────────────────────────

function AnomaliesSub() {
  const anomalies = useAiAlerts(s => s.anomalies);
  const countByKind = useAiAlerts(s => s.countByKind);
  const pending = useAiAlerts(s => s.pending);

  const kinds = useMemo(
    () => (Object.keys(countByKind) as AnomalyKind[]).filter(k => countByKind[k] > 0),
    [countByKind],
  );

  const selectFile = useCallback((fileId: string) => {
    interactionStore.selectFile(fileId);
    const layout = sceneStore.getState().layout;
    const rect = layout?.fileRects.get(fileId);
    if (!rect) return;
    const vp = viewportStore.getState().viewport;
    if (vp.width <= 0 || vp.height <= 0 || vp.scale <= 0) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const nx = vp.width / 2 - cx * vp.scale;
    const ny = vp.height / 2 - cy * vp.scale;
    viewportStore.setViewport({ ...vp, x: nx, y: ny });
  }, []);

  const rerun = useCallback(async () => {
    aiAlertsStore.setPending(true);
    const graph = sceneStore.getState().graph;
    const layout = sceneStore.getState().layout;
    const metrics = layout?.metrics;
    if (!graph || !metrics) {
      aiAlertsStore.setAnomalies([]);
      return;
    }
    const svc = getAiService();
    const { anomalies: result } = await svc.detectAnomalies(graph, metrics);
    aiAlertsStore.setAnomalies(result);
  }, []);

  return (
    <>
      <div className="ws-debug__row" style={{ gap: 4, alignItems: "center" }}>
        <span style={{ flex: 1, opacity: 0.8 }}>
          anomalies {pending ? "…" : `(${anomalies.length})`}
        </span>
        <button
          type="button"
          className="ws-debug__chip"
          onClick={() => void rerun()}
          disabled={pending}
          title="Re-scan current layout"
        >
          rescan
        </button>
      </div>
      {kinds.length > 0 && (
        <div className="ws-debug__lod" style={{ gap: 2, marginTop: 2 }}>
          {kinds.map(k => (
            <span key={k} className="ws-debug__chip" title={ANOMALY_LABEL[k]}>
              {ANOMALY_LABEL[k]} × {countByKind[k]}
            </span>
          ))}
        </div>
      )}
      {anomalies.length === 0 && !pending && (
        <div className="ws-debug__hint">no anomalies detected.</div>
      )}
      {anomalies.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
          {anomalies.slice(0, 8).map((a, i) => (
            <div
              key={`${a.fileId}-${a.kind}-${i}`}
              className="ws-debug__sticky-row"
              onClick={() => selectFile(a.fileId)}
              title={a.explanation}
            >
              <span
                className="ws-debug__sticky-dot"
                style={{
                  background:
                    a.severity === "high"
                      ? "#ef4444"
                      : a.severity === "med"
                        ? "#f59e0b"
                        : "#fbbf24",
                }}
              />
              <span className="ws-debug__sticky-text">
                <span style={{ opacity: 0.8 }}>{ANOMALY_LABEL[a.kind]}</span>
                <span style={{ opacity: 0.6, marginLeft: 4 }}>· {shortId(a.fileId)}</span>
              </span>
            </div>
          ))}
          {anomalies.length > 8 && (
            <div className="ws-debug__hint">(+{anomalies.length - 8} more)</div>
          )}
        </div>
      )}
    </>
  );
}

function shortId(id: string): string {
  const idx = id.lastIndexOf("/");
  return idx >= 0 ? id.slice(idx + 1) : id;
}
