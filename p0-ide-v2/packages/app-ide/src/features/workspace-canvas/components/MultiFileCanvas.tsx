import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../workspace-canvas.css";
import { EdgeGeometryCache, createEdgePickIndex } from "@quanta/canvas-engine";
import type { EdgePickIndex, WorkspaceGraph } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { useCanvasInteractions } from "../hooks/use-canvas-interactions";
import {
  useModifierKeyTracking,
  useGlobalKeybinds,
  isCmdK,
  isCmdShiftT,
  isCmdShiftA,
  type GlobalKeybind,
} from "../hooks/use-keyboard-shortcuts";
import { useSmoothCamera } from "../hooks/use-smooth-camera";
import { useUrlStateSync } from "../hooks/use-url-state-sync";
import { useEdgeFocusLogic } from "../hooks/use-edge-focus-logic";
import {
  useTemporalEdgeSets,
  useActiveTrace,
  useCrossGraphFlash,
} from "../hooks/use-scene-derivations";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore, interactionStore } from "../store/interaction-store";
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
import { AnomalyBadgesLayer } from "./AnomalyBadgesLayer";
import { CommandPalette } from "./CommandPalette";
import { LassoOverlay, BulkActionsToolbar } from "./LassoOverlay";
import { ZoomLens } from "./ZoomLens";
import { ApplyThemeAttribute } from "./ThemeSwitcher";
import { exportAsPNG } from "../lib/export-canvas";
import { featureFlagsStore } from "../store/feature-flags-store";
import { themeStore } from "../store/theme-store";
import { useAnomalyDetectionRun } from "../hooks/use-anomaly-detection";
import { PagesTabBar } from "./PagesTabBar";
import { BookmarksDrawer } from "./BookmarksDrawer";
import { StoryboardPlayer } from "./StoryboardPlayer";
import { ImagesLayer } from "./ImagesLayer";
import { TicketsLayer } from "./TicketsLayer";
import { PrBadgesLayer } from "./PrBadgesLayer";
import { FilmStripScrubber } from "./FilmStripScrubber";
import { DualCanvasContainer, DualSplitToggleButton } from "./DualCanvasContainer";
import { useFeature } from "../store/feature-flags-store";
import { RegressionHuntPanel } from "./RegressionHuntPanel";
import { RefactorPreviewOverlay } from "./RefactorPreviewOverlay";
import { PrReplayLauncher } from "./PrReplayLauncher";
import { BisectGame } from "./BisectGame";
import { AuthorFootprintLegend, computeAuthorTints } from "./AuthorFootprintOverlay";
import { ActionTerrainLayer } from "./action-terrain/ActionTerrainLayer";
import { RefactorBacklogPanel } from "./action-terrain/RefactorBacklogPanel";
import { ActionTerrainToggle } from "./action-terrain/ActionTerrainToggle";
import {
  actionTerrainStore,
  useActionTerrainRender,
  useActionTerrainStore,
} from "../store/action-terrain-store";

const EMPTY_TINT_MAP: ReadonlyMap<string, string> = new Map();

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);
  useUrlStateSync();
  useAnomalyDetectionRun();

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const domLayerRef = useRef<HTMLDivElement>(null);
  const edgeCacheRef = useRef(new EdgeGeometryCache());
  const edgePickIndexRef = useRef<EdgePickIndex>(createEdgePickIndex());

  const { panBy, zoomAt, fitToGraph, setContainerSize, transform, viewport } = useCanvasViewport();
  const modifiers = useModifierKeyTracking();
  const smoothCamera = useSmoothCamera();

  // Palette open state — driven by Cmd+K / Ctrl+K and closed by Esc,
  // click-outside, or after an action runs. Kept in a local React state
  // rather than a store because the palette lifecycle is purely UI-local.
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  const actionTerrainMode  = useActionTerrainStore(s => s.mode);
  const actionTerrainRender = useActionTerrainRender(s => s);

  const { edgeFocus, edgePredicate, edgeViolations } =
    useEdgeFocusLogic(graph, layout, viewState);
  const { temporalEdgeSet, diffAdded, diffRemoved } = useTemporalEdgeSets(graph);
  const { activeTrace, traceEdgeSet } = useActiveTrace(graph);
  const crossGraphFlash = useCrossGraphFlash(graph);

  // Author footprint tints — only computed when the feature is on AND
  // temporal live mode is active. Pure function of (graph, snapshot
  // index); memoized so card renders don't re-derive it per pan tick.
  const authorFootprintOn = useFeature("temporal.authorFootprint");
  const temporalState = useInteractionStore(s => s.temporal);
  const authorTintByFile = useMemo<ReadonlyMap<string, string>>(() => {
    if (!authorFootprintOn) return EMPTY_TINT_MAP;
    if (temporalState.mode !== "live") return EMPTY_TINT_MAP;
    const ctx = computeAuthorTints(graph.history, temporalState.snapshotIndex, graph.fileEdges);
    return ctx.tintByFile;
  }, [authorFootprintOn, temporalState.mode, temporalState.snapshotIndex, graph.history, graph.fileEdges]);

  const {
    onMouseDown, onMouseMove, onMouseUp,
    selectFile: rawSelectFile, hoverFile,
    onClusterClick: rawClusterClick,
    onSuperclusterClick: rawSuperclusterClick,
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

  // Wrap cluster/supercluster zoom so the transition eases when
  // power.smoothCamera is on. The inner hook already writes to the
  // viewport store directly, so we intercept at call time and replace
  // the hard snap with a tween when the flag is live.
  const onClusterClick = useCallback((clusterId: string) => {
    if (!featureFlagsStore.isEnabled("power.smoothCamera")) {
      rawClusterClick(clusterId);
      return;
    }
    const lay = layout;
    const rect = lay?.clusterRects?.get(clusterId)
      ?? lay?.clusters?.find(c => c.id === clusterId)?.rect;
    if (rect) smoothCamera.fitRect(rect, 0.8);
    else rawClusterClick(clusterId);
  }, [rawClusterClick, layout, smoothCamera]);
  const onSuperclusterClick = useCallback((superclusterId: string) => {
    if (!featureFlagsStore.isEnabled("power.smoothCamera")) {
      rawSuperclusterClick(superclusterId);
      return;
    }
    const rect = layout?.superclusters?.find(c => c.id === superclusterId)?.rect;
    if (rect) smoothCamera.fitRect(rect, 0.8);
    else rawSuperclusterClick(superclusterId);
  }, [rawSuperclusterClick, layout, smoothCamera]);

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
    if (!layout) return;
    if (featureFlagsStore.isEnabled("power.smoothCamera")) {
      smoothCamera.fitRect(layout.totalBounds, 0.9);
    } else {
      fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
    }
  }, [fitToGraph, layout, smoothCamera]);

  // Smooth zoom-to-file — used by the palette and as the default zoom-to-rect
  // helper for bookmarks etc. Falls back to an instant snap when the feature
  // is off (via useSmoothCamera.panTo which reads the flag at call time).
  const zoomToFileSmooth = useCallback((fileId: string) => {
    const lay = layout;
    if (!lay) return;
    const rect = lay.fileRects.get(fileId);
    if (!rect) return;
    interactionStore.selectFile(fileId);
    smoothCamera.fitRect(rect, 0.85);
  }, [layout, smoothCamera]);

  const resetViewport = useCallback(() => {
    smoothCamera.panTo(0, 0, 0.1);
  }, [smoothCamera]);

  const exportPng = useCallback(() => {
    const container = containerRef.current;
    void exportAsPNG(container);
  }, []);

  // Global keybinds — registered once, extended here instead of scattering
  // fresh window.addEventListener calls. Cmd+K opens the palette; Cmd+Shift+T
  // cycles the theme when the theme-switcher feature is on. Cmd+Shift+D is
  // still owned by DebugHud directly and is intentionally not duplicated here.
  const keybinds = useMemo<readonly GlobalKeybind[]>(() => ([
    {
      label: "Open command palette",
      match: isCmdK,
      fireInEditable: false,
      handler: () => {
        if (!featureFlagsStore.isEnabled("power.commandPalette")) return;
        setPaletteOpen(true);
      },
    },
    {
      label: "Cycle theme",
      match: isCmdShiftT,
      handler: () => {
        if (!featureFlagsStore.isEnabled("power.themeSwitcher")) return;
        themeStore.cycle();
      },
    },
    {
      label: "Toggle Action Terrain",
      match: isCmdShiftA,
      handler: () => {
        if (!featureFlagsStore.isEnabled("action-terrain.mode")) return;
        actionTerrainStore.toggleMode();
      },
    },
  ]), []);
  useGlobalKeybinds(keybinds);

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
      data-action-terrain={actionTerrainMode ? "on" : "off"}
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
          actionTerrain={{
            enabled: actionTerrainRender.enabled,
            bars: actionTerrainRender.bars,
            cone: actionTerrainRender.cone,
            isoConfig: actionTerrainRender.isoConfig,
          }}
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
            const authorTint = authorTintByFile.get(file.id);
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
                authorTint={authorTint}
                onSelect={selectFile}
              />
            ) : (
              <GroundCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
                authorTint={authorTint}
                onSelect={selectFile}
              />
            );
          })}
        </div>
      )}

      <StickiesLayer transform={transform} scale={viewport.scale} />
      <ImagesLayer transform={transform} scale={viewport.scale} containerRef={containerRef} />
      <CollabLayer
        transform={transform}
        scale={viewport.scale}
        layout={layout}
        graph={graph}
      />
      <AnnotationsLayer transform={transform} scale={viewport.scale} containerRef={containerRef} />
      <ReviewLayer graph={graph} transform={transform} scale={viewport.scale} />
      <TicketsLayer transform={transform} />
      <PrBadgesLayer transform={transform} />
      <AnomalyBadgesLayer layout={layout} transform={transform} />
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
      <PagesTabBar />
      <BookmarksDrawer />
      <StoryboardPlayer />
      <TimerMount />
      <LassoOverlay containerRef={containerRef} layout={layout} />
      <BulkActionsToolbar layout={layout} />
      <ZoomLens containerRef={containerRef} layout={layout} zoomLensHeldRef={modifiers.zoomLensHeldRef} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        zoomToFile={zoomToFileSmooth}
        fitToGraph={onFit}
        resetViewport={resetViewport}
        exportPng={exportPng}
      />
      <ApplyThemeAttribute containerRef={containerRef} />
      <FilmStripScrubber graph={graph} />
      <DualSplitMount graph={graph} />
      <DebugHud />
      <EvidencePanel />
      <DevModeLayer onReady={onDevModeReady} />
      <RegressionHuntPanel />
      <RefactorPreviewOverlay />
      <PrReplayLauncher />
      <BisectGame />
      <AuthorFootprintLegend history={graph.history} />
      <ActionTerrainLayer />
      <ActionTerrainToggle />
      <RefactorBacklogPanel />
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

// Feature-gated mount for the dual-split toggle + container. The split
// UI is rendered as an overlay on top of the shared canvas; the toggle
// is a small button affordance placed near the minimap.
function DualSplitMount({ graph }: { graph: WorkspaceGraph }) {
  const on = useFeature("temporal.dualSplit");
  if (!on) return null;
  return (
    <div style={{ position: "absolute", bottom: 12, left: 200, zIndex: 3 }}>
      <DualSplitToggleButton graph={graph} />
      <DualCanvasContainer graph={graph}>
        {/* The split renders its own chrome; the actual canvas content
            is the surrounding MultiFileCanvas tree, shared across panes
            in the v1 implementation. */}
        <span />
      </DualCanvasContainer>
    </div>
  );
}
