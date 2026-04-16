import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./floating-panel.css";

interface FloatingPanelProps {
  children: ReactNode;
  title?: string;
  onClose: () => void;
  defaultWidth?: number;
  defaultHeight?: number;
}

const MIN_W = 360;
const MIN_H = 300;

export function FloatingPanel({
  children,
  title = "Agent",
  onClose,
  defaultWidth = 460,
  defaultHeight = 640,
}: FloatingPanelProps) {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - defaultWidth - 24,
    y: Math.max(48, (window.innerHeight - defaultHeight) / 2),
  }));
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });

  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const resizing = useRef<string | false>(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0, x: 0, y: 0 });

  /* ── Drag ── */
  const onDragDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
      dragging.current = true;
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const { mx, my, ox, oy } = dragStart.current;
    const nx = ox + (e.clientX - mx);
    const ny = oy + (e.clientY - my);
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 100, nx)),
      y: Math.max(0, Math.min(window.innerHeight - 40, ny)),
    });
  }, []);

  const onDragUp = useCallback(() => {
    dragging.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  /* ── Resize ── */
  const onResizeDown = useCallback(
    (edge: string) => (e: React.PointerEvent) => {
      e.stopPropagation();
      resizing.current = edge;
      resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h, x: pos.x, y: pos.y };
      document.body.style.userSelect = "none";
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [size, pos],
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const { mx, my, w, h, x, y } = resizeStart.current;
    const dx = e.clientX - mx;
    const dy = e.clientY - my;
    const edge = resizing.current;

    let nw = w;
    let nh = h;
    let nx = x;
    let ny = y;

    if (edge.includes("e")) nw = Math.max(MIN_W, w + dx);
    if (edge.includes("w")) { nw = Math.max(MIN_W, w - dx); nx = x + (w - nw); }
    if (edge.includes("s")) nh = Math.max(MIN_H, h + dy);
    if (edge.includes("n")) { nh = Math.max(MIN_H, h - dy); ny = y + (h - nh); }

    setSize({ w: nw, h: nh });
    setPos({ x: nx, y: ny });
  }, []);

  const onResizeUp = useCallback(() => {
    resizing.current = false;
    document.body.style.userSelect = "";
  }, []);

  /* ── Esc to close ── */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className="float-panel"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Title bar */}
      <div
        className="float-panel__titlebar"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
      >
        <span className="float-panel__title">{title}</span>
        <button
          type="button"
          className="float-panel__close"
          data-no-drag
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="float-panel__body">{children}</div>

      {/* Resize edges */}
      {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((edge) => (
        <div
          key={edge}
          className={`float-panel__edge float-panel__edge--${edge}`}
          onPointerDown={onResizeDown(edge)}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      ))}
    </div>,
    document.body,
  );
}
