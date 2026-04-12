import { useCallback, useRef, useState } from "react";

type Side = "right" | "left" | "top" | "bottom";

interface PanelResizerProps {
  /** CSS variable name on .ide root, e.g. "--files-w" or "--bottom-h" */
  cssVar: string;
  /** Which edge of the panel the handle sits on */
  side: Side;
  min?: number;
  max?: number;
}

const HORIZONTAL: ReadonlySet<Side> = new Set<Side>(["left", "right"]);

/**
 * Absolute-positioned drag handle placed inside a grid panel.
 * Reads/writes a CSS custom property on the nearest `.ide` ancestor to
 * resize the panel via grid-template-columns or grid-template-rows.
 *
 * Sign convention: dragging *outward* from the panel grows it.
 *  - right side: positive deltaX grows width
 *  - left side:  negative deltaX grows width
 *  - bottom side: positive deltaY grows height
 *  - top side:    negative deltaY grows height
 */
export function PanelResizer({ cssVar, side, min = 120, max = 600 }: PanelResizerProps) {
  const [dragging, setDragging] = useState(false);
  const startCoord = useRef(0);
  const startSize = useRef(0);

  const isHorizontal = HORIZONTAL.has(side);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const ideEl = (e.currentTarget as HTMLElement).closest<HTMLElement>(".ide");
      if (!ideEl) return;

      const current = parseInt(getComputedStyle(ideEl).getPropertyValue(cssVar), 10) || 0;
      startCoord.current = isHorizontal ? e.clientX : e.clientY;
      startSize.current = current;
      setDragging(true);

      const onMove = (mv: MouseEvent) => {
        const coord = isHorizontal ? mv.clientX : mv.clientY;
        const rawDelta = coord - startCoord.current;
        const sign =
          side === "right" || side === "bottom" ? 1 : -1;
        const next = Math.min(
          max,
          Math.max(min, startSize.current + sign * rawDelta),
        );
        ideEl.style.setProperty(cssVar, `${String(next)}px`);
      };

      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [cssVar, side, min, max, isHorizontal],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-only resize handle
    <div
      className={`ide-resizer ide-resizer-${side}${dragging ? " is-dragging" : ""}`}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
    />
  );
}
