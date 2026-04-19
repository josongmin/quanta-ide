// Side-effect barrel — importing this file triggers every node renderer's
// `registerRenderer(...)` call via module evaluation. `PixiStage` imports
// the barrel once; after that the `RENDERER_REGISTRY` is populated and
// any tier can be resolved by `LodRendererKind` alone.
//
// Order is not significant — the registry throws on duplicate keys, which
// surfaces accidental double-imports rather than quietly re-running.

import "./GalaxyNodeRenderer";
import "./CityNodeRenderer";
import "./ClusterNodeRenderer";
import "./SuperclusterNodeRenderer";

export { RENDERER_REGISTRY } from "./shared/renderer-registry";
export type {
  RendererHandle,
  RendererFactory,
  RendererCallbacks,
  RenderContext,
} from "./shared/renderer-registry";
