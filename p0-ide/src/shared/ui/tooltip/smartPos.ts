/**
 * Smart tooltip positioning — keeps popup fully inside viewport.
 *
 * Two modes:
 *  - **cursor mode** (x, y point): tooltip appears near the cursor.
 *  - **anchor mode** (AnchorRect): tooltip appears attached to a DOM element,
 *    with configurable overlap so the popup visually "touches" its anchor.
 */

const CURSOR_GAP = 14; // px gap in cursor mode
const MARGIN = 10;     // minimum distance from viewport edge

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
}

export interface SmartPosOptions {
  width: number;
  estimatedHeight: number;
  /** Px the tooltip overlaps the anchor (default 0). Positive = tooltip covers part of anchor. */
  overlap?: number;
}

export interface SmartPos {
  left: number;
  top: number;
  placement: "above" | "below";
}

/**
 * Position relative to a cursor point (legacy / LineTooltip).
 * Adds CURSOR_GAP between point and tooltip.
 */
export function smartPos(
  cursorX: number,
  cursorY: number,
  width: number,
  estimatedHeight: number,
): SmartPos {
  return anchorPos(
    { left: cursorX, top: cursorY, bottom: cursorY },
    { width, estimatedHeight, overlap: -CURSOR_GAP },
  );
}

/**
 * Position relative to an anchor rect (symbol, badge, chip).
 * The tooltip is placed below the anchor by default, flipped above if needed.
 * `overlap` controls how many px the tooltip covers the anchor edge.
 */
export function anchorPos(
  anchor: AnchorRect,
  { width, estimatedHeight, overlap = 0 }: SmartPosOptions,
): SmartPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── Horizontal: start at anchor left, flip left if overflow ──
  let left = anchor.left;
  if (left + width > vw - MARGIN) {
    left = vw - MARGIN - width;
  }
  left = Math.max(MARGIN, left);

  // ── Vertical: prefer below, flip above if overflow ──
  const belowTop = anchor.bottom - overlap;
  const aboveTop = anchor.top + overlap - estimatedHeight;

  let top: number;
  let placement: "above" | "below";

  if (belowTop + estimatedHeight > vh - MARGIN && aboveTop >= MARGIN) {
    top = aboveTop;
    placement = "above";
  } else {
    top = belowTop;
    placement = "below";
  }

  top = Math.max(MARGIN, Math.min(vh - estimatedHeight - MARGIN, top));

  return { left, top, placement };
}
