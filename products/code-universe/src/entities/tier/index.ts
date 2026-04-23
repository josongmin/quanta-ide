export type {
  TierSpec,
  TierLadder,
  TierEdgePolicy,
  TierEdge,
} from "./model/types";
export {
  DEFAULT_TIER_LADDER,
  resolveTierByApparentSize,
  apparentPxFor,
  scaleForApparentPx,
  rollupEdges,
} from "./model/types";
export {
  tierStore,
  useTierState,
  type TierState,
} from "./model/store";
