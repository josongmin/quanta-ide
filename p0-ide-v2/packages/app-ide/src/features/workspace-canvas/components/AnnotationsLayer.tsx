import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  annotationsStore,
  useAnnotationsStore,
  getAnnotationAabb,
  type Annotation,
  type AnnotationAnchor,
  type ConnectorGeometry,
  type FrameGeometry,
  type PenGeometry,
  type ShapeGeometry,
  type TextGeometry,
} from "../store/annotations-store";
import { viewportStore } from "../store/viewport-store";
import { sceneStore } from "../store/scene-store";
import { stickiesStore } from "../store/stickies-store";
import { useFeature } from "../store/feature-flags-store";

// AnnotationsLayer
// ------------------------------------------------------------------
// A single world-transformed layer that renders every annotation kind
// plus the ephemeral "in-progress" gestures (active pen stroke, active
// shape rubber-band, active connector rubber-band, laser trail).
//
// Routing strategy: one top-level <svg> whose viewBox is the container
// in world coords (transform is applied via CSS on the wrapping div,
// mirroring how StickiesLayer composes with the pan/zoom transform).
// Each annotation picks its own SVG primitive by `kind`, and the layer
// folds pointer handling for the currently-active tool.

interface Props {
  transform: string;
  scale: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface PointerPathState {
  pointerId: number;
  points: Array<[number, number]>;
}

interface ShapeDraftState {
  pointerId: number;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

interface ConnectorDraftState {
  pointerId: number;
  fromAnchor: AnnotationAnchor;
  curX: number;
  curY: number;
}

interface FrameDraftState {
  pointerId: number;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

interface FrameDragState {
  pointerId: number;
  frameId: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  groupFiles: boolean;
}

interface LaserTrailPoint {
  x: number;
  y: number;
  t: number;
}

const LASER_WINDOW_MS = 800;

export function AnnotationsLayer({ transform, scale, containerRef }: Props) {
  const toolbarOn = useFeature("annotation.toolbar");
  // Subscribe to annotation state. Toolbar-off collapses the layer to null,
  // but we still honor per-tool feature flags at the interaction callsites.
  const annotations = useAnnotationsStore(s => s.annotations);
  const activeTool = useAnnotationsStore(s => s.activeTool);
  const penColor = useAnnotationsStore(s => s.penColor);
  const shapeColor = useAnnotationsStore(s => s.shapeColor);
  const shapeVariant = useAnnotationsStore(s => s.shapeVariant);
  const connectorColor = useAnnotationsStore(s => s.connectorColor);
  const editingId = useAnnotationsStore(s => s.editingId);

  const penEnabled = useFeature("annotation.pen");
  const textEnabled = useFeature("annotation.text");
  const shapeEnabled = useFeature("annotation.shape");
  const connectorEnabled = useFeature("annotation.connector");
  const laserEnabled = useFeature("annotation.laser");
  const frameEnabled = useFeature("annotation.frame");

  const layerRef = useRef<HTMLDivElement>(null);

  const [penDraft, setPenDraft] = useState<PointerPathState | null>(null);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [connectorDraft, setConnectorDraft] = useState<ConnectorDraftState | null>(null);
  const [frameDraft, setFrameDraft] = useState<FrameDraftState | null>(null);
  const frameDragRef = useRef<FrameDragState | null>(null);
  const [laserTrail, setLaserTrail] = useState<LaserTrailPoint[]>([]);

  // Apply world transform imperatively so pan/zoom frames don't
  // re-mount annotation subtrees (mirrors StickiesLayer's approach).
  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  // ── Helpers ──────────────────────────────────────────────────────
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const vp = viewportStore.getState().viewport;
    if (vp.scale <= 0) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - vp.x) / vp.scale,
      y: (clientY - rect.top - vp.y) / vp.scale,
    };
  }, [containerRef]);

  // Resolve a target anchor at world coords. We try file cards first
  // (via the scene's fileRects), then stickies, then fall back to
  // "free" with the raw coord. This lets connectors track dragged
  // cards by id (see `useResolvedAnchor` below).
  const resolveAnchor = useCallback((wx: number, wy: number): AnnotationAnchor => {
    const layout = sceneStore.getState().layout;
    if (layout) {
      for (const [id, r] of layout.fileRects) {
        if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) {
          return { kind: "file", id, x: r.x + r.w / 2, y: r.y + r.h / 2 };
        }
      }
    }
    const stickies = stickiesStore.getState().stickies;
    for (const s of stickies) {
      if (wx >= s.x && wx <= s.x + s.width && wy >= s.y && wy <= s.y + s.height) {
        return { kind: "sticky", id: s.id, x: s.x + s.width / 2, y: s.y + s.height / 2 };
      }
    }
    return { kind: "free", x: wx, y: wy };
  }, []);

  // ── Pointer-down on layer background ─────────────────────────────
  const onLayerPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!toolbarOn) return;
    // Ignore if the gesture started on an annotation interactive surface
    // (frame header, laser is cursor-only, etc.). We only intercept when
    // the user pressed on the layer's own SVG hit-area.
    const target = e.target as Element;
    if (target.closest("[data-annotation-interactive='true']")) return;
    if (e.button !== 0) return;
    const world = toWorld(e.clientX, e.clientY);

    if (activeTool === "pen" && penEnabled) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setPenDraft({ pointerId: e.pointerId, points: [[world.x, world.y]] });
      return;
    }
    if (activeTool === "text" && textEnabled) {
      e.preventDefault();
      e.stopPropagation();
      const geom: TextGeometry = {
        x: world.x,
        y: world.y,
        text: "",
        fontSize: 18,
        color: annotationsStore.getState().textColor,
      };
      const id = annotationsStore.add({ kind: "text", geometry: geom });
      annotationsStore.setEditingId(id);
      annotationsStore.setTool("none");
      return;
    }
    if (activeTool === "shape" && shapeEnabled) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setShapeDraft({
        pointerId: e.pointerId,
        startX: world.x,
        startY: world.y,
        curX: world.x,
        curY: world.y,
      });
      return;
    }
    if (activeTool === "connector" && connectorEnabled) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      const from = resolveAnchor(world.x, world.y);
      setConnectorDraft({
        pointerId: e.pointerId,
        fromAnchor: from,
        curX: world.x,
        curY: world.y,
      });
      return;
    }
    if (activeTool === "frame" && frameEnabled) {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setFrameDraft({
        pointerId: e.pointerId,
        startX: world.x,
        startY: world.y,
        curX: world.x,
        curY: world.y,
      });
      return;
    }
  }, [toolbarOn, activeTool, penEnabled, textEnabled, shapeEnabled, connectorEnabled, frameEnabled, toWorld, resolveAnchor]);

  // ── Window-level pointer move / up so drags survive brief exits ──
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY);
      if (penDraft && e.pointerId === penDraft.pointerId) {
        setPenDraft(d => (d ? { ...d, points: [...d.points, [world.x, world.y]] } : d));
      }
      if (shapeDraft && e.pointerId === shapeDraft.pointerId) {
        setShapeDraft(d => (d ? { ...d, curX: world.x, curY: world.y } : d));
      }
      if (connectorDraft && e.pointerId === connectorDraft.pointerId) {
        setConnectorDraft(d => (d ? { ...d, curX: world.x, curY: world.y } : d));
      }
      if (frameDraft && e.pointerId === frameDraft.pointerId) {
        setFrameDraft(d => (d ? { ...d, curX: world.x, curY: world.y } : d));
      }
      const drag = frameDragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        const dx = world.x - drag.lastX;
        const dy = world.y - drag.lastY;
        if (dx !== 0 || dy !== 0) {
          const ann = annotationsStore
            .getState()
            .annotations.find(a => a.id === drag.frameId);
          if (ann && ann.kind === "frame") {
            const frameAabb = getAnnotationAabb(ann);
            annotationsStore.translate(drag.frameId, dx, dy);
            if (drag.groupFiles && frameAabb) {
              annotationsStore.translateWithin(frameAabb, dx, dy, drag.frameId);
            }
            drag.lastX = world.x;
            drag.lastY = world.y;
          }
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (penDraft && e.pointerId === penDraft.pointerId) {
        const pts = penDraft.points;
        if (pts.length >= 2) {
          const geom: PenGeometry = {
            points: pts,
            color: annotationsStore.getState().penColor,
            strokeWidth: 3,
          };
          annotationsStore.add({ kind: "pen", geometry: geom });
        }
        setPenDraft(null);
      }
      if (shapeDraft && e.pointerId === shapeDraft.pointerId) {
        const x = Math.min(shapeDraft.startX, shapeDraft.curX);
        const y = Math.min(shapeDraft.startY, shapeDraft.curY);
        const w = Math.abs(shapeDraft.curX - shapeDraft.startX);
        const h = Math.abs(shapeDraft.curY - shapeDraft.startY);
        if (w > 4 && h > 4) {
          const s = annotationsStore.getState();
          const geom: ShapeGeometry = {
            x,
            y,
            w,
            h,
            shape: s.shapeVariant,
            color: s.shapeColor,
            strokeWidth: 2,
          };
          annotationsStore.add({ kind: "shape", geometry: geom });
        }
        setShapeDraft(null);
      }
      if (connectorDraft && e.pointerId === connectorDraft.pointerId) {
        const world = toWorld(e.clientX, e.clientY);
        const toAnchor = resolveAnchor(world.x, world.y);
        // Avoid self-loops when source === target.
        const same =
          connectorDraft.fromAnchor.kind === toAnchor.kind &&
          connectorDraft.fromAnchor.id === toAnchor.id &&
          connectorDraft.fromAnchor.kind !== "free";
        if (!same) {
          const geom: ConnectorGeometry = {
            fromAnchor: connectorDraft.fromAnchor,
            toAnchor,
            color: annotationsStore.getState().connectorColor,
            strokeWidth: 2,
          };
          annotationsStore.add({ kind: "connector", geometry: geom });
        }
        setConnectorDraft(null);
      }
      if (frameDraft && e.pointerId === frameDraft.pointerId) {
        const x = Math.min(frameDraft.startX, frameDraft.curX);
        const y = Math.min(frameDraft.startY, frameDraft.curY);
        const w = Math.abs(frameDraft.curX - frameDraft.startX);
        const h = Math.abs(frameDraft.curY - frameDraft.startY);
        if (w > 10 && h > 10) {
          const geom: FrameGeometry = {
            x,
            y,
            w,
            h,
            label: "Frame",
            color: "#64748b",
          };
          const id = annotationsStore.add({ kind: "frame", geometry: geom });
          annotationsStore.setEditingId(id);
        }
        setFrameDraft(null);
      }
      if (frameDragRef.current && e.pointerId === frameDragRef.current.pointerId) {
        frameDragRef.current = null;
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
  }, [penDraft, shapeDraft, connectorDraft, frameDraft, toWorld, resolveAnchor]);

  // ── ESC resets the active tool ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (annotationsStore.getState().editingId) {
          annotationsStore.setEditingId(null);
          return;
        }
        if (annotationsStore.getState().activeTool !== "none") {
          annotationsStore.setTool("none");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Laser trail ─────────────────────────────────────────────────
  useEffect(() => {
    if (!laserEnabled || activeTool !== "laser") {
      if (laserTrail.length > 0) setLaserTrail([]);
      return;
    }
    const onMove = (e: PointerEvent) => {
      const world = toWorld(e.clientX, e.clientY);
      const now = performance.now();
      setLaserTrail(prev => {
        const filtered = prev.filter(p => now - p.t < LASER_WINDOW_MS);
        filtered.push({ x: world.x, y: world.y, t: now });
        return filtered;
      });
    };
    window.addEventListener("pointermove", onMove);
    // Drive the fade with rAF so points decay even when the mouse is still.
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      setLaserTrail(prev => {
        if (prev.length === 0) {
          raf = requestAnimationFrame(tick);
          return prev;
        }
        const filtered = prev.filter(p => now - p.t < LASER_WINDOW_MS);
        if (filtered.length === prev.length) {
          raf = requestAnimationFrame(tick);
          return prev;
        }
        raf = requestAnimationFrame(tick);
        return filtered;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
    // Deliberate: don't re-bind when laserTrail changes; inner closure uses setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laserEnabled, activeTool, toWorld]);

  // ── Frame header drag ─────────────────────────────────────────────
  const onFrameHeaderPointerDown = useCallback((id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,[contenteditable='true']")) return;
    const world = toWorld(e.clientX, e.clientY);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    frameDragRef.current = {
      pointerId: e.pointerId,
      frameId: id,
      startX: world.x,
      startY: world.y,
      lastX: world.x,
      lastY: world.y,
      // Shift-drag suppresses the group mode so power users can reposition
      // the frame alone without nudging every child.
      groupFiles: !e.shiftKey,
    };
    e.preventDefault();
    e.stopPropagation();
  }, [toWorld]);

  if (!toolbarOn) return null;

  const laserPath =
    laserTrail.length >= 2 ? laserTrail.map(p => `${p.x},${p.y}`).join(" ") : "";

  return (
    <div
      ref={layerRef}
      className="workspace-canvas__annotations-layer"
      style={{ transformOrigin: "0 0", pointerEvents: activeTool === "none" ? "none" : "auto" }}
      onPointerDown={onLayerPointerDown}
    >
      <svg
        className="workspace-canvas__annotations-svg"
        // Render in world coords with a huge viewBox; clipping handled by
        // the container's overflow:hidden. `style.overflow="visible"` so
        // strokes outside the default viewport still paint.
        style={{ overflow: "visible" }}
      >
        <defs>
          <marker
            id="annotation-arrowhead"
            viewBox="0 -5 10 10"
            refX="9"
            refY="0"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,-5L10,0L0,5" fill="currentColor" />
          </marker>
        </defs>

        {/* Frame backgrounds first so they sit below everything else */}
        {annotations.filter(a => a.kind === "frame").map(a => (
          <FrameBackground key={a.id} annotation={a} />
        ))}

        {annotations.map(a => {
          switch (a.kind) {
            case "pen":
              return <PenAnnotation key={a.id} annotation={a} />;
            case "shape":
              return <ShapeAnnotation key={a.id} annotation={a} />;
            case "connector":
              return <ConnectorAnnotation key={a.id} annotation={a} />;
            default:
              return null;
          }
        })}

        {/* Active-gesture rubber bands */}
        {penDraft && penDraft.points.length >= 2 && (
          <polyline
            points={penDraft.points.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke={penColor}
            strokeWidth={3 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}
        {shapeDraft && (
          <ShapeDraftOverlay draft={shapeDraft} variant={shapeVariant} color={shapeColor} invScale={1 / scale} />
        )}
        {connectorDraft && (
          <ConnectorDraftOverlay
            fromX={connectorDraft.fromAnchor.x}
            fromY={connectorDraft.fromAnchor.y}
            toX={connectorDraft.curX}
            toY={connectorDraft.curY}
            color={connectorColor}
            invScale={1 / scale}
          />
        )}
        {frameDraft && (
          <rect
            x={Math.min(frameDraft.startX, frameDraft.curX)}
            y={Math.min(frameDraft.startY, frameDraft.curY)}
            width={Math.abs(frameDraft.curX - frameDraft.startX)}
            height={Math.abs(frameDraft.curY - frameDraft.startY)}
            fill="rgba(100,116,139,0.08)"
            stroke="#64748b"
            strokeDasharray={`${6 / scale} ${4 / scale}`}
            strokeWidth={1 / scale}
          />
        )}
        {laserEnabled && activeTool === "laser" && laserPath && (
          <polyline
            points={laserPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth={4 / scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
        )}
      </svg>

      {/* Text annotations live as HTML so they are contenteditable. */}
      {annotations
        .filter(a => a.kind === "text")
        .map(a => (
          <TextAnnotationView
            key={a.id}
            annotation={a}
            isEditing={editingId === a.id}
            invScale={1 / Math.max(0.0001, scale)}
          />
        ))}

      {/* Frame headers (draggable, contenteditable label) */}
      {annotations
        .filter(a => a.kind === "frame")
        .map(a => (
          <FrameHeader
            key={a.id}
            annotation={a}
            isEditing={editingId === a.id}
            invScale={1 / Math.max(0.0001, scale)}
            onHeaderPointerDown={onFrameHeaderPointerDown}
          />
        ))}
    </div>
  );
}

// ── Primitive renderers ──────────────────────────────────────────────

const PenAnnotation = memo(({ annotation }: { annotation: Annotation }) => {
  const g = annotation.geometry as PenGeometry;
  if (g.points.length < 2) return null;
  const d = g.points.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <polyline
      points={d}
      fill="none"
      stroke={g.color}
      strokeWidth={g.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-annotation-id={annotation.id}
    />
  );
});
PenAnnotation.displayName = "PenAnnotation";

const ShapeAnnotation = memo(({ annotation }: { annotation: Annotation }) => {
  const g = annotation.geometry as ShapeGeometry;
  if (g.shape === "rect") {
    return (
      <rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        fill="none"
        stroke={g.color}
        strokeWidth={g.strokeWidth}
        data-annotation-id={annotation.id}
      />
    );
  }
  if (g.shape === "ellipse") {
    return (
      <ellipse
        cx={g.x + g.w / 2}
        cy={g.y + g.h / 2}
        rx={Math.max(1, g.w / 2)}
        ry={Math.max(1, g.h / 2)}
        fill="none"
        stroke={g.color}
        strokeWidth={g.strokeWidth}
        data-annotation-id={annotation.id}
      />
    );
  }
  // Arrow
  const x2 = g.x + g.w;
  const y2 = g.y + g.h;
  return (
    <line
      x1={g.x}
      y1={g.y}
      x2={x2}
      y2={y2}
      stroke={g.color}
      strokeWidth={g.strokeWidth}
      markerEnd="url(#annotation-arrowhead)"
      style={{ color: g.color }}
      data-annotation-id={annotation.id}
    />
  );
});
ShapeAnnotation.displayName = "ShapeAnnotation";

/**
 * Resolve anchor position live: if the anchor references a file that has a
 * current layout rect, use that rect's center; if it references a sticky,
 * use that sticky's current position. This is how connectors "follow" a
 * dragged card without mutating the connector geometry itself.
 */
function useResolvedAnchor(a: AnnotationAnchor): { x: number; y: number } {
  // Re-read on every sticky / scene tick — these are the only stores
  // whose changes affect the resolved position.
  const stickies = stickiesStore.getState().stickies;
  useAnnotationsStore(() => 0); // subscribe to annotation mutations too
  // Note: we intentionally don't subscribe to viewport; position is world-coord.
  const layout = sceneStore.getState().layout;
  if (a.kind === "file" && a.id && layout) {
    const r = layout.fileRects.get(a.id);
    if (r) return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }
  if (a.kind === "sticky" && a.id) {
    const s = stickies.find(x => x.id === a.id);
    if (s) return { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  }
  return { x: a.x, y: a.y };
}

const ConnectorAnnotation = memo(({ annotation }: { annotation: Annotation }) => {
  const g = annotation.geometry as ConnectorGeometry;
  const from = useResolvedAnchor(g.fromAnchor);
  const to = useResolvedAnchor(g.toAnchor);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Subtle curve — midpoint offset perpendicular to the segment, capped.
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bulge = Math.min(60, len * 0.15);
  const cx = from.x + dx / 2 + nx * bulge;
  const cy = from.y + dy / 2 + ny * bulge;
  const path = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={g.color}
      strokeWidth={g.strokeWidth}
      markerEnd="url(#annotation-arrowhead)"
      style={{ color: g.color }}
      data-annotation-id={annotation.id}
    />
  );
});
ConnectorAnnotation.displayName = "ConnectorAnnotation";

const FrameBackground = memo(({ annotation }: { annotation: Annotation }) => {
  const g = annotation.geometry as FrameGeometry;
  return (
    <rect
      x={g.x}
      y={g.y}
      width={g.w}
      height={g.h}
      fill="rgba(100, 116, 139, 0.06)"
      stroke={g.color}
      strokeWidth={1}
      rx={4}
      ry={4}
      data-annotation-id={annotation.id}
    />
  );
});
FrameBackground.displayName = "FrameBackground";

function ShapeDraftOverlay({
  draft,
  variant,
  color,
  invScale,
}: {
  draft: ShapeDraftState;
  variant: "rect" | "ellipse" | "arrow";
  color: string;
  invScale: number;
}) {
  const x = Math.min(draft.startX, draft.curX);
  const y = Math.min(draft.startY, draft.curY);
  const w = Math.abs(draft.curX - draft.startX);
  const h = Math.abs(draft.curY - draft.startY);
  const stroke = 2 * invScale;
  if (variant === "rect") {
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${6 * invScale} ${4 * invScale}`}
      />
    );
  }
  if (variant === "ellipse") {
    return (
      <ellipse
        cx={x + w / 2}
        cy={y + h / 2}
        rx={Math.max(0.5, w / 2)}
        ry={Math.max(0.5, h / 2)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${6 * invScale} ${4 * invScale}`}
      />
    );
  }
  return (
    <line
      x1={draft.startX}
      y1={draft.startY}
      x2={draft.curX}
      y2={draft.curY}
      stroke={color}
      strokeWidth={stroke}
      strokeDasharray={`${6 * invScale} ${4 * invScale}`}
    />
  );
}

function ConnectorDraftOverlay({
  fromX,
  fromY,
  toX,
  toY,
  color,
  invScale,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  invScale: number;
}) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bulge = Math.min(60, len * 0.15);
  const cx = fromX + dx / 2 + nx * bulge;
  const cy = fromY + dy / 2 + ny * bulge;
  const path = `M ${fromX} ${fromY} Q ${cx} ${cy} ${toX} ${toY}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={2 * invScale}
      strokeDasharray={`${6 * invScale} ${4 * invScale}`}
      opacity={0.85}
    />
  );
}

// ── Text annotations (HTML because contenteditable) ──────────────────

function TextAnnotationView({
  annotation,
  isEditing,
  invScale,
}: {
  annotation: Annotation;
  isEditing: boolean;
  invScale: number;
}) {
  const g = annotation.geometry as TextGeometry;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.addRange(r);
    }
  }, [isEditing]);

  const onBlur = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText.trim();
    if (text.length === 0) {
      annotationsStore.remove(annotation.id);
    } else {
      annotationsStore.update(annotation.id, { geometry: { ...g, text } });
    }
    annotationsStore.setEditingId(null);
  }, [annotation.id, g]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  const onDoubleClick = useCallback(() => {
    annotationsStore.setEditingId(annotation.id);
  }, [annotation.id]);

  return (
    <div
      ref={ref}
      className="workspace-canvas__annotation-text"
      contentEditable={isEditing}
      suppressContentEditableWarning
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      data-annotation-id={annotation.id}
      data-annotation-interactive="true"
      style={{
        left: g.x,
        top: g.y,
        color: g.color,
        fontSize: g.fontSize,
        // Counter-scale so hit-target feels reasonable but stays world-anchored.
        minWidth: 30 * invScale,
        padding: `${2 * invScale}px ${4 * invScale}px`,
        outline: isEditing ? "1px dashed #6366f1" : "none",
      }}
    >
      {g.text || (isEditing ? "" : "text")}
    </div>
  );
}

// ── Frame header (HTML for drag + label editing) ────────────────────

function FrameHeader({
  annotation,
  isEditing,
  invScale,
  onHeaderPointerDown,
}: {
  annotation: Annotation;
  isEditing: boolean;
  invScale: number;
  onHeaderPointerDown: (id: string, e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const g = annotation.geometry as FrameGeometry;
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.addRange(r);
    }
  }, [isEditing]);

  const onLabelBlur = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const label = el.innerText.trim() || "Frame";
    annotationsStore.update(annotation.id, { geometry: { ...g, label } });
    annotationsStore.setEditingId(null);
  }, [annotation.id, g]);

  const onLabelKeyDown = useCallback((e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      ref.current?.blur();
    }
  }, []);

  const onDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    onHeaderPointerDown(annotation.id, e);
  }, [annotation.id, onHeaderPointerDown]);

  const onLabelDblClick = useCallback(() => {
    annotationsStore.setEditingId(annotation.id);
  }, [annotation.id]);

  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    annotationsStore.remove(annotation.id);
  }, [annotation.id]);

  return (
    <div
      className="workspace-canvas__annotation-frame-header"
      data-annotation-interactive="true"
      onPointerDown={onDown}
      style={{
        left: g.x,
        top: g.y - 22 * invScale,
        padding: `${2 * invScale}px ${6 * invScale}px`,
        fontSize: 11 * invScale,
        borderRadius: 3 * invScale,
      }}
    >
      <span
        ref={ref}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={onLabelBlur}
        onKeyDown={onLabelKeyDown}
        onDoubleClick={onLabelDblClick}
        className="workspace-canvas__annotation-frame-label"
      >
        {g.label}
      </span>
      <button
        type="button"
        className="workspace-canvas__annotation-frame-delete"
        onClick={onDelete}
        title="remove frame"
        style={{ fontSize: 10 * invScale, marginLeft: 6 * invScale }}
      >
        ×
      </button>
    </div>
  );
}

// Unused re-exports (keep ChangeEvent type-imported for downstream tools).
export type { ChangeEvent };
