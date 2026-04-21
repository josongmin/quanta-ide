// ChordLeaf — one file on the ring.
// --------------------------------------------------------------------
// A small dot marker on the circumference plus a radial label pointing
// outward. The hit target is a generous invisible circle around the
// dot so 10-px dots are still easy to land on. Labels flip on the left
// half so text never reads upside down.

import { memo, useCallback, type KeyboardEvent } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { ChordLeaf as ChordLeafModel } from "../model/types";

export type ChordLeafState = "default" | "highlight" | "dimmed";

export interface ChordLeafProps {
  leaf: ChordLeafModel;
  innerRadius: number;
  /** Tint — defaults to the leaf's group colour so a dot inherits the
   *  arc's identity at a glance. */
  color: string;
  state: ChordLeafState;
  onHoverChange?: (leafId: string | null) => void;
  onFocus?: (leafId: string) => void;
}

const DOT_RADIUS = 4;
const DOT_RADIUS_HOVER = 6;
const HIT_RADIUS = 14;
const LABEL_OFFSET = 8;

function ChordLeafImpl({
  leaf,
  innerRadius,
  color,
  state,
  onHoverChange,
  onFocus,
}: ChordLeafProps) {
  const onEnter = useCallback(() => onHoverChange?.(leaf.id), [leaf.id, onHoverChange]);
  const onLeave = useCallback(() => onHoverChange?.(null), [onHoverChange]);
  const onClick = useCallback(() => onFocus?.(leaf.id), [leaf.id, onFocus]);
  const onKey = useCallback(
    (e: KeyboardEvent<SVGGElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      onFocus?.(leaf.id);
    },
    [leaf.id, onFocus],
  );

  const highlighted = state === "highlight";
  const dimmed = state === "dimmed";
  const opacity = dimmed ? 0.25 : 1;

  // Label — radially outside the dot, rotated tangent to the circle so
  // it reads outward. Flip on the left half.
  const labelRadius = innerRadius + LABEL_OFFSET;
  const labelX = Math.cos(leaf.angle) * labelRadius;
  const labelY = Math.sin(leaf.angle) * labelRadius;
  const leftHalf = Math.cos(leaf.angle) < 0;
  const rotationDeg = (leaf.angle * 180) / Math.PI + (leftHalf ? 180 : 0);
  const textAnchor = leftHalf ? "end" : "start";

  return (
    <g
      data-leaf-id={leaf.id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      onKeyDown={onKey}
      tabIndex={0}
      role="button"
      aria-label={leaf.label}
      style={{
        cursor: "pointer",
        opacity,
        transition: "opacity 120ms ease-out",
        outline: "none",
      }}
    >
      <title>{leaf.label}</title>
      {/* Invisible larger hit target — the visible dot is tiny. */}
      <circle cx={leaf.x} cy={leaf.y} r={HIT_RADIUS} fill="transparent" />
      <circle
        cx={leaf.x}
        cy={leaf.y}
        r={highlighted ? DOT_RADIUS_HOVER : DOT_RADIUS}
        fill={color}
        stroke={highlighted ? tokenColor.text0 : "none"}
        strokeWidth={highlighted ? 1.5 : 0}
        style={{
          transition: "r 120ms ease-out, stroke-width 120ms ease-out",
          pointerEvents: "none",
        }}
      />
      <text
        x={labelX}
        y={labelY}
        transform={`rotate(${rotationDeg}, ${labelX}, ${labelY})`}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fontFamily={font.sans}
        fontSize={font.size.xs}
        fontWeight={highlighted ? font.weight.semibold : font.weight.regular}
        fill={highlighted ? tokenColor.text0 : tokenColor.text1}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {leaf.label}
      </text>
    </g>
  );
}

export const ChordLeaf = memo(ChordLeafImpl);
