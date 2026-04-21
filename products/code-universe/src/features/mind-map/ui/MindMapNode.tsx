// MindMapNode — one node in the egocentric radial graph.
// --------------------------------------------------------------------
// Three visual kinds share one component so the parent can map over a
// uniform `nodes[]` array: `center` (the focus), `aggregator` (virtual
// relationship hub), `entity` (actual neighbour). The hit target is
// the whole `<g>`; only `center` and `entity` are clickable, since
// aggregators are synthetic buckets with no underlying entity.

import { memo, useCallback, useEffect, useState, type KeyboardEvent } from "react";
import type { CSSProperties } from "react";

import type { EntityKind } from "@quanta/canvas-engine";

import {
  color,
  font,
  kindColor,
  kindLabel,
  radius as radiusToken,
} from "../../../shared/ui/tokens";
import type { AggregatorKind, MindMapNode as MindMapNodeModel } from "../model/types";

export interface MindMapNodeProps {
  node: MindMapNodeModel;
  /** Staggered mount delay in ms — the view computes this per ring so
   *  the centre lands first, then aggregators, then entities. */
  mountDelayMs: number;
  /** Position transition duration in ms — 0 on first mount, ~400 on
   *  re-centre so persisting nodes glide to their new coords. */
  positionTransitionMs: number;
  onFocusEntity?: (entityId: string) => void;
  onHoverChange?: (nodeId: string | null) => void;
}

// Map aggregator buckets to glyph hints. Plain unicode (no emoji fonts)
// so the renderer stays text-only and glyphs inherit theme color.
const AGGREGATOR_GLYPH: Readonly<Record<AggregatorKind, string>> = {
  "parent-dir": "↑",
  children: "↓",
  siblings: "↔",
  callers: "→",
  callees: "←",
  "external-deps": "◇",
  inheritance: "◇",
  "data-relations": "◇",
};

// Display name for aggregator categories; falls back to the raw kind.
const AGGREGATOR_LABEL: Readonly<Record<AggregatorKind, string>> = {
  "parent-dir": "PARENTS",
  children: "CHILDREN",
  siblings: "SIBLINGS",
  callers: "CALLERS",
  callees: "CALLEES",
  "external-deps": "EXTERNAL",
  inheritance: "INHERITS",
  "data-relations": "DATA",
};

function MindMapNodeImpl({
  node,
  mountDelayMs,
  positionTransitionMs,
  onFocusEntity,
  onHoverChange,
}: MindMapNodeProps) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Schedule the opacity/scale fade-in after the mountDelayMs tick.
  // Two-rAF double-buffer gives the browser a distinct "from" paint
  // (opacity 0 / scale 0.7) before we flip to the animated "to" state,
  // otherwise the CSS transition has no starting frame to interpolate.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    let timer = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        timer = window.setTimeout(() => setMounted(true), mountDelayMs);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (timer) window.clearTimeout(timer);
    };
  }, [mountDelayMs]);

  const handleHoverEnter = useCallback(() => {
    setHovered(true);
    onHoverChange?.(node.id);
  }, [node.id, onHoverChange]);

  const handleHoverLeave = useCallback(() => {
    setHovered(false);
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleActivate = useCallback(() => {
    if (node.kind !== "entity") return;
    if (node.entityId && onFocusEntity) onFocusEntity(node.entityId);
  }, [node.kind, node.entityId, onFocusEntity]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      handleActivate();
    },
    [handleActivate],
  );

  const interactive = node.kind === "center" || node.kind === "entity";
  const cursor = interactive ? "pointer" : "default";

  const groupStyle: CSSProperties = {
    // Position animation on the wrapper `<g>` — we animate the CSS
    // transform (matrix3d) rather than the SVG `transform` attribute
    // because CSS has built-in interpolation and attribute-animation
    // needs SMIL which we don't want.
    transform: `translate(${node.x}px, ${node.y}px)`,
    transition: `transform ${positionTransitionMs}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 260ms ease-out`,
    opacity: mounted ? 1 : 0,
    cursor,
    outline: "none",
  };

  // Scale on hover lives on an inner `<g>` so it composes cleanly with
  // the outer position transform (can't chain two transforms on the
  // same element without breaking SVG parse).
  const hoverScale = hovered ? (node.kind === "aggregator" ? 1.04 : 1.08) : mounted ? 1 : 0.7;
  const innerStyle: CSSProperties = {
    transform: `scale(${hoverScale})`,
    transformOrigin: "0 0",
    transition: "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1)",
  };

  return (
    <g
      style={groupStyle}
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
      onClick={handleActivate}
      onKeyDown={interactive ? handleKeyDown : undefined}
      tabIndex={node.kind === "entity" ? 0 : -1}
      role={interactive ? "button" : undefined}
      aria-label={`${node.label} (${node.kind})`}
      data-node-id={node.id}
      data-node-kind={node.kind}
    >
      <title>
        {node.label}
        {node.sublabel ? ` — ${node.sublabel}` : ""}
      </title>
      <g style={innerStyle}>
        {renderShape(node)}
      </g>
      {renderLabel(node)}
    </g>
  );
}

function renderShape(node: MindMapNodeModel) {
  if (node.kind === "center") {
    const tint = node.entityKind ? kindColor[node.entityKind] : color.accent;
    const r = node.radius;
    return (
      <g filter="url(#mindmap-glow)">
        <rect
          x={-r}
          y={-r}
          width={r * 2}
          height={r * 2}
          rx={radiusToken.lg}
          ry={radiusToken.lg}
          fill={tint}
          fillOpacity={0.14}
          stroke={tint}
          strokeWidth={2.5}
        />
      </g>
    );
  }

  if (node.kind === "aggregator") {
    // Pill: width scales with the label length; height is node.radius.
    const r = node.radius;
    const label = node.aggregatorKind ? AGGREGATOR_LABEL[node.aggregatorKind] : node.label;
    const labelChars = Math.max(label.length, 6);
    const w = Math.max(r * 2, labelChars * 6 + 28);
    const h = Math.max(r * 1.2, 22);
    const glyph = node.aggregatorKind ? AGGREGATOR_GLYPH[node.aggregatorKind] : "◇";

    return (
      <g>
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={h / 2}
          ry={h / 2}
          fill={color.bg2}
          stroke={color.borderStrong}
          strokeWidth={1.5}
        />
        <text
          x={-w / 2 + 10}
          y={0}
          textAnchor="start"
          dominantBaseline="central"
          fontFamily={font.sans}
          fontSize={font.size.sm}
          fontWeight={font.weight.semibold}
          fill={color.text1}
          style={{ userSelect: "none" }}
        >
          {glyph}
        </text>
        <text
          x={6}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={font.sans}
          fontSize={font.size.xs}
          fontWeight={font.weight.semibold}
          fill={color.text1}
          letterSpacing={font.letter.ultra * 10}
          style={{ userSelect: "none", textTransform: "uppercase" }}
        >
          {label}
        </text>
      </g>
    );
  }

  // entity — shape reflects the entity kind so file ≠ module ≠ function
  // ≠ directory at a glance. Shared ink: same tint / fill opacity /
  // stroke width across shapes so the only visual variable is silhouette.
  const tint = node.entityKind ? kindColor[node.entityKind] : color.text2;
  return renderEntityShape(node.entityKind, node.radius, tint);
}

// Per-kind silhouette. Kept as a switch (not a shape map) because the
// SVG primitives differ (circle vs polygon vs rect) — a map would force
// everyone through the widest-common-subset shape.
function renderEntityShape(
  kind: EntityKind | undefined,
  r: number,
  tint: string,
) {
  const fillOpacity = 0.15;
  const strokeWidth = 1;
  const common = { fill: tint, fillOpacity, stroke: tint, strokeWidth };

  // File: rounded square — visually rhymes with the centre node so the
  // user reads "peer files" as the same kind of thing as the focus.
  if (kind === "building") {
    return (
      <rect
        x={-r}
        y={-r}
        width={r * 2}
        height={r * 2}
        rx={radiusToken.md}
        ry={radiusToken.md}
        {...common}
      />
    );
  }

  // Module: diamond (rotated square). Sits between file (square) and
  // function (triangle) in visual weight, matching its tree depth.
  if (kind === "floor") {
    const pts = `0,${-r} ${r},0 0,${r} ${-r},0`;
    return <polygon points={pts} {...common} />;
  }

  // Function: upward triangle. Smallest silhouette on the ring — reads
  // as a "leaf" without extra labelling.
  if (kind === "room") {
    // Equilateral pointing up, centred on (0, 0). Height = r * √3.
    const h = r * Math.sqrt(3);
    const pts = `0,${-h * 0.55} ${r * 0.95},${h * 0.45} ${-r * 0.95},${h * 0.45}`;
    return <polygon points={pts} {...common} />;
  }

  // Containers (universe / galaxy / street) + unknowns: circle. Keeps
  // directories + packages from competing with files for the square
  // silhouette.
  return <circle cx={0} cy={0} r={r} {...common} />;
}

function renderLabel(node: MindMapNodeModel) {
  // Aggregators render their label inside the pill — skip the external
  // below-the-node label that the other kinds use.
  if (node.kind === "aggregator") return null;

  const below = node.radius + 14;
  const size = node.kind === "center" ? font.size.md : font.size.sm;
  const weight = node.kind === "center" ? font.weight.semibold : font.weight.regular;
  const label = node.label;
  // Width for the wrapping `<foreignObject>` — SVG `<text>` doesn't
  // ellipsis-overflow natively, so we use foreignObject for entities
  // whose names can be long. Centre gets pure `<text>` because its
  // label is usually short and the filter interacts better.
  if (node.kind === "center") {
    return (
      <g>
        <text
          x={0}
          y={below}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontFamily={font.sans}
          fontSize={size}
          fontWeight={weight}
          fill={color.text0}
          style={{ userSelect: "none" }}
        >
          {label}
        </text>
        {node.entityKind ? (
          <text
            x={0}
            y={below + size + 4}
            textAnchor="middle"
            dominantBaseline="hanging"
            fontFamily={font.sans}
            fontSize={font.size.xs}
            fontWeight={font.weight.regular}
            fill={color.text2}
            letterSpacing={font.letter.wide * 10}
            style={{ userSelect: "none", textTransform: "uppercase" }}
          >
            {kindLabel[node.entityKind]}
          </text>
        ) : null}
      </g>
    );
  }

  // entity: truncate with foreignObject + CSS ellipsis.
  const boxW = Math.max(node.radius * 4, 96);
  return (
    <foreignObject
      x={-boxW / 2}
      y={below}
      width={boxW}
      height={font.size.md * 1.5}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <div
        style={{
          textAlign: "center",
          fontFamily: font.sans,
          fontSize: size,
          fontWeight: weight,
          color: color.text1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          userSelect: "none",
        }}
      >
        {label}
      </div>
    </foreignObject>
  );
}

export const MindMapNode = memo(MindMapNodeImpl);
