import { memo } from "react";
import type { Rect } from "@quanta/canvas-engine";

interface Props {
  /** Full folder path — used as a stable key / debugging handle. */
  path: string;
  /** Bounding rect (in canvas coordinates) enclosing every descendant. */
  rect: Rect;
  /** 0 = top-level package, 1 = second tier, etc. Drives label emphasis. */
  depth: number;
  /** 0 = innermost wrapper (nearest to leaves), higher = outer shell. */
  rdepth: number;
  /** Label text to display — either the leaf segment (natural) or the
   *  full path (when the label has been clamped into the viewport). */
  label: string;
  /** World-space position of the label pill. */
  labelX: number;
  labelY: number;
  /** Whether the label has been pushed off its natural corner by the
   *  viewport edge. Drives the `--clamped` variant for styling hooks. */
  clamped: boolean;
  /** Hide the label entirely — used when a same-branch descendant's
   *  clamped label is already carrying the full path. The frame itself
   *  still renders. */
  labelHidden: boolean;
}

/**
 * Visual wrapper that draws a frame around files belonging to the same
 * ancestor folder. Nested folders stack — the outermost top-level package
 * wraps every descendant, down to the innermost leaf folder.
 *
 * Label state (text, position, visibility) is computed by the parent via
 * `computeFolderLabels` so overlap between same-branch ancestor/descendant
 * breadcrumbs can be resolved with global knowledge — a single frame
 * can't see its siblings.
 *
 * Rendered *behind* GroundCards (see `.folder-frame` z-index), so the
 * cards remain fully interactive on top. `pointer-events: none` on the
 * frame itself ensures the overlay never swallows clicks.
 */
function FolderFrameImpl({
  rect, depth, rdepth,
  label, labelX, labelY, clamped, labelHidden,
}: Props) {
  return (
    <>
      <div
        className={`folder-frame folder-frame--d${Math.min(rdepth, 3)}${clamped ? " folder-frame--clamped" : ""}`}
        data-depth={depth}
        data-rdepth={rdepth}
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
      {!labelHidden && (
        <div
          className={`folder-frame__label folder-frame__label--d${Math.min(rdepth, 3)}${clamped ? " folder-frame__label--clamped" : ""}`}
          style={{ left: labelX, top: labelY }}
        >
          {label}
        </div>
      )}
    </>
  );
}

export const FolderFrame = memo(FolderFrameImpl);
