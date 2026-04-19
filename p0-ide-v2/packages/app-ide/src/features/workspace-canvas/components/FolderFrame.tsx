import { memo, type CSSProperties } from "react";
import type { Rect } from "@quanta/canvas-engine";
import { useViewportStore } from "../store/viewport-store";

interface Props {
  /** Full folder path used as the display label. */
  path: string;
  /** Bounding rect (in canvas coordinates) enclosing every descendant. */
  rect: Rect;
  /** 0 = top-level package, 1 = second tier, etc. Drives label emphasis. */
  depth: number;
  /** 0 = innermost wrapper (nearest to leaves), higher = outer shell. */
  rdepth: number;
}

// Screen-space padding we insert between the viewport edge and the
// clamped label so the text doesn't sit flush against the window bezel.
const LABEL_VIEWPORT_PAD_PX = 8;
// Natural offsets from the folder frame's own top-left corner (world px).
// Mirror the CSS defaults so the label sits just above the top border.
const LABEL_NATURAL_X = 16;
const LABEL_NATURAL_Y = -14;

/**
 * Visual wrapper that draws a frame around files belonging to the same
 * ancestor folder. Nested folders stack — the outermost top-level package
 * wraps every descendant, down to the innermost leaf folder.
 *
 * Label shows only the segment for this folder (not the full path) so
 * stacked frames don't repeat their parents — the enclosing frames
 * already communicate the hierarchy visually.
 *
 * When the folder extends past the viewport's top or left edge, the label
 * is clamped to stay just inside the viewport — the user can still see
 * which folder they're inside even when its top-left corner is off-screen.
 *
 * Rendered *behind* GroundCards (see `.folder-frame` z-index), so the
 * cards remain fully interactive on top. `pointer-events: none` on the
 * frame itself ensures the overlay never swallows clicks.
 */
function FolderFrameImpl({ path, rect, depth, rdepth }: Props) {
  const viewport = useViewportStore(s => s.viewport);
  const name = path.split("/").pop() ?? path;

  // Viewport extents in world coordinates. The dom-layer applies
  // `translate(viewport.x, viewport.y) scale(viewport.scale)`, so inverse
  // transform gives the visible world rect.
  const scale = viewport.scale;
  const vLeft = -viewport.x / scale;
  const vTop = -viewport.y / scale;
  const vRight = (viewport.width - viewport.x) / scale;
  const vBottom = (viewport.height - viewport.y) / scale;

  // Clamp label origin into the viewport. The ideal position (natural
  // offsets) wins whenever the folder corner is already on-screen; only
  // when the frame pokes off the top/left do we push the label inward so
  // it rides the viewport edge instead of vanishing with the corner.
  const pad = LABEL_VIEWPORT_PAD_PX / scale;
  const minLocalX = vLeft + pad - rect.x;
  const minLocalY = vTop + pad - rect.y;
  // Never let the label slide past the folder's opposite edge — it must
  // visually belong to this frame, not the one beyond.
  const maxLocalX = Math.max(LABEL_NATURAL_X, rect.w - 24);
  const maxLocalY = Math.max(LABEL_NATURAL_Y, rect.h - 24);

  const localX = Math.min(maxLocalX, Math.max(LABEL_NATURAL_X, minLocalX));
  const localY = Math.min(maxLocalY, Math.max(LABEL_NATURAL_Y, minLocalY));

  // Skip the override entirely when clamping isn't needed — keeps the CSS
  // default (which anchors the label to the frame's own top-left corner)
  // in charge of styling details.
  const clamped = localX !== LABEL_NATURAL_X || localY !== LABEL_NATURAL_Y;
  const labelStyle: CSSProperties | undefined = clamped
    ? { left: localX, top: localY }
    : undefined;

  // Frame offscreen entirely — nothing to do. Cheap bail to avoid painting
  // folders the user can't see.
  const offscreen =
    rect.x + rect.w < vLeft ||
    rect.x > vRight ||
    rect.y + rect.h < vTop ||
    rect.y > vBottom;
  if (offscreen) return null;

  // Label world position — frame is at (rect.x, rect.y), label is at local
  // offset (localX, localY). We render the label as a *sibling* of the
  // frame (not its child) so it can escape the frame's negative-z
  // stacking context and paint above code cards.
  const labelWorldX = rect.x + localX;
  const labelWorldY = rect.y + localY;

  return (
    <>
      <div
        className={`folder-frame folder-frame--d${Math.min(rdepth, 3)}${clamped ? " folder-frame--clamped" : ""}`}
        data-depth={depth}
        data-rdepth={rdepth}
        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      />
      <div
        className={`folder-frame__label folder-frame__label--d${Math.min(rdepth, 3)}`}
        style={{ left: labelWorldX, top: labelWorldY }}
      >
        {name}
      </div>
    </>
  );
}

export const FolderFrame = memo(FolderFrameImpl);
