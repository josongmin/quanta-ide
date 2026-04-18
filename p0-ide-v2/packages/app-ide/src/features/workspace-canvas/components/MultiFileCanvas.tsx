import { useRef, useCallback, useEffect } from "react";
import "../workspace-canvas.css";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { viewportStore } from "../store/viewport-store";
import { sceneStore, useSceneStore } from "../store/scene-store";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { settingsStore, useSettingsStore } from "../store/settings-store";
import { EdgeGeometryCache } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { StreetCard } from "./StreetCard";
import { GroundCard } from "./GroundCard";
import { Minimap } from "./Minimap";
import { CanvasControls } from "./CanvasControls";
import { LoadingOverlay } from "./LoadingOverlay";
import { DebugHud } from "./DebugHud";

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef      = useRef<HTMLDivElement>(null);
  const domLayerRef  = useRef<HTMLDivElement>(null);
  const { panBy, zoomAt, fitToGraph, setContainerSize, transform, viewport } = useCanvasViewport();

  // Stable callbacks so memoized cards don't re-render when unrelated state
  // changes. Store references don't change across renders.
  const selectFile = useCallback((id: string) => interactionStore.selectFile(id), []);
  const hoverFile = useCallback((id: string | null) => interactionStore.hoverFile(id), []);
  // Reads the current value from the settings store at click time so we
  // don't need `showEdges` in deps — keeps this callback referentially
  // stable for the CanvasControls memo boundary (and for our own render
  // budget).
  const toggleEdges = useCallback(() => {
    settingsStore.setShowEdges(!settingsStore.getState().showEdges);
  }, []);

  // Apply the pan/zoom transform imperatively rather than via `style={{transform}}`
  // props. This bypasses React reconciliation for the two hottest-changing DOM
  // nodes on the page (the grid background + DOM card layer). With 5000+ files
  // at street LOD, React reconciling a fresh style object 60×/s alone produced
  // measurable stutter.
  useEffect(() => {
    if (gridRef.current) gridRef.current.style.transform = transform;
    if (domLayerRef.current) domLayerRef.current.style.transform = transform;
  }, [transform]);
  // Fix #5: migrate hot-path selectors onto focused sub-stores so pan/zoom
  // ticks (viewport store) don't wake scene/settings subscribers, and vice
  // versa. Each field is read from the store that owns it.
  const lod               = useInteractionStore(s => s.lod);
  const visibleScene      = useSceneStore(s => s.visibleScene);
  const clusterScene      = useSceneStore(s => s.clusterScene);
  const superclusterScene = useSceneStore(s => s.superclusterScene);
  const viewState         = useInteractionStore(s => s.viewState);
  const layout            = useSceneStore(s => s.layout);
  const layoutProgress    = useSceneStore(s => s.layoutProgress);
  const showEdges         = useSettingsStore(s => s.showEdges);
  const edgeKinds         = useSettingsStore(s => s.edgeKinds);
  const edgeWidthMul      = useSettingsStore(s => s.edgeWidthMul);
  const edgeCacheRef = useRef(new EdgeGeometryCache());

  // Rebuild edge cache when layout changes
  useEffect(() => {
    if (!layout) return;
    edgeCacheRef.current.build(
      layout.edgeRoutes.size > 0 ? (visibleScene?.edges ?? []) : [],
      layout,
    );
    // intentionally exclude visibleScene.edges — rebuild on layout change only
  }, [layout]);

  // ResizeObserver for container size — also triggers initial fit if layout
  // already arrived while container was still 0×0 (worker is fast).
  const fittedRef = useRef(false);
  // When the graph is replaced (setGraph resets layout to null), allow a fresh
  // fit once the new layout arrives. Without this, loading a new repo would
  // leave the old graph's zoom/pan.
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

  // RAF-batched pan/zoom: trackpad wheel + mousemove can fire 100+ Hz. Each
  // event would otherwise round-trip through the store → re-render → Pixi
  // camera effect. Coalesce into one flush per animation frame (~60 fps).
  const pendingPan = useRef({ dx: 0, dy: 0 });
  const pendingZoom = useRef<{ delta: number; x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);

  const flush = useCallback(() => {
    rafId.current = null;
    if (pendingZoom.current) {
      const { delta, x, y } = pendingZoom.current;
      pendingZoom.current = null;
      zoomAt(delta, x, y);
    }
    const { dx, dy } = pendingPan.current;
    if (dx !== 0 || dy !== 0) {
      pendingPan.current.dx = 0;
      pendingPan.current.dy = 0;
      panBy(dx, dy);
    }
  }, [panBy, zoomAt]);

  const scheduleFlush = useCallback(() => {
    if (rafId.current === null) rafId.current = requestAnimationFrame(flush);
  }, [flush]);

  // Wheel handler (non-passive for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Zoom deltas accumulate too — multiple wheel ticks in one frame
        // collapse into one zoomAt call with summed delta around the last cursor.
        const delta = e.deltaY * -0.008;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (pendingZoom.current) {
          pendingZoom.current.delta += delta;
          pendingZoom.current.x = px;
          pendingZoom.current.y = py;
        } else {
          pendingZoom.current = { delta, x: px, y: py };
        }
      } else {
        pendingPan.current.dx += -e.deltaX;
        pendingPan.current.dy += -e.deltaY;
      }
      scheduleFlush();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scheduleFlush]);

  useEffect(() => () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
  }, []);

  // Mouse drag for pan
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,a,.file-card")) return;
    e.preventDefault();
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    pendingPan.current.dx += e.clientX - lastMouse.current.x;
    pendingPan.current.dy += e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    scheduleFlush();
  }, [scheduleFlush]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Zoom controls
  const onZoomIn = useCallback(() => zoomAt(0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onZoomOut = useCallback(() => zoomAt(-0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onFit = useCallback(() => {
    if (layout) fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
  }, [fitToGraph, layout]);

  // Cluster click → zoom-to-fit that cluster's rect. Reads layout + viewport
  // directly from the owning sub-stores at click time so this callback stays
  // referentially stable (important: PixiStage stores the ref inside a
  // useEffect([]) init path).
  const onClusterClick = useCallback((clusterId: string) => {
    const layout = sceneStore.getState().layout;
    const rect = layout?.clusterRects?.get(clusterId)
      ?? layout?.clusters?.find(c => c.id === clusterId)?.rect;
    if (!rect) return;
    const vp = viewportStore.getState().viewport;
    if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
    // Fill ~80% of the viewport with the cluster; center it.
    const FILL = 0.8;
    const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
    // Clamp to the same bounds as useCanvasViewport.zoomAt (0.05..2.5).
    const scale = Math.min(2.5, Math.max(0.05, rawScale));
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const x = vp.width / 2 - cx * scale;
    const y = vp.height / 2 - cy * scale;
    viewportStore.setViewport({ ...vp, x, y, scale });
  }, []);

  // Supercluster click → same zoom-to-fit behavior as clusters, indexed into
  // layout.superclusters. Referentially stable so PixiStage's init-path ref
  // capture doesn't churn.
  const onSuperclusterClick = useCallback((superclusterId: string) => {
    const layout = sceneStore.getState().layout;
    const rect = layout?.superclusters?.find(c => c.id === superclusterId)?.rect;
    if (!rect) return;
    const vp = viewportStore.getState().viewport;
    if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
    const FILL = 0.8;
    const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
    const scale = Math.min(2.5, Math.max(0.05, rawScale));
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const x = vp.width / 2 - cx * scale;
    const y = vp.height / 2 - cy * scale;
    viewportStore.setViewport({ ...vp, x, y, scale });
  }, []);

  // Show the loading overlay only when none of the three scene tiers has
  // been computed. At supergalaxy / universe LOD visibleScene is null (we
  // use clusterScene / superclusterScene instead) — either one is "ready".
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
      {/* Grid dot background (moves with pan/zoom; transform applied imperatively) */}
      <div
        ref={gridRef}
        className="workspace-canvas__grid"
        style={{ transformOrigin: "0 0" }}
      />

      {/* WebGL layer: always mounted when layout ready to avoid reinit on LOD transition */}
      {layout && (
        <PixiStage
          visible={visibleScene ?? { kind: "files", files: [], edges: [], comments: [] }}
          clusters={clusterScene}
          superclusters={superclusterScene}
          layout={layout}
          viewState={viewState}
          viewport={viewport}
          lod={lod}
          edgeCache={edgeCacheRef.current}
          showEdges={showEdges}
          edgeKinds={edgeKinds}
          edgeWidthMul={edgeWidthMul}
          onFileClick={selectFile}
          onFileHover={hoverFile}
          onClusterClick={onClusterClick}
          onSuperclusterClick={onSuperclusterClick}
        />
      )}

      {/* DOM layer: Street/Ground (transform applied imperatively via domLayerRef) */}
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
            return lod === "street" ? (
              <StreetCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
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

      {/* Overlays */}
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
      <DebugHud />
    </div>
  );
}
