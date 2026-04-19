import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type { Entity, EntityTree, HierarchicalLayout, Rect, WorkspaceGraph } from "@quanta/canvas-engine";
import {
  DEFAULT_TIER_LADDER,
  rollupEdges,
  tierStore,
  type TierEdge,
  type TierSpec,
} from "../../../entities/tier";
import { ENTITY_DEPTH } from "../../../entities/entity";
import { entityStore, useEntityState } from "../../../entities/entity";
import { startCameraTween, type CameraState } from "../../../shared/lib/camera-animation";

// CanvasViewport
// --------------------------------------------------------------------
// SVG viewport with drag-to-pan + arrow-key pan + click-to-drill +
// Esc-to-zoom-out + animated camera transitions.
//
// Interaction model:
//   - Click on a non-leaf entity → drill IN (camera animates to the
//     entity's rect, tier switches to the next inner kind).
//   - Esc → drill OUT (tier switches to the next outer kind, camera
//     fits all entities at that tier).
//   - Arrow keys → pan in camera space.
//   - Ctrl/Cmd + wheel → zoom (handled by CanvasShell, drives the
//     tierStore; this viewport reacts to tier changes).
//
// Camera transitions animate via a single RAF tween (see
// `shared/lib/camera-animation`). Prior tween cancels on supersede —
// rapid clicks never chain animations.

const KEY_PAN_PX = 40;
const DRILL_FIT_PAD = 72;

interface Props {
  tree: EntityTree;
  layout: HierarchicalLayout;
  tier: TierSpec;
  graph: WorkspaceGraph;
  width: number;
  height: number;
}

const SVG_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  background:
    "radial-gradient(circle at 20% 10%, rgba(99,102,241,0.05), transparent 60%), #f8fafc",
  cursor: "grab",
  outline: "none",
};

export function CanvasViewport({ tree, layout, tier, graph, width, height }: Props): ReactElement {
  const [camera, setCameraState] = useState<CameraState>({ tx: 0, ty: 0, scale: 1 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const tweenRef = useRef<{ cancel(): void } | null>(null);

  const visibleEntities = useMemo<readonly Entity[]>(
    () => tree.byKind(tier.visibleKind),
    [tree, tier.visibleKind],
  );
  const tierEdges = useMemo<readonly TierEdge[]>(
    () => rollupEdges(tree, graph.fileEdges, tier.visibleKind),
    [tree, graph.fileEdges, tier.visibleKind],
  );

  // Fit utility — computes the camera that frames a given world rect
  // inside the current viewport with `pad` screen-px margin.
  const cameraForRect = useCallback(
    (bounds: Rect | null, pad = DRILL_FIT_PAD): CameraState => {
      if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
        return { tx: 0, ty: 0, scale: 1 };
      }
      const avail = { w: Math.max(1, width - pad * 2), h: Math.max(1, height - pad * 2) };
      const scale = Math.min(avail.w / bounds.w, avail.h / bounds.h);
      const tx = -bounds.x * scale + (width - bounds.w * scale) / 2;
      const ty = -bounds.y * scale + (height - bounds.h * scale) / 2;
      return { tx, ty, scale };
    },
    [width, height],
  );

  // Cancel any in-flight tween. Safe to call repeatedly.
  const cancelTween = useCallback(() => {
    tweenRef.current?.cancel();
    tweenRef.current = null;
  }, []);
  const tweenTo = useCallback(
    (target: CameraState, durationMs?: number) => {
      cancelTween();
      tweenRef.current = startCameraTween(cameraRef.current, target, setCameraState, durationMs);
    },
    [cancelTween],
  );

  // ── Fit on tier change ──────────────────────────────────────────
  // Use layoutEffect so the fit happens in the same frame the tier
  // flips — users see a direct transition, not a one-frame flash of
  // stale camera pose.
  useLayoutEffect(() => {
    if (visibleEntities.length === 0) {
      setCameraState({ tx: 0, ty: 0, scale: 1 });
      return;
    }
    const bounds = unionRects(visibleEntities, layout);
    const target = cameraForRect(bounds);
    tweenTo(target);
  }, [visibleEntities, layout, cameraForRect, tweenTo]);

  useEffect(() => () => cancelTween(), [cancelTween]);

  // ── Drag to pan ─────────────────────────────────────────────────
  const dragRef = useRef<{ id: number; x: number; y: number; tx: number; ty: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    // Pan only on background hit; entity rects get pointer events
    // and want to stay clickable.
    const tag = (e.target as SVGElement).tagName;
    if (tag !== "svg" && tag !== "g") return;
    cancelTween();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      tx: cameraRef.current.tx,
      ty: cameraRef.current.ty,
    };
  }, [cancelTween]);
  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    setCameraState(c => ({ ...c, tx: d.tx + dx, ty: d.ty + dy }));
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
  }, []);

  // ── Keyboard: arrow-pan + Esc drill-out ─────────────────────────
  const drillOut = useCallback(() => {
    const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
    if (idx <= 0) return;
    const outer = DEFAULT_TIER_LADDER[idx - 1];
    if (!outer) return;
    entityStore.selectEntity(null);
    tierStore.jumpToTier(outer.name);
  }, [tier.name]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Hierarchical Esc: selection first, then drill-out.
        // Matches macOS/Figma conventions (Esc = "undo one step").
        const { selectedId } = entityStore.getState().interaction;
        if (selectedId) {
          entityStore.selectEntity(null);
        } else {
          drillOut();
        }
        return;
      }
      // Cmd/Ctrl + 0 → fit all visible entities at the current tier.
      if ((e.metaKey || e.ctrlKey) && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault();
        const bounds = unionRects(visibleEntities, layout);
        tweenTo(cameraForRect(bounds));
        return;
      }
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = KEY_PAN_PX;
      else if (e.key === "ArrowRight") dx = -KEY_PAN_PX;
      else if (e.key === "ArrowUp") dy = KEY_PAN_PX;
      else if (e.key === "ArrowDown") dy = -KEY_PAN_PX;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      cancelTween();
      setCameraState(c => ({ ...c, tx: c.tx + dx, ty: c.ty + dy }));
    },
    [drillOut, cancelTween, cameraForRect, tweenTo, visibleEntities, layout],
  );

  // ── Rect interactions: drill-in on click ────────────────────────
  const { hoveredId, selectedId } = useEntityState(s => s.interaction);

  const drillInto = useCallback(
    (entity: Entity) => {
      const rect = layout.rects.get(entity.id);
      if (!rect) return;
      // Animate to the entity's rect BEFORE flipping the tier — the
      // tier change triggers its own fit-to-content on the new tier,
      // but this in-flight tween gives the user an immediate visual
      // response so the flip doesn't feel teleport-y.
      tweenTo(cameraForRect(rect, 24), 240);

      // Flip tier to the next inner kind IF this entity has children
      // at that inner kind. Leaves (building/floor/room depending on
      // data depth) just stay selected without drilling.
      const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
      const innerSpec = DEFAULT_TIER_LADDER[idx + 1];
      if (
        innerSpec &&
        entity.childIds.length > 0 &&
        ENTITY_DEPTH[entity.kind] < ENTITY_DEPTH[innerSpec.visibleKind]
      ) {
        // Defer by one microtask so the tween state settles before
        // the tier-change effect kicks off its own fit.
        queueMicrotask(() => tierStore.jumpToTier(innerSpec.name));
      }
    },
    [tier.name, layout, cameraForRect, tweenTo],
  );

  const onRectClick = useCallback(
    (entity: Entity) => {
      entityStore.selectEntity(entity.id);
      drillInto(entity);
    },
    [drillInto],
  );
  const onRectEnter = useCallback((id: string) => {
    entityStore.hoverEntity(id);
  }, []);
  const onRectLeave = useCallback(() => {
    entityStore.hoverEntity(null);
  }, []);

  // Clear hover when tier changes — the prior hover target may no
  // longer be visible.
  useEffect(() => {
    entityStore.hoverEntity(null);
  }, [tier.visibleKind]);

  const transform = `translate(${camera.tx} ${camera.ty}) scale(${camera.scale})`;

  return (
    <svg
      style={SVG_STYLE}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <g transform={transform}>
        {tierEdges.map(edge => {
          const from = layout.rects.get(edge.fromId);
          const to = layout.rects.get(edge.toId);
          if (!from || !to) return null;
          const x1 = from.x + from.w / 2;
          const y1 = from.y + from.h / 2;
          const x2 = to.x + to.w / 2;
          const y2 = to.y + to.h / 2;
          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#818cf8"
              strokeOpacity={Math.min(0.65, 0.25 + edge.count * 0.1)}
              strokeWidth={Math.max(1, Math.log1p(edge.weight)) / camera.scale}
              strokeLinecap="round"
            />
          );
        })}

        {visibleEntities.map(entity => {
          const rect = layout.rects.get(entity.id);
          if (!rect) return null;
          return (
            <EntityRect
              key={entity.id}
              entity={entity}
              rect={rect}
              scale={camera.scale}
              isSelected={entity.id === selectedId}
              isHovered={entity.id === hoveredId}
              onClick={onRectClick}
              onEnter={onRectEnter}
              onLeave={onRectLeave}
            />
          );
        })}
      </g>
    </svg>
  );
}

function EntityRect({
  entity,
  rect,
  scale,
  isSelected,
  isHovered,
  onClick,
  onEnter,
  onLeave,
}: {
  entity: Entity;
  rect: Rect;
  scale: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (e: Entity) => void;
  onEnter: (id: string) => void;
  onLeave: () => void;
}): ReactElement {
  const palette = paletteFor(entity);
  const stroke = isSelected ? "#4f46e5" : isHovered ? "#6366f1" : palette.stroke;
  const fill = isSelected ? palette.fillSelected : palette.fill;
  const strokeWidth = (isSelected ? 2.5 : isHovered ? 2 : 1.5) / scale;
  const labelSize = Math.max(10 / scale, 7);
  const labelVisible = rect.w * scale > 60 && rect.h * scale > 22;

  return (
    <g
      onClick={e => {
        e.stopPropagation();
        onClick(entity);
      }}
      onPointerEnter={() => onEnter(entity.id)}
      onPointerLeave={onLeave}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        rx={Math.min(8, rect.w * 0.02)}
        ry={Math.min(8, rect.h * 0.02)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {labelVisible && (
        <text
          x={rect.x + 10}
          y={rect.y + labelSize + 6}
          fontSize={labelSize}
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
          fill={palette.label}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {entity.name}
        </text>
      )}
    </g>
  );
}

function paletteFor(entity: Entity): {
  fill: string;
  fillSelected: string;
  stroke: string;
  label: string;
} {
  switch (entity.kind) {
    case "universe":
      return { fill: "#f5f3ff", fillSelected: "#ede9fe", stroke: "#a78bfa", label: "#5b21b6" };
    case "galaxy":
      return { fill: "#eef2ff", fillSelected: "#e0e7ff", stroke: "#818cf8", label: "#4338ca" };
    case "street":
      return { fill: "#ecfeff", fillSelected: "#cffafe", stroke: "#22d3ee", label: "#0e7490" };
    case "building":
      return { fill: "#ffffff", fillSelected: "#fff7ed", stroke: "#94a3b8", label: "#334155" };
    case "floor":
      return { fill: "#fef9c3", fillSelected: "#fef08a", stroke: "#ca8a04", label: "#854d0e" };
    case "room":
      return { fill: "#f0fdf4", fillSelected: "#bbf7d0", stroke: "#22c55e", label: "#15803d" };
  }
}

function unionRects(entities: readonly Entity[], layout: HierarchicalLayout): Rect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const e of entities) {
    const r = layout.rects.get(e.id);
    if (!r) continue;
    any = true;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  if (!any) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
