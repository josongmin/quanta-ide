import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { stickiesStore, useStickiesStore } from "../store/stickies-store";
import { viewportStore } from "../store/viewport-store";
import { useUxSettings } from "../store/ux-settings-store";
import { StickyNote, useDeactivateOnOutsideClick } from "./StickyNote";

interface Props {
  transform: string;
  scale: number;
}

interface DragRef {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

export function StickiesLayer({ transform, scale }: Props) {
  const stickies = useStickiesStore(s => s.stickies);
  const activeId = useStickiesStore(s => s.activeId);
  const showStickies = useUxSettings(s => s.showStickies);

  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragRef | null>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  useDeactivateOnOutsideClick(layerRef.current);

  const onDragStart = useCallback(
    (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
      const sticky = stickiesStore.getState().stickies.find(s => s.id === id);
      if (!sticky) return;
      dragRef.current = {
        id,
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: sticky.x,
        startY: sticky.y,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const dxScreen = e.clientX - drag.startClientX;
      const dyScreen = e.clientY - drag.startClientY;
      // convert screen-delta to world-delta
      const nx = drag.startX + dxScreen / vp.scale;
      const ny = drag.startY + dyScreen / vp.scale;
      stickiesStore.setPosition(drag.id, nx, ny);
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
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

  if (!showStickies) return null;

  return (
    <div
      ref={layerRef}
      className="workspace-canvas__stickies-layer"
      style={{ transformOrigin: "0 0" }}
    >
      {stickies.map(s => (
        <StickyNote
          key={s.id}
          sticky={s}
          isActive={activeId === s.id}
          scale={scale}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}
