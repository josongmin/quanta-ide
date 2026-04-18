import { useMemo } from "react";
import type { WorkspaceLayout } from "@quanta/canvas-engine";
import { useAiAlerts } from "../store/ai-alerts-store";
import { useFeature } from "../store/feature-flags-store";
import type { Anomaly, AnomalyKind, AnomalySeverity } from "../lib/ai-service";

// Anomaly badges (ai.anomalyAlerts)
// -------------------------------------------------------------------
// One small warning-triangle badge on the top-left corner of every
// file card flagged by detectAnomalies. Positioned in world-space
// (same transform as the DOM card layer) so badges track the card
// as the user pans/zooms. Pure-DOM for now — Pixi integration can
// follow later if badge count becomes a perf concern.

interface Props {
  layout: WorkspaceLayout | null;
  transform: string;
}

const LABELS: Record<AnomalyKind, string> = {
  "coupling-spike": "Coupling spike",
  "cycle-gone-hot": "Cycle hot",
  "unreachable": "Unreachable",
  "owner-drift": "Owner drift",
};

const SEV_COLOR: Record<AnomalySeverity, string> = {
  high: "#ef4444",
  med: "#f59e0b",
  low: "#fbbf24",
};

export function AnomalyBadgesLayer({ layout, transform }: Props) {
  const on = useFeature("ai.anomalyAlerts");
  const byFileId = useAiAlerts(s => s.byFileId);

  const entries = useMemo(() => {
    if (!on || !layout) return [];
    const out: Array<{ fileId: string; x: number; y: number; top: Anomaly; count: number }> = [];
    for (const [fileId, list] of byFileId) {
      if (list.length === 0) continue;
      const rect = layout.fileRects.get(fileId);
      if (!rect) continue;
      // `list` is already severity-sorted (the store derives it from the
      // sort in mock-ai-service), so the first is the most severe.
      out.push({ fileId, x: rect.x, y: rect.y, top: list[0], count: list.length });
    }
    return out;
  }, [on, layout, byFileId]);

  if (!on || entries.length === 0) return null;

  return (
    <div
      className="ws-anomaly-badges"
      style={{ transform, transformOrigin: "0 0" }}
    >
      {entries.map(e => (
        <div
          key={e.fileId}
          className="ws-anomaly-badge"
          style={{
            left: e.x - 8,
            top: e.y - 8,
            background: SEV_COLOR[e.top.severity],
          }}
          title={`${LABELS[e.top.kind]} — ${e.top.explanation}${e.count > 1 ? `\n(+${e.count - 1} more)` : ""}`}
        >
          !
        </div>
      ))}
    </div>
  );
}
