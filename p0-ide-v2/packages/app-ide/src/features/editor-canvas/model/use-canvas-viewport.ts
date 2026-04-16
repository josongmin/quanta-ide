import { useReducer, useCallback, useEffect, useMemo } from "react";

// ── Public types ────────────────────────────────────────────────────
export interface Viewport {
  x: number; // translate X
  y: number; // translate Y
  scale: number; // zoom level (0.25 - 3)
}

// ── Reducer ─────────────────────────────────────────────────────────
type Action =
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; delta: number; cx: number; cy: number }
  | { type: "fit"; graphW: number; graphH: number; containerW: number; containerH: number };

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

function reducer(state: Viewport, action: Action): Viewport {
  switch (action.type) {
    case "pan":
      return { ...state, x: state.x + action.dx, y: state.y + action.dy };

    case "zoom": {
      const newScale = clampScale(state.scale * (1 + action.delta));
      // Adjust x/y so the point (cx, cy) in container space stays stable
      const ratio = newScale / state.scale;
      const x = action.cx - (action.cx - state.x) * ratio;
      const y = action.cy - (action.cy - state.y) * ratio;
      return { x, y, scale: newScale };
    }

    case "fit":
      return computeFit(action.graphW, action.graphH, action.containerW, action.containerH);
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

  // Re-fit when graph dimensions change
  useEffect(() => {
    dispatch({ type: "fit", graphW, graphH, containerW, containerH });
  }, [graphW, graphH, containerW, containerH]);

  // ── Stable action callbacks ─────────────────────────────────────
  const pan = useCallback((dx: number, dy: number) => {
    dispatch({ type: "pan", dx, dy });
  }, []);

  const zoom = useCallback((delta: number, cx: number, cy: number) => {
    dispatch({ type: "zoom", delta, cx, cy });
  }, []);

  const fit = useCallback(() => {
    dispatch({ type: "fit", graphW, graphH, containerW, containerH });
  }, [graphW, graphH, containerW, containerH]);

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

  // CSS transform string for the SVG <g> element
  const transform = useMemo(
    () => `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
    [viewport.x, viewport.y, viewport.scale],
  );

  return { viewport, pan, zoom, fit, zoomIn, zoomOut, transform };
}
