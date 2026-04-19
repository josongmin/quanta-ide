import { useCallback, type PointerEvent as ReactPointerEvent } from "react";

type Orientation = "vertical" | "horizontal";

interface ResizeHandleProps {
  onResize: (d: number) => void;
  ariaLabel: string;
  orientation?: Orientation;
}

export function ResizeHandle({ onResize, ariaLabel, orientation = "vertical" }: ResizeHandleProps) {
  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const isH = orientation === "horizontal";
      let last = isH ? e.clientY : e.clientX;
      const onMove = (ev: PointerEvent) => {
        const cur = isH ? ev.clientY : ev.clientX;
        const d = cur - last;
        last = cur;
        onResize(d);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = isH ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [onResize, orientation],
  );

  return (
    <div
      className={`resize-handle resize-handle--${orientation}`}
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      onPointerDown={startDrag}
    />
  );
}
