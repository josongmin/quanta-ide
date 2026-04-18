import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./floating-panel.css";

interface FloatingPanelProps {
  children: ReactNode;
  title?: string;
  onClose: () => void;
  defaultWidth?: number;
  defaultHeight?: number;
  /** Enable a collapse/expand toggle in the title bar. Collapsed panels show
   *  only the title bar and disable resize. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Minimum width/height overrides (defaults: 360×300). */
  minWidth?: number;
  minHeight?: number;
  /** Visual variant. "hud" forces a dark slate palette regardless of app
   *  theme — useful for debug/observability panels that overlay the canvas. */
  variant?: "default" | "hud";
}

const DEFAULT_MIN_W = 360;
const DEFAULT_MIN_H = 300;

export function FloatingPanel({
  children,
  title = "Agent",
  onClose,
  defaultWidth = 460,
  defaultHeight = 640,
  collapsible = false,
  defaultCollapsed = false,
  minWidth = DEFAULT_MIN_W,
  minHeight = DEFAULT_MIN_H,
  variant = "default",
}: FloatingPanelProps) {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - defaultWidth - 24,
    y: Math.max(48, (window.innerHeight - defaultHeight) / 2),
  }));
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight });
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);

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

    if (edge.includes("e")) nw = Math.max(minWidth, w + dx);
    if (edge.includes("w")) { nw = Math.max(minWidth, w - dx); nx = x + (w - nw); }
    if (edge.includes("s")) nh = Math.max(minHeight, h + dy);
    if (edge.includes("n")) { nh = Math.max(minHeight, h - dy); ny = y + (h - nh); }

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

  /* ── Stop canvas pan/zoom while interacting with the panel ──
   * The workspace canvas registers native (non-React) wheel/pointer handlers,
   * so React's synthetic stopPropagation isn't enough. We attach native
   * capture-phase listeners on the panel root and terminate the DOM walk
   * before canvas handlers see the event. */
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: Event) => { e.stopPropagation(); };
    el.addEventListener("wheel", stop, { passive: false, capture: true });
    el.addEventListener("pointerdown", stop, { capture: true });
    el.addEventListener("mousedown", stop, { capture: true });
    el.addEventListener("touchstart", stop, { capture: true, passive: false });
    return () => {
      el.removeEventListener("wheel", stop, { capture: true });
      el.removeEventListener("pointerdown", stop, { capture: true });
      el.removeEventListener("mousedown", stop, { capture: true });
      el.removeEventListener("touchstart", stop, { capture: true });
    };
  }, []);

  const widthStyle = size.w;
  const heightStyle = collapsed ? undefined : size.h;

  return createPortal(
    <div
      ref={panelRef}
      className={`float-panel${collapsed ? " is-collapsed" : ""}${variant === "hud" ? " float-panel--hud" : ""}`}
      style={{ left: pos.x, top: pos.y, width: widthStyle, height: heightStyle }}
    >
      {/* Title bar */}
      <div
        className="float-panel__titlebar"
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
      >
        <span className="float-panel__title">{title}</span>
        {collapsible && (
          <button
            type="button"
            className="float-panel__collapse"
            data-no-drag
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "펼치기" : "축소"}
            title={collapsed ? "펼치기" : "축소"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {collapsed
                ? <polyline points="6 9 12 15 18 9" />
                : <polyline points="6 15 12 9 18 15" />}
            </svg>
          </button>
        )}
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

      {/* Content — hidden while collapsed so the panel shrinks to the titlebar. */}
      {!collapsed && <div className="float-panel__body">{children}</div>}

      {/* Resize edges — disabled while collapsed; height is auto then. */}
      {!collapsed && (["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((edge) => (
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
