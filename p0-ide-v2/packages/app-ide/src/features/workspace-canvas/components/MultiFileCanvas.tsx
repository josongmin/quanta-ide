import { useCallback, useEffect, useRef } from "react";
import "../workspace-canvas.css";
import { EdgeGeometryCache, createEdgePickIndex } from "@quanta/canvas-engine";
import type { EdgePickIndex, WorkspaceGraph } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { useCanvasInteractions } from "../hooks/use-canvas-interactions";
import { useModifierKeyTracking } from "../hooks/use-keyboard-shortcuts";
import { useUrlStateSync } from "../hooks/use-url-state-sync";
import { useEdgeFocusLogic } from "../hooks/use-edge-focus-logic";
import {
  useTemporalEdgeSets,
  useActiveTrace,
  useCrossGraphFlash,
} from "../hooks/use-scene-derivations";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import { useRenderSettings, renderSettingsStore } from "../store/render-settings-store";
import { usePresenceStore } from "../store/presence-store";
import { stickiesStore } from "../store/stickies-store";
import { startMockPresence } from "../lib/mock-presence";
import { StreetCard } from "./StreetCard";
import { GroundCard } from "./GroundCard";
import { Minimap } from "./Minimap";
import { CanvasControls } from "./CanvasControls";
import { LoadingOverlay } from "./LoadingOverlay";
import { DebugHud } from "./DebugHud";
import { EvidencePanel } from "./EvidencePanel";
import { StickiesLayer } from "./StickiesLayer";
import { AnnotationsLayer } from "./AnnotationsLayer";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { CollabLayer } from "./CollabLayer";
import { ReviewLayer } from "./ReviewLayer";
import { SessionTimer } from "./SessionTimer";
import { DevModeLayer, type DevModeLayerApi } from "./DevModeLayer";
import { useFeature } from "../store/feature-flags-store";

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);
  useUrlStateSync();

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const domLayerRef = useRef<HTMLDivElement>(null);
  const edgeCacheRef = useRef(new EdgeGeometryCache());
  const edgePickIndexRef = useRef<EdgePickIndex>(createEdgePickIndex());

  const { panBy, zoomAt, fitToGraph, setContainerSize, transform, viewport } = useCanvasViewport();
  const modifiers = useModifierKeyTracking();

  // Store selectors — each column subscribes to its owning sub-store so a
  // pan tick never wakes scene/interaction/settings listeners.
  const lod               = useInteractionStore(s => s.lod);
  const visibleScene      = useSceneStore(s => s.visibleScene);
  const clusterScene      = useSceneStore(s => s.clusterScene);
  const superclusterScene = useSceneStore(s => s.superclusterScene);
  const viewState         = useInteractionStore(s => s.viewState);
  const layout            = useSceneStore(s => s.layout);
  const layoutProgress    = useSceneStore(s => s.layoutProgress);
  const showEdges         = useRenderSettings(s => s.showEdges);
  const edgeKinds         = useRenderSettings(s => s.edgeKinds);
  const edgeLayers        = useRenderSettings(s => s.edgeLayers);
  const edgeMinSeverity   = useRenderSettings(s => s.edgeMinSeverity);
  const edgeWidthMul      = useRenderSettings(s => s.edgeWidthMul);
  const showClusterEdges  = useRenderSettings(s => s.showClusterEdges);
  const showSccBubbles    = useRenderSettings(s => s.showSccBubbles);
  const showStartHereBadges = useRenderSettings(s => s.showStartHereBadges);
  const startHereTopN     = useRenderSettings(s => s.startHereTopN);
  const showCrossGraphEdges = useRenderSettings(s => s.showCrossGraphEdges);
  const highlightCrossGraph = useRenderSettings(s => s.highlightCrossGraph);
  const showAgentPresence = useRenderSettings(s => s.showAgentPresence);
  const elevationMode     = useRenderSettings(s => s.elevationMode);
  const showEffectBadges  = useRenderSettings(s => s.showEffectBadges);
  const showLatencyOverlay = useRenderSettings(s => s.showLatencyOverlay);
  const agentPresence     = usePresenceStore(s => s.agents);

  const { edgeFocus, edgePredicate, edgeViolations } =
    useEdgeFocusLogic(graph, layout, viewState);
  const { temporalEdgeSet, diffAdded, diffRemoved } = useTemporalEdgeSets(graph);
  const { activeTrace, traceEdgeSet } = useActiveTrace(graph);
  const crossGraphFlash = useCrossGraphFlash(graph);

  const {
    onMouseDown, onMouseMove, onMouseUp,
    selectFile: rawSelectFile, hoverFile,
    onClusterClick, onSuperclusterClick,
    onZoomIn, onZoomOut,
  } = useCanvasInteractions({
    containerRef,
    edgePickIndexRef,
    modifiers,
    panBy,
    zoomAt,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });

  // Dev Mode capture hook — when the user holds M and clicks a file we
  // route the selection into the measure state machine instead of the
  // normal selection path. Stored on a ref so the wrapper below stays
  // referentially stable.
  const devModeApiRef = useRef<DevModeLayerApi | null>(null);
  const onDevModeReady = useCallback((api: DevModeLayerApi) => {
    devModeApiRef.current = api;
  }, []);
  const selectFile = useCallback((fileId: string) => {
    if (devModeApiRef.current?.tryCaptureSelection(fileId)) return;
    rawSelectFile(fileId);
  }, [rawSelectFile]);

  // Pan/zoom transform — written imperatively to bypass React reconciliation
  // for the two hottest-changing DOM nodes (grid bg + DOM card layer). With
  // 5000+ files at street LOD, reconciling style objects 60×/s stutters.
  useEffect(() => {
    if (gridRef.current) gridRef.current.style.transform = transform;
    if (domLayerRef.current) domLayerRef.current.style.transform = transform;
  }, [transform]);

  // Toggle master edges — reads from the store at click time so we don't
  // need `showEdges` in deps (keeps the ref stable for CanvasControls).
  const toggleEdges = useCallback(() => {
    renderSettingsStore.setShowEdges(!renderSettingsStore.getState().showEdges);
  }, []);

  const onFit = useCallback(() => {
    if (layout) fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
  }, [fitToGraph, layout]);

  // Edge cache + pick index rebuilds tied to layout.
  useEffect(() => {
    if (!layout) return;
    edgeCacheRef.current.build(
      layout.edgeRoutes.size > 0 ? (visibleScene?.edges ?? []) : [],
      layout,
    );
    // intentionally exclude visibleScene.edges — rebuild on layout change only
  }, [layout]);
  useEffect(() => {
    if (!layout) {
      edgePickIndexRef.current.clear();
      return;
    }
    const edges = visibleScene?.edges ?? [];
    edgePickIndexRef.current.build(edges, layout);
  }, [layout, visibleScene?.edges]);

  // ResizeObserver — also triggers initial fit if layout arrived while the
  // container was still 0×0 (worker is fast). `fittedRef` resets on graph
  // swap so a new repo's layout gets a fresh fit.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!layout) fittedRef.current = false;
  }, [layout]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setContainerSize(r.width, r.height);
      if (!fittedRef.current && layout && r.width > 0 && r.height > 0) {
        fittedRef.current = true;
        fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerSize, fitToGraph, layout]);

  useEffect(() => {
    const stop = startMockPresence();
    return () => stop();
  }, []);

  // Demo stickies — once per layout, when no stickies exist yet.
  useEffect(() => {
    if (!layout) return;
    if (stickiesStore.getState().stickies.length > 0) return;
    const rects = layout.fileRects;
    if (rects.size === 0) return;
    const files = graph.files;
    if (files.length === 0) return;
    const scored = files
      .map(f => ({ file: f, risk: typeof f.riskScore === "number" ? f.riskScore : 0 }))
      .sort((a, b) => b.risk - a.risk);
    const topRisk = scored[0]?.file;
    const taintEdge = graph.fileEdges.find(
      e => e.kind === "taint-propagation" || e.layer === "safety",
    );
    const taintOriginId = taintEdge?.from;
    const taintOriginFile = taintOriginId ? files.find(f => f.id === taintOriginId) : undefined;
    const seed: Array<{ fileId: string; text: string }> = [];
    if (topRisk) seed.push({ fileId: topRisk.id, text: "TODO: refactor — high risk surface" });
    if (taintOriginFile && taintOriginFile.id !== topRisk?.id) {
      seed.push({ fileId: taintOriginFile.id, text: "ask security team about this source" });
    }
    if (seed.length < 2 && files[0]) {
      seed.push({ fileId: files[0].id, text: "welcome — shift+dblclick to add a note" });
    }
    for (const s of seed) {
      const r = rects.get(s.fileId);
      if (!r) continue;
      stickiesStore.create(r.x + r.w + 24, r.y, { text: s.text, anchorFileId: s.fileId });
    }
    stickiesStore.setActive(null);
  }, [layout, graph]);

  if (!visibleScene && !clusterScene && !superclusterScene) {
    return (
      <div ref={containerRef} className="workspace-canvas workspace-canvas--loading">
        <LoadingOverlay progress={layoutProgress} hasGraph={!!graph.files.length} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="workspace-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div
        ref={gridRef}
        className="workspace-canvas__grid"
        style={{ transformOrigin: "0 0" }}
      />

      {layout && (
        <PixiStage
          scene={{
            visible: visibleScene ?? { kind: "files", files: [], edges: [], comments: [] },
            clusters: clusterScene,
            superclusters: superclusterScene,
            layout,
            viewState,
            viewport,
            lod,
            edgeCache: edgeCacheRef.current,
          }}
          edgeRender={{
            showEdges,
            edgeKinds,
            edgeLayers,
            edgeMinSeverity,
            edgeWidthMul,
            edgeFocus,
            edgePredicate,
            edgeViolations,
          }}
          overlays={{
            showClusterEdges,
            showSccBubbles,
            showStartHereBadges,
            startHereTopN,
            showCrossGraphEdges,
            crossGraphFlash,
          }}
          temporal={{ temporalEdgeSet, diffAdded, diffRemoved }}
          trace={{ activeTrace, traceEdgeSet }}
          presence={{ agentPresence, showAgentPresence }}
          highlightCrossGraph={highlightCrossGraph}
          elevationMode={elevationMode}
          effects={graph.effects}
          latency={graph.latency}
          showEffectBadges={showEffectBadges}
          showLatencyOverlay={showLatencyOverlay}
          onFileClick={selectFile}
          onFileHover={hoverFile}
          onClusterClick={onClusterClick}
          onSuperclusterClick={onSuperclusterClick}
        />
      )}

      {(lod === "street" || lod === "ground") && visibleScene && (
        <div
          ref={domLayerRef}
          className="workspace-canvas__dom-layer"
          style={{ transformOrigin: "0 0", willChange: "transform" }}
        >
          {visibleScene.files.map(file => {
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            const isSelected = viewState.selectedFileId === file.id;
            const fileEffects = graph.effects?.[file.id];
            const fileLatency = graph.latency?.[file.id];
            return lod === "street" ? (
              <StreetCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
                elevationMode={elevationMode}
                effects={fileEffects}
                latency={fileLatency}
                showEffectBadges={showEffectBadges}
                showLatencyOverlay={showLatencyOverlay}
                onSelect={selectFile}
              />
            ) : (
              <GroundCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
                onSelect={selectFile}
              />
            );
          })}
        </div>
      )}

      <StickiesLayer transform={transform} scale={viewport.scale} />
      <CollabLayer
        transform={transform}
        scale={viewport.scale}
        layout={layout}
        graph={graph}
      />
      <AnnotationsLayer transform={transform} scale={viewport.scale} containerRef={containerRef} />
      <ReviewLayer graph={graph} transform={transform} scale={viewport.scale} />
      <Minimap layout={layout} viewport={viewport} />
      <CanvasControls
        scale={viewport.scale}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFit={onFit}
        showEdges={showEdges}
        edgeCount={visibleScene?.edges.length ?? 0}
        onToggleEdges={toggleEdges}
      />
      <AnnotationToolbar />
      <TimerMount />
      <DebugHud />
      <EvidencePanel />
      <DevModeLayer onReady={onDevModeReady} />
    </div>
  );
}

// Feature-gated mount for the session timer widget. Rendered as a
// separate component so the gate lookup doesn't re-run the canvas
// body's memoization.
function TimerMount() {
  const on = useFeature("review.timer");
  if (!on) return null;
  return <SessionTimer />;
}
