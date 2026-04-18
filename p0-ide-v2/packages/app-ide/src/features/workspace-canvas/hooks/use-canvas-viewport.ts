import { useCallback } from "react";
import { viewportStore, useViewportStore } from "../store/viewport-store";

// Scale bounds. Lower bound was 0.05 (5%) which blocked universe LOD
// (threshold 0.025) and left huge treemap layouts (~140k × 98k for quanta-v2)
// un-fit-able in a 1920×833 viewport. 0.001 is safe numerically — Pixi's
// world transform handles it, and float precision at this depth is still fine
// for the kinds of integer world coords we use (Rect x/y in the tens of
// thousands). Upper bound unchanged.
const MIN_SCALE = 0.001;
const MAX_SCALE = 2.5;

export function useCanvasViewport() {
  // Subscribe ONLY to the viewport slice so pan/zoom frames don't wake
  // subscribers of scene / interaction / settings.
  const viewport = useViewportStore(s => s.viewport);

  const panBy = useCallback((dx: number, dy: number) => {
    const prev = viewportStore.getState().viewport;
    viewportStore.setViewport({ ...prev, x: prev.x + dx, y: prev.y + dy });
  }, []);

  const zoomAt = useCallback((delta: number, anchorX: number, anchorY: number) => {
    const prev = viewportStore.getState().viewport;
    const prevScale = prev.scale;
    const prevX = prev.x;
    const prevY = prev.y;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * (1 + delta)));
    const ratio = newScale / prevScale;
    const x = anchorX - (anchorX - prevX) * ratio;
    const y = anchorY - (anchorY - prevY) * ratio;
    viewportStore.setViewport({ ...prev, x, y, scale: newScale });
  }, []);

  const fitToGraph = useCallback((graphW: number, graphH: number) => {
    const prev = viewportStore.getState().viewport;
    const containerW = prev.width;
    const containerH = prev.height;
    if (graphW <= 0 || graphH <= 0 || containerW <= 0 || containerH <= 0) return;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(containerW / graphW, containerH / graphH) * 0.9));
    const x = (containerW - graphW * scale) / 2;
    const y = (containerH - graphH * scale) / 2;
    viewportStore.setViewport({ ...prev, x, y, scale });
  }, []);

  const setContainerSize = useCallback((w: number, h: number) => {
    const prev = viewportStore.getState().viewport;
    viewportStore.setViewport({ ...prev, width: w, height: h });
  }, []);

  const transform = `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`;

  return { viewport, panBy, zoomAt, fitToGraph, setContainerSize, transform };
}
