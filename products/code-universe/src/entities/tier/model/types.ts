// Engine type re-exports. See entities/entity/model/types.ts for the
// rationale — product slice boundary keeps engine imports isolated.
export type {
  TierSpec,
  TierLadder,
  TierEdgePolicy,
  TierEdge,
} from "@quanta/canvas-engine";
export {
  DEFAULT_TIER_LADDER,
  resolveTierByApparentSize,
  apparentPxFor,
  scaleForApparentPx,
  rollupEdges,
} from "@quanta/canvas-engine";
