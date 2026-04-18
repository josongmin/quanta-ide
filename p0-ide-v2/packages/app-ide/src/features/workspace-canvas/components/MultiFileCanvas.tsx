import { useRef, useCallback, useEffect } from "react";
import "../workspace-canvas.css";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";
import { EdgeGeometryCache } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { StreetCard } from "./StreetCard";
import { GroundCard } from "./GroundCard";
import { Minimap } from "./Minimap";
import { CanvasControls } from "./CanvasControls";

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);

  const containerRef = useRef<HTMLDivElement>(null);
  const { panBy, zoomAt, fitToGraph, setContainerSize, transform, viewport } = useCanvasViewport();
  const lod          = useWorkspaceCanvas(s => s.lod);
  const visibleScene = useWorkspaceCanvas(s => s.visibleScene);
  const viewState    = useWorkspaceCanvas(s => s.viewState);
  const layout       = useWorkspaceCanvas(s => s.layout);
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

  // Wheel handler (non-passive for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.deltaY * -0.004, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, panBy]);

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
    panBy(e.clientX - lastMouse.current.x, e.clientY - lastMouse.current.y);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [panBy]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Zoom controls
  const onZoomIn = useCallback(() => zoomAt(0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onZoomOut = useCallback(() => zoomAt(-0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onFit = useCallback(() => {
    if (layout) fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
  }, [fitToGraph, layout]);

  if (!visibleScene) {
    return <div ref={containerRef} className="workspace-canvas workspace-canvas--loading" />;
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
      {/* Grid dot background (moves with pan/zoom) */}
      <div
        className="workspace-canvas__grid"
        style={{ transform, transformOrigin: "0 0" }}
      />

      {/* WebGL layer: always mounted when layout ready to avoid reinit on LOD transition */}
      {layout && (
        <PixiStage
          visible={visibleScene}
          layout={layout}
          viewState={viewState}
          lod={lod}
          edgeCache={edgeCacheRef.current}
          onFileClick={(fileId) => workspaceCanvasStore.selectFile(fileId)}
          onFileHover={(fileId) => workspaceCanvasStore.hoverFile(fileId)}
        />
      )}

      {/* DOM layer: Street */}
      {lod === "street" && (
        <div className="workspace-canvas__dom-layer" style={{ transform, transformOrigin: "0 0", willChange: "transform" }}>
          {visibleScene.files.map(file => {
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            return (
              <StreetCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={viewState.selectedFileId === file.id}
                onSelect={(id) => workspaceCanvasStore.selectFile(id)}
              />
            );
          })}
        </div>
      )}

      {/* DOM layer: Ground */}
      {lod === "ground" && (
        <div className="workspace-canvas__dom-layer" style={{ transform, transformOrigin: "0 0", willChange: "transform" }}>
          {visibleScene.files.map(file => {
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            return (
              <GroundCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={viewState.selectedFileId === file.id}
                onSelect={(id) => workspaceCanvasStore.selectFile(id)}
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
      />
    </div>
  );
}
