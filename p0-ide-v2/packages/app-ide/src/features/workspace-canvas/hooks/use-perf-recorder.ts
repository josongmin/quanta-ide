import { useEffect, useRef, useState } from "react";
import { viewportStore } from "../store/viewport-store";
import { sceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";
import { settingsStore } from "../store/settings-store";

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

type Phase = "pre" | "slow" | "recovering" | "fast";

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
  phase: Phase | null;
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
  captureBuf: FrameSample[];
  phasePerFrame: Phase[];
  transitions: Transition[];
  phase: Phase;
  slowFrameCount: number;
  recoverStreak: number;
  tailCount: number;
  lastDumpTime: number;
}

function sampleCurrentFrame(dtMs: number): FrameSample {
  // Read each sub-store individually to avoid allocating the facade's
  // merged snapshot on every tick. Sub-store getState() is O(1) and
  // returns a stable reference.
  const vpState = viewportStore.getState();
  const scState = sceneStore.getState();
  const itState = interactionStore.getState();
  const stState = settingsStore.getState();

  const vp = vpState.viewport;
  const tb = scState.layout?.totalBounds;
  const scene =
    scState.superclusterScene ? "supercluster" :
    scState.clusterScene ? "cluster" :
    scState.visibleScene ? "file" : "none";
  let drawCalls: number | null = null;
  try {
    drawCalls =
      (globalThis as { __pixi?: { app?: { renderer?: { statistics?: { drawCalls?: number } } } } })
        .__pixi?.app?.renderer?.statistics?.drawCalls ?? null;
  } catch { drawCalls = null; }

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

async function postDump(
  trigger: string,
  frames: FrameSample[],
  phases: Phase[],
  transitions: Transition[],
): Promise<{ path?: string; error?: string }> {
  // Annotate frames with their phase for easy grep.
  const annotated = frames.map((f, i) => ({ ...f, phase: phases[i] ?? "slow" }));
  const summary = buildSummary(phases, frames);

  // We send `frames` (flat) + `transitions` + `summary` as separate logical
  // sections; the server plugin converts each to an NDJSON line.
  const extras: Array<Record<string, unknown>> = [
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
      body: JSON.stringify({ trigger, frames: [...annotated, ...extras], meta }),
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
} {
  const [enabled, setEnabled] = useState(enabledInitial);
  const [status, setStatus] = useState<RecorderStatus>({
    enabled: enabledInitial,
    capturing: false,
    phase: null,
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

      if (enabled) {
        const sample = sampleCurrentFrame(dt);
        const r = refs.current;

        // Always fill the ring buffer — it's our "pre-drop" history.
        r.ring[r.ringIdx] = sample;
        r.ringIdx = (r.ringIdx + 1) % PRE_FRAMES;
        if (r.ringIdx === 0) r.ringFull = true;

        if (r.capturing) {
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
        } else {
          // Not capturing — watch for trigger.
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

  return { status, setEnabled, dumpNow };
}
