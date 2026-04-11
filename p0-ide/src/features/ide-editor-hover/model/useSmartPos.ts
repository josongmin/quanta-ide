/**
 * Smart tooltip positioning — keeps popup fully inside viewport.
 *
 * Strategy (UX science):
 *  1. Default: right-below cursor (+gap)
 *  2. Overflows right  → flip to left of cursor
 *  3. Overflows bottom → flip to above cursor
 *  4. Always clamp with MARGIN from all edges
 */

const GAP    = 14;   // px between cursor and popup edge
const MARGIN = 10;   // minimum distance from viewport edge

export interface SmartPos {
  left: number;
  top: number;
  /** "above" | "below" — for arrow direction if needed */
  placement: "above" | "below";
}

export function smartPos(
  cursorX: number,
  cursorY: number,
  width: number,
  estimatedHeight: number,
): SmartPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Horizontal: prefer right of cursor, flip left if overflow
  let left = cursorX + GAP;
  if (left + width > vw - MARGIN) {
    left = cursorX - width - GAP;
  }
  left = Math.max(MARGIN, left);

  // Vertical: prefer below cursor, flip above if overflow
  let top: number;
  let placement: "above" | "below";

  const belowTop = cursorY + GAP;
  const aboveTop = cursorY - estimatedHeight - GAP;

  if (belowTop + estimatedHeight > vh - MARGIN && aboveTop >= MARGIN) {
    top = aboveTop;
    placement = "above";
  } else {
    top = belowTop;
    placement = "below";
  }

  // Final clamp
  top = Math.max(MARGIN, Math.min(vh - estimatedHeight - MARGIN, top));

  return { left, top, placement };
}
