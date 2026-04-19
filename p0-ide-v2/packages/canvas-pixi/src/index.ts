export { PixiStage } from "./stage/PixiStage";
export type { PixiStageProps, ActionTerrainProps } from "./stage/PixiStage";
export type { IsoTerrainBar } from "./renderers/iso/IsoTerrainRenderer";
export type { IsoConeInput, IsoConeRing } from "./renderers/iso/IsoConeRenderer";
export type { IsoConfig } from "./renderers/iso/iso-projection";
export { getPixiDebugHook } from "./debug/pixi-debug-hook";
export type { PixiDebugHook } from "./debug/pixi-debug-hook";
// Design-token palettes — consumed by HUD legends that preview edge style
// (KIND_STYLE keyed by EdgeKind, LAYER_STYLE keyed by EdgeLayer). Kept as
// read-only records so HUD can't mutate the renderer palette.
export { KIND_STYLE, LAYER_STYLE, DESIGN_TOKENS, ROI_COLD, ROI_WARM, ROI_HOT } from "./renderers/shared/colors";
export { DEFAULT_ISO_CONFIG } from "./renderers/iso/iso-projection";

// Per-phase timing snapshot for EdgeStaticRenderer. Imported by the
// workspace perf recorder (app-ide) so each frame sample can attribute
// CPU time to {bundling / main loop / diff-removed / mesh commit}
// phases. Read-only snapshot — each `redraw()` overwrites the fields.
export { getEdgeStaticPerfStats } from "./renderers/EdgeStaticRenderer";
export type { EdgeStaticPerfStats } from "./renderers/EdgeStaticRenderer";
