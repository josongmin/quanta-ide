import { useCallback } from "react";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";

export function useCanvasViewport() {
  const viewport = useWorkspaceCanvas(s => s.viewport);

  const panBy = useCallback((dx: number, dy: number) => {
    const prev = workspaceCanvasStore.getState().viewport;
    workspaceCanvasStore.setViewport({ ...prev, x: prev.x + dx, y: prev.y + dy });
  }, []);

  const zoomAt = useCallback((delta: number, anchorX: number, anchorY: number) => {
    const prev = workspaceCanvasStore.getState().viewport;
    const prevScale = prev.scale;
    const prevX = prev.x;
    const prevY = prev.y;
    const newScale = Math.min(2.5, Math.max(0.05, prevScale * (1 + delta)));
    const ratio = newScale / prevScale;
    const x = anchorX - (anchorX - prevX) * ratio;
    const y = anchorY - (anchorY - prevY) * ratio;
    workspaceCanvasStore.setViewport({ ...prev, x, y, scale: newScale });
  }, []);

  const fitToGraph = useCallback((graphW: number, graphH: number) => {
    const prev = workspaceCanvasStore.getState().viewport;
    const containerW = prev.width;
    const containerH = prev.height;
    if (graphW <= 0 || graphH <= 0 || containerW <= 0 || containerH <= 0) return;
    const scale = Math.min(2.5, Math.max(0.05, Math.min(containerW / graphW, containerH / graphH) * 0.9));
    const x = (containerW - graphW * scale) / 2;
    const y = (containerH - graphH * scale) / 2;
    workspaceCanvasStore.setViewport({ ...prev, x, y, scale });
  }, []);

  const setContainerSize = useCallback((w: number, h: number) => {
    const prev = workspaceCanvasStore.getState().viewport;
    workspaceCanvasStore.setViewport({ ...prev, width: w, height: h });
  }, []);

  const transform = `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`;

  return { viewport, panBy, zoomAt, fitToGraph, setContainerSize, transform };
}
