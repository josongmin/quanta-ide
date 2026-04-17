import { useReducer, useCallback, useEffect, useMemo } from "react";

// ── Public types ────────────────────────────────────────────────────
export interface Viewport {
  x: number; // translate X
  y: number; // translate Y
  scale: number; // zoom level (0.25 - 3)
}

/** Bounding box for a region of interest (in graph coordinates). */
export interface FocusRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Reducer ─────────────────────────────────────────────────────────
type Action =
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; delta: number; cx: number; cy: number }
  | { type: "fit"; graphW: number; graphH: number; containerW: number; containerH: number }
  | { type: "focus"; region: FocusRegion; containerW: number; containerH: number };

function clampScale(s: number): number {
  return Math.min(3, Math.max(0.25, s));
}

function computeFit(graphW: number, graphH: number, containerW: number, containerH: number): Viewport {
  if (graphW <= 0 || graphH <= 0 || containerW <= 0 || containerH <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }
  const scale = clampScale(Math.min(containerW / graphW, containerH / graphH, 1) * 0.9);
  const x = (containerW - graphW * scale) / 2;
  const y = (containerH - graphH * scale) / 2;
  return { x, y, scale };
}

function computeFocus(region: FocusRegion, containerW: number, containerH: number): Viewport {
  if (region.w <= 0 || region.h <= 0 || containerW <= 0 || containerH <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }
  // Fit region into container with 10% padding
  const scale = clampScale(Math.min(containerW / region.w, containerH / region.h) * 0.85);
  // Center the region
  const x = (containerW - region.w * scale) / 2 - region.x * scale;
  const y = (containerH - region.h * scale) / 2 - region.y * scale;
  return { x, y, scale };
}

function reducer(state: Viewport, action: Action): Viewport {
  switch (action.type) {
    case "pan":
      return { ...state, x: state.x + action.dx, y: state.y + action.dy };

    case "zoom": {
      const newScale = clampScale(state.scale * (1 + action.delta));
      const ratio = newScale / state.scale;
      const x = action.cx - (action.cx - state.x) * ratio;
      const y = action.cy - (action.cy - state.y) * ratio;
      return { x, y, scale: newScale };
    }

    case "fit":
      return computeFit(action.graphW, action.graphH, action.containerW, action.containerH);

    case "focus":
      return computeFocus(action.region, action.containerW, action.containerH);
  }
}

// ── Hook ────────────────────────────────────────────────────────────
export function useCanvasViewport(
  graphW: number,
  graphH: number,
  containerW: number,
  containerH: number,
) {
  const initialState = computeFit(graphW, graphH, containerW, containerH);
  const [viewport, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "fit", graphW, graphH, containerW, containerH });
  }, [graphW, graphH, containerW, containerH]);

  const pan = useCallback((dx: number, dy: number) => {
    dispatch({ type: "pan", dx, dy });
  }, []);

  const zoom = useCallback((delta: number, cx: number, cy: number) => {
    dispatch({ type: "zoom", delta, cx, cy });
  }, []);

  const fit = useCallback(() => {
    dispatch({ type: "fit", graphW, graphH, containerW, containerH });
  }, [graphW, graphH, containerW, containerH]);

  const focusRegion = useCallback((region: FocusRegion) => {
    dispatch({ type: "focus", region, containerW, containerH });
  }, [containerW, containerH]);

  const zoomIn = useCallback(() => {
    const cx = containerW / 2;
    const cy = containerH / 2;
    dispatch({ type: "zoom", delta: 0.2, cx, cy });
  }, [containerW, containerH]);

  const zoomOut = useCallback(() => {
    const cx = containerW / 2;
    const cy = containerH / 2;
    dispatch({ type: "zoom", delta: -0.2, cx, cy });
  }, [containerW, containerH]);

  const transform = useMemo(
    () => `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
    [viewport.x, viewport.y, viewport.scale],
  );

  return { viewport, pan, zoom, fit, focusRegion, zoomIn, zoomOut, transform };
}
