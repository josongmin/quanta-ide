import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Container } from "pixi.js";
import type {
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
  WorkspaceLayout,
  ViewState,
  Viewport,
  LodLevel,
  LodRendererKind,
  EdgeGeometryCache,
  EdgeKind,
  EdgeLayer,
  EdgeSeverity,
  FileEdge,
  Trace,
  FileEffects,
  FileLatency,
} from "@quanta/canvas-engine";
import { resolveEffectiveTier, getTierConfig, resolveLayerPolicy } from "@quanta/canvas-engine";
import { RENDERER_REGISTRY, type RendererHandle, type RenderContext } from "../renderers";
import { installCityFonts } from "../renderers/shared/BitmapFontAtlas";
import type { AgentPresenceInput } from "../renderers/PresenceRingRenderer";
import { RendererStack, type OverlayRenderCtx } from "../renderers/overlay-registry";

// PixiStage
// -------------------------------------------------------------------
// Thin orchestrator over (a) a tier-renderer registry and (b) an
// overlay-renderer stack. The stage owns lifecycle (Pixi App init,
// StrictMode-safe cache, context loss / restore, resize, visibility
// ticker pause) and dispatches scene updates to the two registries;
// the per-overlay wiring lives in `overlay-registry.ts`.

// Module-level cache keyed by canvas element. In React StrictMode (dev),
// effects run twice (mount → unmount → mount). Without this cache, two
// concurrent app.init() calls race on the same canvas, producing conflicting
// WebGL contexts that leak (browsers cap ~16 contexts → page crash).
interface PixiBundle {
  app: Application;
  world: Container;
  nodeHandles: Map<LodRendererKind, RendererHandle>;
  overlays: RendererStack;
}
const pixiByCanvas = new WeakMap<HTMLCanvasElement, PixiBundle>();
const initInFlight = new WeakMap<HTMLCanvasElement, Promise<PixiBundle>>();

// Grace window before an unmount-triggered destroy actually fires. StrictMode's
// mount → unmount → mount cycle and Fast Refresh both can unmount/remount
// within a few ms; we wait long enough for a remount to cancel the destroy,
// but short enough that a real tab-away still reclaims WebGL contexts.
const UNMOUNT_DESTROY_DELAY_MS = 50;

// Grouped prop bags. Each sub-shape carries a single concern so the
// parent's `<PixiStage ...>` call site groups related fields together
// — and so new overlay params land on the overlay bag, not the flat
// 40-arg signature the audit flagged.

export interface EdgeRenderProps {
  showEdges?: boolean;
  edgeKinds?: Partial<Record<EdgeKind, boolean>>;
  edgeLayers?: Partial<Record<EdgeLayer, boolean>>;
  edgeMinSeverity?: EdgeSeverity;
  edgeWidthMul?: number;
  /**
   * Focus-mode dimming: edges NOT in `edgeIds` render at base alpha *
   * `dimAlpha`. Undefined → no dimming (normal render).
   */
  edgeFocus?: { edgeIds: ReadonlySet<string>; dimAlpha: number };
  /** Live filter DSL predicate — edges failing it are skipped entirely. */
  edgePredicate?: (edge: FileEdge) => boolean;
  /** Arch-violating edge ids — rendered with a red halo pass. */
  edgeViolations?: ReadonlySet<string>;
}

export interface OverlayProps {
  showClusterEdges?: boolean;
  showSccBubbles?: boolean;
  showStartHereBadges?: boolean;
  startHereTopN?: number;
  /** Multi-graph: when false, `crossGraph===true` edges are not drawn. */
  showCrossGraphEdges?: boolean;
  /** Multi-graph: cross-graph edges to flash (HUD "graph sources" click). */
  crossGraphFlash?: ReadonlySet<string>;
}

export interface TemporalProps {
  temporalEdgeSet?: ReadonlySet<string>;
  diffAdded?: ReadonlySet<string>;
  diffRemoved?: ReadonlySet<string>;
}

export interface TraceProps {
  activeTrace?: Trace | null;
  /** `from→to` keys of the active-trace edges — drives static-edge dim. */
  traceEdgeSet?: ReadonlySet<string>;
}

export interface PresenceProps {
  agentPresence?: readonly AgentPresenceInput[];
  showAgentPresence?: boolean;
}

export interface SceneProps {
  visible: WorkspaceView;
  /** Populated only at supergalaxy LOD. One box per cluster. */
  clusters?: WorkspaceClusterView | null;
  /** Populated only at universe LOD. One box per supercluster. */
  superclusters?: WorkspaceSuperclusterView | null;
  layout: WorkspaceLayout;
  viewState: ViewState;
  viewport: Viewport;
  lod: LodLevel;
  edgeCache?: EdgeGeometryCache;
}

export interface PixiStageProps {
  scene: SceneProps;
  edgeRender: EdgeRenderProps;
  overlays: OverlayProps;
  temporal: TemporalProps;
  trace: TraceProps;
  presence: PresenceProps;

  /** Master toggle for multi-graph gold cross-overlay. */
  highlightCrossGraph?: boolean;
  elevationMode?: boolean;
  /** Per-file side-effect annotations — drives EffectBadgeRenderer. */
  effects?: Record<string, FileEffects>;
  /** Per-file latency — drives cost tint on city+galaxy. */
  latency?: Record<string, FileLatency>;
  showEffectBadges?: boolean;
  showLatencyOverlay?: boolean;

  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
  onClusterClick?: (clusterId: string) => void;
  onSuperclusterClick?: (superclusterId: string) => void;
  /** Parent surfaces a fallback UI instead of the renderer silently logging. */
  onPixiError?: (err: Error) => void;
}

// Scheduled destroy slots, per-canvas. When the effect unmounts we schedule a
// timeout to tear down the bundle; if the effect remounts within the grace
// window we cancel it.
const pendingDestroys = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();

function destroyBundle(bundle: PixiBundle): void {
  try {
    for (const handle of bundle.nodeHandles.values()) handle.destroy();
    bundle.overlays.destroy();
  } catch (e) {
    console.warn("[PixiStage] renderer destroy failed", e);
  }
  try {
    bundle.app.destroy(true, { children: true });
  } catch (e) {
    console.warn("[PixiStage] app destroy failed", e);
  }
}

// Stable empty set used for the "dim all static edges" path when a trace
// overlay is active without a user path-query.
const EMPTY_EDGE_ID_SET: ReadonlySet<string> = new Set<string>();
const TRACE_DIM_ALPHA = 0.15;

export function PixiStage({
  scene,
  edgeRender,
  overlays,
  temporal,
  trace,
  presence,
  highlightCrossGraph,
  elevationMode = false,
  effects,
  latency,
  showEffectBadges = true,
  showLatencyOverlay = false,
  onFileClick,
  onFileHover,
  onClusterClick,
  onSuperclusterClick,
  onPixiError,
}: PixiStageProps) {
  const { visible, clusters, superclusters, layout, viewState, viewport, lod, edgeCache } = scene;
  const { showEdges = true, edgeKinds, edgeLayers, edgeMinSeverity, edgeWidthMul, edgeFocus, edgePredicate, edgeViolations } = edgeRender;
  const { showClusterEdges, showSccBubbles, showStartHereBadges, startHereTopN = 5, showCrossGraphEdges, crossGraphFlash } = overlays;
  const { temporalEdgeSet, diffAdded, diffRemoved } = temporal;
  const { activeTrace, traceEdgeSet } = trace;
  const { agentPresence, showAgentPresence = true } = presence;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeHandlesRef = useRef<Map<LodRendererKind, RendererHandle> | null>(null);
  const overlaysRef = useRef<RendererStack | null>(null);
  const [pixiReady, setPixiReady] = useState(false);

  // Latest-callback refs so the init effect can use stable deps ([]).
  // Without this, a new arrow on every render would re-init Pixi.
  const onFileClickRef = useRef(onFileClick);
  const onFileHoverRef = useRef(onFileHover);
  const onClusterClickRef = useRef(onClusterClick);
  const onSuperclusterClickRef = useRef(onSuperclusterClick);
  const onPixiErrorRef = useRef(onPixiError);
  onFileClickRef.current = onFileClick;
  onFileHoverRef.current = onFileHover;
  onClusterClickRef.current = onClusterClick;
  onSuperclusterClickRef.current = onSuperclusterClick;
  onPixiErrorRef.current = onPixiError;

  // ── Init PixiJS (StrictMode-safe via canvas-keyed cache) ────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const pending = pendingDestroys.get(canvas);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingDestroys.delete(canvas);
    }

    const applyBundle = (bundle: PixiBundle) => {
      if (cancelled) return;
      appRef.current = bundle.app;
      worldRef.current = bundle.world;
      nodeHandlesRef.current = bundle.nodeHandles;
      overlaysRef.current = bundle.overlays;
      setPixiReady(true);
    };

    const handleContextLost = () => {
      setPixiReady(false);
      appRef.current?.ticker.stop();
    };

    // Context restore — browsers re-raise after a GPU reset or memory-pressure
    // tab restore. Every GPU-resident resource is dead; replace the whole
    // bundle rather than surgically re-uploading per renderer.
    const handleContextRestored = () => {
      try {
        const old = pixiByCanvas.get(canvas);
        if (old) {
          destroyBundle(old);
          pixiByCanvas.delete(canvas);
        }
        installCityFonts();
        initInFlight.delete(canvas);
        const promise = coldInit(canvas);
        initInFlight.set(canvas, promise);
        void promise
          .then(bundle => {
            initInFlight.delete(canvas);
            applyBundle(bundle);
            bundle.app.ticker.start();
          })
          .catch(err => {
            console.error("[PixiStage] context-restore rebuild failed", err);
            onPixiErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
          });
      } catch (err) {
        console.error("[PixiStage] context-restore rebuild threw", err);
        onPixiErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    async function coldInit(el: HTMLCanvasElement): Promise<PixiBundle> {
      const initW = el.clientWidth || 800;
      const initH = el.clientHeight || 600;
      let app: Application;
      try {
        app = new Application();
        await app.init({
          canvas: el,
          width: initW,
          height: initH,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
      } catch (err) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const world = new Container();
      app.stage.addChild(world);
      app.stage.eventMode = "static";

      const callbacks = {
        onFileClick: (id: string) => onFileClickRef.current?.(id),
        onFileHover: (id: string | null) => onFileHoverRef.current?.(id),
        onClusterClick: (id: string) => onClusterClickRef.current?.(id),
        onSuperclusterClick: (id: string) => onSuperclusterClickRef.current?.(id),
      };
      const nodeHandles = new Map<LodRendererKind, RendererHandle>();
      for (const [kind, factory] of RENDERER_REGISTRY) {
        nodeHandles.set(kind, factory(world, callbacks));
      }
      const bundle: PixiBundle = {
        app,
        world,
        nodeHandles,
        overlays: new RendererStack(world),
      };
      pixiByCanvas.set(el, bundle);
      return bundle;
    }

    const cached = pixiByCanvas.get(canvas);
    if (cached) {
      applyBundle(cached);
    } else {
      const existing = initInFlight.get(canvas);
      const promise = existing ?? coldInit(canvas);
      if (!existing) initInFlight.set(canvas, promise);
      void promise
        .then(bundle => {
          initInFlight.delete(canvas);
          applyBundle(bundle);
        })
        .catch(err => {
          initInFlight.delete(canvas);
          console.error("[PixiStage] init failed", err);
          onPixiErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        });
    }

    // Backgrounded tabs burn GPU and invite GL context loss — pause the
    // ticker on hide, resume on show.
    const handleVisibility = () => {
      const app = appRef.current;
      if (!app) return;
      if (document.hidden) app.ticker.stop();
      else app.ticker.start();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      document.removeEventListener("visibilitychange", handleVisibility);
      appRef.current = null;
      worldRef.current = null;
      nodeHandlesRef.current = null;
      overlaysRef.current = null;
      const bundle = pixiByCanvas.get(canvas);
      if (!bundle) return;
      const prior = pendingDestroys.get(canvas);
      if (prior !== undefined) clearTimeout(prior);
      const timer = setTimeout(() => {
        pendingDestroys.delete(canvas);
        const live = pixiByCanvas.get(canvas);
        if (live) {
          destroyBundle(live);
          pixiByCanvas.delete(canvas);
        }
      }, UNMOUNT_DESTROY_DELAY_MS);
      pendingDestroys.set(canvas, timer);
    };
  }, []); // stable — callbacks read via refs, cache keyed by canvas

  // ── Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const app = appRef.current;
      if (!app) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) app.renderer.resize(w, h);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [pixiReady]);

  // ── Camera (pan/zoom) — just moves world container, no redraw ────
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.x = viewport.x;
    world.y = viewport.y;
    world.scale.set(viewport.scale);
  }, [pixiReady, viewport]);

  // Bucketed scale avoids thrash on tiny zoom ticks.
  const scaleBucket = Math.round(viewport.scale * 20) / 20;

  const hasClusters = !!(clusters && clusters.clusters.length > 0);
  const hasSuperclusters = !!(superclusters && superclusters.superclusters.length > 0);
  const effectiveLod: LodLevel = resolveEffectiveTier(lod, { hasClusters, hasSuperclusters });

  // Per-file loc lookup. Stable across pan; rebuilt only when visible.files changes.
  const fileLookup = useMemo(() => {
    const m = new Map<string, { loc: number }>();
    for (const f of visible.files) m.set(f.id, { loc: f.loc });
    return m;
  }, [visible.files]);

  // Tier/layer/severity resolution. Applied below the overlay dispatch
  // so the overlay context carries the *effective* gates, not raw props.
  const tier = getTierConfig(effectiveLod);
  const tierLayers = resolveLayerPolicy(tier);
  const effectiveLayerFilter: Record<EdgeLayer, boolean> = {
    structural: tierLayers.structural && (edgeLayers?.structural ?? true),
    flow:       tierLayers.flow       && (edgeLayers?.flow       ?? true),
    safety:     tierLayers.safety     && (edgeLayers?.safety     ?? true),
    impact:     tierLayers.impact     && (edgeLayers?.impact     ?? true),
  };
  const anyLayerOn =
    effectiveLayerFilter.structural ||
    effectiveLayerFilter.flow ||
    effectiveLayerFilter.safety ||
    effectiveLayerFilter.impact;

  const SEV_RANK: Record<EdgeSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const tierSev = tier.minEdgeSeverity;
  const userSev = edgeMinSeverity;
  let effectiveMinSeverity: EdgeSeverity | undefined;
  if (tierSev && userSev) {
    effectiveMinSeverity = SEV_RANK[userSev] > SEV_RANK[tierSev] ? userSev : tierSev;
  } else {
    effectiveMinSeverity = userSev ?? tierSev;
  }

  // When a trace overlay is active, static edges dim to TRACE_DIM_ALPHA
  // so the dynamic path dominates. User `edgeFocus` (path query) wins.
  const effectiveEdgeFocus = edgeFocus ?? (
    activeTrace && traceEdgeSet
      ? { edgeIds: EMPTY_EDGE_ID_SET, dimAlpha: TRACE_DIM_ALPHA }
      : undefined
  );

  // Cluster-edge gate — tier must opt in, layout must carry edges, and
  // user `showClusterEdges` must not force-off.
  const tierShowClusterEdges = tier.showClusterEdges === true;
  const userClusterEdgesOff = showClusterEdges === false;
  const clusterEdgesToRender = tierShowClusterEdges && !userClusterEdgesOff
    ? (layout.clusterEdges ?? null)
    : null;

  // SCC bubbles only at galaxy+ (file rects dense enough to form cycles).
  const sccBubblesAllowed = showSccBubbles !== false &&
    (effectiveLod === "galaxy" || effectiveLod === "city" || effectiveLod === "street" || effectiveLod === "ground");

  const startHereAllowed = showStartHereBadges !== false;

  // ── Node tier dispatch ───────────────────────────────────────────
  useEffect(() => {
    if (!pixiReady) return;
    const handles = nodeHandlesRef.current;
    if (!handles) return;

    let ctx: RenderContext | null = null;
    switch (tier.sceneKind) {
      case "files":
        ctx = {
          sceneKind: "files",
          files: visible.files,
          layout,
          viewState,
          viewport,
          metrics: layout.metrics,
          elevationMode,
          latency,
          showLatencyOverlay,
        };
        break;
      case "clusters":
        ctx = { sceneKind: "clusters", clusters: clusters?.clusters ?? [], viewport };
        break;
      case "superclusters":
        ctx = { sceneKind: "superclusters", superclusters: superclusters?.superclusters ?? [], viewport };
        break;
    }

    const activeHandle = handles.get(tier.rendererKind);
    if (activeHandle && ctx) activeHandle.update(ctx);
    for (const [kind, handle] of handles) {
      if (kind !== tier.rendererKind) handle.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, visible.files, clusters, superclusters, layout, effectiveLod, scaleBucket, viewState.selectedFileId, viewState.hoveredFileId, elevationMode, latency, showLatencyOverlay]);

  // ── Overlay stack dispatch ──────────────────────────────────────
  // Single effect drives every overlay registered in `overlay-registry.ts`.
  // Each overlay reads only the slice of ctx it cares about; identity of
  // ctx changes on every render, but React only re-runs when a dep in
  // the list below changes. Deps intentionally match the union of all
  // overlays' inputs so adding a field to `OverlayRenderCtx` is the only
  // place a new dep would need to land.
  useEffect(() => {
    if (!pixiReady) return;
    const stack = overlaysRef.current;
    if (!stack) return;
    const edgesToRender = showEdges && anyLayerOn ? visible.edges : [];
    const ctx: OverlayRenderCtx = {
      visible: edgesToRender === visible.edges ? visible : { ...visible, edges: edgesToRender },
      layout,
      viewport,
      viewState,
      lod: effectiveLod,
      edgeCache,
      fileLookup,
      showEdges,
      edgeKinds,
      edgeLayers: effectiveLayerFilter,
      edgeMinSeverity: effectiveMinSeverity,
      edgeWidthMul,
      edgeFocus: effectiveEdgeFocus,
      edgePredicate,
      edgeViolations,
      temporalEdgeSet,
      diffAdded,
      diffRemoved,
      showCrossGraphEdges,
      highlightCrossGraph,
      crossGraphFlash,
      clusterEdgesToRender,
      sccBubblesAllowed,
      startHereAllowed,
      startHereTopN,
      activeTrace: activeTrace ?? null,
      agentPresence,
      showAgentPresence,
      effects,
      showEffectBadges,
    };
    stack.update(ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pixiReady, visible, layout, edgeCache, scaleBucket, effectiveLod, fileLookup,
    viewState.selectedEdgeId, viewState.hoveredEdgeId, viewState.hoveredFileId,
    showEdges, edgeKinds, effectiveLayerFilter.structural, effectiveLayerFilter.flow, effectiveLayerFilter.safety, effectiveLayerFilter.impact,
    effectiveMinSeverity, edgeWidthMul, effectiveEdgeFocus, edgePredicate, edgeViolations,
    temporalEdgeSet, diffAdded, diffRemoved,
    showCrossGraphEdges, highlightCrossGraph, crossGraphFlash,
    clusterEdgesToRender, sccBubblesAllowed, startHereAllowed, startHereTopN,
    activeTrace, agentPresence, showAgentPresence,
    effects, showEffectBadges,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, display: "block" }}
    />
  );
}
