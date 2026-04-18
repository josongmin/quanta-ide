import { useMemo } from "react";
import { viewportStore, useViewportStore } from "../../store/viewport-store";
import { useSceneStore } from "../../store/scene-store";
import { useSettingsStore, settingsStore, type EdgeKind } from "../../store/settings-store";

const EDGE_KINDS: readonly EdgeKind[] = ["import", "taint-propagation", "blast"] as const;

function scenePct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function countByKind(edges: readonly { kind: EdgeKind }[]): Record<EdgeKind, number> {
  const out: Record<EdgeKind, number> = { import: 0, "taint-propagation": 0, blast: 0 };
  for (const e of edges) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}

function copyViewportToClipboard(): void {
  const v = viewportStore.getState().viewport;
  const txt = `x=${v.x.toFixed(1)}, y=${v.y.toFixed(1)}, scale=${(v.scale * 100).toFixed(2)}%`;
  navigator.clipboard?.writeText(txt).catch(() => {});
}

function resetViewport(): void {
  const v = viewportStore.getState().viewport;
  viewportStore.setViewport({ ...v, x: 0, y: 0, scale: 1 });
}

function centerViewport(): void {
  const v = viewportStore.getState().viewport;
  viewportStore.setViewport({ ...v, x: v.width / 2, y: v.height / 2 });
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
  const edgeKinds = useSettingsStore(s => s.edgeKinds);
  const edgeWidthMul = useSettingsStore(s => s.edgeWidthMul);
  const freezeScene = useSettingsStore(s => s.freezeScene);

  const tb = layout?.totalBounds;
  const clusterTotal = layout?.clusters?.length ?? 0;
  const clusterVisible = clusters?.clusters.length ?? 0;
  const superTotal = layout?.superclusters?.length ?? 0;
  const superVisible = superclusters?.superclusters.length ?? 0;

  // Edge breakdown is cheap (linear scan) but visible.edges can be 10k+ —
  // memoize so panning doesn't re-count every viewport tick.
  const edgeBreakdown = useMemo(
    () => countByKind(visible?.edges ?? []),
    [visible?.edges],
  );
  const totalEdgeBreakdown = useMemo(
    () => countByKind(graph?.fileEdges ?? []),
    [graph?.fileEdges],
  );

  return (
    <>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">scale</span>
        <span className="ws-debug__v">{(viewport.scale * 100).toFixed(2)}%</span>

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

        {EDGE_KINDS.map(k => (
          <EdgeKindRow
            key={k}
            kind={k}
            visible={edgeBreakdown[k]}
            total={totalEdgeBreakdown[k]}
          />
        ))}

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
      </div>

      <div className="ws-debug__divider">render toggles</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEdges}
          onChange={e => settingsStore.setShowEdges(e.target.checked)}
        />
        <span>edges (all)</span>
      </label>
      <div className="ws-debug__lod" style={{ gap: 2, marginLeft: 20 }}>
        {EDGE_KINDS.map(k => (
          <button
            key={k}
            type="button"
            className={`ws-debug__chip${edgeKinds[k] ? " is-on" : ""}`}
            onClick={() => settingsStore.setEdgeKind(k, !edgeKinds[k])}
            title={k}
            disabled={!showEdges}
          >
            {k === "taint-propagation" ? "taint" : k.slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="ws-debug__row" style={{ alignItems: "center" }}>
        <span style={{ flex: "0 0 82px", opacity: 0.75 }}>edge width</span>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={edgeWidthMul}
          onChange={e => settingsStore.setEdgeWidthMul(parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ flex: "0 0 42px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {edgeWidthMul.toFixed(2)}×
        </span>
      </div>

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
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={freezeScene}
          onChange={e => settingsStore.setFreezeScene(e.target.checked)}
        />
        <span>freeze scene</span>
      </label>

      <div className="ws-debug__divider">viewport</div>
      <div className="ws-debug__lod" style={{ gap: 2 }}>
        <button type="button" className="ws-debug__chip" onClick={resetViewport} title="x=0,y=0,scale=1">
          reset
        </button>
        <button type="button" className="ws-debug__chip" onClick={centerViewport} title="center pan">
          center
        </button>
        <button type="button" className="ws-debug__chip" onClick={copyViewportToClipboard} title="copy x,y,scale">
          copy
        </button>
      </div>
    </>
  );
}

function EdgeKindRow({ kind, visible, total }: { kind: EdgeKind; visible: number; total: number }) {
  const label = kind === "taint-propagation" ? "taint" : kind;
  return (
    <>
      <span className="ws-debug__k" style={{ paddingLeft: 8, opacity: 0.75 }}>· {label}</span>
      <span className="ws-debug__v" style={{ opacity: 0.85 }}>
        {visible.toLocaleString()} / {total.toLocaleString()}
      </span>
    </>
  );
}
