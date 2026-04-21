// ChordEdge — one bundled dependency path between two leaves.
// --------------------------------------------------------------------
// Thin stroked curve; colour + alpha drive its state:
//   default:   neutral grey, low alpha — ambient density signal.
//   outbound:  accent blue, high alpha — "this is where `hoverLeaf`
//              reaches to".
//   inbound:   success green, high alpha — "this reaches into
//              `hoverLeaf`".
//   dimmed:    near-invisible — stays in the scene so the ring's
//              overall shape reads but yields stage to the incident
//              edges.

import { memo, useMemo } from "react";
import { color as tokenColor } from "../../../shared/ui/tokens";
import { bundlePathD } from "../lib/edge-bundling";
import type { ChordEdge as ChordEdgeModel, ChordLeaf } from "../model/types";

export type ChordEdgeState = "default" | "outbound" | "inbound" | "dimmed";

export interface ChordEdgeProps {
  edge: ChordEdgeModel;
  fromLeaf: ChordLeaf;
  toLeaf: ChordLeaf;
  /** Bundling strength — parent usually pins at 0.85, but animating
   *  this during mount produces the classic "bundle-in" reveal. */
  beta: number;
  state: ChordEdgeState;
}

const ALPHA = {
  default: 0.22,
  outbound: 0.85,
  inbound: 0.85,
  dimmed: 0.08,
} as const;

const STROKE_WIDTH = {
  default: 1,
  outbound: 1.75,
  inbound: 1.75,
  dimmed: 0.75,
} as const;

function ChordEdgeImpl({ edge, fromLeaf, toLeaf, beta, state }: ChordEdgeProps) {
  const d = useMemo(
    () => bundlePathD({ fromPath: fromLeaf.pathFromRoot, toPath: toLeaf.pathFromRoot, beta }),
    [fromLeaf.pathFromRoot, toLeaf.pathFromRoot, beta],
  );
  if (!d) return null;

  let stroke: string = tokenColor.text2;
  if (state === "outbound") stroke = tokenColor.accent;
  else if (state === "inbound") stroke = tokenColor.success;

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeOpacity={ALPHA[state]}
      strokeWidth={STROKE_WIDTH[state]}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pointerEvents: "none" }}
      data-edge-id={edge.id}
    />
  );
}

export const ChordEdge = memo(ChordEdgeImpl);
