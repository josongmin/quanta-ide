// Canonical renderer-side file-card dimensions. Logically these belong to
// the renderer — they describe how much room each card needs for a header
// stripe + function-block stack to be readable. Layout code in
// canvas-engine consumes them too, but *only* as opt-like constants passed
// into a fixed-size packer; the engine treats them as minimums it must
// respect. We therefore keep the canonical pair here and mirror the same
// numeric values in `canvas-engine/src/layout/types.ts` (explicitly
// commented there as "mirror of canvas-pixi") — this inversion (renderer as
// source of truth, engine as mirror) keeps the engine package free of
// renderer imports while making the "who owns this" question unambiguous.

// 560 × 720 world-px — sized so at city-LOD scale (~0.18–0.35) the card
// comfortably holds a 11px header + four 9px function rows. Any change
// needs to be mirrored in `canvas-engine/src/layout/types.ts`.
export const FILE_CARD_W = 560;
export const FILE_CARD_H = 720;
