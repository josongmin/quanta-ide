// ChordArc — one group's arc segment on the outer ring.
// --------------------------------------------------------------------
// Renders as a thick stroked arc at `innerRadius + gap`, with a label
// placed along the arc's angular midpoint. The arc is interactive
// (hover highlights all leaves under it). Colour is the group's
// hashed-hue palette colour, kept consistent with the leaves below it.

import { memo, useCallback } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { ChordGroup } from "../model/types";

export interface ChordArcProps {
  group: ChordGroup;
  innerRadius: number;
  /** True when this arc is the hovered one — tints slightly darker. */
  hovered: boolean;
  /** True when another arc is hovered — dim this one so the hovered
   *  arc's neighbourhood stands out. */
  dimmed: boolean;
  onHoverChange?: (groupId: string | null) => void;
}

/** Radial offset of the arc ring from the leaf ring — enough to clear
 *  the dot markers without pushing the arc into the label band. */
const ARC_OFFSET = 14;
/** Stroke width of the arc. */
const ARC_STROKE = 10;
/** Radial offset of the group label from the arc. */
const LABEL_OFFSET = 32;

function ChordArcImpl({ group, innerRadius, hovered, dimmed, onHoverChange }: ChordArcProps) {
  const arcRadius = innerRadius + ARC_OFFSET;
  const midAngle = (group.startAngle + group.endAngle) / 2;

  const onEnter = useCallback(() => {
    onHoverChange?.(group.id);
  }, [group.id, onHoverChange]);
  const onLeave = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  const d = describeArc(arcRadius, group.startAngle, group.endAngle);
  // Label — tangent to the arc at its midpoint. Rotate so the text
  // reads outward (baseline along the circumference). Flip on the left
  // half so text isn't upside-down.
  const labelX = Math.cos(midAngle) * (innerRadius + LABEL_OFFSET + ARC_OFFSET);
  const labelY = Math.sin(midAngle) * (innerRadius + LABEL_OFFSET + ARC_OFFSET);
  const leftHalf = Math.cos(midAngle) < 0;
  const labelRotationDeg = (midAngle * 180) / Math.PI + (leftHalf ? 180 : 0);

  const opacity = dimmed ? 0.35 : 1;
  const strokeOpacity = hovered ? 1 : 0.88;

  return (
    <g
      data-group-id={group.id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ cursor: "pointer", opacity, transition: "opacity 120ms ease-out" }}
    >
      <title>
        {group.label} — {group.leafIds.length} file{group.leafIds.length === 1 ? "" : "s"}
      </title>
      <path
        d={d}
        stroke={group.color}
        strokeWidth={hovered ? ARC_STROKE + 2 : ARC_STROKE}
        strokeOpacity={strokeOpacity}
        fill="none"
        strokeLinecap="butt"
      />
      <text
        x={labelX}
        y={labelY}
        transform={`rotate(${labelRotationDeg}, ${labelX}, ${labelY})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily={font.sans}
        fontSize={font.size.sm}
        fontWeight={hovered ? font.weight.semibold : font.weight.medium}
        fill={hovered ? tokenColor.text0 : tokenColor.text1}
        letterSpacing={font.letter.wide * 10}
        style={{ userSelect: "none", pointerEvents: "none", textTransform: "uppercase" }}
      >
        {group.label}
      </text>
    </g>
  );
}

/** Describe an SVG arc path between two angles at `r`. Uses the
 *  larger-arc and sweep flags derived from the angular span. Arc
 *  commands are always-positive sweep because our angles increase. */
function describeArc(r: number, startAngle: number, endAngle: number): string {
  const sx = Math.cos(startAngle) * r;
  const sy = Math.sin(startAngle) * r;
  const ex = Math.cos(endAngle) * r;
  const ey = Math.sin(endAngle) * r;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const sweep = 1;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweep} ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

export const ChordArc = memo(ChordArcImpl);
