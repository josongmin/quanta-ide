import { useEffect } from "react";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import { aiAlertsStore } from "../store/ai-alerts-store";
import { getAiService } from "../lib/ai-service-ref";

// use-anomaly-detection
// ------------------------------------------------------------------
// Fires detectAnomalies whenever the layout finishes computing and
// the ai.anomalyAlerts feature is enabled. The result is cached in
// aiAlertsStore so the HUD section + the world-space badges layer
// read from the same source.
//
// Rationale for hooking on layout (not graph): metrics live on the
// layout, and running detection without metrics would require us to
// recompute centrality — the layout pipeline already does that.

export function useAnomalyDetectionRun(): void {
  const on = useFeature("ai.anomalyAlerts");
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);

  useEffect(() => {
    if (!on) {
      aiAlertsStore.clear();
      return;
    }
    if (!graph || !layout || !layout.metrics) return;
    let cancelled = false;
    aiAlertsStore.setPending(true);
    const svc = getAiService();
    void svc.detectAnomalies(graph, layout.metrics).then(({ anomalies }) => {
      if (cancelled) return;
      aiAlertsStore.setAnomalies(anomalies);
    }).catch(() => {
      if (cancelled) return;
      aiAlertsStore.setAnomalies([]);
    });
    return () => { cancelled = true; };
  }, [on, graph, layout]);
}
