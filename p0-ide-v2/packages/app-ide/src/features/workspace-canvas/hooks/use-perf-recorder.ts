import { useEffect, useRef, useState } from "react";
import { getEdgeStaticPerfStats } from "@quanta/canvas-pixi";
import { viewportStore } from "../store/viewport-store";
import { sceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { estimateUniverseMemory } from "../lib/estimate-memory";

// ───────────────────────────────────────────────────────────────────
// Perf recorder — slow/recovery-aware.
//
// Trigger: FPS drops below LOW_FPS_THRESHOLD for TRIGGER_WINDOW frames.
//
// Recording phases (tagged onto each frame + emitted as transition markers):
//   - "pre":        frames BEFORE the drop, captured from the ring buffer.
//   - "slow":       from trigger onwards while fps < RECOVERED_THRESHOLD.
//   - "recovering": fps ≥ RECOVERED_THRESHOLD but not yet sustained.
//   - "fast":       fps sustained above RECOVERED_THRESHOLD for RECOVER_WINDOW
//                   consecutive frames. We keep recording a FAST_TAIL so slow
//                   vs. fast frames have comparable sample size.
//
// Dump shape (NDJSON):
//   {kind:"meta", …}
//   {kind:"frame", phase:"pre"|"slow"|"recovering"|"fast", …}
//   {kind:"transition", from, to, t}                          // emitted at each phase edge
//   {kind:"summary", slowFrames, fastFrames, slowP50Dt, slowP95Dt,
//                    fastP50Dt, fastP95Dt, deltaDt, diffHints:[…] }
//
// The "summary" block is the first thing a reader grep's for — it surfaces
// the slow-vs-fast delta and the most likely offending signals (e.g., edges
// jumped from 0→2800 between fast and slow frames).
// ───────────────────────────────────────────────────────────────────

const LOW_FPS_THRESHOLD = 45;
const RECOVERED_THRESHOLD = 55;           // "clearly smooth again"
const TRIGGER_WINDOW = 5;
const RECOVER_WINDOW = 60;                 // frames of sustained fast fps that mark recovery
const PRE_FRAMES = 180;                    // ring buffer size (3s @ 60fps)
const MAX_SLOW_FRAMES = 600;               // hard cap on slow phase (10s @ 60fps)
const FAST_TAIL_FRAMES = 120;              // frames to keep recording after recovery
const COOLDOWN_MS = 30_000;
// Manual-mode cap: 10 min @ 60fps ≈ 36000 frames. Prevents unbounded
// captureBuf growth if the user forgets to stop.
const MAX_MANUAL_FRAMES = 36_000;
// Universe memory estimate is O(graph+groundData) — potentially thousands
// of items. Sample at lower frequency and reuse the last value in between.
const MEMORY_SAMPLE_EVERY_N_FRAMES = 6;    // ~10 Hz at 60fps

type Phase = "pre" | "slow" | "recovering" | "fast" | "manual";

export interface FrameSample {
  t: number;
  dtMs: number;
  fps: number;
  phase?: Phase;                           // filled in on dump
  lod: string;
  scale: number;
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
  totalBoundsW: number;
  totalBoundsH: number;
  graphFiles: number;
  graphEdges: number;
  visibleFiles: number;
  visibleEdges: number;
  clustersTotal: number;
  clustersVisible: number;
  superclustersTotal: number;
  superclustersVisible: number;
  sceneKind: "file" | "cluster" | "supercluster" | "none";
  showEdges: boolean;
  drawCalls: number | null;
  workerLayout: boolean;
  workerAggregates: boolean;
  // Universe memory estimate (bytes). Sampled at MEMORY_SAMPLE_EVERY_N_FRAMES;
  // values between samples carry the last reading forward.
  memUniverseTotal: number;
  memGraph: number;
  memLayout: number;
  memGround: number;
  // Chromium-only: performance.memory.usedJSHeapSize (null elsewhere).
  heapUsed: number | null;
  // EdgeStaticRenderer per-phase timings (ms) for the last redraw().
  // Populated for every sample but equal to the previous frame's values
  // on frames where the renderer didn't redraw (no edge state change).
  // Consumers wanting "this frame only" should diff `edgeRedrawCount`
  // between samples.
  edgeBundleMs: number;
  edgeMainLoopMs: number;
  edgeDiffRemovedMs: number;
  edgeCommitMs: number;
  edgeTotalMs: number;
  edgeDrawn: number;
  edgeRedrawCount: number;
}

export interface Transition {
  from: Phase;
  to: Phase;
  t: number;
}

export interface Summary {
  slowFrames: number;
  fastFrames: number;
  slowP50Dt: number;
  slowP95Dt: number;
  fastP50Dt: number;
  fastP95Dt: number;
  deltaDt: number;
  /** Human-readable hypotheses ranked by magnitude of change between fast and slow phases. */
  diffHints: string[];
}

export interface RecorderStatus {
  enabled: boolean;
  capturing: boolean;
  manual: boolean;           // user-driven recording (vs FPS-triggered)
  phase: Phase | null;
  capturedFrames: number;    // live frame count during manual capture
  dumpsSent: number;
  lastDumpAt: number | null;
  lastDumpPath: string | null;
  lastError: string | null;
  logDir: string | null;
}

interface RecorderRefs {
  ring: FrameSample[];
  ringIdx: number;
  ringFull: boolean;
  lowStreak: number;
  capturing: boolean;
  manual: boolean;
  captureBuf: FrameSample[];
  phasePerFrame: Phase[];
  transitions: Transition[];
  phase: Phase;
  slowFrameCount: number;
  recoverStreak: number;
  tailCount: number;
  lastDumpTime: number;
}

// Cached memory sample — refreshed by sampleCurrentFrame at
// MEMORY_SAMPLE_EVERY_N_FRAMES cadence. Module-level so ring-buffer
// samples captured before the first refresh get a zero reading rather
// than a stale one from a previous session.
let memTickCounter = 0;
let cachedMem: { total: number; graph: number; layout: number; ground: number } = {
  total: 0, graph: 0, layout: 0, ground: 0,
};
function readHeapUsed(): number | null {
  const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
  return perf.memory?.usedJSHeapSize ?? null;
}

function sampleCurrentFrame(dtMs: number): FrameSample {
  // Read each sub-store individually to avoid allocating the facade's
  // merged snapshot on every tick. Sub-store getState() is O(1) and
  // returns a stable reference.
  const vpState = viewportStore.getState();
  const scState = sceneStore.getState();
  const itState = interactionStore.getState();
  const stState = renderSettingsStore.getState();

  const vp = vpState.viewport;
  const tb = scState.layout?.totalBounds;
  const scene =
    scState.superclusterScene ? "supercluster" :
    scState.clusterScene ? "cluster" :
    scState.visibleScene ? "file" : "none";
  let drawCalls: number | null;
  try {
    drawCalls =
      (globalThis as { __pixi?: { app?: { renderer?: { statistics?: { drawCalls?: number } } } } })
        .__pixi?.app?.renderer?.statistics?.drawCalls ?? null;
  } catch { drawCalls = null; }

  memTickCounter++;
  if (memTickCounter % MEMORY_SAMPLE_EVERY_N_FRAMES === 0) {
    const snap = estimateUniverseMemory();
    cachedMem = {
      total: snap.breakdown.total,
      graph: snap.breakdown.graph,
      layout: snap.breakdown.layout,
      ground: snap.breakdown.groundData,
    };
  }

  // Edge-renderer per-phase snapshot — overwritten at the end of every
  // `EdgeStaticRenderer.redraw()`. On frames where the renderer didn't
  // redraw (scene state stable), the values reflect the most recent
  // redraw, so diffing `edgeRedrawCount` between samples tells readers
  // whether the timing is "stale" or fresh.
  const edgeStats = getEdgeStaticPerfStats();

  return {
    t: performance.now(),
    dtMs,
    fps: dtMs > 0 ? Math.round(1000 / dtMs) : 0,
    lod: itState.lod,
    scale: vp.scale,
    viewportX: vp.x,
    viewportY: vp.y,
    viewportW: vp.width,
    viewportH: vp.height,
    totalBoundsW: tb?.w ?? 0,
    totalBoundsH: tb?.h ?? 0,
    graphFiles: scState.graph?.files.length ?? 0,
    graphEdges: scState.graph?.fileEdges.length ?? 0,
    visibleFiles: scState.visibleScene?.files.length ?? 0,
    visibleEdges: scState.visibleScene?.edges.length ?? 0,
    clustersTotal: scState.layout?.clusters?.length ?? 0,
    clustersVisible: scState.clusterScene?.clusters.length ?? 0,
    superclustersTotal: scState.layout?.superclusters?.length ?? 0,
    superclustersVisible: scState.superclusterScene?.superclusters.length ?? 0,
    sceneKind: scene,
    showEdges: stState.showEdges,
    drawCalls,
    workerLayout: scState.workerLayout,
    workerAggregates: scState.workerAggregates,
    memUniverseTotal: cachedMem.total,
    memGraph: cachedMem.graph,
    memLayout: cachedMem.layout,
    memGround: cachedMem.ground,
    heapUsed: readHeapUsed(),
    edgeBundleMs: edgeStats.bundleMs,
    edgeMainLoopMs: edgeStats.mainLoopMs,
    edgeDiffRemovedMs: edgeStats.diffRemovedMs,
    edgeCommitMs: edgeStats.commitMs,
    edgeTotalMs: edgeStats.totalMs,
    edgeDrawn: edgeStats.drawnEdges,
    edgeRedrawCount: edgeStats.redrawCount,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/**
 * Build the summary. We diff `avg(slow)` vs `avg(fast)` across a handful of
 * numeric signals and surface the biggest movers as plain-English hints.
 * Hypothesis ranking uses relative delta (|slow-fast| / max(|slow|,|fast|,1))
 * so a 2x edge count swing reads louder than a 1-file swing.
 */
function buildSummary(
  phases: Phase[],
  frames: FrameSample[],
): Summary {
  const slow: FrameSample[] = [];
  const fast: FrameSample[] = [];
  for (let i = 0; i < frames.length; i++) {
    const p = phases[i];
    if (p === "slow") slow.push(frames[i]);
    else if (p === "fast") fast.push(frames[i]);
  }
  const slowDts = slow.map(f => f.dtMs).sort((a, b) => a - b);
  const fastDts = fast.map(f => f.dtMs).sort((a, b) => a - b);
  const slowP50 = percentile(slowDts, 50);
  const slowP95 = percentile(slowDts, 95);
  const fastP50 = percentile(fastDts, 50);
  const fastP95 = percentile(fastDts, 95);

  // Compare mean values of instrumented signals between slow and fast.
  const signals: Array<{ key: string; extract: (f: FrameSample) => number }> = [
    { key: "visibleFiles",         extract: f => f.visibleFiles },
    { key: "visibleEdges",         extract: f => f.visibleEdges },
    { key: "clustersVisible",      extract: f => f.clustersVisible },
    { key: "superclustersVisible", extract: f => f.superclustersVisible },
    { key: "scale",                extract: f => f.scale },
    { key: "drawCalls",            extract: f => f.drawCalls ?? 0 },
    { key: "showEdges",            extract: f => (f.showEdges ? 1 : 0) },
    { key: "workerLayout",         extract: f => (f.workerLayout ? 1 : 0) },
    { key: "workerAggregates",     extract: f => (f.workerAggregates ? 1 : 0) },
  ];

  type Movement = { key: string; slow: number; fast: number; relDelta: number; absDelta: number };
  const movements: Movement[] = [];
  for (const sig of signals) {
    const s = avg(slow.map(sig.extract));
    const fv = avg(fast.map(sig.extract));
    const absDelta = s - fv;
    const denom = Math.max(Math.abs(s), Math.abs(fv), 1);
    movements.push({ key: sig.key, slow: s, fast: fv, relDelta: absDelta / denom, absDelta });
  }

  // LOD distribution is categorical — detect which LODs dominate each phase.
  const lodCount = (fs: FrameSample[]) => {
    const c: Record<string, number> = {};
    for (const f of fs) c[f.lod] = (c[f.lod] ?? 0) + 1;
    return c;
  };
  const slowLods = lodCount(slow);
  const fastLods = lodCount(fast);
  const sceneCount = (fs: FrameSample[]) => {
    const c: Record<string, number> = {};
    for (const f of fs) c[f.sceneKind] = (c[f.sceneKind] ?? 0) + 1;
    return c;
  };
  const slowScenes = sceneCount(slow);
  const fastScenes = sceneCount(fast);

  const hints: string[] = [];
  // Sort movements by |relDelta| desc — biggest mover first.
  const sortedMv = [...movements].sort((a, b) => Math.abs(b.relDelta) - Math.abs(a.relDelta));
  for (const m of sortedMv.slice(0, 4)) {
    if (Math.abs(m.relDelta) < 0.05) continue;    // <5% change — not informative
    const dir = m.absDelta > 0 ? "↑" : "↓";
    hints.push(`${m.key}: slow=${m.slow.toFixed(1)} fast=${m.fast.toFixed(1)} (${dir}${(Math.abs(m.relDelta) * 100).toFixed(0)}%)`);
  }
  if (JSON.stringify(slowLods) !== JSON.stringify(fastLods)) {
    hints.push(`lod: slow=${JSON.stringify(slowLods)} fast=${JSON.stringify(fastLods)}`);
  }
  if (JSON.stringify(slowScenes) !== JSON.stringify(fastScenes)) {
    hints.push(`scene: slow=${JSON.stringify(slowScenes)} fast=${JSON.stringify(fastScenes)}`);
  }

  return {
    slowFrames: slow.length,
    fastFrames: fast.length,
    slowP50Dt: slowP50,
    slowP95Dt: slowP95,
    fastP50Dt: fastP50,
    fastP95Dt: fastP95,
    deltaDt: slowP50 - fastP50,
    diffHints: hints,
  };
}

// ───────────────────────────────────────────────────────────────────
// Deterministic text summary — designed so an LLM reader (or human
// skimming `head -30 perf-*.ndjson`) gets the key facts without
// parsing the per-frame body.
//
// Contract: same input → same output bytes. No wall-clock values, no
// iteration-order dependencies. Numeric formats use fixed decimals so
// small float perturbations don't change strings. Key order is fixed.
// ───────────────────────────────────────────────────────────────────
function fmtMB(n: number): string {
  return `${(n / (1024 * 1024)).toFixed(2)}MB`;
}
function stats(xs: number[]): { min: number; p50: number; p95: number; max: number; mean: number } {
  if (xs.length === 0) return { min: 0, p50: 0, p95: 0, max: 0, mean: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  let sum = 0;
  for (const x of sorted) sum += x;
  return {
    min: sorted[0],
    p50: sorted[Math.floor(0.5 * sorted.length)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
  };
}
function histogram<T extends string>(xs: T[]): Record<T, number> {
  const h = {} as Record<T, number>;
  for (const x of xs) h[x] = (h[x] ?? 0) + 1;
  return h;
}
function formatHistogram(h: Record<string, number>): string {
  // Fixed order by value desc then key asc for determinism.
  const entries = Object.entries(h).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.map(([k, v]) => `${k}=${v}`).join(" ");
}

function buildLlmSummary(
  trigger: string,
  frames: FrameSample[],
  phases: Phase[],
  transitions: Transition[],
): string {
  const n = frames.length;
  if (n === 0) {
    return [
      "# quanta-perf-summary v1",
      `trigger: ${trigger}`,
      "frames: 0",
      "(no samples captured)",
    ].join("\n");
  }

  const t0 = frames[0].t;
  const tLast = frames[n - 1].t;
  const durationMs = tLast - t0;

  const dt = stats(frames.map(f => f.dtMs));
  const fps = stats(frames.map(f => f.fps));
  const scale = stats(frames.map(f => f.scale));
  const mem = stats(frames.map(f => f.memUniverseTotal));
  const memGraph = stats(frames.map(f => f.memGraph));
  const memLayout = stats(frames.map(f => f.memLayout));
  const memGround = stats(frames.map(f => f.memGround));
  const heapVals = frames.map(f => f.heapUsed).filter((v): v is number => v !== null);
  const heap = stats(heapVals);
  const drawVals = frames.map(f => f.drawCalls).filter((v): v is number => v !== null);
  const draws = stats(drawVals);

  const lodHist = histogram(frames.map(f => f.lod));
  const sceneHist = histogram(frames.map(f => f.sceneKind));
  const phaseHist = histogram(phases);
  const longFrames = frames.filter(f => f.dtMs >= 33).length;

  const files0 = frames[0].graphFiles;
  const edges0 = frames[0].graphEdges;

  // Find the 3 biggest peaks in dtMs (slowest frames) — useful anchors.
  const slowest = frames
    .map((f, i) => ({ i, dt: f.dtMs, t: f.t - t0, lod: f.lod, scene: f.sceneKind, vis: f.visibleFiles, ve: f.visibleEdges }))
    .sort((a, b) => b.dt - a.dt)
    .slice(0, 3);

  const lines: string[] = [];
  lines.push("# quanta-perf-summary v1");
  lines.push("# Fixed-format deterministic summary. See `frame` kind lines for raw samples.");
  lines.push("");
  lines.push("[session]");
  lines.push(`trigger:        ${trigger}`);
  lines.push(`frames:         ${n}`);
  lines.push(`duration_ms:    ${durationMs.toFixed(0)}`);
  lines.push(`long_frames:    ${longFrames} (${((longFrames / n) * 100).toFixed(1)}%)`);
  lines.push(`graph_files:    ${files0}`);
  lines.push(`graph_edges:    ${edges0}`);
  lines.push("");
  lines.push("[frame_dt_ms]");
  lines.push(`min:  ${dt.min.toFixed(2)}`);
  lines.push(`p50:  ${dt.p50.toFixed(2)}`);
  lines.push(`p95:  ${dt.p95.toFixed(2)}`);
  lines.push(`max:  ${dt.max.toFixed(2)}`);
  lines.push(`mean: ${dt.mean.toFixed(2)}`);
  lines.push("");
  lines.push("[fps]");
  lines.push(`min:  ${fps.min}`);
  lines.push(`p50:  ${fps.p50}`);
  lines.push(`p95:  ${fps.p95}`);
  lines.push(`max:  ${fps.max}`);
  lines.push(`mean: ${fps.mean.toFixed(1)}`);
  lines.push("");
  lines.push("[viewport_scale]");
  lines.push(`min:  ${scale.min.toFixed(4)}`);
  lines.push(`p50:  ${scale.p50.toFixed(4)}`);
  lines.push(`max:  ${scale.max.toFixed(4)}`);
  lines.push("");
  lines.push("[universe_memory]");
  lines.push(`total.min:  ${fmtMB(mem.min)}`);
  lines.push(`total.p50:  ${fmtMB(mem.p50)}`);
  lines.push(`total.max:  ${fmtMB(mem.max)}`);
  lines.push(`total.mean: ${fmtMB(mem.mean)}`);
  lines.push(`graph.mean:  ${fmtMB(memGraph.mean)}`);
  lines.push(`layout.mean: ${fmtMB(memLayout.mean)}`);
  lines.push(`ground.mean: ${fmtMB(memGround.mean)}`);
  lines.push("");
  if (heapVals.length > 0) {
    lines.push("[js_heap_used]");
    lines.push(`min:  ${fmtMB(heap.min)}`);
    lines.push(`p50:  ${fmtMB(heap.p50)}`);
    lines.push(`max:  ${fmtMB(heap.max)}`);
    lines.push(`mean: ${fmtMB(heap.mean)}`);
    lines.push(`universe_frac_of_heap.mean: ${heap.mean > 0 ? ((mem.mean / heap.mean) * 100).toFixed(1) : "0.0"}%`);
    lines.push("");
  }
  if (drawVals.length > 0) {
    lines.push("[pixi_draw_calls]");
    lines.push(`min:  ${draws.min}`);
    lines.push(`p50:  ${draws.p50}`);
    lines.push(`max:  ${draws.max}`);
    lines.push(`mean: ${draws.mean.toFixed(1)}`);
    lines.push("");
  }

  // Edge-renderer per-phase timings. Only meaningful when the renderer
  // actually redrew during the sample window; if `edgeRedrawCount` is
  // flat across the whole capture, the timings are stale "last known"
  // values and we surface that explicitly so a reader doesn't chase a
  // phantom bottleneck. Otherwise we show p50/p95 across the fresh
  // samples only (frames where the counter ticked).
  const firstRedrawCount = frames[0].edgeRedrawCount;
  const lastRedrawCount = frames[n - 1].edgeRedrawCount;
  const freshEdge = frames.filter((_, i) => {
    if (i === 0) return true;
    return frames[i].edgeRedrawCount !== frames[i - 1].edgeRedrawCount;
  });
  const anyEdgeFresh = lastRedrawCount > firstRedrawCount;
  lines.push("[edge_renderer_ms]");
  if (!anyEdgeFresh) {
    lines.push(`(no redraw during capture — lastKnownTotal=${frames[n-1].edgeTotalMs.toFixed(2)}ms drawn=${frames[n-1].edgeDrawn})`);
  } else {
    const bundleStats = stats(freshEdge.map(f => f.edgeBundleMs));
    const mainStats = stats(freshEdge.map(f => f.edgeMainLoopMs));
    const diffStats = stats(freshEdge.map(f => f.edgeDiffRemovedMs));
    const commitStats = stats(freshEdge.map(f => f.edgeCommitMs));
    const totalStats = stats(freshEdge.map(f => f.edgeTotalMs));
    const drawnStats = stats(freshEdge.map(f => f.edgeDrawn));
    lines.push(`redraws:       ${lastRedrawCount - firstRedrawCount} (${((lastRedrawCount - firstRedrawCount) / n * 100).toFixed(1)}% of frames)`);
    lines.push(`bundle.p50:    ${bundleStats.p50.toFixed(2)}  p95: ${bundleStats.p95.toFixed(2)}  max: ${bundleStats.max.toFixed(2)}`);
    lines.push(`mainloop.p50:  ${mainStats.p50.toFixed(2)}  p95: ${mainStats.p95.toFixed(2)}  max: ${mainStats.max.toFixed(2)}`);
    lines.push(`diffRem.p50:   ${diffStats.p50.toFixed(2)}  p95: ${diffStats.p95.toFixed(2)}  max: ${diffStats.max.toFixed(2)}`);
    lines.push(`commit.p50:    ${commitStats.p50.toFixed(2)}  p95: ${commitStats.p95.toFixed(2)}  max: ${commitStats.max.toFixed(2)}`);
    lines.push(`total.p50:     ${totalStats.p50.toFixed(2)}  p95: ${totalStats.p95.toFixed(2)}  max: ${totalStats.max.toFixed(2)}`);
    lines.push(`drawn.p50:     ${drawnStats.p50}  p95: ${drawnStats.p95}  max: ${drawnStats.max}`);
  }
  lines.push("");
  lines.push("[lod_distribution]");
  lines.push(formatHistogram(lodHist));
  lines.push("");
  lines.push("[scene_distribution]");
  lines.push(formatHistogram(sceneHist));
  lines.push("");
  lines.push("[phase_distribution]");
  lines.push(formatHistogram(phaseHist));
  lines.push("");
  lines.push("[transitions]");
  if (transitions.length === 0) {
    lines.push("(none)");
  } else {
    for (const tr of transitions) {
      lines.push(`+${(tr.t - t0).toFixed(0)}ms ${tr.from}->${tr.to}`);
    }
  }
  lines.push("");
  lines.push("[slowest_frames]");
  for (const s of slowest) {
    lines.push(`+${s.t.toFixed(0)}ms dt=${s.dt.toFixed(2)}ms lod=${s.lod} scene=${s.scene} vis_files=${s.vis} vis_edges=${s.ve}`);
  }
  return lines.join("\n");
}

async function postDump(
  trigger: string,
  frames: FrameSample[],
  phases: Phase[],
  transitions: Transition[],
): Promise<{ path?: string; error?: string }> {
  // Annotate frames with their phase for easy grep.
  const annotated = frames.map((f, i) => ({ ...f, phase: phases[i] ?? "slow" }));
  const summary = buildSummary(phases, frames);

  // We send `frames` (flat) + `transitions` + `summary` + `llm-summary` as
  // separate logical sections; the server plugin converts each to an NDJSON
  // line. The `llm-summary` block is first so `head -N perf-*.ndjson` gives
  // a human/LLM-readable digest without parsing the rest.
  const llmSummary = buildLlmSummary(trigger, frames, phases, transitions);
  const extras: Array<Record<string, unknown>> = [
    { _kind: "llm-summary", text: llmSummary },
    ...transitions.map(t => ({ _kind: "transition", ...t })),
    { _kind: "summary", ...summary },
  ];

  const meta = {
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    screenW: window.innerWidth,
    screenH: window.innerHeight,
    frameCount: annotated.length,
    triggerThresholdFps: LOW_FPS_THRESHOLD,
    recoveredThresholdFps: RECOVERED_THRESHOLD,
    repoRoot: sceneStore.getState().repoRoot,
    summary,                               // duplicated into meta so `head -1` shows it
  };

  try {
    const res = await fetch("/__perf/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Extras first (llm-summary, transitions, summary) so the digest is
      // near the top of the file — readers can `head -30` for an overview.
      body: JSON.stringify({ trigger, frames: [...extras, ...annotated], meta }),
    });
    if (!res.ok) return { error: `server ${res.status}` };
    const body = (await res.json()) as { path?: string };
    return { path: body.path };
  } catch (err) {
    return { error: String(err) };
  }
}

// Default off in dev & prod — the recorder only arms when the user toggles
// it on from the DebugHud. `enabledInitial` is kept as an escape hatch so
// tests (or future auto-start flows) can force it on.
export function usePerfRecorder(enabledInitial = false): {
  status: RecorderStatus;
  setEnabled: (v: boolean) => void;
  dumpNow: () => void;
  startManual: () => void;
  stopManual: () => void;
} {
  const [enabled, setEnabled] = useState(enabledInitial);
  const [manualOn, setManualOn] = useState(false);
  const [status, setStatus] = useState<RecorderStatus>({
    enabled: enabledInitial,
    capturing: false,
    manual: false,
    phase: null,
    capturedFrames: 0,
    dumpsSent: 0,
    lastDumpAt: null,
    lastDumpPath: null,
    lastError: null,
    logDir: null,
  });

  const refs = useRef<RecorderRefs>({
    ring: new Array(PRE_FRAMES),
    ringIdx: 0,
    ringFull: false,
    lowStreak: 0,
    capturing: false,
    manual: false,
    captureBuf: [],
    phasePerFrame: [],
    transitions: [],
    phase: "fast",
    slowFrameCount: 0,
    recoverStreak: 0,
    tailCount: 0,
    lastDumpTime: -Infinity,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/__perf/dir")
      .then(r => r.json())
      .then((d: { dir?: string }) => {
        if (!cancelled && d.dir) setStatus(s => ({ ...s, logDir: d.dir! }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setStatus(s => ({ ...s, enabled }));
  }, [enabled]);

  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();

    const finalizeAndDump = (trigger: string) => {
      const r = refs.current;
      const frames = [...r.captureBuf];
      const phases = [...r.phasePerFrame];
      const transitions = [...r.transitions];
      r.capturing = false;
      r.captureBuf.length = 0;
      r.phasePerFrame.length = 0;
      r.transitions.length = 0;
      r.phase = "fast";
      r.lowStreak = 0;
      r.slowFrameCount = 0;
      r.recoverStreak = 0;
      r.tailCount = 0;
      r.lastDumpTime = performance.now();
      setStatus(s => ({ ...s, capturing: false, phase: null }));
      void postDump(trigger, frames, phases, transitions).then(result => {
        setStatus(s => ({
          ...s,
          dumpsSent: s.dumpsSent + 1,
          lastDumpAt: performance.now(),
          lastDumpPath: result.path ?? s.lastDumpPath,
          lastError: result.error ?? null,
        }));
      });
    };

    const transitionTo = (next: Phase, t: number) => {
      const r = refs.current;
      if (r.phase === next) return;
      r.transitions.push({ from: r.phase, to: next, t });
      r.phase = next;
      setStatus(s => ({ ...s, phase: next }));
    };

    const tick = () => {
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;

      const r = refs.current;
      const active = enabled || r.manual;
      if (active) {
        const sample = sampleCurrentFrame(dt);

        // Always fill the ring buffer — it's our "pre-drop" history.
        r.ring[r.ringIdx] = sample;
        r.ringIdx = (r.ringIdx + 1) % PRE_FRAMES;
        if (r.ringIdx === 0) r.ringFull = true;

        if (r.manual && r.capturing) {
          // Manual mode: accumulate every frame with phase "manual" until
          // the user stops or we hit the hard cap.
          r.captureBuf.push(sample);
          r.phasePerFrame.push("manual");
          // Publish live count so the HUD can show progress. Throttle to once
          // per second so setState isn't in the RAF hot path every frame.
          if (r.captureBuf.length % 60 === 0) {
            const frames = r.captureBuf.length;
            setStatus(s => (s.capturedFrames === frames ? s : { ...s, capturedFrames: frames }));
          }
          if (r.captureBuf.length >= MAX_MANUAL_FRAMES) {
            r.manual = false;
            setManualOn(false);
            finalizeAndDump("manual-cap");
          }
        } else if (r.capturing) {
          // Decide the phase for THIS frame based on current fps + prior phase.
          let phaseForThisFrame: Phase = r.phase;
          if (r.phase === "slow") {
            if (sample.fps >= RECOVERED_THRESHOLD) {
              r.recoverStreak++;
              phaseForThisFrame = "recovering";
              transitionTo("recovering", sample.t);
            } else {
              phaseForThisFrame = "slow";
              r.slowFrameCount++;
              r.recoverStreak = 0;
            }
          } else if (r.phase === "recovering") {
            if (sample.fps >= RECOVERED_THRESHOLD) {
              r.recoverStreak++;
              phaseForThisFrame = "recovering";
              if (r.recoverStreak >= RECOVER_WINDOW) {
                transitionTo("fast", sample.t);
                phaseForThisFrame = "fast";
              }
            } else {
              // Regressed back into slow — reset streak.
              r.recoverStreak = 0;
              r.slowFrameCount++;
              phaseForThisFrame = "slow";
              transitionTo("slow", sample.t);
            }
          } else if (r.phase === "fast") {
            phaseForThisFrame = "fast";
            r.tailCount++;
          }

          r.captureBuf.push(sample);
          r.phasePerFrame.push(phaseForThisFrame);

          // Termination conditions — whichever hits first.
          const hitFastTail = r.phase === "fast" && r.tailCount >= FAST_TAIL_FRAMES;
          const hitSlowCap = r.slowFrameCount >= MAX_SLOW_FRAMES;
          if (hitFastTail || hitSlowCap) {
            finalizeAndDump(hitSlowCap ? "slow-cap" : "auto-slow-to-fast");
          }
        } else if (enabled && !r.manual) {
          // Not capturing — watch for trigger. Skipped while manual mode is
          // active so a user-initiated capture isn't interrupted.
          if (sample.fps < LOW_FPS_THRESHOLD) {
            r.lowStreak++;
            if (
              r.lowStreak >= TRIGGER_WINDOW &&
              now - r.lastDumpTime >= COOLDOWN_MS
            ) {
              // Flush ring → captureBuf as "pre" phase, then begin "slow" capture.
              const buf: FrameSample[] = [];
              const phaseBuf: Phase[] = [];
              if (r.ringFull) {
                for (let i = 0; i < PRE_FRAMES; i++) {
                  buf.push(r.ring[(r.ringIdx + i) % PRE_FRAMES]);
                  phaseBuf.push("pre");
                }
              } else {
                for (let i = 0; i < r.ringIdx; i++) {
                  buf.push(r.ring[i]);
                  phaseBuf.push("pre");
                }
              }
              r.captureBuf = buf;
              r.phasePerFrame = phaseBuf;
              r.transitions = [{ from: "fast", to: "slow", t: sample.t }];
              r.phase = "slow";
              r.slowFrameCount = 0;
              r.recoverStreak = 0;
              r.tailCount = 0;
              r.capturing = true;
              setStatus(s => ({ ...s, capturing: true, phase: "slow" }));
            }
          } else {
            r.lowStreak = 0;
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  const startManual = () => {
    const r = refs.current;
    if (r.manual) return;
    // Flush ring buffer as "pre" phase so the user sees what was on screen
    // just before they hit record. Free context and usually short.
    const buf: FrameSample[] = [];
    const phaseBuf: Phase[] = [];
    if (r.ringFull) {
      for (let i = 0; i < PRE_FRAMES; i++) {
        buf.push(r.ring[(r.ringIdx + i) % PRE_FRAMES]);
        phaseBuf.push("pre");
      }
    } else {
      for (let i = 0; i < r.ringIdx; i++) {
        buf.push(r.ring[i]);
        phaseBuf.push("pre");
      }
    }
    r.captureBuf = buf;
    r.phasePerFrame = phaseBuf;
    r.transitions = [{ from: "fast", to: "manual", t: performance.now() }];
    r.phase = "manual";
    r.manual = true;
    r.capturing = true;
    setManualOn(true);
    setStatus(s => ({ ...s, manual: true, capturing: true, phase: "manual", capturedFrames: 0 }));
  };

  const stopManual = () => {
    const r = refs.current;
    if (!r.manual) return;
    const frames = [...r.captureBuf];
    const phases = [...r.phasePerFrame];
    const transitions = [...r.transitions, { from: "manual" as Phase, to: "fast" as Phase, t: performance.now() }];
    r.capturing = false;
    r.manual = false;
    r.captureBuf.length = 0;
    r.phasePerFrame.length = 0;
    r.transitions.length = 0;
    r.phase = "fast";
    r.lastDumpTime = performance.now();
    setManualOn(false);
    setStatus(s => ({ ...s, manual: false, capturing: false, phase: null }));
    void postDump("manual", frames, phases, transitions).then(result => {
      setStatus(s => ({
        ...s,
        dumpsSent: s.dumpsSent + 1,
        lastDumpAt: performance.now(),
        lastDumpPath: result.path ?? s.lastDumpPath,
        lastError: result.error ?? null,
      }));
    });
  };

  const dumpNow = () => {
    const r = refs.current;
    const buf: FrameSample[] = [];
    const phases: Phase[] = [];
    if (r.ringFull) {
      for (let i = 0; i < PRE_FRAMES; i++) {
        buf.push(r.ring[(r.ringIdx + i) % PRE_FRAMES]);
        phases.push("pre");
      }
    } else {
      for (let i = 0; i < r.ringIdx; i++) {
        buf.push(r.ring[i]);
        phases.push("pre");
      }
    }
    r.lastDumpTime = performance.now();
    void postDump("manual", buf, phases, []).then(result => {
      setStatus(s => ({
        ...s,
        dumpsSent: s.dumpsSent + 1,
        lastDumpAt: performance.now(),
        lastDumpPath: result.path ?? s.lastDumpPath,
        lastError: result.error ?? null,
      }));
    });
  };

  // `manualOn` drives UI re-renders on start/stop; the tick loop reads
  // `refs.current.manual` directly so the RAF closure never sees a stale value.
  void manualOn;

  return { status, setEnabled, dumpNow, startManual, stopManual };
}
