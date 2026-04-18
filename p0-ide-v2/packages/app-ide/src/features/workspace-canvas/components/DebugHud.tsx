import { useEffect, useRef, useState } from "react";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";

// Floating corner overlay for development/debugging. Surfaces the LOD, scale,
// viewport, scene counts, and a few render toggles. Not meant to ship to end
// users — gate via `debugHudOpen` flag; hidden state is still reachable via
// the store toggle action (wire Cmd+Shift+D from a global shortcut).

const LOD_CHOICES = ["auto", "universe", "supergalaxy", "galaxy", "city", "street", "ground"] as const;

// Rolling frame-time window for p50/p95. 120 samples ≈ 2s at 60fps which is
// the right horizon for "how smooth does it feel right now" without being
// dominated by stale frames from before the last interaction.
const FRAME_WINDOW = 120;

// Percentile reader over a fixed-size ring buffer. Sorting on every read is
// O(n log n) but n=120 and we only read at 2 Hz — negligible.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

// Pull Pixi's draw-call count if the app is running. Surface via the
// `__pixi` debug hook installed by PixiStage — we deliberately don't import
// pixi here because this HUD must work without the renderer mounted.
function readPixiDrawCalls(): number | null {
  interface PixiDebugHook {
    app?: {
      renderer?: {
        // Pixi v8 stats object (when enabled).
        statistics?: { drawCalls?: number };
      };
    };
  }
  const hook = (globalThis as unknown as { __pixi?: PixiDebugHook }).__pixi;
  const n = hook?.app?.renderer?.statistics?.drawCalls;
  return typeof n === "number" ? n : null;
}

export function DebugHud() {
  const open     = useWorkspaceCanvas(s => s.debugHudOpen);
  const lod      = useWorkspaceCanvas(s => s.lod);
  const viewport = useWorkspaceCanvas(s => s.viewport);
  const layout   = useWorkspaceCanvas(s => s.layout);
  const visible       = useWorkspaceCanvas(s => s.visibleScene);
  const clusters      = useWorkspaceCanvas(s => s.clusterScene);
  const superclusters = useWorkspaceCanvas(s => s.superclusterScene);
  const graph         = useWorkspaceCanvas(s => s.graph);
  // Worker RTT proxy — we don't have a dedicated telemetry field yet
  // (see workspace-canvas-store.ts TODO), so the display uses
  // `layoutProgress.lastUpdateMs` as the closest available signal. This
  // gives us the full request→layout-ready duration at layout time.
  const layoutProgress = useWorkspaceCanvas(s => s.layoutProgress);

  const showEdges    = useWorkspaceCanvas(s => s.showEdges);
  const showGridBg   = useWorkspaceCanvas(s => s.showGridBg);
  const showHitLayers = useWorkspaceCanvas(s => s.showHitLayers);
  const forceLod     = useWorkspaceCanvas(s => s.forceLod);

  // Per-second FPS tick — RAF loop that only updates the displayed number at
  // 2 Hz so we don't trigger 60 re-renders/s from the HUD itself.
  const [fps, setFps] = useState(0);
  // Frame-time stats rolled into HUD state at 2 Hz (same cadence as fps). We
  // keep the rolling window in a ref to avoid re-renders on every frame.
  const [frameStats, setFrameStats] = useState({ p50: 0, p95: 0 });
  // Draw calls sampled at 2 Hz alongside fps.
  const [drawCalls, setDrawCalls] = useState<number | null>(null);

  const frameCount = useRef(0);
  const lastSample = useRef(performance.now());
  const lastFrame = useRef(performance.now());
  // Ring buffer of frame deltas (ms).
  const frameTimes = useRef<number[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const frameDelta = now - lastFrame.current;
      lastFrame.current = now;
      // Push into ring buffer — O(1) amortized since we cap at FRAME_WINDOW.
      const buf = frameTimes.current;
      if (buf.length >= FRAME_WINDOW) buf.shift();
      buf.push(frameDelta);

      const dt = now - lastSample.current;
      if (dt >= 500) {
        setFps(Math.round((frameCount.current * 1000) / dt));
        frameCount.current = 0;
        lastSample.current = now;
        // Compute p50/p95 from a sorted copy of the current window.
        const sorted = [...buf].sort((a, b) => a - b);
        setFrameStats({
          p50: percentile(sorted, 50),
          p95: percentile(sorted, 95),
        });
        setDrawCalls(readPixiDrawCalls());
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
  const superTotal = layout?.superclusters?.length ?? 0;
  const superVisible = superclusters?.superclusters.length ?? 0;
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

        <span className="ws-debug__k">frame p50/p95</span>
        <span className="ws-debug__v">
          {frameStats.p50 > 0 ? `${frameStats.p50.toFixed(1)} / ${frameStats.p95.toFixed(1)}ms` : "—"}
        </span>

        <span className="ws-debug__k">draws</span>
        <span className="ws-debug__v">
          {drawCalls !== null ? drawCalls.toLocaleString() : "—"}
        </span>

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
            scope for this HUD change. Display placeholders so the row
            layout is ready to wire up when the renderer exposes its
            counters. TODO(canvas-pixi): expose pool counts on window.__pixi. */}
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
