/**
 * Pure helper — computes fixed top/left for a popover given an anchor rect,
 * placement, offset, popover size, and viewport size. Flips vertically when
 * the primary side has insufficient space.
 */

export type PopoverPlacement =
  | "bottom-start"
  | "bottom-end"
  | "bottom"
  | "top-start"
  | "top-end"
  | "top";

export interface PopoverAnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export interface ComputedPopoverPosition {
  top: number;
  left: number;
}

export function computePopoverPosition(
  anchor: PopoverAnchorRect,
  placement: PopoverPlacement,
  offset: number,
  popoverSize: { width: number; height: number },
  viewport: { width: number; height: number },
): ComputedPopoverPosition {
  const isTop = placement.startsWith("top");
  const spaceBelow = viewport.height - anchor.bottom;
  const spaceAbove = anchor.top;

  let useTop = isTop;
  if (isTop && spaceAbove < popoverSize.height + offset && spaceBelow > spaceAbove) {
    useTop = false;
  } else if (!isTop && spaceBelow < popoverSize.height + offset && spaceAbove > spaceBelow) {
    useTop = true;
  }

  const top = useTop
    ? anchor.top - popoverSize.height - offset
    : anchor.bottom + offset;

  const align = placement.endsWith("-end")
    ? "end"
    : placement.endsWith("-start")
      ? "start"
      : "center";

  let left: number;
  if (align === "start") {
    left = anchor.left;
  } else if (align === "end") {
    left = anchor.right - popoverSize.width;
  } else {
    left = anchor.left + anchor.width / 2 - popoverSize.width / 2;
  }

  const pad = 8;
  if (left + popoverSize.width > viewport.width - pad) {
    left = viewport.width - popoverSize.width - pad;
  }
  if (left < pad) left = pad;

  return { top, left };
}
