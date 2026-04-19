import { useEffect, useRef, useState } from "react";
import { getPixiDebugHook } from "@quanta/canvas-pixi";
import { estimateUniverseMemory, type UniverseMemorySnapshot } from "../../lib/estimate-memory";

// Rolling frame-time window for p50/p95. 120 samples ≈ 2s at 60fps which is
// the right horizon for "how smooth does it feel right now" without being
// dominated by stale frames from before the last interaction.
const FRAME_WINDOW = 120;
// Any frame ≥ this many ms is a "jank" frame (a drop below ~30fps).
const LONG_FRAME_MS = 33;

interface FrameStats {
  p50: number;
  p95: number;
  longCount: number;
  longPct: number;
}

interface PixiMem {
  textures: number | null;
  buffers: number | null;
  batches: number | null;
}

// Fixed-size Float32Array ring buffer for per-frame deltas. Avoids the
// `Array.shift()` O(n) allocator churn in the 60 Hz sample path.
interface FrameRing {
  buf: Float32Array;
  head: number;
  filled: number;
}

function createFrameRing(size: number): FrameRing {
  return { buf: new Float32Array(size), head: 0, filled: 0 };
}

function pushFrame(ring: FrameRing, dt: number): void {
  ring.buf[ring.head] = dt;
  ring.head = (ring.head + 1) % ring.buf.length;
  if (ring.filled < ring.buf.length) ring.filled++;
}

const sortScratch = new Float32Array(FRAME_WINDOW);

function computeStats(ring: FrameRing): FrameStats {
  const n = ring.filled;
  if (n === 0) return { p50: 0, p95: 0, longCount: 0, longPct: 0 };
  let longCount = 0;
  for (let i = 0; i < n; i++) {
    const v = ring.buf[i];
    sortScratch[i] = v;
    if (v >= LONG_FRAME_MS) longCount++;
  }
  const view = sortScratch.subarray(0, n);
  view.sort();
  const p50Idx = Math.min(n - 1, Math.max(0, Math.floor(0.5 * n)));
  const p95Idx = Math.min(n - 1, Math.max(0, Math.floor(0.95 * n)));
  return {
    p50: view[p50Idx],
    p95: view[p95Idx],
    longCount,
    longPct: (longCount / n) * 100,
  };
}

function readPixiStats(): { drawCalls: number | null; mem: PixiMem } {
  const hook = getPixiDebugHook();
  const r = hook?.app?.renderer;
  const rawDrawCalls = r?.statistics?.drawCalls;
  const drawCalls = typeof rawDrawCalls === "number" ? rawDrawCalls : null;
  // Pixi v8 doesn't expose batch counters on the public renderer surface —
  // we probe optional internals and fall back to null so the UI shows "—".
  const managedTextures = r?.texture?.managedTextures;
  const managedBuffers = r?.buffer?.managedBuffers;
  const mem: PixiMem = {
    textures: Array.isArray(managedTextures) ? managedTextures.length : null,
    buffers: Array.isArray(managedBuffers) ? managedBuffers.length : null,
    batches: null,
  };
  return { drawCalls, mem };
}

interface HeapStats { used: number; limit: number }
function readHeap(): HeapStats | null {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } };
  if (!perf.memory) return null;
  return { used: perf.memory.usedJSHeapSize, limit: perf.memory.jsHeapSizeLimit };
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export function FpsSection() {
  const [fps, setFps] = useState(0);
  const [frameStats, setFrameStats] = useState<FrameStats>({ p50: 0, p95: 0, longCount: 0, longPct: 0 });
  const [drawCalls, setDrawCalls] = useState<number | null>(null);
  const [mem, setMem] = useState<PixiMem>({ textures: null, buffers: null, batches: null });
  const [heap, setHeap] = useState<HeapStats | null>(null);
  const [universe, setUniverse] = useState<UniverseMemorySnapshot | null>(null);

  const frameCount = useRef(0);
  const lastSample = useRef(performance.now());
  const lastFrame = useRef(performance.now());
  const ring = useRef<FrameRing>(createFrameRing(FRAME_WINDOW));

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const frameDelta = now - lastFrame.current;
      lastFrame.current = now;
      pushFrame(ring.current, frameDelta);

      const dt = now - lastSample.current;
      if (dt >= 500) {
        setFps(Math.round((frameCount.current * 1000) / dt));
        frameCount.current = 0;
        lastSample.current = now;
        setFrameStats(computeStats(ring.current));
        const stats = readPixiStats();
        setDrawCalls(stats.drawCalls);
        setMem(stats.mem);
        setHeap(readHeap());
        setUniverse(estimateUniverseMemory());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fpsColor = fps >= 55 ? undefined : fps >= 40 ? "#fbbf24" : "#f87171";

  return (
    <>
      <span className="ws-debug__k">FPS</span>
      <span className="ws-debug__v" style={fpsColor ? { color: fpsColor } : undefined}>{fps}</span>

      <span className="ws-debug__k">프레임 p50/p95</span>
      <span className="ws-debug__v">
        {frameStats.p50 > 0 ? `${frameStats.p50.toFixed(1)} / ${frameStats.p95.toFixed(1)}ms` : "—"}
      </span>

      <span className="ws-debug__k" title="최근 120 프레임 중 33ms 이상">끊김</span>
      <span className="ws-debug__v">
        {frameStats.longCount > 0
          ? `${frameStats.longCount} (${frameStats.longPct.toFixed(0)}%)`
          : "0"}
      </span>

      <span className="ws-debug__k">드로우 콜</span>
      <span className="ws-debug__v">
        {drawCalls !== null ? drawCalls.toLocaleString() : "—"}
      </span>

      <span className="ws-debug__k">텍스처</span>
      <span className="ws-debug__v">
        {mem.textures !== null ? mem.textures.toLocaleString() : "—"}
      </span>

      <span className="ws-debug__k">버퍼</span>
      <span className="ws-debug__v">
        {mem.buffers !== null ? mem.buffers.toLocaleString() : "—"}
      </span>

      {heap && (
        <>
          <span className="ws-debug__k">힙</span>
          <span className="ws-debug__v" title={`${fmtBytes(heap.used)} / ${fmtBytes(heap.limit)}`}>
            {fmtBytes(heap.used)} ({((heap.used / heap.limit) * 100).toFixed(0)}%)
          </span>
        </>
      )}

      {universe && universe.breakdown.total > 0 && (
        <>
          <span className="ws-debug__k" title="Code Universe 데이터 구조(그래프+레이아웃+그라운드)가 차지하는 추정 바이트. GPU 버퍼와 워커 힙은 제외.">유니버스</span>
          <span
            className="ws-debug__v"
            title={
              `그래프:  ${fmtBytes(universe.breakdown.graph)}\n` +
              `레이아웃: ${fmtBytes(universe.breakdown.layout)}\n` +
              `씬: ${fmtBytes(universe.breakdown.visibleScene + universe.breakdown.clusterScene + universe.breakdown.superclusterScene)}\n` +
              `그라운드: ${fmtBytes(universe.breakdown.groundData)}  (파일 ${universe.counts.groundEntries}개)\n` +
              (heap ? `힙의 약 ${((universe.breakdown.total / heap.used) * 100).toFixed(0)}%` : "")
            }
          >
            {fmtBytes(universe.breakdown.total)}
          </span>
        </>
      )}
    </>
  );
}
