import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

interface ResizeHandleProps {
  onResize: (dx: number) => void;
  ariaLabel: string;
}

export function ResizeHandle({ onResize, ariaLabel }: ResizeHandleProps) {
  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      let lastX = e.clientX;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        onResize(dx);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize],
  );

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={startDrag}
    />
  );
}
