// MindMapNode — centre / aggregator / entity node renderer.
// Visual language — flat geometric silhouette + meaningful inner mark:
//   center     — glowing rounded square with breathing halo ring
//   aggregator — premium capsule pill: [glyph | LABEL | count-badge]
//   entity     — kind-shaped silhouette with opaque white backdrop so
//                edges are fully occluded behind the node body
//
// EntityKind → shape / inner mark (no skeumorphic overlays):
//   universe  — rounded square with 2×2 inner tile grid    (workspace = many packages)
//   galaxy    — rounded square with shipping-label band    (package = labeled bundle)
//   street    — folder-tab silhouette                      (folder = universally recognised)
//   building  — portrait rectangle with folded corner      (file = dog-ear document)
//   floor     — diamond with 3 stacked horizontal lines    (module = block of statements)
//   room      — circle with ƒ mark                         (function = math notation)
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
import type { AggregatorKind, MindMapNode as MindMapNodeModel, MindMapSymbolChip } from "../model/types";

/** Glyph shown inside the representative-symbol chip under a file entity.
 *  Same vocabulary Galaxy's hover card uses — keeps cross-view reads
 *  consistent so a user who learns ƒ=function in one view doesn't have
 *  to re-learn it in the other. */
function symbolChipGlyph(kind: MindMapSymbolChip["kind"]): string {
  switch (kind) {
    case "class":     return "◇";
    case "function":
    case "method":    return "ƒ";
    case "variable":  return "x";
    case "parameter": return "›";
    case "module":    return "{}";
    default:          return "ƒ";
  }
}

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

  // Radiate-out entrance: before the mount flips true, render the node
  // at a fraction of its final polar position — close to the origin, but
  // far enough to carry its starting direction. When `mounted` flips,
  // the position transition carries it out to (fx, fy). Combined with
  // the per-node stagger (mountDelayMs), the graph reads as a burst of
  // nodes springing from the center along their orbits rather than a
  // flat, simultaneous reveal.
  const fx = node.x + offsetX;
  const fy = node.y + offsetY;
  const RADIATE_START = 0.14; // 14% of the way from origin to final
  const px = mounted || isThisDragging ? fx : fx * RADIATE_START;
  const py = mounted || isThisDragging ? fy : fy * RADIATE_START;

  const groupStyle: CSSProperties = {
    transform: `translate(${px}px, ${py}px)`,
    // No transform transition while actively dragging — the pointer must
    // feel "glued" to the node. Re-centers, release, and entrance all animate.
    transition: isThisDragging
      ? "opacity 280ms ease-out"
      : `transform ${positionTransitionMs}ms cubic-bezier(0.22, 1, 0.28, 1), opacity 360ms ease-out`,
    opacity: mounted
      ? (anyDragging && !isThisDragging ? 0.42 : 1)
      : 0,
    // Interactive nodes (center + entity) show a pointer — "this clicks
    // and re-centers". Non-interactive aggregators still get grab so the
    // drag-to-reposition affordance reads. During drag the grabbing
    // cursor takes over regardless.
    cursor: isThisDragging
      ? "grabbing"
      : interactive
        ? "pointer"
        : "grab",
    outline: "none",
  };

  // Mount: subtle scale bump (0.78 → 1) on top of the radiate-out
  // translation. The position change is the primary entrance motion;
  // scale only adds a light "pop" so the node doesn't read as a rigid
  // puck sliding in. Drag → 1.08, hover → 1.05/1.10.
  const scaleAmt = isThisDragging
    ? 1.08
    : hovered
      ? (node.kind === "aggregator" ? 1.05 : 1.10)
      : mounted ? 1 : 0.78;
  const innerStyle: CSSProperties = {
    transform:       `scale(${scaleAmt})`,
    transformOrigin: "0px 0px",
    transition:      "transform 560ms cubic-bezier(0.22, 1, 0.28, 1), filter 180ms ease-out",
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
// Always a rounded square regardless of entity kind — this shape IS the
// "focus" indicator, distinct from every satellite. Kind is communicated
// by tint colour + the label tag below, and by a subtle inner mark that
// mirrors the satellite grammar (tile grid for workspace, band for
// package, folder tab for folder, etc.).
function renderCenter(node: MindMapNodeModel, hovered: boolean) {
  const tint = node.entityKind ? kindColor[node.entityKind] : color.accent;
  const r    = node.radius;

  // Halo always accent-blue — "selected/focus" visual language consistent
  // with the rest of the design system.  Entity kind is shown via face color.
  const haloTint = color.accent;

  // Softer, more refined: tint only suggests the kind — it doesn't
  // shout. Thinner stroke, cornier radius, gentler opacity. Hover bumps
  // the tint enough to register without becoming saturated.
  const faceFillOpacity   = hovered ? 0.22 : 0.13;
  const faceStrokeOpacity = hovered ? 0.82 : 0.60;
  const faceStrokeWidth   = hovered ? 1.6 : 1.2;
  const rxFace = Math.max(radiusToken.lg, r * 0.28);

  return (
    <g filter="url(#mm-center-glow)">
      {/* Outer breathing halo — always accent (selected-state indicator) */}
      <circle cx={0} cy={0} r={r + 20}
        fill="none" stroke={haloTint} strokeWidth={1.2}
        style={{ transformOrigin: "0px 0px", animation: "mm-breathe 2.8s ease-in-out infinite", opacity: 0.36 }}
      />
      {/* Static inner ring for depth */}
      <circle cx={0} cy={0} r={r + 9}
        fill="none" stroke={haloTint} strokeWidth={0.6} strokeOpacity={0.14}
        style={{ transformOrigin: "0px 0px" }}
      />
      {hovered && (
        <circle cx={0} cy={0} r={r + 7}
          fill="none" stroke={haloTint} strokeWidth={1.4}
          strokeOpacity={0.52}
          style={{ animation: "mm-breathe 1.4s ease-in-out infinite", transformOrigin: "0px 0px" }}
        />
      )}
      {/* Opaque backdrop — hides edge endpoints behind the face */}
      <rect x={-r} y={-r} width={r * 2} height={r * 2}
        rx={rxFace} ry={rxFace}
        fill={color.bg0} stroke="none"
      />
      {/* Face — soft tint with a thin kind-colored outline */}
      <rect x={-r} y={-r} width={r * 2} height={r * 2}
        rx={rxFace} ry={rxFace}
        fill={tint} fillOpacity={faceFillOpacity}
        stroke={tint} strokeWidth={faceStrokeWidth}
        strokeOpacity={faceStrokeOpacity}
        style={{ transition: "fill-opacity 160ms ease-out, stroke-width 160ms ease-out, stroke-opacity 160ms" }}
      />
      {/* Inner kind mark — same geometric language as the satellites
       *  (scaled down so it reads as a quiet signifier, not a competing
       *  symbol). Rendered inside the center's face. */}
      {renderCenterInnerMark(node.entityKind, r, tint, hovered)}
    </g>
  );
}

// Small kind-specific mark drawn inside the center's rounded square —
// echoes the satellite shape grammar so the centre reads as "this kind,
// focused", not as a generic blue tile. Scale-down factor 0.48 keeps it
// inside the face with breathing room on all sides.
function renderCenterInnerMark(
  kind: EntityKind | undefined,
  r: number,
  tint: string,
  hovered: boolean,
) {
  if (!kind) return null;
  const s   = r * 0.48; // mark half-size
  const op  = hovered ? 0.62 : 0.44;
  const sw  = 1.1;

  if (kind === "universe") {
    // 2×2 tile grid
    const tile = s * 0.42;
    const gap  = s * 0.18;
    const tiles: Array<[number, number]> = [
      [-tile - gap / 2, -tile - gap / 2],
      [ gap / 2,        -tile - gap / 2],
      [-tile - gap / 2,  gap / 2],
      [ gap / 2,         gap / 2],
    ];
    return (
      <g>
        {tiles.map(([x, y], i) => (
          <rect key={i}
            x={x} y={y} width={tile} height={tile} rx={tile * 0.22} ry={tile * 0.22}
            fill="none" stroke={tint} strokeWidth={sw} strokeOpacity={op} />
        ))}
      </g>
    );
  }
  if (kind === "galaxy") {
    // Rounded square with horizontal label band
    return (
      <g>
        <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={s * 0.2} ry={s * 0.2}
          fill="none" stroke={tint} strokeWidth={sw} strokeOpacity={op} />
        <line x1={-s + s * 0.15} y1={-s * 0.38} x2={s - s * 0.15} y2={-s * 0.38}
          stroke={tint} strokeWidth={sw * 0.85} strokeOpacity={op * 0.85} />
      </g>
    );
  }
  if (kind === "street") {
    // Folder tab silhouette
    const w = s;
    const hBody = s * 0.70;
    const tabW = w * 0.55;
    const tabH = s * 0.28;
    const slope = tabH * 0.55;
    const d =
      `M ${-w} ${-hBody - tabH} ` +
      `L ${-w + tabW} ${-hBody - tabH} ` +
      `L ${-w + tabW + slope} ${-hBody} ` +
      `L ${w} ${-hBody} ` +
      `L ${w} ${hBody} ` +
      `L ${-w} ${hBody} ` +
      `Z`;
    return (
      <path d={d}
        fill="none" stroke={tint} strokeWidth={sw} strokeOpacity={op}
        strokeLinejoin="round" />
    );
  }
  if (kind === "building") {
    // Portrait rect with folded corner
    const w   = s * 0.74;
    const h   = s * 0.94;
    const cut = w * 0.42;
    const outline =
      `M ${-w} ${-h} ` +
      `L ${w - cut} ${-h} ` +
      `L ${w} ${-h + cut} ` +
      `L ${w} ${h} ` +
      `L ${-w} ${h} ` +
      `Z`;
    return (
      <g>
        <path d={outline}
          fill="none" stroke={tint} strokeWidth={sw} strokeOpacity={op}
          strokeLinejoin="round" />
        <line x1={w - cut} y1={-h + cut} x2={w} y2={-h + cut}
          stroke={tint} strokeWidth={sw * 0.85} strokeOpacity={op * 0.85} />
        <line x1={w - cut} y1={-h} x2={w - cut} y2={-h + cut}
          stroke={tint} strokeWidth={sw * 0.85} strokeOpacity={op * 0.85} />
      </g>
    );
  }
  if (kind === "floor") {
    // Diamond
    const pts = `0,${-s} ${s},0 0,${s} ${-s},0`;
    return (
      <polygon points={pts}
        fill="none" stroke={tint} strokeWidth={sw} strokeOpacity={op}
        strokeLinejoin="round" />
    );
  }
  if (kind === "room") {
    // ƒ mark
    return (
      <text x={0} y={s * 0.18}
        textAnchor="middle" dominantBaseline="central"
        fontFamily={font.mono} fontSize={s * 1.9} fontWeight={font.weight.bold}
        fontStyle="italic"
        fill={tint} fillOpacity={op}
        style={{ userSelect: "none" }}
      >
        ƒ
      </text>
    );
  }
  return null;
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
      {/* Tinted fill — soft so the pill reads as a hint, not a button */}
      <rect x={-w / 2} y={-h / 2} width={w} height={h}
        rx={rx} ry={rx}
        fill={accent} fillOpacity={hovered ? 0.12 : 0.06}
        stroke={accent} strokeWidth={hovered ? 1.3 : 1.0}
        strokeOpacity={hovered ? 0.80 : 0.48}
        style={{ transition: "fill-opacity 140ms ease-out, stroke-opacity 140ms ease-out" }}
      />
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
// Flat geometric silhouettes — each shape + inner mark carries the kind
// meaning without skeumorphic icons. Every branch renders:
//   (1) opaque white backdrop → masks edge endpoints behind the body,
//   (2) tinted tint-coloured face,
//   (3) meaningful inner mark (stacked lines / grid / fold / band / ƒ / …).

function renderEntityShape(
  kind: EntityKind | undefined,
  r: number,
  tint: string,
  hovered: boolean,
) {
  // Refined palette: hollow silhouettes with a soft tint hint. Thin
  // stroke + low fill opacity reads as "material paper" rather than
  // a flat sticker. Hover bumps both slightly — never to saturated.
  const fillOpacity   = hovered ? 0.18 : 0.09;
  const strokeWidth   = hovered ? 1.5  : 1.1;
  const strokeOpacity = hovered ? 0.82 : 0.62;
  const markOpacity   = strokeOpacity * 0.58;
  const markWidth     = 0.9;
  const trans: CSSProperties = {
    transition: "fill-opacity 140ms, stroke-width 140ms, stroke-opacity 140ms",
  };
  const shadow = { filter: "drop-shadow(0 2px 6px rgba(15, 23, 42, 0.06))" };

  // ── building (file) → portrait rect with folded corner + content lines
  if (kind === "building") {
    const w   = r * 0.78;
    const h   = r;
    const cut = w * 0.42;
    const outline =
      `M ${f(-w)} ${f(-h)} ` +
      `L ${f(w - cut)} ${f(-h)} ` +
      `L ${f(w)} ${f(-h + cut)} ` +
      `L ${f(w)} ${f(h)} ` +
      `L ${f(-w)} ${f(h)} ` +
      `Z`;
    const foldTri =
      `M ${f(w - cut)} ${f(-h)} ` +
      `L ${f(w)} ${f(-h + cut)} ` +
      `L ${f(w - cut)} ${f(-h + cut)} ` +
      `Z`;
    // Three stacked content lines — last is shorter to read as "end of text"
    const linesX   = w * 0.62;
    const shortX   = w * 0.30;
    const lineYs: Array<[number, number]> = [
      [-h * 0.02, linesX],
      [ h * 0.24, linesX],
      [ h * 0.50, shortX],
    ];
    return (
      <g>
        <path d={outline} fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <path d={outline}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          strokeLinejoin="round" style={trans} />
        {/* Fold triangle — slightly darker tint reads as dog-ear */}
        <path d={foldTri} fill={tint} fillOpacity={hovered ? 0.30 : 0.18} stroke="none" />
        <path d={foldTri}
          fill="none" stroke={tint} strokeWidth={markWidth} strokeOpacity={strokeOpacity * 0.58}
          strokeLinejoin="round" />
        {/* Content lines */}
        {lineYs.map(([y, x], i) => (
          <line key={i}
            x1={-x} y1={f(y)} x2={x} y2={f(y)}
            stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity}
            strokeLinecap="round" />
        ))}
      </g>
    );
  }

  // ── floor (module) → diamond with 3 stacked statement lines ─────────
  if (kind === "floor") {
    const pts = `0,${f(-r)} ${f(r)},0 0,${f(r)} ${f(-r)},0`;
    // Lines are clipped to the diamond's horizontal extent at each y.
    // Diamond half-width at y: (r - |y|).
    const lineYs = [-r * 0.26, 0, r * 0.26];
    return (
      <g>
        <polygon points={pts} fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <polygon points={pts}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          strokeLinejoin="round" style={trans} />
        {lineYs.map((y, i) => {
          const halfW = (r - Math.abs(y)) * 0.72;
          return (
            <line key={i}
              x1={-halfW} y1={f(y)} x2={halfW} y2={f(y)}
              stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity}
              strokeLinecap="round" />
          );
        })}
      </g>
    );
  }

  // ── room (function) → circle with ƒ mark ────────────────────────────
  if (kind === "room") {
    return (
      <g>
        <circle cx={0} cy={0} r={r}
          fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <circle cx={0} cy={0} r={r}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          style={trans} />
        <text x={0} y={f(r * 0.14)}
          textAnchor="middle" dominantBaseline="central"
          fontFamily={font.mono} fontSize={f(r * 1.25)} fontWeight={font.weight.bold}
          fontStyle="italic"
          fill={tint} fillOpacity={hovered ? 0.78 : 0.58}
          style={{ userSelect: "none" }}
        >
          ƒ
        </text>
      </g>
    );
  }

  // ── street (folder) → folder-tab silhouette ─────────────────────────
  if (kind === "street") {
    const w     = r * 0.96;
    const hBody = r * 0.78;
    const tabW  = w * 0.52;
    const tabH  = r * 0.26;
    const slope = tabH * 0.55;
    const path =
      `M ${f(-w)} ${f(-hBody - tabH)} ` +
      `L ${f(-w + tabW)} ${f(-hBody - tabH)} ` +
      `L ${f(-w + tabW + slope)} ${f(-hBody)} ` +
      `L ${f(w)} ${f(-hBody)} ` +
      `L ${f(w)} ${f(hBody)} ` +
      `L ${f(-w)} ${f(hBody)} ` +
      `Z`;
    return (
      <g>
        <path d={path} fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <path d={path}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity}
          strokeLinejoin="round" style={trans} />
        {/* Separator between tab and body — reinforces the folder grammar */}
        <line
          x1={f(-w + tabW + slope)} y1={f(-hBody)}
          x2={f(w)} y2={f(-hBody)}
          stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity} />
      </g>
    );
  }

  // ── galaxy (package) → rounded square with shipping-label band ──────
  if (kind === "galaxy") {
    const side = r * 1.42;
    const half = side / 2;
    const rx   = r * 0.22;
    const bandY1 = -half + side * 0.22;
    const bandY2 = -half + side * 0.42;
    return (
      <g>
        <rect x={-half} y={-half} width={side} height={side} rx={rx} ry={rx}
          fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <rect x={-half} y={-half} width={side} height={side} rx={rx} ry={rx}
          fill={tint} fillOpacity={fillOpacity}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} style={trans} />
        {/* Horizontal shipping-tape band */}
        <line x1={-half + rx * 0.6} y1={bandY1} x2={half - rx * 0.6} y2={bandY1}
          stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity} />
        <line x1={-half + rx * 0.6} y1={bandY2} x2={half - rx * 0.6} y2={bandY2}
          stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity} />
        {/* Subtle tie-in — reads as "sealed" */}
        <line x1={0} y1={bandY1} x2={0} y2={bandY2}
          stroke={tint} strokeWidth={markWidth * 0.85} strokeOpacity={markOpacity * 0.85} />
      </g>
    );
  }

  // ── universe (workspace) → rounded square with 2×2 inner tile grid ──
  if (kind === "universe") {
    const side = r * 1.5;
    const half = side / 2;
    const rx   = r * 0.22;
    const gap  = side * 0.09;
    const tile = (side - gap * 3) / 2;
    const tileRx = tile * 0.2;
    const tilePositions: Array<[number, number]> = [
      [-half + gap,         -half + gap],
      [ gap / 2,            -half + gap],
      [-half + gap,          gap / 2],
      [ gap / 2,             gap / 2],
    ];
    return (
      <g>
        <rect x={-half} y={-half} width={side} height={side} rx={rx} ry={rx}
          fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
        <rect x={-half} y={-half} width={side} height={side} rx={rx} ry={rx}
          fill={tint} fillOpacity={fillOpacity * 0.75}
          stroke={tint} strokeWidth={strokeWidth} strokeOpacity={strokeOpacity} style={trans} />
        {tilePositions.map(([x, y], i) => (
          <rect key={i}
            x={x} y={y} width={tile} height={tile} rx={tileRx} ry={tileRx}
            fill={tint} fillOpacity={hovered ? 0.40 : 0.24}
            stroke={tint} strokeWidth={markWidth} strokeOpacity={markOpacity * 1.4} />
        ))}
      </g>
    );
  }

  // ── default → circle ────────────────────────────────────────────────
  return (
    <g>
      <circle cx={0} cy={0} r={r} fill={color.bg0} fillOpacity={0.96} stroke="none" style={shadow} />
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

  // Entity — name + kind type tag + (for files) representative symbols
  const boxW  = Math.max(node.radius * 4, 96);
  const ekind = node.entityKind;
  const kindTagY = below + nameSize + 6;
  // Symbol chip strip sits one row below the kind tag. Rendered via
  // foreignObject so flex-wrap + ellipsis do the hard layout work that
  // raw SVG <text> can't handle cleanly.
  const chips = node.symbolPreview ?? [];
  const chipOverflow = chips.length > 0 && node.symbolTotal && node.symbolTotal > chips.length
    ? node.symbolTotal - chips.length
    : 0;
  const chipsY  = kindTagY + font.size.xxs + 6;
  const chipsH  = 20;
  const chipsW  = Math.max(boxW, 110);
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
        <text x={0} y={kindTagY}
          textAnchor="middle" dominantBaseline="hanging"
          fontFamily={font.sans} fontSize={font.size.xxs} fontWeight={font.weight.regular}
          fill={kindColor[ekind]} fillOpacity={0.72} letterSpacing="0.08em"
          style={{ userSelect: "none" }}
        >
          {kindIcon[ekind]} {kindLabel[ekind].toUpperCase()}
        </text>
      )}
      {chips.length > 0 && (
        <foreignObject
          x={-chipsW / 2} y={chipsY}
          width={chipsW} height={chipsH}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div style={{
            display: "flex", flexWrap: "nowrap",
            justifyContent: "center", alignItems: "center",
            gap: 4,
            fontFamily: font.mono ?? font.sans,
            fontSize: 9.5,
            lineHeight: 1.2,
            color: color.text2,
            userSelect: "none",
          }}>
            {chips.map(c => (
              <span key={c.id} style={{
                display: "inline-flex", alignItems: "center", gap: 2,
                padding: "1px 5px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 3,
                maxWidth: 72,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }} title={`${c.kind} · ${c.name}`}>
                <span style={{ color: color.text1, fontWeight: 600 }}>{symbolChipGlyph(c.kind)}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              </span>
            ))}
            {chipOverflow > 0 && (
              <span style={{
                color: color.text3 ?? color.text2,
                fontSize: 9,
              }}>
                +{chipOverflow}
              </span>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export const MindMapNode = memo(MindMapNodeImpl);
