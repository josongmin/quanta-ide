// Tier model — public surface.
export type { TierSpec, TierLadder, TierEdgePolicy } from "./types";
export {
  DEFAULT_TIER_LADDER,
  resolveTierByApparentSize,
  apparentPxFor,
  scaleForApparentPx,
} from "./default-ladder";
export { rollupEdges, type TierEdge } from "./edge-rollup";
