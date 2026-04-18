import { memo, useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { commentsStore, type CommentThread } from "../store/comments-store";
import { viewportStore } from "../store/viewport-store";

interface Props {
  thread: CommentThread;
  isOpen: boolean;
  scale: number;
}

interface DragRef {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function CommentPinInner({ thread, isOpen, scale }: Props) {
  const dragRef = useRef<DragRef | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    if (thread.locked) {
      // Locked pins still toggle the popover but cannot be dragged.
      e.stopPropagation();
      commentsStore.setOpen(isOpen ? null : thread.id);
      return;
    }
    dragRef.current = {
      id: thread.id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: thread.posX,
      startY: thread.posY,
      moved: false,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    e.stopPropagation();
  }, [thread.id, thread.posX, thread.posY, thread.locked, isOpen]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const dx = (e.clientX - drag.startClientX) / vp.scale;
      const dy = (e.clientY - drag.startClientY) / vp.scale;
      if (!drag.moved && Math.hypot(dx, dy) > 2 / vp.scale) drag.moved = true;
      if (drag.moved) {
        commentsStore.setPosition(drag.id, drag.startX + dx, drag.startY + dy);
      }
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const wasDrag = drag.moved;
      dragRef.current = null;
      if (!wasDrag) {
        commentsStore.setOpen(
          commentsStore.getState().openThreadId === drag.id ? null : drag.id,
        );
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const invScale = scale > 0 ? 1 / scale : 1;
  const className = [
    "ws-comment-pin",
    thread.resolved ? "ws-comment-pin--resolved" : "",
    thread.locked ? "ws-comment-pin--locked" : "",
    isOpen ? "ws-comment-pin--open" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      style={{
        left: thread.posX,
        top: thread.posY,
        "--pin-inv-scale": invScale.toFixed(4),
      } as React.CSSProperties}
      onPointerDown={onPointerDown}
      title={thread.locked ? "locked comment" : "open thread"}
      aria-label={`comment thread with ${thread.messages.length} message${thread.messages.length === 1 ? "" : "s"}`}
    >
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <path
          d="M3 4 Q3 2 5 2 L15 2 Q17 2 17 4 L17 12 Q17 14 15 14 L9 14 L5 17 L5 14 Q3 14 3 12 Z"
          fill="currentColor"
        />
      </svg>
      {thread.messages.length > 0 && (
        <span className="ws-comment-pin__count">{thread.messages.length}</span>
      )}
    </button>
  );
}

export const CommentPin = memo(CommentPinInner);
