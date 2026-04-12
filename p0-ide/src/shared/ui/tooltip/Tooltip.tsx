import { forwardRef, type ReactNode } from "react";
import { smartPos, anchorPos, type AnchorRect } from "./smartPos";

export interface TooltipProps {
  children: ReactNode;
  /** Fixed width of the tooltip (needed for smart positioning) */
  width?: number;
  /** Estimated height for overflow detection */
  estimatedHeight?: number;
  variant?: "default" | "muted";
  className?: string;
  "aria-label"?: string;
  /** When true, the tooltip accepts pointer events (hoverable / clickable). */
  interactive?: boolean;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

/** Cursor-mode: tooltip positioned near a point (legacy). */
export interface CursorTooltipProps extends TooltipProps {
  x: number;
  y: number;
  anchor?: never;
  overlap?: never;
}

/** Anchor-mode: tooltip positioned relative to a DOM rect. */
export interface AnchorTooltipProps extends TooltipProps {
  anchor: AnchorRect;
  /** Px the tooltip overlaps the anchor edge (default 0). */
  overlap?: number;
  x?: never;
  y?: never;
}

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;

/**
 * Shared floating Tooltip chrome.
 *
 * Computes viewport-clamped position and renders a fixed div with
 * overlay-popover tokens. Parents handle their own show/hide state.
 */
export const Tooltip = forwardRef<HTMLDivElement, CursorTooltipProps | AnchorTooltipProps>(
  function Tooltip(props, ref) {
    const {
      width = DEFAULT_WIDTH,
      estimatedHeight = DEFAULT_HEIGHT,
      variant = "default",
      children,
      className,
      "aria-label": ariaLabel,
      interactive,
      onMouseEnter,
      onMouseLeave,
    } = props;

    const { left, top } = props.anchor
      ? anchorPos(props.anchor, { width, estimatedHeight, overlap: props.overlap })
      : smartPos(props.x, props.y, width, estimatedHeight);

    return (
      <div
        ref={ref}
        className={`tooltip tooltip--${variant}${interactive ? " tooltip--interactive" : ""}${className ? ` ${className}` : ""}`}
        style={{ left, top, width }}
        role={interactive ? "dialog" : "tooltip"}
        aria-label={ariaLabel}
        {...(interactive ? { onMouseEnter, onMouseLeave } : {})}
      >
        {children}
      </div>
    );
  },
);
