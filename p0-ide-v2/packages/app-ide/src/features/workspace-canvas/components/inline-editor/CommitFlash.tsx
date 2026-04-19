import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  inlineEditorStore,
  useInlineEditorStore,
} from "../../store/inline-editor-store";
import { useSceneStore } from "../../store/scene-store";
import { useViewportStore } from "../../store/viewport-store";

// CommitFlash
// -------------------------------------------------------------------
// Brief success overlay pinned over the just-committed card. Subscribes
// to `inlineEditorStore.lastCommit` — a transient signal set by
// `commitDraft` — projects the card's world rect to screen coords, and
// paints a green glow + checkmark badge for ~1100ms. Clears the store
// signal on unmount so a subsequent commit on the same card re-fires
// the animation instead of no-oping.
//
// Portaled to body for the same reasons as the other overlays (escapes
// canvas CSS transform, fixed screen size regardless of zoom).

const FLASH_DURATION_MS = 1100;

export function CommitFlash() {
  const commit = useInlineEditorStore(s => s.lastCommit);
  const rect = useSceneStore(s =>
    commit !== null ? (s.layout?.fileRects.get(commit.fileId) ?? null) : null,
  );
  const viewport = useViewportStore(s => s.viewport);

  useEffect(() => {
    if (commit === null) return;
    const t = window.setTimeout(() => inlineEditorStore.clearCommitSignal(), FLASH_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [commit]);

  if (commit === null || !rect) return null;

  const sx = rect.x * viewport.scale + viewport.x;
  const sy = rect.y * viewport.scale + viewport.y;
  const sw = rect.w * viewport.scale;
  const sh = rect.h * viewport.scale;

  return createPortal(
    <div
      className="commit-flash"
      style={{ top: sy, left: sx, width: sw, height: sh }}
      aria-hidden="true"
    >
      <div className="commit-flash__glow" />
      <div className="commit-flash__badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Saved</span>
      </div>
    </div>,
    document.body,
  );
}
