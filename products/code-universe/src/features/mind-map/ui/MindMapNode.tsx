// MindMapNode — centre / aggregator / entity node renderer.
// Visual language:
//   center     — glowing rounded square with breathing halo ring.
//   aggregator — premium capsule pill: [glyph | LABEL | count-badge].
//   entity     — kind-shaped silhouette with opaque white backdrop so
//                edges are fully occluded behind the node body.
//
// EntityKind → shape:
//   universe  — three concentric rings          (◎ glyph)
//   galaxy    — thick outer ring + center dot   (⬡ glyph)
//   street    — pointy-top hexagon              (⊞ glyph)
//   building  — document with folded corner     (⊟ glyph)
//   floor     — diamond / rotated square        (◆ glyph)
//   room      — upward triangle + ƒ mark        (ƒ glyph)
//   default   — circle

import { memo, useCallback, useEffect, useState, type KeyboardEvent } from "react";
import type { CSSProperties } from "react";

import type { EntityKind } from "@quanta/canvas-engine";

import {
  color,
  font,
  kindColor,
  kindIcon,
  kindLabel,
  radius as radiusToken,
} from "../../../shared/ui/tokens";
import type { AggregatorKind, MindMapNode as MindMapNodeModel } from "../model/types";

export interface MindMapNodeProps {
  node: MindMapNodeModel;
  mountDelayMs: number;
  positionTransitionMs: number;
  onFocusEntity?: (entityId: string) => void;
  onHoverChange?: (nodeId: string | null) => void;
  /** User-applied drag offset — layered on top of the layout's (node.x, node.y). */
  offsetX?: number;
  offsetY?: number;
  /** Parent's current zoom scale — converts screen-px drag to graph-px. */
  viewScale?: number;
  /** Fired continuously during drag; parent persists the offset. */
  onOffsetChange?: (id: string, dx: number, dy: number) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  /** Some node in the view is currently being dragged. */
  anyDragging?: boolean;
  /** This specific node is being dragged. */
  isThisDragging?: boolean;
}

// ── Category palette ─────────────────────────────────────────────────
const AGG_COLOR: Readonly<Record<AggregatorKind, string>> = {
  callers:          "#0d99ff",
  callees:          "#e09321",
  siblings:         "#9e77ff",
  children:         "#22a06b",
  "parent-dir":     "#8c9bab",
  "external-deps":  "#e5484d",
  inheritance:      "#f76b15",
  "data-relations": "#30a46c",
};

const AGG_GLYPH: Readonly<Record<AggregatorKind, string>> = {
  "parent-dir":     "↑",
  children:         "↓",
  siblings:         "↔",
  callers:          "←",
  callees:          "→",
  "external-deps":  "◈",
  inheritance:      "◇",
  "data-relations": "⬡",
};

const AGG_LABEL: Readonly<Record<AggregatorKind, string>> = {
  "parent-dir":     "PARENTS",
  children:         "CHILDREN",
  siblings:         "SIBLINGS",
  callers:          "CALLERS",
  callees:          "CALLEES",
  "external-deps":  "EXTERNAL",
  inheritance:      "INHERITS",
  "data-relations": "DATA",
};

// ── Geometry helper ───────────────────────────────────────────────────
function f(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// ── Component ────────────────────────────────────────────────────────

function MindMapNodeImpl({
  node,
  mountDelayMs,
  positionTransitionMs,
  onFocusEntity,
  onHoverChange,
  offsetX = 0,
  offsetY = 0,
  viewScale = 1,
  onOffsetChange,
  onDragStart,
  onDragEnd,
  anyDragging = false,
  isThisDragging = false,
}: MindMapNodeProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [ripple, setRipple]   = useState(false);

  useEffect(() => {
    let r1 = 0, r2 = 0, t = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        t = window.setTimeout(() => setMounted(true), mountDelayMs);
      });
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); window.clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHoverEnter = useCallback(() => {
    setHovered(true);
    onHoverChange?.(node.id);
  }, [node.id, onHoverChange]);

  const handleHoverLeave = useCallback(() => {
    setHovered(false);
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleActivate = useCallback(() => {
    if (node.kind !== "entity" && node.kind !== "center") return;
    if (node.entityId && onFocusEntity) {
      setRipple(false);
      requestAnimationFrame(() => setRipple(true));
      onFocusEntity(node.entityId);
    }
  }, [node.kind, node.entityId, onFocusEntity]);

  const handleKeyDown = useCallback((e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    handleActivate();
  }, [handleActivate]);

  // ── Drag-to-reposition ───────────────────────────────────────────
  // Left-mouse-down on a node enters a tentative drag. If the pointer
  // moves past the 3 px dead-zone we commit to dragging — the parent is
  // notified, and every mousemove updates the per-node offset. If the
  // pointer never crosses the dead-zone, mouseup is treated as a click
  // and activates the node (re-centers the graph). Window listeners let
  // the drag track cleanly when the pointer leaves the SVG.
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // block parent pan

    const startX = e.clientX;
    const startY = e.clientY;
    const baseDx = offsetX;
    const baseDy = offsetY;
    const sc     = viewScale || 1;
    let moved    = false;

    const onMove = (me: MouseEvent) => {
      const ddx = me.clientX - startX;
      const ddy = me.clientY - startY;
      if (!moved && Math.hypot(ddx, ddy) > 3) {
        moved = true;
        onDragStart?.(node.id);
      }
      if (moved) {
        onOffsetChange?.(node.id, baseDx + ddx / sc, baseDy + ddy / sc);
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (moved) {
        onDragEnd?.();
      } else {
        handleActivate();
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [node.id, offsetX, offsetY, viewScale, onOffsetChange, onDragStart, onDragEnd, handleActivate]);

  // Double-click on a repositioned node snaps it back to the algorithmic
  // position — a quick "undo my drag" affordance.
  const handleDblClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    if (offsetX === 0 && offsetY === 0) return;
    e.stopPropagation();
    onOffsetChange?.(node.id, 0, 0);
  }, [node.id, offsetX, offsetY, onOffsetChange]);

  const interactive = node.kind === "center" || node.kind === "entity";
  const hasOffset   = offsetX !== 0 || offsetY !== 0;

  const groupStyle: CSSProperties = {
    transform: `translate(${node.x + offsetX}px, ${node.y + offsetY}px)`,
    // No transform transition while actively dragging — the pointer must
    // feel "glued" to the node. Re-centers and release still animate.
    transition: isThisDragging
      ? "opacity 280ms ease-out"
      : `transform ${positionTransitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 280ms ease-out`,
    opacity: mounted
      ? (anyDragging && !isThisDragging ? 0.42 : 1)
      : 0,
    cursor: isThisDragging ? "grabbing" : "grab",
    outline: "none",
  };

  // Scale: drag picks it up slightly (1.08), hover bumps normally, mount
  // grows from 60% → 100%.
  const scaleAmt = isThisDragging
    ? 1.08
    : hovered
      ? (node.kind === "aggregator" ? 1.05 : 1.10)
      : mounted ? 1 : 0.60;
  const innerStyle: CSSProperties = {
    transform:       `scale(${scaleAmt})`,
    transformOrigin: "0px 0px",
    transition:      "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), filter 180ms ease-out",
    filter: isThisDragging
      ? "drop-shadow(0 10px 18px rgba(10,30,60,0.22))"
      : undefined,
  };

  return (
    <g
      style={groupStyle}
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDblClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={node.kind === "entity" ? 0 : -1}
      role={interactive ? "button" : undefined}
      aria-label={`${node.label} (${node.kind})`}
      data-node-id={node.id}
      data-node-kind={node.kind}
    >
      <title>
        {node.label}{node.sublabel ? ` — ${node.sublabel}` : ""}
        {hasOffset ? "  ·  double-click to reset position" : ""}
      </title>
      {/* Ghost marker at the original layout position — only visible
       *  while this specific node is being dragged, so the user can see
       *  where the node "belongs" and choose whether to commit the move. */}
      {isThisDragging && hasOffset && (
        <g style={{ pointerEvents: "none" }}>
          <circle
            cx={-offsetX} cy={-offsetY} r={node.radius}
            fill="none"
            stroke="rgba(13,153,255,0.55)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <line
            x1={-offsetX} y1={-offsetY} x2={0} y2={0}
            stroke="rgba(13,153,255,0.28)"
            strokeWidth={0.8}
            strokeDasharray="2 3"
          />
        </g>
      )}
      <g style={innerStyle}>
        {renderShape(node, hovered || isThisDragging, ripple)}
      </g>
      {renderLabel(node)}
    </g>
  );
}

// ── Shape renderers ──────────────────────────────────────────────────

function renderShape(node: MindMapNodeModel, hovered: boolean, ripple: boolean) {
  if (node.kind === "center")     return renderCenter(node, hovered);
  if (node.kind === "aggregator") return renderAggregator(node, hovered);
  return renderEntity(node, hovered, ripple);
}

// Center — glowing rounded square with animated halo ring.
function renderCenter(node: MindMapNodeModel, hovered: boolean) {
  const tint = node.entityKind ? kindColor[node.entityKind] : color.accent;
  const r    = node.radius;

  // Halo always accent-blue — "selected/focus" visual language consistent
  // with the rest of the design system.  Entity kind is shown via face color.
  const haloTint = color.accent;

  return (
    <g filter="url(#mm-center-glow)">
      {/* Outer breathing halo — always accent (selected-state indicator) */}
      <circle cx={0} cy={0} r={r + 18}
        fill="none" stroke={haloTint} strokeWidth={1.8}
        style={{ transformOrigin: "0px 0px", animation: "mm-breathe 2.8s ease-in-out infinite", opacity: 0.42 }}
      />
      {/* Static inner ring for depth */}
      <circle cx={0} cy={0} r={r + 8}
        fill="none" stroke={haloTint} strokeWidth={0.8} strokeOpacity={0.18}
        style={{ transformOrigin: "0px 0px" }}
      />
      {hovered && (
        <circle cx={0} cy={0} r={r + 7}
          fill="none" stroke={haloTint} strokeWidth={2}
          strokeOpacity={0.65}
          style={{ animation: "mm-breathe 1.4s ease-in-out infinite", transformOrigin: "0px 0px" }}
        />
      )}
      {/* Face — edges start from radius+1 so no backdrop needed here */}
      <rect x={-r} y={-r} width={r * 2} height={r * 2}
        rx={radiusToken.lg} ry={radiusToken.lg}
        fill={tint} fillOpacity={hovered ? 0.38 : 0.26}
        stroke={tint} strokeWidth={hovered ? 2.5 : 2.0}
        strokeOpacity={0.88}
        style={{ transition: "fill-opacity 160ms ease-out, stroke-width 160ms ease-out, stroke-opacity 160ms" }}
      />
      {/* Inner highlight — gives the card a slight top-lit depth */}
      <rect x={-r + 3} y={-r + 3} width={(r - 3) * 2} height={(r - 3) * 2}
        rx={radiusToken.md} ry={radiusToken.md}
        fill="none" stroke="white" strokeWidth={1.0} strokeOpacity={0.30}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
}

// Aggregator — premium capsule: [glyph | LABEL | count-badge].
function renderAggregator(node: MindMapNodeModel, hovered: boolean) {
  const kind     = node.aggregatorKind!;
  const accent   = AGG_COLOR[kind] ?? color.text2;
  const label    = AGG_LABEL[kind] ?? node.label;
  const glyph    = AGG_GLYPH[kind] ?? "◇";
  const rawCount = node.sublabel ?? "0";
  const count    = parseInt(rawCount, 10);
  const countText = isNaN(count) || count === 0 ? "—" : rawCount;

  // Pill dimensions — glyph cap(22px) + label + badge cap(22px), min 88px.
  const labelPx = label.length * 6.0;
  const w = Math.max(88, labelPx + 50);
  const h = 26;
  const rx = h / 2;

  const glyphX = -w / 2 + 13;
  const badgeX =  w / 2 - 13;
  const badgeR = 9;

  return (
    <g>
      {/* Opaque backdrop — hides edges behind the pill + subtle drop-shadow */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h}
        rx={rx} ry={rx}
        fill={color.bg0} fillOpacity={0.96} stroke="none"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))" }}
      />
      {/* Tinted fill */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h}
        rx={rx} ry={rx}
        fill={accent} fillOpacity={hovered ? 0.16 : 0.09}
        stroke={accent} strokeWidth={hovered ? 1.6 : 1.2}
        strokeOpacity={hovered ? 0.92 : 0.65}
        style={{ transition: "fill-opacity 140ms ease-out, stroke-opacity 140ms ease-out" }}
      />
      {/* Top-highlight for depth */}
      <rect x={-w / 2 + 2} y={-h / 2 + 1.5} width={w - 4} height={h / 2 - 2}
        rx={rx - 1} ry={rx - 1}
        fill="white" fillOpacity={hovered ? 0.10 : 0.06} stroke="none"
        style={{ pointerEvents: "none" }}
      />
      {/* Segment dividers */}
      <line x1={glyphX + 10} y1={-h / 2 + 5} x2={glyphX + 10} y2={h / 2 - 5}
        stroke={accent} strokeOpacity={0.28} strokeWidth={1} />
      <line x1={badgeX - 10} y1={-h / 2 + 5} x2={badgeX - 10} y2={h / 2 - 5}
        stroke={accent} strokeOpacity={0.28} strokeWidth={1} />
      {/* Category glyph */}
      <text x={glyphX} y={0.5}
        textAnchor="middle" dominantBaseline="central"
        fontFamily={font.sans} fontSize={font.size.sm} fontWeight={font.weight.bold}
        fill={accent} style={{ userSelect: "none" }}
      >
        {glyph}
      </text>
      {/* Label */}
      <text x={0} y={0.5}
        textAnchor="middle" dominantBaseline="central"
        fontFamily={font.sans} fontSize={font.size.xxs} fontWeight={font.weight.semibold}
        fill={color.text0} letterSpacing="0.07em"
        style={{ userSelect: "none" }}
      >
        {label}
      </text>
      {/* Count badge */}
      <circle cx={badgeX} cy={0} r={badgeR}
        fill={accent} fillOpacity={count === 0 ? 0.30 : (hovered ? 0.90 : 0.72)}
        style={{ transition: "fill-opacity 140ms ease-out" }}
      />
      <text x={badgeX} y={0.5}
        textAnchor="middle" dominantBaseline="central"
        fontFamily={font.mono} fontSize={font.size.xxs} fontWeight={font.weight.bold}
        fill="white" fillOpacity={count === 0 ? 0.55 : 1}
        style={{ userSelect: "none" }}
      >
        {countText}
      </text>
    </g>
  );
}

// Entity — kind-shaped silhouette with hover ring and click ripple.
function renderEntity(node: MindMapNodeModel, hovered: boolean, ripple: boolean) {
  const tint = node.entityKind ? kindColor[node.entityKind] : color.text2;
  const r    = node.radius;

  return (
    <g>
      {hovered && (
        <circle cx={0} cy={0} r={r + 5}
          fill="none" stroke={tint} strokeWidth={1.5} strokeOpacity={0.45}
          style={{ animation: "mm-breathe 1.6s ease-in-out infinite", transformOrigin: "0px 0px" }}
        />
      )}
      {ripple && (
        <circle key={String(ripple)} cx={0} cy={0} r={r}
          fill="none" stroke={tint} strokeWidth={1.5}
          style={{ animation: "mm-hover-ring 500ms ease-out forwards", transformOrigin: "0px 0px" }}
        />
      )}
      {renderEntityShape(node.entityKind, r, tint, hovered)}
    </g>
  );
}

// ── Per-kind entity shape ────────────────────────────────────────────
// Every branch renders: (1) opaque white backdrop — masks edges behind
// the node body, (2) tinted colored fill, (3) optional inner detail.

function renderEntityShape(
  kind: EntityKind | undefined,
  r: number,
  tint: string,
  hovered: boolean,
) {
  const fillOpacity   = hovered ? 0.36 : 0.22;
  const strokeWidth   = hovered ? 2.0  : 1.5;
  const strokeOpacity = hovered ? 0.95 : 0.82;
  const trans: CSSProperties = {
    transition: "fill-opacity 140ms, stroke-width 140ms, stroke-opacity 140ms",
  };

  // ── building → portrait rounded rectangle with concentric inner ────
  // Same "outer form + miniature inner form" grammar as street (hex),
  // floor (diamond), and universe (circles). Portrait proportion
  // (0.78:1) reads as "page / document" by aspect ratio alone without
  // needing any skeuomorphic detail; it's also clearly distinct from
  // the center node's squarer hero tile so the two don't blur together.
  if (kind === "building") {
    const w   = r * 0.78;          // outer half-width
    const h   = r;                 // outer half-height
    const rx  = r * 0.22;          // outer corner radius
    const wi  = w * 0.56;          // inner half-width
    const hi  = h * 0.56;          // inner half-height
    const rxi = Math.max(1, rx * 0.56);
    return (
      <g>
        {/* Backdrop — opaque white so edges are occluded behind the chip */}
        <rect x={-w} y={-h} width={w * 2} height={h * 2} rx={rx} ry={rx}
          fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        {/* Tinted face */}
        <rect x={-w} y={-h} width={w * 2} height={h * 2} rx={rx} ry={rx}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          style={trans} />
        {/* Inner miniature — same rhythm as the other kind shapes */}
        <rect x={-wi} y={-hi} width={wi * 2} height={hi * 2} rx={rxi} ry={rxi}
          fill="none"
          stroke={tint} strokeWidth={0.8}
          strokeOpacity={strokeOpacity * 0.38} />
      </g>
    );
  }

  // ── floor → module diamond with inner diamond detail ───────────────
  if (kind === "floor") {
    const pts  = `0,${f(-r)} ${f(r)},0 0,${f(r)} ${f(-r)},0`;
    const ri   = r * 0.48;
    const ptsI = `0,${f(-ri)} ${f(ri)},0 0,${f(ri)} ${f(-ri)},0`;
    return (
      <g>
        <polygon points={pts} fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        <polygon points={pts} fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} style={trans} />
        <polygon points={ptsI} fill="none"
          stroke={tint} strokeWidth={0.8} strokeOpacity={strokeOpacity * 0.38} />
      </g>
    );
  }

  // ── room → function upward triangle with ƒ mark ───────────────────
  if (kind === "room") {
    const pts = `0,${f(-r)} ${f(r * 0.88)},${f(r * 0.76)} ${f(-r * 0.88)},${f(r * 0.76)}`;
    return (
      <g>
        <polygon points={pts} fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        <polygon points={pts} fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          strokeLinejoin="round" style={trans} />
        <text x={0} y={f(r * 0.16)}
          textAnchor="middle" dominantBaseline="central"
          fontFamily={font.mono} fontSize={f(r * 0.56)} fontWeight={font.weight.bold}
          fill={tint} fillOpacity={hovered ? 0.65 : 0.42}
          style={{ userSelect: "none" }}
        >
          {kindIcon.room}
        </text>
      </g>
    );
  }

  // ── street → directory pointy-top hexagon with inner ring ─────────
  if (kind === "street") {
    const s = 0.866;
    const hex = (scale: number) => [
      `0,${f(-r * scale)}`,
      `${f(r * s * scale)},${f(-r * 0.5 * scale)}`,
      `${f(r * s * scale)},${f(r * 0.5 * scale)}`,
      `0,${f(r * scale)}`,
      `${f(-r * s * scale)},${f(r * 0.5 * scale)}`,
      `${f(-r * s * scale)},${f(-r * 0.5 * scale)}`,
    ].join(" ");
    return (
      <g>
        <polygon points={hex(1)} fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        <polygon points={hex(1)} fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} style={trans} />
        <polygon points={hex(0.52)} fill="none"
          stroke={tint} strokeWidth={0.8} strokeOpacity={strokeOpacity * 0.35} />
      </g>
    );
  }

  // ── galaxy → package: thick ring (annulus) + center dot ───────────
  if (kind === "galaxy") {
    const rRing = r * 0.64;
    const ringW = r * 0.42;
    return (
      <g>
        <circle cx={0} cy={0} r={r} fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        <circle cx={0} cy={0} r={rRing}
          fill="none" stroke={tint} strokeWidth={ringW} strokeOpacity={strokeOpacity}
          style={trans} />
        <circle cx={0} cy={0} r={r * 0.20}
          fill={tint} fillOpacity={hovered ? 0.88 : 0.68} stroke="none" />
      </g>
    );
  }

  // ── universe → workspace: three concentric rings ───────────────────
  if (kind === "universe") {
    return (
      <g>
        <circle cx={0} cy={0} r={r} fill={color.bg0} fillOpacity={0.96} stroke="none"
          style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
        <circle cx={0} cy={0} r={r * 0.28}
          fill={tint} fillOpacity={hovered ? 0.82 : 0.60} stroke="none" />
        <circle cx={0} cy={0} r={r * 0.58}
          fill="none" stroke={tint} strokeWidth={1.5} strokeOpacity={strokeOpacity}
          style={trans} />
        <circle cx={0} cy={0} r={r}
          fill="none" stroke={tint} strokeWidth={0.9} strokeOpacity={strokeOpacity * 0.58}
          style={trans} />
      </g>
    );
  }

  // ── default → circle ───────────────────────────────────────────────
  return (
    <g>
      <circle cx={0} cy={0} r={r} fill={color.bg0} fillOpacity={0.96} stroke="none"
        style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.09))" }} />
      <circle cx={0} cy={0} r={r} fill={tint} fillOpacity={fillOpacity}
        stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} style={trans} />
    </g>
  );
}

// ── Label ────────────────────────────────────────────────────────────

function renderLabel(node: MindMapNodeModel) {
  if (node.kind === "aggregator") return null;

  const below      = node.radius + 14;
  const nameSize   = node.kind === "center" ? font.size.md  : font.size.sm;
  const nameWeight = node.kind === "center" ? font.weight.semibold : font.weight.medium;

  if (node.kind === "center") {
    return (
      <g>
        <text x={0} y={below}
          textAnchor="middle" dominantBaseline="hanging"
          fontFamily={font.sans} fontSize={nameSize} fontWeight={nameWeight}
          fill={color.text0} style={{ userSelect: "none" }}
        >
          {node.label}
        </text>
        {node.entityKind ? (
          <text x={0} y={below + nameSize + 5}
            textAnchor="middle" dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.xs} fontWeight={font.weight.regular}
            fill={color.text2} letterSpacing="0.10em"
            style={{ userSelect: "none" }}
          >
            {kindLabel[node.entityKind].toUpperCase()}
          </text>
        ) : null}
      </g>
    );
  }

  // Entity — name + kind type tag
  const boxW  = Math.max(node.radius * 4, 96);
  const ekind = node.entityKind;
  return (
    <g>
      <foreignObject
        x={-boxW / 2} y={below}
        width={boxW} height={nameSize * 1.6}
        style={{ overflow: "visible", pointerEvents: "none" }}
      >
        <div style={{
          textAlign: "center",
          fontFamily: font.sans,
          fontSize: nameSize,
          fontWeight: nameWeight,
          color: color.text1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          userSelect: "none",
        }}>
          {node.label}
        </div>
      </foreignObject>
      {ekind && (
        <text x={0} y={below + nameSize + 6}
          textAnchor="middle" dominantBaseline="hanging"
          fontFamily={font.sans} fontSize={font.size.xxs} fontWeight={font.weight.regular}
          fill={kindColor[ekind]} fillOpacity={0.72} letterSpacing="0.08em"
          style={{ userSelect: "none" }}
        >
          {kindIcon[ekind]} {kindLabel[ekind].toUpperCase()}
        </text>
      )}
    </g>
  );
}

export const MindMapNode = memo(MindMapNodeImpl);
