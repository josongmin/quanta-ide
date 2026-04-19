import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  inlineEditorStore,
  useInlineEditorStore,
} from "../../store/inline-editor-store";
import { useSceneStore } from "../../store/scene-store";
import { useViewportStore } from "../../store/viewport-store";

// FloatingEditorToolbar
// -------------------------------------------------------------------
// Pinned, glass-style control strip that tracks the top-right corner of
// the currently-editing card. Positions in screen coords (portaled to
// body) so canvas pan/zoom moves it without CSS-transform blur — see
// AiEditPrompt for the same pattern.
//
// Actions surface the three operations users expect from any editor:
//   - AI edit (⌘K)  → opens the Cursor-style prompt for the current selection
//   - Save  (⌘⏎)    → `commitDraft` (keeps the buffer, clears dirty)
//   - Discard        → wipes the draft and exits edit mode
// The `onOpenAi` prop lets the parent share the InlineCodeEditor's own
// captureSelectionAndOpen callback so the popup anchors on the real caret.

interface Props {
  fileId: string;
  /** Fire the AI prompt. InlineCodeEditor provides the actual selection
   *  capture so the anchor matches the current caret position. */
  onOpenAi: () => void;
  /** Commit the draft + exit edit mode. */
  onCommit: () => void;
}

export function FloatingEditorToolbar({ fileId, onOpenAi, onCommit }: Props) {
  const rect = useSceneStore(s => s.layout?.fileRects.get(fileId) ?? null);
  const viewport = useViewportStore(s => s.viewport);
  const isDirty = useInlineEditorStore(s => !!s.dirtyByFileId[fileId]);

  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!rect) { setAnchor(null); return; }
    // World → screen: the canvas transform is `translate(x,y) scale(s)`.
    // The card's top-right corner in world coords is (rect.x + rect.w, rect.y).
    const sx = (rect.x + rect.w) * viewport.scale + viewport.x;
    const sy = rect.y * viewport.scale + viewport.y;
    // Clamp so the toolbar stays on-screen even when the card is
    // partially off-canvas.
    const TOOLBAR_W_EST = 220;
    const MARGIN = 8;
    const left = Math.max(MARGIN, Math.min(window.innerWidth - TOOLBAR_W_EST - MARGIN, sx - TOOLBAR_W_EST));
    const top = Math.max(MARGIN, sy - 40);
    setAnchor({ top, left });
  }, [rect, viewport.scale, viewport.x, viewport.y]);

  const handleDiscard = useCallback(() => {
    inlineEditorStore.discardDraft(fileId);
    inlineEditorStore.endEdit();
  }, [fileId]);

  // Keep the toolbar mounted only while the viewport keeps the card
  // broadly visible. Fully off-screen editing is rare (user zoomed away
  // mid-edit) — when it happens we hide the toolbar rather than paint it
  // at clamped edge positions that look detached from any card.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!rect) { setVisible(false); return; }
    const sx = rect.x * viewport.scale + viewport.x;
    const sy = rect.y * viewport.scale + viewport.y;
    const sw = rect.w * viewport.scale;
    const sh = rect.h * viewport.scale;
    const onScreen =
      sx + sw > 0 && sx < window.innerWidth &&
      sy + sh > 0 && sy < window.innerHeight;
    setVisible(onScreen);
  }, [rect, viewport.scale, viewport.x, viewport.y]);

  if (!anchor || !visible) return null;

  return createPortal(
    <div
      className="floating-editor-toolbar"
      style={{ top: anchor.top, left: anchor.left }}
      role="toolbar"
      aria-label="Inline editor actions"
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <button
        type="button"
        className="floating-editor-toolbar__btn floating-editor-toolbar__btn--ai"
        onClick={onOpenAi}
        title="AI edit (⌘K)"
        aria-label="AI edit selection"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8Z" />
        </svg>
        <span>AI</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="floating-editor-toolbar__sep" />

      <button
        type="button"
        className={`floating-editor-toolbar__btn floating-editor-toolbar__btn--primary${isDirty ? "" : " is-disabled"}`}
        onClick={onCommit}
        disabled={!isDirty}
        title={isDirty ? "Commit draft (⌘⏎)" : "No pending changes"}
        aria-label="Commit"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Save</span>
        <kbd>⌘⏎</kbd>
      </button>

      <button
        type="button"
        className="floating-editor-toolbar__btn floating-editor-toolbar__btn--danger"
        onClick={handleDiscard}
        title="Discard draft"
        aria-label="Discard draft"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        </svg>
      </button>
    </div>,
    document.body,
  );
}
