import { useEffect, useRef, useState } from "react";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";

// Floating corner overlay for development/debugging. Surfaces the LOD, scale,
// viewport, scene counts, and a few render toggles. Not meant to ship to end
// users — gate via `debugHudOpen` flag; hidden state is still reachable via
// the store toggle action (wire Cmd+Shift+D from a global shortcut).

const LOD_CHOICES = ["auto", "supergalaxy", "galaxy", "city", "street", "ground"] as const;

export function DebugHud() {
  const open     = useWorkspaceCanvas(s => s.debugHudOpen);
  const lod      = useWorkspaceCanvas(s => s.lod);
  const viewport = useWorkspaceCanvas(s => s.viewport);
  const layout   = useWorkspaceCanvas(s => s.layout);
  const visible  = useWorkspaceCanvas(s => s.visibleScene);
  const clusters = useWorkspaceCanvas(s => s.clusterScene);
  const graph    = useWorkspaceCanvas(s => s.graph);

  const showEdges    = useWorkspaceCanvas(s => s.showEdges);
  const showGridBg   = useWorkspaceCanvas(s => s.showGridBg);
  const showHitLayers = useWorkspaceCanvas(s => s.showHitLayers);
  const forceLod     = useWorkspaceCanvas(s => s.forceLod);

  // Per-second FPS tick — RAF loop that only updates the displayed number at
  // 2 Hz so we don't trigger 60 re-renders/s from the HUD itself.
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastSample = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const dt = now - lastSample.current;
      if (dt >= 500) {
        setFps(Math.round((frameCount.current * 1000) / dt));
        frameCount.current = 0;
        lastSample.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Global keyboard toggle (Cmd/Ctrl+Shift+D).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        workspaceCanvasStore.toggleDebugHud();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        className="ws-debug__toggle"
        onClick={() => workspaceCanvasStore.toggleDebugHud()}
        title="Show debug HUD (⌘⇧D)"
      >
        debug
      </button>
    );
  }

  const tb = layout?.totalBounds;
  const clusterTotal = layout?.clusters?.length ?? 0;
  const clusterVisible = clusters?.clusters.length ?? 0;
  const scenePct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="ws-debug">
      <div className="ws-debug__header">
        <span>debug</span>
        <button
          type="button"
          className="ws-debug__close"
          title="Hide (⌘⇧D)"
          onClick={() => workspaceCanvasStore.toggleDebugHud()}
        >×</button>
      </div>
      <div className="ws-debug__grid">
        <span className="ws-debug__k">fps</span>
        <span className="ws-debug__v">{fps}</span>

        <span className="ws-debug__k">lod</span>
        <span className="ws-debug__v ws-debug__v--hl">{lod}</span>

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

        <span className="ws-debug__k">scene</span>
        <span className="ws-debug__v">
          {clusters ? "cluster" : visible ? "file" : "—"}
        </span>
      </div>

      <div className="ws-debug__divider">toggles</div>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showEdges}
          onChange={e => workspaceCanvasStore.setShowEdges(e.target.checked)}
        />
        <span>edges</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showGridBg}
          onChange={e => workspaceCanvasStore.setShowGridBg(e.target.checked)}
        />
        <span>grid bg</span>
      </label>
      <label className="ws-debug__row">
        <input
          type="checkbox"
          checked={showHitLayers}
          onChange={e => workspaceCanvasStore.setShowHitLayers(e.target.checked)}
        />
        <span>hit layers</span>
      </label>

      <div className="ws-debug__divider">force lod</div>
      <div className="ws-debug__lod">
        {LOD_CHOICES.map(v => (
          <button
            key={v}
            type="button"
            className={`ws-debug__chip${forceLod === v ? " is-on" : ""}`}
            onClick={() => workspaceCanvasStore.setForceLod(v)}
          >
            {v === "auto" ? "auto" : v.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}
