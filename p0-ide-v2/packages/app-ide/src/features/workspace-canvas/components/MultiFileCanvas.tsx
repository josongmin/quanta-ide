import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../workspace-canvas.css";
import { EdgeGeometryCache, createEdgePickIndex } from "@quanta/canvas-engine";
import type { EdgePickIndex, WorkspaceGraph } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { requestEdgeGeometry, onEdgeGeometryReady } from "../hooks/use-worker-bridge";
import { useHebPaths } from "../hooks/use-heb-paths";
import { useCanvasViewport, INITIAL_FIT_MAX_SCALE } from "../hooks/use-canvas-viewport";
import { useCanvasInteractions } from "../hooks/use-canvas-interactions";
import { useTouchGestures } from "../hooks/use-touch-gestures";
import { useCanvasInitialize } from "../hooks/use-canvas-initialize";
import {
  useModifierKeyTracking,
  useGlobalKeybinds,
} from "../hooks/use-keyboard-shortcuts";
import { useCanvasKeybinds } from "../hooks/use-canvas-keybinds";
import { useInlineEditorStore } from "../store/inline-editor-store";
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
import { StreetCard } from "./StreetCard";
import { GroundCard } from "./GroundCard";
import { FolderFrame } from "./FolderFrame";
import { DebugKillSwitchBanner } from "./DebugKillSwitchBanner";
import { computeFolderRects } from "../lib/compute-folder-rects";
import { LoadingOverlay } from "./LoadingOverlay";
import { CanvasLayers } from "./CanvasLayers";
import { useKeyboardHints } from "./KeyboardHints";
import { type DevModeLayerApi } from "./DevModeLayer";
import { exportAsPNG } from "../lib/export-canvas";
import { featureFlagsStore } from "../store/feature-flags-store";
import { useAnomalyDetectionRun } from "../hooks/use-anomaly-detection";
import { useFeature } from "../store/feature-flags-store";
import { computeAuthorTints } from "./AuthorFootprintOverlay";
import {
  actionTerrainStore,
  useActionTerrainRender,
  useActionTerrainStore,
} from "../store/action-terrain-store";

const EMPTY_TINT_MAP: ReadonlyMap<string, string> = new Map();

interface Props {
  graph: WorkspaceGraph;
  /**
   * Whether the host tab is currently visible. The Shell keeps inactive
   * tabs mounted under `display: none`, so this prop is the only reliable
   * signal that the canvas is on-screen. We use it to:
   *   - pause the Pixi ticker while the tab is hidden (saves CPU on
   *     multi-tab workflows; complements the browser-level
   *     `visibilitychange` pause inside PixiStage).
   *   - The Code-Universe-level `resetDebugKnobs` fires from WorkspaceApp
   *     via `useTabFocus`; no extra wiring needed here.
   *
   * Defaults to `true` so callers that don't yet forward the prop
   * (tests, isolated previews) keep working.
   */
  isActive?: boolean;
}

export function MultiFileCanvas({ graph, isActive = true }: Props) {
  useWorkspaceCanvasOrchestrator(graph);
  useUrlStateSync();
  useAnomalyDetectionRun();
  const hebPaths = useHebPaths();
  useUrlStateSync();
  useAnomalyDetectionRun();
  // HEB path precompute — writes to sceneStore.hebPaths at galaxy-tier
  // LODs and returns a Map<edgeId, Float32Array> view for the renderer.
  // When EdgeStaticRenderer's HEB flag is off (default), the renderer
  // ignores the map; when on, it strokes edges along the pre-sampled
  // polyline at galaxy LOD only.
  const hebPaths = useHebPaths();

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
  // Keyboard hints overlay — owns the "?" global chord.
  const keyboardHints = useKeyboardHints();

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
  const showEffectBadges  = useRenderSettings(s => s.showEffectBadges);
  const showLatencyOverlay = useRenderSettings(s => s.showLatencyOverlay);
  const agentPresence     = usePresenceStore(s => s.agents);

  const actionTerrainMode    = useActionTerrainStore(s => s.mode);
  const actionTerrainEnabled = useActionTerrainRender(s => s.enabled);
  const actionTerrainBars    = useActionTerrainRender(s => s.bars);
  const actionTerrainCone    = useActionTerrainRender(s => s.coneForRenderer);
  const actionTerrainIsoCfg  = useActionTerrainRender(s => s.isoConfig);
  const actionTerrainProps = useMemo(() => ({
    enabled: actionTerrainEnabled,
    bars: actionTerrainBars,
    cone: actionTerrainCone,
    isoConfig: actionTerrainIsoCfg,
  }), [actionTerrainEnabled, actionTerrainBars, actionTerrainCone, actionTerrainIsoCfg]);

  // Iso bars are the primary signal in action-terrain mode; suppress flat
  // graph edges so they don't compete. The user-facing `showEdges` toggle
  // still reflects preference — flipping the mode off restores it.
  const effectiveShowEdges = showEdges && !actionTerrainMode;

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

  // Post-process the layout into per-folder wrapper rects. Purely visual
  // overlay — does not feed back into layout placement. Rebuilt only when
  // the graph's files or the layout reference change.
  const folderRects = useMemo(
    () => (layout ? computeFolderRects(graph.files, layout) : []),
    [graph.files, layout],
  );

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

  // Mobile / pen input. Parallel to the mouse path, guarded on
  // pointerType so mouse events stay owned by onMouseDown/Move/Up.
  useTouchGestures({ containerRef, panBy, zoomAt });

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
    // Mirror canvas selection into the Action Terrain store when mode is
    // active so the blast/fix cone tracks canvas clicks, not just panel rows.
    if (actionTerrainStore.getState().mode) {
      actionTerrainStore.selectFile(fileId);
    }
  }, [rawSelectFile]);

  // Pan/zoom transform — written imperatively to bypass React reconciliation
  // for the two hottest-changing DOM nodes (grid bg + DOM card layer). With
  // 5000+ files at street LOD, reconciling style objects 60×/s stutters.
  useEffect(() => {
    if (gridRef.current) gridRef.current.style.transform = transform;
    if (domLayerRef.current) domLayerRef.current.style.transform = transform;
  }, [transform]);

  // Inline-edit: when a new fileId enters edit mode, glide the camera to
  // fit that card so the editor shows at a legible scale. Seeded with the
  // current editingFileId (not null) so a non-null value carried across a
  // remount does not get interpreted as a fresh transition and auto-zoom
  // the user into ground tier on every Code Universe (re-)entry.
  const editingFileId = useInlineEditorStore(s => s.editingFileId);
  const prevEditingRef = useRef<string | null>(editingFileId);
  useEffect(() => {
    const prev = prevEditingRef.current;
    if (editingFileId === prev) return;
    prevEditingRef.current = editingFileId;
    if (!editingFileId) return;
    const rect = layout?.fileRects.get(editingFileId);
    if (!rect) return;
    smoothCamera.fitRect(rect, 0.85);
  }, [editingFileId, layout, smoothCamera]);

  // Mount-time side effects (edit-session cleanup, forceLod reset,
  // presence bridge + mock presence, demo stickies seeding) are
  // consolidated in useCanvasInitialize.
  useCanvasInitialize({ layout, graph });

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

  // Global keybinds live in use-canvas-keybinds. Cmd+Shift+D is still
  // owned by DebugHud directly and intentionally not duplicated there.
  useGlobalKeybinds(useCanvasKeybinds({ setPaletteOpen }));

  // Edge geometry: the main-thread `edgeCacheRef.current.build(...)` call
  // used to spread every route into a `BezierGeometry` and compute a 4-way
  // min/max bbox per edge — roughly 2000 entries × (spread + 4× Math.min/max
  // + new Rect) per layout rebuild. The bbox field is dead data (no reader
  // in the renderer pipeline; `EdgeOverlayRenderer`/`EdgeStaticRenderer`
  // only call `cache?.get(id) ?? layout.edgeRoutes.get(id)` for the route
  // fields), so that main-thread work was ~1ms of pure GC churn on every
  // graph swap.
  //
  // New path: fire `requestEdgeGeometry` at the worker instead. The worker
  // already owns `runGeometryTask`, which writes the 8-floats-per-edge
  // control points into a single transferable `Float32Array`. The renderer
  // keeps working unchanged: `cache.get(id)` returns undefined for entries
  // the worker hasn't delivered yet, and the `?? layout.edgeRoutes.get(id)`
  // fallback picks up the route from the layout Map — identical to what the
  // old `build()` was writing into the cache. The worker result is stashed
  // in `edgeGeometryBatchRef` for downstream consumers (GPU-buffer edge
  // renderer wiring is a follow-up) and for measurement.
  //
  // Expected saving per layout rebuild at 2000 edges: ~0.8-1.2ms main-
  // thread time, ~2000 throwaway objects (spread + bbox) off the heap.
  // First-paint is not regressed because the renderer has always read the
  // same fallback path when `cache.get()` misses.
  const edgeGeometryBatchRef = useRef<{
    requestId: string;
    positions: Float32Array;
    edgeIds: string[];
  } | null>(null);
  const pendingGeometryRequestIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!layout) {
      edgeCacheRef.current.clear();
      edgeGeometryBatchRef.current = null;
      pendingGeometryRequestIdRef.current = null;
      return;
    }
    const edges = layout.edgeRoutes.size > 0 ? (visibleScene?.edges ?? []) : [];
    // Cache stays empty — the renderer fallback (`layout.edgeRoutes.get`)
    // covers the reads until the worker batch lands. We keep the class
    // instance around because `PixiStage`'s type expects it.
    edgeCacheRef.current.clear();
    if (edges.length === 0) {
      edgeGeometryBatchRef.current = null;
      pendingGeometryRequestIdRef.current = null;
      return;
    }
    // Fire-and-forget: bridge tracks its own `currentGeometryRequestId` to
    // drop superseded responses, and we stash the id here so the listener
    // below can ignore payloads that predate our latest effect run (covers
    // the race where pan-driven layout invalidation triggers back-to-back
    // rebuilds).
    pendingGeometryRequestIdRef.current = requestEdgeGeometry(graph, layout);
    // WHY: edge cache rebuilds only when layout changes — edge updates
    // flow through the layout pipeline, so `visibleScene?.edges` here is
    // a snapshot read, not a reactive dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, graph]);

  // Subscribe once on mount. The bridge guards against stale responses at
  // the module level (via `currentGeometryRequestId`), but since multiple
  // mounts of this component could race, we also compare to our own
  // `pendingGeometryRequestIdRef` and drop any batch whose id doesn't match
  // the most recent request WE issued.
  useEffect(() => {
    const off = onEdgeGeometryReady((batch, requestId) => {
      if (pendingGeometryRequestIdRef.current !== requestId) return;
      edgeGeometryBatchRef.current = {
        requestId,
        positions: batch.positions,
        edgeIds: batch.edgeIds,
      };
    });
    return off;
  }, []);
  useEffect(() => {
    if (!layout) {
      edgePickIndexRef.current.clear();
      return;
    }
    const edges = visibleScene?.edges ?? [];
    edgePickIndexRef.current.build(edges, layout);
  }, [layout, visibleScene?.edges]);

  // Track whether we've already auto-fit this graph. Reset on graph swap
  // (layout → null → new layout) so a new repo's first layout always fits.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (!layout) fittedRef.current = false;
  }, [layout]);

  // ResizeObserver owns only the container-size write-through to the
  // viewport store. Fit is triggered by the dedicated effect below — keeping
  // these responsibilities split avoids the RO+layout dependency race that
  // used to skip fits when layout arrived while the container was 0×0.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setContainerSize(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerSize]);

  // Single source of truth for initial auto-fit: fires exactly once per
  // graph, as soon as BOTH the layout and a non-zero container size are
  // available — whichever arrives last. INITIAL_FIT_MAX_SCALE keeps first
  // paint off the ground tier.
  useEffect(() => {
    if (fittedRef.current) return;
    if (!layout) return;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    if (layout.totalBounds.w <= 0 || layout.totalBounds.h <= 0) return;
    fittedRef.current = true;
    fitToGraph(layout.totalBounds.w, layout.totalBounds.h, INITIAL_FIT_MAX_SCALE);
  }, [layout, viewport.width, viewport.height, fitToGraph]);

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
      data-inline-editing={editingFileId ? "on" : "off"}
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

      <DebugKillSwitchBanner />

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
            showEdges: effectiveShowEdges,
            edgeKinds,
            edgeLayers,
            edgeMinSeverity,
            edgeWidthMul,
            edgeFocus,
            edgePredicate,
            edgeViolations,
            hebPaths: hebPaths ?? undefined,
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
          actionTerrain={actionTerrainProps}
          highlightCrossGraph={highlightCrossGraph}
          effects={graph.effects}
          latency={graph.latency}
          showEffectBadges={showEffectBadges}
          showLatencyOverlay={showLatencyOverlay}
          active={isActive}
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
          {/* Folder frames render first (and carry z-index: 1 via CSS) so
              they sit visually behind the cards. pointer-events: none on
              the frame ensures card interactions are never blocked. */}
          {folderRects.map(fr => (
            <FolderFrame
              key={fr.path}
              path={fr.path}
              rect={fr.rect}
              depth={fr.depth}
              rdepth={fr.rdepth}
            />
          ))}
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

      <CanvasLayers
        transform={transform}
        scale={viewport.scale}
        viewport={viewport}
        layout={layout}
        graph={graph}
        containerRef={containerRef}
        zoomLensHeldRef={modifiers.zoomLensHeldRef}
        controls={{
          showEdges,
          edgeCount: visibleScene?.edges.length ?? 0,
          onZoomIn,
          onZoomOut,
          onFit,
          onToggleEdges: toggleEdges,
        }}
        palette={{
          open: paletteOpen,
          onClose: () => setPaletteOpen(false),
          zoomToFile: zoomToFileSmooth,
          resetViewport,
          exportPng,
        }}
        keyboardHints={{
          open: keyboardHints.open,
          onClose: () => keyboardHints.setOpen(false),
        }}
        onDevModeReady={onDevModeReady}
      />
    </div>
  );
}
