import type { Rect } from "../graph/types";

// Line-anchored edge attachment. Street/Ground renderers draw the file card
// at full size with visible code lines; attaching an edge to the rect centre
// hides which line/symbol actually originates the relation. Sourcetrail /
// CodeSee / Lens.org attach edges to the card perimeter at the source line's
// vertical position, so the reader's eye lands on the exact symbol.
//
// Below the street tier the card is too small to show individual lines —
// callers should fall back to rect-centre anchoring via `centreAnchor`.

export interface EdgeAnchor {
  x: number;
  y: number;
  /** Which side of the rect this anchor sits on. Used by renderers to pick
   *  the bezier tangent direction (right-edge → control point goes right). */
  side: "left" | "right" | "top" | "bottom";
}

export interface LineAnchorInput {
  rect: Rect;
  line: number;            // 1-based
  totalLines: number;      // file.loc
  headerHeight?: number;   // world-px, default 32 (matches street-card CSS)
  footerHeight?: number;   // world-px, default 20
  /** When the partner rect is to the left of this one → use left edge. */
  partnerCenterX: number;
}

/**
 * Compute a perimeter anchor at a specific line Y position. Chooses the
 * left or right edge based on which side the partner is on, so edges don't
 * cross the card. Clamps line → [1, totalLines] so a bogus line doesn't
 * throw the anchor off the card.
 */
export function lineAnchor(input: LineAnchorInput): EdgeAnchor {
  const { rect, partnerCenterX } = input;
  const totalLines = Math.max(1, input.totalLines);
  const line = Math.min(Math.max(1, input.line), totalLines);
  const headerH = input.headerHeight ?? 32;
  const footerH = input.footerHeight ?? 20;
  const codeH = Math.max(1, rect.h - headerH - footerH);
  const y = rect.y + headerH + ((line - 0.5) / totalLines) * codeH;

  const cardCenterX = rect.x + rect.w / 2;
  const side: "left" | "right" = partnerCenterX < cardCenterX ? "left" : "right";
  const x = side === "left" ? rect.x : rect.x + rect.w;
  return { x, y, side };
}

/** Rect-centre fallback — used when a line anchor isn't applicable (no
 *  line number on the edge, or tier too coarse to show lines). */
export function centreAnchor(rect: Rect): EdgeAnchor {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
    side: "right",
  };
}

/** Side-centre anchor — used at city/galaxy when we know direction but
 *  don't have line detail. Places anchor at mid-height of the chosen side. */
export function sideAnchor(rect: Rect, partnerCenterX: number): EdgeAnchor {
  const cardCenterX = rect.x + rect.w / 2;
  const side: "left" | "right" = partnerCenterX < cardCenterX ? "left" : "right";
  return {
    x: side === "left" ? rect.x : rect.x + rect.w,
    y: rect.y + rect.h / 2,
    side,
  };
}
