// LOD-tier renderer registry.
//
// Why: the LOD ladder lives in `canvas-engine/lod-config.ts` as a data-only
// list of tiers (each with a `rendererKind` string). Without a registry, the
// PixiStage had to carry a switch/if that mapped each `LodRendererKind` →
// concrete class. Adding a tier then needs edits in *two* places (config +
// stage), which is exactly the OCP smell the audit flagged.
//
// With this registry, each node renderer self-registers (via its module
// being imported — see `./index.ts` barrel) a `RendererFactory` keyed by
// `LodRendererKind`. PixiStage resolves a handle and calls a uniform
// `update(ctx)` / `clear()` / `destroy()` lifecycle — the handle itself
// dispatches based on the context's `sceneKind`.
//
// Tiers that render purely through the DOM layer (street, ground) register
// nothing — PixiStage treats "no registered factory" as "nothing to do at
// this tier" and only clears the other handles.

import type { Container } from "pixi.js";
import type {
  FileNode,
  WorkspaceLayout,
  WorkspaceMetrics,
  ViewState,
  Viewport,
  ClusterMeta,
  LodRendererKind,
  FileLatency,
} from "@quanta/canvas-engine";

// Handlers surfaced upward from the renderers to PixiStage's onClick/onHover
// props. Kept narrow — renderers that don't fire an event (e.g. galaxy has
// no click-through at the lowest-detail tier) simply omit the handler.
export interface RendererCallbacks {
  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
  onClusterClick?: (clusterId: string) => void;
  onSuperclusterClick?: (superclusterId: string) => void;
}

// Tagged-union context — one shape per scene-kind declared in lod-config.
// Renderers pattern-match on `ctx.sceneKind` to pull the fields they need.
// This mirrors how `buildSceneQuery` dispatches inside canvas-engine so the
// mental model stays symmetrical across packages.
export type RenderContext =
  | {
      sceneKind: "files";
      files: FileNode[];
      layout: WorkspaceLayout;
      viewState: ViewState;
      viewport: Viewport;
      /**
       * Optional per-file centrality metrics. When present the galaxy tier
       * uses `metrics.perFile.get(id).degree` to scale hub dots. Absent on
       * graphs where `layout.metrics` was skipped (computeMetrics:false).
       * Derived from layout but passed separately so renderers don't have
       * to introspect layout.metrics inside their hot path.
       */
      metrics?: WorkspaceMetrics;
      /**
       * CodeCity-inspired fake 3D: when true, renderers map risk score to
       * apparent elevation (drop shadow, darker trailing border, subtle
       * scale). Defaults to false — galaxy leaves it off for perf.
       */
      elevationMode?: boolean;
      /**
       * Per-file latency readings (p50/p95/p99). Present iff the graph
       * shipped with `WorkspaceGraph.latency`. City/Galaxy renderers use
       * this only when `showLatencyOverlay === true`.
       */
      latency?: Record<string, FileLatency>;
      /**
       * Cost-overlay toggle: when true, file card fills are tinted toward
       * their p95 latency colour. Off by default — the overlay overrides
       * the usual risk colouring so it's opt-in from the HUD.
       */
      showLatencyOverlay?: boolean;
    }
  | {
      sceneKind: "clusters";
      clusters: ClusterMeta[];
      viewport: Viewport;
    }
  | {
      sceneKind: "superclusters";
      superclusters: ClusterMeta[];
      viewport: Viewport;
    };

// Uniform lifecycle exposed to PixiStage. Every tier renderer adapts its
// private `update(...)` signature behind this interface — the adapter lives
// inside the factory so renderer classes keep their current call shapes
// (partial-update fast paths in Galaxy etc. remain private).
export interface RendererHandle {
  update(ctx: RenderContext): void;
  clear(): void;
  destroy(): void;
}

// Factory produces a `RendererHandle` for a given kind. Takes the parent
// Pixi `world` container and the callback bag; returns the handle.
export type RendererFactory = (
  parent: Container,
  callbacks: RendererCallbacks,
) => RendererHandle;

// Module-scoped singleton. Renderer modules register into this map at
// import time; PixiStage reads it once per init. Kept `Map` (not plain
// object) for better lifetime/iteration ergonomics.
export const RENDERER_REGISTRY: Map<LodRendererKind, RendererFactory> = new Map();

export function registerRenderer(kind: LodRendererKind, factory: RendererFactory): void {
  // Second registration is a bug in test-reload flow or duplicated barrels
  // — silently overwriting would hide it; throwing makes it visible.
  if (RENDERER_REGISTRY.has(kind)) {
    throw new Error(`[canvas-pixi] renderer kind "${kind}" already registered`);
  }
  RENDERER_REGISTRY.set(kind, factory);
}
