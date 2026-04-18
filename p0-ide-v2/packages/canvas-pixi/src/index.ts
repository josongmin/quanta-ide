export { PixiStage } from "./stage/PixiStage";
export type { PixiStageProps } from "./stage/PixiStage";
export { getPixiDebugHook } from "./debug/pixi-debug-hook";
export type { PixiDebugHook } from "./debug/pixi-debug-hook";
// Design-token palettes — consumed by HUD legends that preview edge style
// (KIND_STYLE keyed by EdgeKind, LAYER_STYLE keyed by EdgeLayer). Kept as
// read-only records so HUD can't mutate the renderer palette.
export { KIND_STYLE, LAYER_STYLE, DESIGN_TOKENS } from "./renderers/shared/colors";
