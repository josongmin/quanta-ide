import { useViewportStore } from "../../store/viewport-store";
import { useSceneStore } from "../../store/scene-store";
import { useSettingsStore, settingsStore } from "../../store/settings-store";

function scenePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export function SceneSection() {
  const viewport = useViewportStore(s => s.viewport);
  const layout = useSceneStore(s => s.layout);
  const visible = useSceneStore(s => s.visibleScene);
  const clusters = useSceneStore(s => s.clusterScene);
  const superclusters = useSceneStore(s => s.superclusterScene);
  const graph = useSceneStore(s => s.graph);
  const layoutProgress = useSceneStore(s => s.layoutProgress);

  const showEdges = useSettingsStore(s => s.showEdges);
  const showGridBg = useSettingsStore(s => s.showGridBg);
  const showHitLayers = useSettingsStore(s => s.showHitLayers);

  const tb = layout?.totalBounds;
  const clusterTotal = layout?.clusters?.length ?? 0;
  const clusterVisible = clusters?.clusters.length ?? 0;
  const superTotal = layout?.superclusters?.length ?? 0;
  const superVisible = superclusters?.superclusters.length ?? 0;

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">scale</span>
        <span className="ws-debug__v">{(viewport.scale * 100).toFixed(1)}%</span>

        <span className="ws-debug__k">viewport</span>
        <span className="ws-debug__v">
          {Math.round(viewport.x)}, {Math.round(viewport.y)} · {viewport.width}×{viewport.height}
        </span>

        <span className="ws-debug__k">layout</span>
        <span className="ws-debug__v">
          {tb ? `${Math.round(tb.w).toLocaleString()}×${Math.round(tb.h).toLocaleString()}` : "—"}
        </span>

        <span className="ws-debug__k">worker-rtt</span>
        <span className="ws-debug__v">
          {/* Proxy: layoutProgress.lastUpdateMs ≈ requestLayout→ready. When a
              dedicated telemetry field lands in the store, swap to that. */}
          {layoutProgress.lastUpdateMs > 0
            ? `${Math.round(layoutProgress.lastUpdateMs)}ms`
            : "—"}
        </span>

        <span className="ws-debug__k">files</span>
        <span className="ws-debug__v">
          {visible ? `${visible.files.length.toLocaleString()} / ${graph?.files.length.toLocaleString() ?? 0}` : "—"}
          {visible && graph && ` (${scenePct(visible.files.length, graph.files.length)}%)`}
        </span>

        <span className="ws-debug__k">edges</span>
        <span className="ws-debug__v">
          {visible ? `${visible.edges.length.toLocaleString()} / ${graph?.fileEdges.length.toLocaleString() ?? 0}` : "—"}
        </span>

        <span className="ws-debug__k">clusters</span>
        <span className="ws-debug__v">
          {clusterTotal > 0 ? `${clusterVisible} / ${clusterTotal}` : "—"}
        </span>

        <span className="ws-debug__k">superclusters</span>
        <span className="ws-debug__v">
          {superTotal > 0 ? `${superVisible} / ${superTotal}` : "—"}
        </span>

        <span className="ws-debug__k">scene</span>
        <span className="ws-debug__v">
          {superclusters ? "supercluster" : clusters ? "cluster" : visible ? "file" : "—"}
        </span>

        {/* Per-font label pool utilization — requires reading internal state
            from CityNodeRenderer which lives in canvas-pixi and is out of
            scope for this HUD change. TODO(canvas-pixi): expose pool counts
            on window.__pixi. */}
        <span className="ws-debug__k">pool[city-reg]</span>
        <span className="ws-debug__v">—</span>

        <span className="ws-debug__k">pool[city-bold]</span>
        <span className="ws-debug__v">—</span>

        <span className="ws-debug__k">pool[city-mono]</span>
        <span className="ws-debug__v">—</span>
      </div>

      <div className="ws-debug__divider">toggles</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEdges}
          onChange={e => settingsStore.setShowEdges(e.target.checked)}
        />
        <span>edges</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showGridBg}
          onChange={e => settingsStore.setShowGridBg(e.target.checked)}
        />
        <span>grid bg</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHitLayers}
          onChange={e => settingsStore.setShowHitLayers(e.target.checked)}
        />
        <span>hit layers</span>
      </label>
    </>
  );
}
