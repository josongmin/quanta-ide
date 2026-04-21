// MindMapEdge — one tapered bezier ribbon between two nodes.
// --------------------------------------------------------------------
// Rendering contract: the builder gives us endpoint node positions +
// radii. We inset the endpoints inward by each node's radius so the
// curve visually docks at the node's border, not its dead centre.
// Paint is handled by the `taperedPathD` helper which returns a
// closed-fill path bracketing a variable-width cubic bezier.

import { memo } from "react";

import { taperedPathD } from "../lib/tapered-path";
import type { MindMapEdge as MindMapEdgeModel } from "../model/types";

export interface MindMapEdgeProps {
  edge: MindMapEdgeModel;
  from: { x: number; y: number; radius: number };
  to: { x: number; y: number; radius: number };
  hovered?: boolean;
}

// Tint for the trunk edges (centre → aggregator). Subtle shift toward
// the accent so the backbone reads as "hub" geometry even at a glance.
const TRUNK_FILL = "rgba(99, 120, 145, 0.55)";
// Neutral neutral for leaf spokes.
const LEAF_FILL = "rgba(160, 160, 170, 0.45)";

function MindMapEdgeImpl({ edge, from, to, hovered }: MindMapEdgeProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  // Degenerate: endpoints collapsed onto each other (shouldn't happen,
  // but the builder might emit a zero-length edge mid-transition).
  if (dist < 0.5) return null;

  const ux = dx / dist;
  const uy = dy / dist;

  // Inset endpoints so the ribbon meets the node border, not the centre.
  // `+1` nudge keeps the ribbon from visually overlapping the border.
  const insetFrom = from.radius + 1;
  const insetTo = to.radius + 1;

  // If the two nodes overlap (insets consume the whole edge), skip.
  if (insetFrom + insetTo >= dist) return null;

  const x0 = from.x + ux * insetFrom;
  const y0 = from.y + uy * insetFrom;
  const x1 = to.x - ux * insetTo;
  const y1 = to.y - uy * insetTo;

  // Half-widths because taperedPathD brackets the curve with TWO offset
  // curves — the visible ribbon width is 2 * w.
  const widthMult = hovered ? 1.2 : 1.0;
  const w0 = (edge.widthStart / 2) * widthMult;
  const w1 = (edge.widthEnd / 2) * widthMult;

  // Short edges get gentler curvature — otherwise the trunk balloons
  // awkwardly when the aggregator ring is tight.
  const curvature = dist < 80 ? 0.12 : 0.22;

  const d = taperedPathD({
    x0,
    y0,
    x1,
    y1,
    w0,
    w1,
    curvature,
    steps: 28,
  });

  if (!d) return null;

  const fill = edge.kind === "center-to-aggregator" ? TRUNK_FILL : LEAF_FILL;

  return (
    <path
      d={d}
      fill={fill}
      stroke="none"
      style={{
        transition: "fill 160ms ease-out",
        pointerEvents: "none",
      }}
      // Referencing color here keeps the import alive (e.g. future theme hooks).
      data-edge-kind={edge.kind}
      data-edge-id={edge.id}
    />
  );
}

export const MindMapEdge = memo(MindMapEdgeImpl);
