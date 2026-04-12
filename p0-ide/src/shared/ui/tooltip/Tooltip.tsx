import { forwardRef, type ReactNode } from "react";
import { smartPos } from "./smartPos";

export interface TooltipProps {
  /** Cursor X (viewport coords) */
  x: number;
  /** Cursor Y (viewport coords) */
  y: number;
  /** Fixed width of the tooltip (needed for smart positioning) */
  width?: number;
  /** Estimated height for overflow detection */
  estimatedHeight?: number;
  variant?: "default" | "muted";
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;

/**
 * Shared floating Tooltip chrome.
 *
 * Computes viewport-clamped position via {@link smartPos} and renders a fixed
 * div with overlay-popover tokens. Parents handle their own show/hide state.
 */
export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(
  {
    x,
    y,
    width = DEFAULT_WIDTH,
    estimatedHeight = DEFAULT_HEIGHT,
    variant = "default",
    children,
    className,
    "aria-label": ariaLabel,
  },
  ref,
) {
  const { left, top } = smartPos(x, y, width, estimatedHeight);

  return (
    <div
      ref={ref}
      className={`tooltip tooltip--${variant}${className ? ` ${className}` : ""}`}
      style={{ left, top, width }}
      role="tooltip"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
});
