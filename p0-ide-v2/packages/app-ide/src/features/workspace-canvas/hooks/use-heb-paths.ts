import { useEffect, useMemo, useRef } from "react";
import type { LodLevel } from "@quanta/canvas-engine";
import type { HebBatch } from "@quanta/canvas-worker";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import { requestHebPaths } from "./use-worker-bridge";

// Hierarchical Edge Bundling driver hook.
//
// Why this lives in its own hook (not inside MultiFileCanvas or the
// orchestrator): HEB is coarse — it describes folder-level braiding, not
// per-file anchoring — so it only matters at zoomed-out tiers. Running the
// ~200ms rebuild on every graph/layout tick would burn frames.
//
// Trigger policy:
//   - Rebuild when (graph identity × layout identity × lod enters galaxy-
//     or-above) changes. The LOD guard ensures a user who only ever browses
//     at city LOD never pays the HEB cost.
//   - `forceRebuild` bumps a ref so the effect re-runs on the next tick
//     without relying on new object identity.
//
// LOD tiers that benefit from HEB: galaxy / supergalaxy / universe — these
// are the tiers where raw edge density collapses into noise. city and
// ground render per-file anchored edges through the existing
// EdgeStaticRenderer and ignore HEB entirely.
//
// Integration note: the hook writes the raw HebBatch into
// sceneStore.hebPaths, then exposes a derived Map<edgeId, Float32Array>
// for the renderer. The derivation creates *views* into the batch's
// flat `samples` Float32Array via `subarray` — zero-copy per edge, so
// the map itself fits in one allocation plus N Float32Array headers
// (no new geometry bytes). EdgeStaticRenderer consumes the map when
// its HEB flag is on and the current LOD matches.

const HEB_LODS: ReadonlySet<LodLevel> = new Set<LodLevel>([
  "galaxy",
  "supergalaxy",
  "universe",
]);

export interface UseHebPathsOptions {
  /** Bundling strength 0..1 — defaults to the bundler's own default (0.85). */
  tension?: number;
  /** Samples per path — defaults to the bundler's own default (24). */
  samples?: number;
  /** Manually disable HEB even at eligible LODs (e.g. debug toggle). */
  enabled?: boolean;
}

export function useHebPaths(options: UseHebPathsOptions = {}): Map<string, Float32Array> | null {
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const workerHeb = useSceneStore(s => s.workerHeb);
  const hebBatch = useSceneStore(s => s.hebPaths);
  const lod = useInteractionStore(s => s.lod);

  // Ref guards against re-submitting an identical request while the last
  // job is still in flight. StrictMode / rapid zoom can otherwise flood
  // the worker with duplicate BUILD_HEB messages.
  const lastKeyRef = useRef<string | null>(null);

  const enabled = options.enabled !== false;
  const tension = options.tension;
  const samples = options.samples;

  useEffect(() => {
    if (!enabled) return;
    if (!graph || !layout) return;
    if (!HEB_LODS.has(lod)) return;

    // Compose an identity key. We intentionally key by object identity
    // (WeakRef-ish — React's reference equality is enough since the scene
    // store creates new objects on write) AND by tension/samples. Changing
    // tension mid-session should invalidate the cached result.
    const key = `${stableRef(graph)}:${stableRef(layout)}:${tension ?? "d"}:${samples ?? "d"}`;
    if (lastKeyRef.current === key) return;
    if (workerHeb) return; // a request is already in flight; wait for HEB_READY

    lastKeyRef.current = key;
    requestHebPaths(graph, layout, { tension, samples });
  }, [graph, layout, lod, enabled, tension, samples, workerHeb]);

  // Convert the worker's packed HebBatch into the Map<edgeId, Float32Array>
  // shape EdgeStaticRenderer consumes. Each value is a zero-copy view
  // into the batch's `samples` buffer (Float32Array.subarray), so the map
  // is cheap to rebuild on every batch swap. Memoised by batch identity —
  // the scene store replaces the batch ref on every HEB_READY, so identity
  // equality is a reliable change signal.
  const pathMap = useMemo(() => hebBatchToMap(hebBatch), [hebBatch]);
  return pathMap;
}

/**
 * Unpack a HebBatch's flat `samples` + per-edge `offsets/lengths` into
 * a Map<edgeId, Float32Array> with subarray views (no copies).
 *
 * Exported separately so tests can call it without a full hook-rendering
 * harness. Safe against a null/empty batch — returns `null` in that case
 * so downstream `prop === undefined` checks continue to short-circuit.
 */
export function hebBatchToMap(batch: HebBatch | null): Map<string, Float32Array> | null {
  if (!batch || batch.edgeIds.length === 0) return null;
  const out = new Map<string, Float32Array>();
  for (let i = 0; i < batch.edgeIds.length; i++) {
    const offsetFloats = batch.offsets[i]!;
    const pairCount = batch.lengths[i]!;
    const floatCount = pairCount * 2;
    if (floatCount < 4) continue; // need ≥2 points for a segment
    const view = batch.samples.subarray(offsetFloats, offsetFloats + floatCount);
    out.set(batch.edgeIds[i]!, view);
  }
  return out.size > 0 ? out : null;
}

// Minimal WeakMap-backed identity stamp so we can key on graph/layout
// references without running .toString() on giant objects.
const idStamps = new WeakMap<object, string>();
let idCounter = 0;
function stableRef(obj: object): string {
  const existing = idStamps.get(obj);
  if (existing) return existing;
  const stamp = `r${++idCounter}`;
  idStamps.set(obj, stamp);
  return stamp;
}
