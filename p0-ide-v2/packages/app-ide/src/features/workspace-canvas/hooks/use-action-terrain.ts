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
import { ROI_COLD, ROI_WARM, ROI_HOT, type IsoConfig } from "@quanta/canvas-pixi";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import {
  useActionTerrainStore,
  type ActionTerrainBarPayload,
  type ActionTerrainConePayload,
} from "../store/action-terrain-store";

export interface ActionTerrainDerived {
  enabled: boolean;
  roi: RefactorRoiResult | null;
  suggestions: ReadonlyMap<string, readonly RefactorPlan[]>;
  simulation: RefactorSimulationResult | null;
  cone: ImpactCone | null;
  bars: readonly ActionTerrainBarPayload[];
  coneForRenderer: ActionTerrainConePayload | null;
  isoConfig: IsoConfig;
  metrics: WorkspaceMetrics | null;
}

function deriveRoiColor(t: number): number {
  if (t <= 0.5) return mixHex(ROI_COLD, ROI_WARM, t * 2);
  return mixHex(ROI_WARM, ROI_HOT, (t - 0.5) * 2);
}

function clamp01(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

const DEFAULT_ISO_CONFIG: IsoConfig = { xShiftPerZ: 0.35, maxZ: 180 };
const MAX_CONE_DEPTH = 4;
const MAX_SUGGESTIONS_PER_FILE = 2;

const EMPTY_SUGGESTIONS: ReadonlyMap<string, readonly RefactorPlan[]> = new Map();
const EMPTY_BARS: readonly ActionTerrainBarPayload[] = [];

const DISABLED_RESULT: ActionTerrainDerived = {
  enabled: false,
  roi: null,
  suggestions: EMPTY_SUGGESTIONS,
  simulation: null,
  cone: null,
  bars: EMPTY_BARS,
  coneForRenderer: null,
  isoConfig: DEFAULT_ISO_CONFIG,
  metrics: null,
};

export function useActionTerrain(): ActionTerrainDerived {
  const mode = useActionTerrainStore(s => s.mode);
  const selectedFileId = useActionTerrainStore(s => s.selectedFileId);
  const coneDirection = useActionTerrainStore(s => s.coneDirection);
  const activePlanId = useActionTerrainStore(s => s.activePlanId);
  const showSimulationDelta = useActionTerrainStore(s => s.showSimulationDelta);
  const heightScale = useActionTerrainStore(s => s.heightScale);

  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);

  // Sub-feature flags: terrain bars and cone can be independently disabled
  // even when master `.mode` is on.
  const topographyOn = useFeature("action-terrain.leverage-topography");
  const coneOn = useFeature("action-terrain.blast-fix-cone");

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
        rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
        heightNorm: t,
        colorHex: deriveRoiColor(t),
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
      cone,
      bars,
      coneForRenderer,
      isoConfig: DEFAULT_ISO_CONFIG,
      metrics,
    };
  }, [mode, roi, suggestions, simulation, cone, bars, coneForRenderer, metrics]);
}

