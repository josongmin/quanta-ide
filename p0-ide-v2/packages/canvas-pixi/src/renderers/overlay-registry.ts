import type { Container } from "pixi.js";
import type {
  WorkspaceView,
  WorkspaceLayout,
  ViewState,
  Viewport,
  LodLevel,
  EdgeGeometryCache,
  EdgeKind,
  EdgeLayer,
  EdgeSeverity,
  FileEdge,
  Trace,
  ClusterEdge,
  FileEffects,
} from "@quanta/canvas-engine";
import { EdgeStaticRenderer } from "./EdgeStaticRenderer";
import { EdgeOverlayRenderer } from "./EdgeOverlayRenderer";
import { TraceEdgeRenderer } from "./TraceEdgeRenderer";
import { ClusterEdgeRenderer } from "./ClusterEdgeRenderer";
import { SCCBubbleRenderer } from "./SCCBubbleRenderer";
import { StartHereBadgeRenderer } from "./StartHereBadgeRenderer";
import { PresenceRingRenderer, type AgentPresenceInput } from "./PresenceRingRenderer";
import { EffectBadgeRenderer } from "./EffectBadgeRenderer";
import { IsoTerrainRenderer, type IsoTerrainBar } from "./iso/IsoTerrainRenderer";
import { IsoConeRenderer, type IsoConeInput } from "./iso/IsoConeRenderer";
import type { IsoConfig } from "./iso/iso-projection";

// Overlay registry.
// -------------------------------------------------------------------
// Where tier renderers (galaxy / city / cluster / supercluster) plug into
// `renderer-registry.ts`, overlays are cross-cutting passes that layer
// on top of whatever tier is active: static edges, hover overlay, SCC
// bubbles, start-here badges, presence rings, cluster super-edges, trace
// edges. Before this registry, PixiStage owned concrete refs for every
// overlay and had seven near-identical `useEffect` blocks wiring them.
//
// Uniform contract (`OverlayHandle`):
//   - `update(ctx)` — idempotent paint of the current state.
//   - `clear()`     — blank out (used when gate is off or tier changes).
//   - `destroy()`   — release Pixi objects.
//
// Each overlay interprets a single `OverlayRenderCtx` shape; fields it
// doesn't consume are ignored. `PixiStage` resolves handles by id and
// loops — adding a new overlay means adding a factory here, not new
// state in the stage.

export type OverlayId =
  | "edgeStatic"
  | "edgeOverlay"
  | "clusterEdge"
  | "sccBubble"
  | "startHereBadge"
  | "presenceRing"
  | "traceEdge"
  | "effectBadge"
  | "isoTerrain"
  | "isoCone";

export interface OverlayRenderCtx {
  visible: WorkspaceView;
  layout: WorkspaceLayout;
  viewport: Viewport;
  viewState: ViewState;
  lod: LodLevel;
  edgeCache?: EdgeGeometryCache;
  /** Per-file loc lookup. Built once per visible.files change. */
  fileLookup: Map<string, { loc: number }>;

  // Edge-render gates (applied by PixiStage before dispatch; overlays
  // still need individual fields for their own per-edge filter pass).
  showEdges: boolean;
  edgeKinds?: Partial<Record<EdgeKind, boolean>>;
  edgeLayers?: Partial<Record<EdgeLayer, boolean>>;
  edgeMinSeverity?: EdgeSeverity;
  edgeWidthMul?: number;
  edgeFocus?: { edgeIds: ReadonlySet<string>; dimAlpha: number };
  edgePredicate?: (edge: FileEdge) => boolean;
  edgeViolations?: ReadonlySet<string>;
  temporalEdgeSet?: ReadonlySet<string>;
  diffAdded?: ReadonlySet<string>;
  diffRemoved?: ReadonlySet<string>;
  showCrossGraphEdges?: boolean;
  highlightCrossGraph?: boolean;
  crossGraphFlash?: ReadonlySet<string>;
  /** Hierarchical Edge Bundling sampled polylines (edgeId → flat
   *  [x0, y0, x1, y1, ...] Float32Array). Only consumed by
   *  EdgeStaticRenderer at galaxy LOD when the feature flag is on. */
  hebPaths?: Map<string, Float32Array>;

  // Cluster / bubble / badge gates.
  clusterEdgesToRender: readonly ClusterEdge[] | null;
  sccBubblesAllowed: boolean;
  startHereAllowed: boolean;
  startHereTopN: number;

  // Trace.
  activeTrace: Trace | null;

  // Presence.
  agentPresence?: readonly AgentPresenceInput[];
  showAgentPresence: boolean;

  // Per-file side-effect chips.
  effects?: Record<string, FileEffects>;
  showEffectBadges: boolean;

  // Action-terrain iso overlay.
  actionTerrainEnabled?: boolean;
  actionTerrainBars?: readonly IsoTerrainBar[];
  actionTerrainCone?: IsoConeInput | null;
  actionTerrainIsoConfig?: IsoConfig;
}

export interface OverlayHandle {
  update(ctx: OverlayRenderCtx): void;
  clear(): void;
  destroy(): void;
}

export type OverlayFactory = (world: Container) => OverlayHandle;

// Registry is populated by side-effect below. `PixiStage` pulls the map
// once per cold-init and creates a handle per entry.
export const OVERLAY_REGISTRY: Map<OverlayId, OverlayFactory> = new Map();

function register(id: OverlayId, factory: OverlayFactory): void {
  if (OVERLAY_REGISTRY.has(id)) {
    throw new Error(`[canvas-pixi] overlay "${id}" already registered`);
  }
  OVERLAY_REGISTRY.set(id, factory);
}

// --- Factories ------------------------------------------------------

register("edgeStatic", (world) => {
  const r = new EdgeStaticRenderer(world);
  // LODs where edges are never drawn. Mirrors EDGE_SKIP_LODS inside the
  // renderer — we short-circuit here too so coarse-tier frames skip the
  // build() work entirely (no array copy of ctx.visible.edges, no
  // opts-object allocation). The renderer still owns the final authority
  // (it also applies hysteresis), but this dispatch-side gate keeps the
  // hot path cheap when we're definitely above the edge-draw regime.
  const EDGE_SKIP_LODS: ReadonlySet<string> = new Set(["supergalaxy", "universe"]);
  // EdgeStaticRenderer has no public `clear()` — the next `update` call
  // with `showEdges=false` or empty `visible.edges` naturally blanks the
  // shared Graphics via its internal `redraw()`. A standalone clear() is
  // effectively a no-op because the renderer re-submits whenever the
  // scene changes.
  return {
    update(ctx) {
      // Early dispatch-side LOD gate. Renderer.build() with an empty
      // edge list would still run its redraw bookkeeping — giving it
      // the same signal via a direct build([], …) call lets its
      // internal skip path (gfx.clear + bail) fire without allocating
      // a visible-edges snapshot. The renderer's own hysteresis runs
      // against opts.lod, so we preserve lod in both branches.
      if (!ctx.showEdges || EDGE_SKIP_LODS.has(ctx.lod)) {
        r.build([], ctx.layout, ctx.edgeCache, ctx.viewport, {
          lod: ctx.lod,
          fileById: ctx.fileLookup,
        });
        return;
      }
      r.build(ctx.visible.edges, ctx.layout, ctx.edgeCache, ctx.viewport, {
        kindFilter: ctx.edgeKinds,
        layerFilter: ctx.edgeLayers as Record<EdgeLayer, boolean> | undefined,
        minSeverity: ctx.edgeMinSeverity,
        widthMul: ctx.edgeWidthMul,
        focus: ctx.edgeFocus,
        lod: ctx.lod,
        fileById: ctx.fileLookup,
        customPredicate: ctx.edgePredicate,
        violatingEdgeIds: ctx.edgeViolations,
        temporalEdgeSet: ctx.temporalEdgeSet,
        diffAdded: ctx.diffAdded,
        diffRemoved: ctx.diffRemoved,
        showCrossGraphEdges: ctx.showCrossGraphEdges,
        highlightCrossGraph: ctx.highlightCrossGraph,
        crossGraphFlash: ctx.crossGraphFlash,
        hebPaths: ctx.hebPaths,
      });
    },
    clear() { /* handled by next update */ },
    destroy() { r.destroy(); },
  };
});

register("edgeOverlay", (world) => {
  const r = new EdgeOverlayRenderer(world);
  // Same as edgeStatic — overlay rerenders on every viewState change and
  // no-ops when nothing is hovered/selected, so we don't need an explicit
  // clear path.
  return {
    update(ctx) {
      r.update(ctx.viewState, ctx.layout, ctx.edgeCache);
    },
    clear() { /* handled by next update */ },
    destroy() { r.destroy(); },
  };
});

register("clusterEdge", (world) => {
  const r = new ClusterEdgeRenderer(world);
  return {
    update(ctx) {
      const edges = ctx.clusterEdgesToRender;
      if (edges && edges.length > 0) r.update(edges, ctx.viewport);
      else r.clear();
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("sccBubble", (world) => {
  const r = new SCCBubbleRenderer(world);
  return {
    update(ctx) {
      if (ctx.sccBubblesAllowed && ctx.layout.sccs && ctx.layout.sccs.length > 0) {
        r.build(ctx.layout.sccs, ctx.layout.fileRects, ctx.viewport);
      } else {
        r.clear();
      }
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("startHereBadge", (world) => {
  const r = new StartHereBadgeRenderer(world);
  return {
    update(ctx) {
      if (ctx.startHereAllowed && ctx.layout.startHere && ctx.layout.startHere.length > 0) {
        r.build(ctx.layout.startHere, ctx.layout.fileRects, ctx.lod, ctx.startHereTopN, ctx.viewport);
      } else {
        r.clear();
      }
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("presenceRing", (world) => {
  const r = new PresenceRingRenderer(world);
  return {
    update(ctx) {
      if (ctx.showAgentPresence && ctx.agentPresence && ctx.agentPresence.length > 0) {
        r.build(ctx.agentPresence, ctx.layout.fileRects, ctx.lod, ctx.viewport);
      } else {
        r.clear();
      }
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("traceEdge", (world) => {
  const r = new TraceEdgeRenderer(world);
  return {
    update(ctx) {
      if (ctx.activeTrace && ctx.activeTrace.edges.length > 0) {
        r.build(ctx.activeTrace.edges, ctx.layout, ctx.viewport, {
          fileRects: ctx.layout.fileRects,
          fileById: ctx.fileLookup,
        });
      } else {
        r.clear();
      }
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("effectBadge", (world) => {
  const r = new EffectBadgeRenderer(world);
  return {
    update(ctx) {
      if (ctx.showEffectBadges && ctx.effects) {
        r.build(ctx.visible.files, ctx.effects, ctx.layout, ctx.viewport, ctx.lod);
      } else {
        r.clear();
      }
    },
    clear() { r.clear(); },
    destroy() { r.destroy(); },
  };
});

register("isoTerrain", (world) => {
  const r = new IsoTerrainRenderer(world);
  // Cache last inputs so viewport-only ticks (which re-fire the overlay
  // dispatch) don't trigger a 5k-bar rebuild when nothing iso-relevant
  // changed. Works because the hook's `bars` memo is reference-stable.
  let lastBars: readonly IsoTerrainBar[] | undefined;
  let lastCfg: IsoConfig | undefined;
  let lastEnabled = false;
  return {
    update(ctx) {
      const enabled = !!ctx.actionTerrainEnabled;
      const bars = ctx.actionTerrainBars;
      const cfg = ctx.actionTerrainIsoConfig;
      if (enabled === lastEnabled && bars === lastBars && cfg === lastCfg) return;
      lastEnabled = enabled;
      lastBars = bars;
      lastCfg = cfg;
      if (enabled && bars && bars.length > 0) r.build(bars, cfg);
      else r.clear();
    },
    clear() {
      r.clear();
      lastBars = undefined;
      lastCfg = undefined;
      lastEnabled = false;
    },
    destroy() { r.destroy(); },
  };
});

register("isoCone", (world) => {
  const r = new IsoConeRenderer(world);
  let lastCone: IsoConeInput | null | undefined;
  let lastCfg: IsoConfig | undefined;
  let lastEnabled = false;
  return {
    update(ctx) {
      const enabled = !!ctx.actionTerrainEnabled;
      const cone = ctx.actionTerrainCone ?? null;
      const cfg = ctx.actionTerrainIsoConfig;
      if (enabled === lastEnabled && cone === lastCone && cfg === lastCfg) return;
      lastEnabled = enabled;
      lastCone = cone;
      lastCfg = cfg;
      if (enabled && cone) r.build(cone, cfg);
      else r.clear();
    },
    clear() {
      r.clear();
      lastCone = undefined;
      lastCfg = undefined;
      lastEnabled = false;
    },
    destroy() { r.destroy(); },
  };
});

// --- RendererStack ---------------------------------------------------

/**
 * Owns a map of overlay id → handle for one Pixi world container.
 * Created once per bundle; drives `update(ctx)` / `clear()` / `destroy()`
 * across every registered overlay in a single call.
 */
export class RendererStack {
  private handles = new Map<OverlayId, OverlayHandle>();

  constructor(world: Container) {
    for (const [id, factory] of OVERLAY_REGISTRY) {
      this.handles.set(id, factory(world));
    }
  }

  update(ctx: OverlayRenderCtx): void {
    for (const h of this.handles.values()) h.update(ctx);
  }

  clear(): void {
    for (const h of this.handles.values()) h.clear();
  }

  destroy(): void {
    for (const h of this.handles.values()) {
      try { h.destroy(); } catch (e) { console.warn("[canvas-pixi] overlay destroy failed", e); }
    }
    this.handles.clear();
  }
}
