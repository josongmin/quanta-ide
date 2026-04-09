import { useCallback, useRef, useState } from "react";

type Side = "right" | "left";

interface PanelResizerProps {
  /** CSS variable name on .ide root, e.g. "--files-w" */
  cssVar: string;
  /** Which side of the panel the handle sits on */
  side: Side;
  min?: number;
  max?: number;
}

/**
 * Absolute-positioned drag handle placed inside a grid panel.
 * Reads/writes a CSS custom property on the nearest `.ide` ancestor to
 * resize the panel via grid-template-columns.
 */
export function PanelResizer({ cssVar, side, min = 120, max = 600 }: PanelResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const ideEl = (e.currentTarget as HTMLElement).closest(".ide") as HTMLElement | null;
      if (!ideEl) return;

      const current = parseInt(getComputedStyle(ideEl).getPropertyValue(cssVar), 10) || 0;
      startX.current = e.clientX;
      startW.current = current;
      setDragging(true);

      const onMove = (mv: MouseEvent) => {
        const delta = mv.clientX - startX.current;
        const next = Math.min(max, Math.max(min, startW.current + (side === "right" ? delta : -delta)));
        ideEl.style.setProperty(cssVar, `${next}px`);
      };

      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [cssVar, side, min, max],
  );

  return (
    <div
      className={`ide-resizer ide-resizer-${side}${dragging ? " is-dragging" : ""}`}
      style={{ [side]: 0 }}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="vertical"
    />
  );
}
