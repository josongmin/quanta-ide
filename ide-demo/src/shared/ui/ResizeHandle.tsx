import { useCallback, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

interface Props {
  side: "left" | "right";
  onResize: (delta: number) => void;
}

/**
 * Fitts's Law: actual hit target is 12px wide (invisible expansion)
 * Visual affordance: thin line + cursor change signals draggability
 * Feedback: blue accent on hover/active (Doherty: instant response)
 */
export function ResizeHandle({ side, onResize }: Props) {
  const dragging = useRef(false);
  const lastX = useRef(0);
  const [active, setActive] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    setActive(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onResize(side === "left" ? dx : -dx);
    };

    const onUp = () => {
      dragging.current = false;
      setActive(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [onResize, side]);

  return (
    <div
      onMouseDown={onMouseDown}
      className={cn(
        "w-[3px] cursor-col-resize shrink-0 relative z-10 transition-all duration-100",
        active ? "bg-risk-info/60" : "bg-transparent hover:bg-risk-info/20",
      )}
    >
      {/* Expanded hit area — Fitts's Law */}
      <div className="absolute inset-y-0 -left-[5px] -right-[5px]" />
      {/* Center dot indicator (visible on hover) */}
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 rounded-full transition-opacity",
        active ? "bg-risk-info opacity-80" : "bg-text-muted/20 opacity-0 group-hover:opacity-100",
      )} />
    </div>
  );
}
