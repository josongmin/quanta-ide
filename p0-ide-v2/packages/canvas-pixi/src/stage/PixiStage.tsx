import { useEffect, useRef, useState } from "react";
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
} from "@quanta/canvas-engine";
import { resolveEffectiveTier, getTierConfig } from "@quanta/canvas-engine";
// Side-effect import — populates RENDERER_REGISTRY with every tier factory.
// Without this the registry is empty and `coldInit` below finds no handles.
import { RENDERER_REGISTRY, type RendererHandle, type RenderContext } from "../renderers";
import { EdgeStaticRenderer } from "../renderers/EdgeStaticRenderer";
import { EdgeOverlayRenderer } from "../renderers/EdgeOverlayRenderer";
import { installCityFonts } from "../renderers/shared/BitmapFontAtlas";

// Module-level cache keyed by canvas element. In React StrictMode (dev),
// effects run twice (mount → unmount → mount). Without this cache, two
// concurrent app.init() calls race on the same canvas, producing conflicting
// WebGL contexts that leak (browsers cap ~16 contexts → page crash).
interface PixiBundle {
  app: Application;
  world: Container;
  edgeStatic: EdgeStaticRenderer;
  // Handles are keyed by `LodRendererKind`. Only tiers with a registered
  // factory appear here — DOM-rendered tiers (street, ground) map to no
  // handle, which the update effect treats as "nothing to draw at Pixi".
  nodeHandles: Map<LodRendererKind, RendererHandle>;
  edgeOverlay: EdgeOverlayRenderer;
}
const pixiByCanvas = new WeakMap<HTMLCanvasElement, PixiBundle>();
const initInFlight = new WeakMap<HTMLCanvasElement, Promise<PixiBundle>>();

// Grace window before an unmount-triggered destroy actually fires. StrictMode's
// mount → unmount → mount cycle and Fast Refresh both can unmount/remount
// within a few ms; we wait long enough for a remount to cancel the destroy,
// but short enough that a real tab-away (user navigated to another route)
// still reclaims WebGL contexts promptly.
const UNMOUNT_DESTROY_DELAY_MS = 50;

// Stable reference used when we skip edge rendering. Using a fresh `[]` each
// render would defeat React's dep comparison and rebuild every frame.
const EMPTY_EDGES: WorkspaceView["edges"] = [];

export interface PixiStageProps {
  visible: WorkspaceView;
  /** Populated only at supergalaxy LOD. Renderer draws one box per cluster. */
  clusters?: WorkspaceClusterView | null;
  /** Populated only at universe LOD. Renderer draws one box per supercluster. */
  superclusters?: WorkspaceSuperclusterView | null;
  layout: WorkspaceLayout;
  viewState: ViewState;
  viewport: Viewport;
  lod: LodLevel;
  edgeCache?: EdgeGeometryCache;
  /** When false, edges are not rendered regardless of visible.edges content. */
  showEdges?: boolean;
  /** Per-kind edge visibility. Missing/undefined = visible. */
  edgeKinds?: Partial<Record<"import" | "taint-propagation" | "blast", boolean>>;
  /** Multiplier applied to each edge's base stroke width (0.25..3). */
  edgeWidthMul?: number;
  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
  onClusterClick?: (clusterId: string) => void;
  onSuperclusterClick?: (superclusterId: string) => void;
  /**
   * Fired when Pixi init throws (WebGL unavailable, GPU driver error, etc.).
   * Parents should surface a fallback UI instead of the renderer silently
   * logging to console. Called with the caught Error.
   */
  onPixiError?: (err: Error) => void;
}

// Scheduled destroy slots, per-canvas. When the effect unmounts we schedule a
// timeout to tear down the bundle; if the effect remounts within the grace
// window we cancel it. Module-scope (not a ref) so the cleanup closure and
// the next-mount setup closure can both see the same timer.
const pendingDestroys = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();

function destroyBundle(bundle: PixiBundle): void {
  // Destroy renderers *before* the Application so the GL context is still
  // alive when their buffers unload. App.destroy() last — it nukes the GL
  // context itself.
  try {
    for (const handle of bundle.nodeHandles.values()) handle.destroy();
    bundle.edgeStatic.destroy();
    bundle.edgeOverlay.destroy();
  } catch (e) {
    // A failure in one renderer's destroy shouldn't block the app teardown —
    // the GL context still needs to be released.
    console.warn("[PixiStage] renderer destroy failed", e);
  }
  try {
    bundle.app.destroy(true, { children: true });
  } catch (e) {
    console.warn("[PixiStage] app destroy failed", e);
  }
}

export function PixiStage({
  visible,
  clusters,
  superclusters,
  layout,
  viewState,
  viewport,
  lod,
  edgeCache,
  showEdges = true,
  edgeKinds,
  edgeWidthMul,
  onFileClick,
  onFileHover,
  onClusterClick,
  onSuperclusterClick,
  onPixiError,
}: PixiStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  // Registry-driven handles — one ref holds the whole map so render effects
  // can loop without knowing the concrete renderer class names.
  const nodeHandlesRef = useRef<Map<LodRendererKind, RendererHandle> | null>(null);
  const edgeStaticRef = useRef<EdgeStaticRenderer | null>(null);
  const edgeOverlayRef = useRef<EdgeOverlayRenderer | null>(null);
  // State (not ref) so render effects re-run when pixi finishes async init.
  // If readyRef were a plain ref, data that arrived before init completed
  // would be silently dropped — the effect skips and never re-fires.
  const [pixiReady, setPixiReady] = useState(false);

  // Keep latest callbacks in refs so the init effect can use stable deps ([]).
  // Without this, the parent passes a new arrow function each render → effect
  // would re-run every render → Pixi would re-init on every render.
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
  // Without the cache, StrictMode double-mount in dev creates two concurrent
  // app.init() calls on the same canvas. Each creates a new WebGL context.
  // The first gets destroyed when its cleanup fires, but this races with the
  // second init's context creation → context leak → page crash after ~16
  // mounts (browsers cap concurrent WebGL contexts).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    // On remount, cancel a pending destroy from the previous (StrictMode /
    // Fast Refresh) unmount. This is the mechanism that keeps the bundle
    // alive across double-effects while still letting a *real* unmount (no
    // remount within UNMOUNT_DESTROY_DELAY_MS) reclaim resources.
    const pending = pendingDestroys.get(canvas);
    if (pending !== undefined) {
      clearTimeout(pending);
      pendingDestroys.delete(canvas);
    }

    // Helper — re-wires renderer refs from a bundle and flips pixiReady.
    // Called from: cold init, warm cache hit, and context-restore rebuild.
    const applyBundle = (bundle: PixiBundle) => {
      if (cancelled) return;
      appRef.current = bundle.app;
      worldRef.current = bundle.world;
      edgeStaticRef.current = bundle.edgeStatic;
      nodeHandlesRef.current = bundle.nodeHandles;
      edgeOverlayRef.current = bundle.edgeOverlay;
      setPixiReady(true);
    };

    const handleContextLost = () => {
      setPixiReady(false);
      appRef.current?.ticker.stop();
    };

    // `webglcontextrestored` — browsers re-raise this after a GPU reset or
    // after the user returns to a tab whose GL context was dropped under
    // memory pressure. The underlying HTMLCanvasElement is the same, but
    // every GPU-resident resource (Buffers, Textures, Meshes) is dead.
    // We replace the whole bundle — easier and safer than trying to surgically
    // re-upload buffers inside the same renderer instances (which would
    // require each renderer to expose a rebuildGpu() and reset its own
    // pool/cache state — net equivalent to recreating them). Idempotent
    // against "fires while already ready" because we unconditionally
    // destroy-then-rebuild.
    const handleContextRestored = () => {
      try {
        const old = pixiByCanvas.get(canvas);
        if (old) {
          destroyBundle(old);
          pixiByCanvas.delete(canvas);
        }
        // Run the normal cold-init path. This will re-install BitmapFonts
        // via the installCityFonts() guard inside each renderer (the guard
        // flag is process-lifetime, so after a context loss the *GPU*
        // glyph atlas is stale; today the guard skips re-install, so we
        // force a fresh install here before any renderer touches fonts).
        // Note: installCityFonts currently uses a module-scoped `installed`
        // flag that survives the context loss and prevents re-upload. The
        // right fix lives in BitmapFontAtlas (needs a `reinstall()` or
        // atlas-reset call). For now log and rely on Pixi's internal
        // texture-upload-on-demand to recover glyphs lazily.
        // TODO(canvas-pixi): expose BitmapFontAtlas.reinstall() that clears
        // the `installed` flag AND BitmapFont.uninstall()s prior atlases,
        // so we can rebuild the GPU glyph cache on restore.
        installCityFonts();
        initInFlight.delete(canvas);
        const promise = coldInit(canvas);
        initInFlight.set(canvas, promise);
        void promise
          .then(bundle => {
            initInFlight.delete(canvas);
            applyBundle(bundle);
            // Restart the ticker that handleContextLost stopped.
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

    // Shared cold-init routine — used on first mount *and* after context
    // restore. Wraps `new Application()` + `app.init()` in a try/catch so
    // a WebGL-unavailable environment surfaces through onPixiError instead
    // of an unhandled promise rejection.
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
        // Re-throw as Error — the .catch() below invokes onPixiError.
        const wrapped = err instanceof Error ? err : new Error(String(err));
        throw wrapped;
      }
      const world = new Container();
      app.stage.addChild(world);
      app.stage.eventMode = "static";
      const edgeStatic = new EdgeStaticRenderer(world);
      // Callback bag forwards to the parent-supplied props via refs so a
      // new arrow identity on re-render doesn't invalidate the handle.
      const callbacks = {
        onFileClick: (id: string) => onFileClickRef.current?.(id),
        onFileHover: (id: string | null) => onFileHoverRef.current?.(id),
        onClusterClick: (id: string) => onClusterClickRef.current?.(id),
        onSuperclusterClick: (id: string) => onSuperclusterClickRef.current?.(id),
      };
      // Walk the registry — each entry owns its own Pixi object hierarchy.
      // `LodRendererKind`s that don't have a factory (street, ground) stay
      // absent from `nodeHandles`; the dispatch effect treats absence as
      // "DOM tier, Pixi does nothing".
      const nodeHandles = new Map<LodRendererKind, RendererHandle>();
      for (const [kind, factory] of RENDERER_REGISTRY) {
        nodeHandles.set(kind, factory(world, callbacks));
      }
      const edgeOverlay = new EdgeOverlayRenderer(world);
      const bundle: PixiBundle = { app, world, edgeStatic, nodeHandles, edgeOverlay };
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

    // ── Visibility-driven ticker pause ─────────────────────────────
    // When the tab is backgrounded, Pixi's ticker keeps running and burns
    // GPU/CPU for invisible pixels. Also — prolonged background execution
    // is one of the paths to spontaneous GL context loss. Pause here,
    // resume on show. Guarded by pixiReady via the ref (the listener may
    // fire before the app is live; we just no-op in that case).
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
      // Null out refs immediately so a stray render during the grace
      // window can't dispatch to a bundle that's about to be destroyed.
      appRef.current = null;
      worldRef.current = null;
      nodeHandlesRef.current = null;
      edgeStaticRef.current = null;
      edgeOverlayRef.current = null;
      // Schedule destroy. Real unmount vs StrictMode double-mount is
      // distinguished purely by *whether the effect re-runs within the
      // grace window* — the next-mount closure clearTimeout()s this.
      const bundle = pixiByCanvas.get(canvas);
      if (!bundle) return;
      const prior = pendingDestroys.get(canvas);
      if (prior !== undefined) clearTimeout(prior);
      const timer = setTimeout(() => {
        pendingDestroys.delete(canvas);
        // Re-fetch — a context restore between schedule and fire could
        // have replaced the bundle; we still want to destroy whatever
        // currently owns the canvas.
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
  // Hot path: fires on every viewport change. Keep it minimal.
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.x = viewport.x;
    world.y = viewport.y;
    world.scale.set(viewport.scale);
  }, [pixiReady, viewport]);

  // ── Node redraw — decoupled from viewport.x/y ──────────────────
  // Full rebuild is expensive (Text objects dominate). Panning uses only
  // world.x/y and must not trigger rebuild. Bucketed scale avoids thrash on
  // tiny zoom ticks. visible.files reference is already stable (orchestrator
  // dedupes) — so plain-ref deps are cheaper than stringifying ids.
  const scaleBucket = Math.round(viewport.scale * 20) / 20;
  // Effective LOD cascade — a higher tier with no data to draw falls
  // through to the next finer tier so the user never sees an empty canvas.
  // The fallback chain itself (universe → supergalaxy → galaxy → …) is
  // declared once in `lod-config.ts`'s `LOD_TIERS[*].fallback` and walked
  // here via `resolveEffectiveTier`. Previously this was a hand-written
  // pair of `if` branches; keeping it in the config means adding a new
  // intermediate tier doesn't require editing PixiStage.
  const hasClusters = !!(clusters && clusters.clusters.length > 0);
  const hasSuperclusters = !!(superclusters && superclusters.superclusters.length > 0);
  const effectiveLod: LodLevel = resolveEffectiveTier(lod, { hasClusters, hasSuperclusters });
  useEffect(() => {
    if (!pixiReady) return;
    const handles = nodeHandlesRef.current;
    if (!handles) return;

    const tier = getTierConfig(effectiveLod);
    // Build the tagged-union context from tier.sceneKind. The registry
    // handle then dispatches internally — PixiStage no longer knows which
    // concrete renderer services which scene.
    let ctx: RenderContext | null = null;
    switch (tier.sceneKind) {
      case "files":
        ctx = { sceneKind: "files", files: visible.files, layout, viewState, viewport };
        break;
      case "clusters":
        ctx = { sceneKind: "clusters", clusters: clusters?.clusters ?? [], viewport };
        break;
      case "superclusters":
        ctx = { sceneKind: "superclusters", superclusters: superclusters?.superclusters ?? [], viewport };
        break;
    }

    // Drive the active tier's handle; every other registered handle gets
    // a `clear()` so stale Pixi objects from a previous tier don't paint.
    // DOM-layer tiers (street, ground) have no registered factory — the
    // `activeHandle` lookup will simply return undefined and every other
    // handle gets cleared, which is the correct "nothing drawn" state.
    const activeHandle = handles.get(tier.rendererKind);
    if (activeHandle && ctx) activeHandle.update(ctx);
    for (const [kind, handle] of handles) {
      if (kind !== tier.rendererKind) handle.clear();
    }
    // Intentional subset: viewport.x/y excluded (pan never triggers redraw);
    // scaleBucket captures scale changes; selection/hover handled via viewState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, visible.files, clusters, superclusters, layout, effectiveLod, scaleBucket, viewState.selectedFileId, viewState.hoveredFileId]);

  // ── Edge static redraw ──────────────────────────────────────────
  // Two gates: the user's `showEdges` toggle AND the LOD tier config's
  // `showEdges` flag. LOD wins when tier declares `showEdges: false` —
  // rationale: at galaxy+ zoom, thousands of bezier curves are the
  // dominant bottleneck per the perf recorder (galaxy + 3k edges + 220
  // files = 58ms/frame vs. 17ms when files=94). The tier config declares
  // where edges are viable; we enforce that here instead of hoping the
  // user remembers to toggle off.
  const tierAllowsEdges = getTierConfig(effectiveLod).showEdges !== false;
  const edgesToRender = showEdges && tierAllowsEdges ? visible.edges : EMPTY_EDGES;
  useEffect(() => {
    if (!pixiReady) return;
    edgeStaticRef.current?.build(edgesToRender, layout, edgeCache, viewport, {
      kindFilter: edgeKinds,
      widthMul: edgeWidthMul,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, edgesToRender, layout, edgeCache, scaleBucket, edgeKinds, edgeWidthMul]);

  // ── Overlay redraw (selection/hover only — intentional partial deps) ─
  useEffect(() => {
    if (!pixiReady) return;
    edgeOverlayRef.current?.update(viewState, layout, edgeCache);
  }, [pixiReady, viewState.selectedEdgeId, viewState.hoveredFileId, layout, edgeCache]); // viewState.* intentional subset

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
      }}
    />
  );
}
