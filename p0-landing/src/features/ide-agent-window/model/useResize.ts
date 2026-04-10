import { useCallback, useEffect, useRef, useState } from "react";

export type ResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const RESIZE_CURSORS: Record<ResizeEdge, string> = {
  n: "n-resize", s: "s-resize", e: "e-resize", w: "w-resize",
  ne: "ne-resize", nw: "nw-resize", se: "se-resize", sw: "sw-resize",
};

const MIN_W = 400;
const MIN_H = 300;

export function useResize(
  initialSize: { w: number; h: number },
  pos: { x: number; y: number },
  setPos: (p: { x: number; y: number }) => void,
) {
  const [size, setSize] = useState(initialSize);
  const resizing = useRef<ResizeEdge | null>(null);
  const origin = useRef({ mx: 0, my: 0, w: 0, h: 0, px: 0, py: 0 });

  const onResizeMouseDown = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = edge;
    origin.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h, px: pos.x, py: pos.y };
  }, [size, pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const edge = resizing.current;
      if (!edge) return;
      const dx = e.clientX - origin.current.mx;
      const dy = e.clientY - origin.current.my;
      let newW = origin.current.w, newH = origin.current.h;
      let newX = origin.current.px, newY = origin.current.py;
      if (edge.includes("e")) newW = Math.max(MIN_W, origin.current.w + dx);
      if (edge.includes("s")) newH = Math.max(MIN_H, origin.current.h + dy);
      if (edge.includes("w")) { newW = Math.max(MIN_W, origin.current.w - dx); newX = origin.current.px + (origin.current.w - newW); }
      if (edge.includes("n")) { newH = Math.max(MIN_H, origin.current.h - dy); newY = origin.current.py + (origin.current.h - newH); }
      setSize({ w: newW, h: newH });
      setPos({ x: newX, y: newY });
    };
    const onUp = () => { resizing.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [setPos]);

  return { size, onResizeMouseDown };
}
