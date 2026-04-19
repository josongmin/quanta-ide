import { memo } from "react";

interface Props {
  /** Canonical project-relative path — rendered as the breadcrumb text. */
  text: string;
  /** World-space position of the pill (computed by computeCanvasLabels). */
  worldX: number;
  worldY: number;
}

/**
 * Sticky breadcrumb pill for a code card. The owning card's intrinsic
 * header has scrolled above the viewport, so this pill takes over and
 * spells out the full project-relative path while the card body is
 * still on-screen.
 *
 * Layout (position, visibility, overlap resolution) is owned by
 * `computeCanvasLabels` so this component stays purely presentational.
 */
function FileStickyLabelImpl({ text, worldX, worldY }: Props) {
  return (
    <div
      className="file-sticky-label"
      style={{ left: worldX, top: worldY }}
    >
      {text}
    </div>
  );
}

export const FileStickyLabel = memo(FileStickyLabelImpl);
