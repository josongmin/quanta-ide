import { useEffect, useMemo } from "react";
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
} from "@quanta/canvas-engine";
import {
  ROI_COLD,
  ROI_WARM,
  ROI_HOT,
  DEFAULT_ISO_CONFIG,
  type IsoConfig,
} from "@quanta/canvas-pixi";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import {
  actionTerrainStore,
  useActionTerrainStore,
  EMPTY_SUGGESTIONS,
  EMPTY_BARS,
  type ActionTerrainBarPayload,
  type ActionTerrainConePayload,
} from "../store/action-terrain-store";

export interface ActionTerrainDerived {
  enabled: boolean;
  roi: RefactorRoiResult | null;
  suggestions: ReadonlyMap<string, readonly RefactorPlan[]>;
  simulation: RefactorSimulationResult | null;
  bars: readonly ActionTerrainBarPayload[];
  coneForRenderer: ActionTerrainConePayload | null;
  isoConfig: IsoConfig;
}

export function deriveRoiColorHex(t: number): number {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (clamped <= 0.5) return mixHex(ROI_COLD, ROI_WARM, clamped * 2);
  return mixHex(ROI_WARM, ROI_HOT, (clamped - 0.5) * 2);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

const MAX_CONE_DEPTH = 4;
const MAX_SUGGESTIONS_PER_FILE = 2;

const DISABLED_RESULT: ActionTerrainDerived = {
  enabled: false,
  roi: null,
  suggestions: EMPTY_SUGGESTIONS,
  simulation: null,
  bars: EMPTY_BARS,
  coneForRenderer: null,
  isoConfig: DEFAULT_ISO_CONFIG,
};

export function useActionTerrain(): ActionTerrainDerived {
  // Feature-flag AND store-toggle AND sub-feature gates. If the master flag
  // is off we never want to pay the compute even if the persisted store
  // state says mode=true.
  const featureOn = useFeature("action-terrain.mode");
  const storeMode = useActionTerrainStore(s => s.mode);
  const mode = featureOn && storeMode;
  const selectedFileId = useActionTerrainStore(s => s.selectedFileId);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const activePlanId = useActionTerrainStore(s => s.activePlanId);
  const showSimulationDelta = useActionTerrainStore(s => s.showSimulationDelta);
  const heightScale = useActionTerrainStore(s => s.heightScale);

  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);

  const topographyOn = useFeature("action-terrain.leverage-topography");
  const coneOn = useFeature("action-terrain.blast-fix-cone");

  const metrics = useMemo(() => {
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
    if (!mode || !graph || !roi) return EMPTY_SUGGESTIONS;
    return buildRefactorSuggestions(roi, {
      sccs,
      maxPerFile: MAX_SUGGESTIONS_PER_FILE,
    });
  }, [mode, graph, roi, sccs]);

  const activePlan = useMemo<RefactorPlan | null>(() => {
    if (!activePlanId) return null;
    for (const plans of suggestions.values()) {
      for (const p of plans) if (p.id === activePlanId) return p;
    }
    return null;
  }, [activePlanId, suggestions]);

  // Auto-clear a plan id that has gone stale (graph swap invalidated the
  // prior suggestions). Without this the store holds a phantom selection
  // that never produces a simulation overlay.
  useEffect(() => {
    if (activePlanId && !activePlan && suggestions.size > 0) {
      actionTerrainStore.selectPlan(null);
    }
  }, [activePlanId, activePlan, suggestions]);

  const simulation = useMemo<RefactorSimulationResult | null>(() => {
    if (!mode || !roi || !activePlan) return null;
    return simulateRefactor(roi, activePlan);
  }, [mode, roi, activePlan]);

  const cone = useMemo<ImpactCone | null>(() => {
    if (!mode || !coneOn || !graph || !selectedFileId) return null;
    return coneDirection === "blast"
      ? computeBlastCone(graph, selectedFileId, MAX_CONE_DEPTH)
      : computeFixCone(graph, selectedFileId, MAX_CONE_DEPTH);
  }, [mode, coneOn, graph, selectedFileId, coneDirection]);

  const bars = useMemo<readonly ActionTerrainBarPayload[]>(() => {
    if (!mode || !topographyOn || !layout || !roi) return EMPTY_BARS;
    const simAfter = showSimulationDelta ? simulation?.after.perFile : undefined;
    const deltaSet = simulation?.terrainDelta;
    const out: ActionTerrainBarPayload[] = [];
    for (const [fileId, rect] of layout.fileRects) {
      const raw = simAfter?.get(fileId) ?? roi.scores.get(fileId)?.score ?? 0;
      const t = clamp01((raw / 100) * heightScale);
      out.push({
        fileId,
        rect,
        heightNorm: t,
        colorHex: deriveRoiColorHex(t),
        alpha: 0.88,
        highlighted: selectedFileId === fileId || (deltaSet?.has(fileId) ?? false),
      });
    }
    return out;
  }, [mode, topographyOn, layout, roi, simulation, showSimulationDelta, heightScale, selectedFileId]);

  const coneForRenderer = useMemo<ActionTerrainConePayload | null>(() => {
    if (!mode || !layout || !cone) return null;
    const rootRect = layout.fileRects.get(cone.rootFileId);
    if (!rootRect) return null;
    const root = { x: rootRect.x + rootRect.w / 2, y: rootRect.y + rootRect.h / 2 };
    const rings = cone.rings.map(ring => {
      const nodes: { x: number; y: number; fileId: string }[] = [];
      for (const fid of ring.fileIds) {
        const r = layout.fileRects.get(fid);
        if (!r) continue;
        nodes.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, fileId: fid });
      }
      return { depth: ring.depth, nodes };
    });
    return { root, rings, direction: cone.direction };
  }, [mode, layout, cone]);

  return useMemo<ActionTerrainDerived>(() => {
    if (!mode) return DISABLED_RESULT;
    return {
      enabled: true,
      roi,
      suggestions,
      simulation,
      bars,
      coneForRenderer,
      isoConfig: DEFAULT_ISO_CONFIG,
    };
  }, [mode, roi, suggestions, simulation, bars, coneForRenderer]);
}
