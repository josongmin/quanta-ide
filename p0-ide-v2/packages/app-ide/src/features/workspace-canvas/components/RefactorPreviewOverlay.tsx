import { useEffect, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";
import { getAiService } from "../lib/ai-service-ref";
import type { PredictFutureResult } from "../lib/ai-service";

// RefactorPreviewOverlay (temporal.refactorPreview)
// -----------------------------------------------------------------
// Simple HUD banner + expandable panel at the top of the canvas.
// Runs `aiService.predictFuture({ horizonDays: 30 })` once the
// graph has a history attached; re-runs when the graph swaps.
// The v1 is intentionally non-destructive — no ghost cards drawn
// into the scene. It surfaces the forecast numbers + a clickable
// "future-risk" list that drives the selected file so readers can
// jump to the forecast hotspot.

const HORIZON_DAYS = 30;

export function RefactorPreviewOverlay() {
  const enabled = useFeature("temporal.refactorPreview");
  const graph = useSceneStore(s => s.graph);
  const [open, setOpen] = useState(false);
  const [forecast, setForecast] = useState<PredictFutureResult | null>(null);

  // Drop the forecast when the graph's identity swaps.
  useEffect(() => {
    setForecast(null);
  }, [graph]);

  // Kick off the forecast when the feature is on AND a graph with
  // history is present. We guard against StrictMode double-invoke
  // by checking `disposed` before setState.
  useEffect(() => {
    if (!enabled) return;
    if (!graph || !graph.history || graph.history.snapshots.length < 2) return;
    let disposed = false;
    (async () => {
      const ai = getAiService();
      const out = await ai.predictFuture({
        graph,
        history: graph.history!,
        horizonDays: HORIZON_DAYS,
      });
      if (!disposed) setForecast(out);
    })();
    return () => { disposed = true; };
  }, [enabled, graph]);

  if (!enabled || !forecast) return null;

  return (
    <div style={wrapStyle} role="status" aria-label="Refactor preview">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={bannerStyle}
        title="Click to expand the forecast"
      >
        <span style={{ fontWeight: 600 }}>Refactor preview ({HORIZON_DAYS}d)</span>
        <span style={{ opacity: 0.8 }}>
          +{forecast.expectedNewFiles} files · +{forecast.expectedNewEdges} edges · {forecast.expectedNewCycles.length} cycle-risk
        </span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={narrationStyle}>{forecast.narration}</div>

          {forecast.expectedNewCycles.length > 0 && (
            <>
              <div style={sectionLabelStyle}>Predicted new-cycle members</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {forecast.expectedNewCycles.map(fid => (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => interactionStore.selectFile(fid)}
                    style={riskChipStyle}
                    title={fid}
                  >
                    <span aria-hidden style={dotStyle} />
                    {fid.split("/").pop()}
                  </button>
                ))}
              </div>
            </>
          )}

          {forecast.hottestFilesForecast.length > 0 && (
            <>
              <div style={{ ...sectionLabelStyle, marginTop: 8 }}>Hottest files forecast</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {forecast.hottestFilesForecast.map(fid => (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => interactionStore.selectFile(fid)}
                    style={fileChipStyle}
                    title={fid}
                  >
                    {fid.split("/").pop()}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  maxWidth: "min(560px, 60vw)",
  pointerEvents: "auto",
};

const bannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 12px",
  background: "rgba(251, 191, 36, 0.92)",
  color: "#0f172a",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
  fontFamily: "system-ui, sans-serif",
};

const panelStyle: React.CSSProperties = {
  marginTop: 6,
  padding: "10px 12px",
  background: "rgba(15, 23, 42, 0.96)",
  color: "#e2e8f0",
  borderRadius: 8,
  boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
  fontSize: 12,
};

const narrationStyle: React.CSSProperties = {
  lineHeight: 1.55,
  color: "#cbd5e1",
  marginBottom: 8,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94a3b8",
  marginBottom: 4,
};

const riskChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "rgba(251, 191, 36, 0.18)",
  border: "1px solid rgba(251, 191, 36, 0.45)",
  color: "#fde68a",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
};

const dotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#fbbf24",
};

const fileChipStyle: React.CSSProperties = {
  background: "rgba(148, 163, 184, 0.1)",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  color: "#e2e8f0",
  fontSize: 11,
  padding: "3px 6px",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "JetBrains Mono, ui-monospace, monospace",
};
