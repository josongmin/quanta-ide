import { useRef, useCallback, useEffect } from "react";
import "../workspace-canvas.css";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { useWorkspaceCanvas } from "../store/workspace-canvas-store";
import { workspaceCanvasStore } from "../store/workspace-canvas-store";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);

  const containerRef = useRef<HTMLDivElement>(null);
  const { panBy, zoomAt, setContainerSize, transform } = useCanvasViewport();
  const lod          = useWorkspaceCanvas(s => s.lod);
  const visibleScene = useWorkspaceCanvas(s => s.visibleScene);

  // ResizeObserver for container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerSize]);

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
      {/* DOM layer: street + ground */}
      {(lod === "street" || lod === "ground") && (
        <div className="workspace-canvas__dom-layer" style={{ transform, transformOrigin: "0 0", willChange: "transform" }}>
          {visibleScene.files.map(file => {
            const layout = workspaceCanvasStore.getState().layout;
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            return (
              <div
                key={file.id}
                className="file-card"
                style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                onClick={() => workspaceCanvasStore.selectFile(file.id)}
              >
                <div className="file-card__header">{file.name}</div>
                <div className="file-card__body">
                  {/* GroundCard / StreetCard goes here in later phases */}
                  <span style={{ opacity: 0.4, fontSize: 11 }}>{lod} · {file.loc} lines</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Galaxy/City: placeholder until canvas-pixi is ready */}
      {(lod === "galaxy" || lod === "city") && (
        <div className="workspace-canvas__dom-layer" style={{ transform, transformOrigin: "0 0" }}>
          {visibleScene.files.map(file => {
            const layout = workspaceCanvasStore.getState().layout;
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            const risk = file.riskScore;
            const bg = risk >= 70 ? "#fee2e2" : risk >= 40 ? "#fef3c7" : "#dcfce7";
            return (
              <div
                key={file.id}
                style={{
                  position: "absolute",
                  left: rect.x, top: rect.y,
                  width: rect.w, height: rect.h,
                  background: bg,
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  cursor: "pointer",
                }}
                onClick={() => workspaceCanvasStore.selectFile(file.id)}
              >
                {file.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
