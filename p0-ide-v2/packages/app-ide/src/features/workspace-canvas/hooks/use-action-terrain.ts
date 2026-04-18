import { useMemo } from "react";
import {
  computeRefactorROI,
  buildRefactorSuggestions,
  computeBlastCone,
  computeFixCone,
  simulateRefactor,
  computeWorkspaceMetrics,
  mixHex,
  type RefactorRoiResult,
  type RefactorPlan,
  type RefactorSimulationResult,
  type ImpactCone,
  type WorkspaceMetrics,
} from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { useActionTerrainStore } from "../store/action-terrain-store";

// Action-terrain derivation hook.
// -------------------------------------------------------------------
// Pulls graph + metrics + sccs + layout from scene, composes the engine's
// ROI / suggestions / cone / simulation APIs, and emits a flat render-ready
// `bars` array + `coneForRenderer` the Pixi overlay consumes via ctx. Kept
// memo-heavy: re-computing ROI on every camera tick would dominate at 5k+
// files. When mode is off every sub-compute bails to the cheap disabled
// branch so we pay zero ROI cost unless the user opted in.

export interface IsoTerrainBar {
  fileId: string;
  rect: { x: number; y: number; w: number; h: number };
  /** 0..1 after heightScale multiplier. */
  heightNorm: number;
  /** Packed 24-bit RGB. */
  colorHex: number;
  alpha?: number;
  highlighted?: boolean;
}

export interface TerrainConeNode {
  x: number;
  y: number;
  fileId: string;
}

export interface TerrainConeForRenderer {
  root: { x: number; y: number };
  rings: readonly { depth: number; nodes: readonly TerrainConeNode[] }[];
  direction: "blast" | "fix";
}

export interface IsoConfig {
  xShiftPerZ: number;
  maxZ: number;
}

export interface ActionTerrainEnabledResult {
  enabled: true;
  roi: RefactorRoiResult;
  suggestions: ReadonlyMap<string, readonly RefactorPlan[]>;
  simulation: RefactorSimulationResult | null;
  cone: ImpactCone | null;
  bars: readonly IsoTerrainBar[];
  coneForRenderer: TerrainConeForRenderer | null;
  isoConfig: IsoConfig;
  /** Metrics object used — re-exposed so the HUD can read perf counters. */
  metrics: WorkspaceMetrics | null;
}

export interface ActionTerrainDisabledResult {
  enabled: false;
}

export type ActionTerrainResult = ActionTerrainEnabledResult | ActionTerrainDisabledResult;

// Cold → hot ROI color ramp. Green 0x22c55e → amber 0xfacc15 → red 0xef4444.
// Two-segment lerp matches the --ws-roi-cold/warm/hot CSS vars without
// plumbing the DOM strings through the Pixi renderer.
function roiColor(t: number): number {
  if (t <= 0.5) return mixHex(0x22c55e, 0xfacc15, t * 2);
  return mixHex(0xfacc15, 0xef4444, (t - 0.5) * 2);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

const DEFAULT_ISO_CONFIG: IsoConfig = { xShiftPerZ: 0.35, maxZ: 180 };
const MAX_CONE_DEPTH = 4;
const MAX_SUGGESTIONS_PER_FILE = 2;

export function useActionTerrain(): ActionTerrainResult {
  const mode = useActionTerrainStore(s => s.mode);
  const selectedFileId = useActionTerrainStore(s => s.selectedFileId);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const activePlanId = useActionTerrainStore(s => s.activePlanId);
  const showSimulationDelta = useActionTerrainStore(s => s.showSimulationDelta);
  const heightScale = useActionTerrainStore(s => s.heightScale);

  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);

  // Metrics — prefer layout-cached (already computed once by the layout
  // worker); fall back to a live recompute when layout hasn't attached them.
  // Memoized on graph identity so scene swaps are the only trigger.
  const metrics = useMemo<WorkspaceMetrics | null>(() => {
    if (!mode) return null;
    if (!graph) return null;
    if (layout?.metrics) return layout.metrics;
    return computeWorkspaceMetrics(graph);
  }, [mode, graph, layout?.metrics]);

  const sccs = layout?.sccs;

  const roi = useMemo<RefactorRoiResult | null>(() => {
    if (!mode) return null;
    if (!graph || !metrics) return null;
    return computeRefactorROI(graph, metrics, { sccs });
  }, [mode, graph, metrics, sccs]);

  const suggestions = useMemo<ReadonlyMap<string, readonly RefactorPlan[]>>(() => {
    if (!mode || !graph || !metrics || !roi) return new Map();
    return buildRefactorSuggestions(graph, roi, metrics, {
      sccs,
      maxPerFile: MAX_SUGGESTIONS_PER_FILE,
    });
  }, [mode, graph, metrics, roi, sccs]);

  const activePlan = useMemo<RefactorPlan | null>(() => {
    if (!activePlanId) return null;
    for (const plans of suggestions.values()) {
      for (const p of plans) if (p.id === activePlanId) return p;
    }
    return null;
  }, [activePlanId, suggestions]);

  const simulation = useMemo<RefactorSimulationResult | null>(() => {
    if (!mode || !roi || !activePlan) return null;
    return simulateRefactor(roi, activePlan);
  }, [mode, roi, activePlan]);

  const cone = useMemo<ImpactCone | null>(() => {
    if (!mode || !graph || !selectedFileId) return null;
    return coneDirection === "blast"
      ? computeBlastCone(graph, selectedFileId, MAX_CONE_DEPTH)
      : computeFixCone(graph, selectedFileId, MAX_CONE_DEPTH);
  }, [mode, graph, selectedFileId, coneDirection]);

  const bars = useMemo<readonly IsoTerrainBar[]>(() => {
    if (!mode || !layout || !roi) return [];
    const simAfter = showSimulationDelta ? simulation?.after.perFile : undefined;
    const deltaSet = simulation?.terrainDelta;
    const out: IsoTerrainBar[] = [];
    for (const [fileId, rect] of layout.fileRects) {
      const raw = simAfter?.get(fileId) ?? roi.scores.get(fileId)?.score ?? 0;
      const heightNorm = clamp01((raw / 100) * heightScale);
      const colorHex = roiColor(heightNorm);
      const highlighted =
        selectedFileId === fileId || (deltaSet?.has(fileId) ?? false);
      out.push({
        fileId,
        rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
        heightNorm,
        colorHex,
        alpha: 0.88,
        highlighted,
      });
    }
    return out;
  }, [mode, layout, roi, simulation, showSimulationDelta, heightScale, selectedFileId]);

  const coneForRenderer = useMemo<TerrainConeForRenderer | null>(() => {
    if (!mode || !layout || !cone) return null;
    const rootRect = layout.fileRects.get(cone.rootFileId);
    if (!rootRect) return null;
    const root = { x: rootRect.x + rootRect.w / 2, y: rootRect.y + rootRect.h / 2 };
    const rings = cone.rings.map(ring => {
      const nodes: TerrainConeNode[] = [];
      for (const fid of ring.fileIds) {
        const r = layout.fileRects.get(fid);
        if (!r) continue;
        nodes.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, fileId: fid });
      }
      return { depth: ring.depth, nodes };
    });
    return { root, rings, direction: cone.direction };
  }, [mode, layout, cone]);

  if (!mode) {
    return { enabled: false };
  }
  if (!roi) {
    // Graph not ready yet — expose a safe empty but "enabled" result so
    // renderer gates can stay boolean-simple.
    return {
      enabled: true,
      roi: { scores: new Map(), ordered: [], maxScore: 0 },
      suggestions: new Map(),
      simulation: null,
      cone: null,
      bars: [],
      coneForRenderer: null,
      isoConfig: DEFAULT_ISO_CONFIG,
      metrics,
    };
  }
  return {
    enabled: true,
    roi,
    suggestions,
    simulation,
    cone,
    bars,
    coneForRenderer,
    isoConfig: DEFAULT_ISO_CONFIG,
    metrics,
  };
}
