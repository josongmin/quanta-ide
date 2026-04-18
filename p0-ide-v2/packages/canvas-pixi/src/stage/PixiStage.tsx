import { useEffect, useRef, useState } from "react";
import { Application, Container } from "pixi.js";
import type {
  WorkspaceView,
  WorkspaceLayout,
  ViewState,
  Viewport,
  LodLevel,
  EdgeGeometryCache,
} from "@quanta/canvas-engine";
import { GalaxyNodeRenderer } from "../renderers/GalaxyNodeRenderer";
import { CityNodeRenderer } from "../renderers/CityNodeRenderer";
import { EdgeStaticRenderer } from "../renderers/EdgeStaticRenderer";
import { EdgeOverlayRenderer } from "../renderers/EdgeOverlayRenderer";

// Module-level cache keyed by canvas element. In React StrictMode (dev),
// effects run twice (mount → unmount → mount). Without this cache, two
// concurrent app.init() calls race on the same canvas, producing conflicting
// WebGL contexts that leak (browsers cap ~16 contexts → page crash).
interface PixiBundle {
  app: Application;
  world: Container;
  edgeStatic: EdgeStaticRenderer;
  galaxy: GalaxyNodeRenderer;
  city: CityNodeRenderer;
  edgeOverlay: EdgeOverlayRenderer;
}
const pixiByCanvas = new WeakMap<HTMLCanvasElement, PixiBundle>();
const initInFlight = new WeakMap<HTMLCanvasElement, Promise<PixiBundle>>();

// Stable reference used when we skip edge rendering. Using a fresh `[]` each
// render would defeat React's dep comparison and rebuild every frame.
const EMPTY_EDGES: WorkspaceView["edges"] = [];

export interface PixiStageProps {
  visible: WorkspaceView;
  layout: WorkspaceLayout;
  viewState: ViewState;
  viewport: Viewport;
  lod: LodLevel;
  edgeCache?: EdgeGeometryCache;
  /** When false, edges are not rendered regardless of visible.edges content. */
  showEdges?: boolean;
  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
}

export function PixiStage({
  visible,
  layout,
  viewState,
  viewport,
  lod,
  edgeCache,
  showEdges = true,
  onFileClick,
  onFileHover,
}: PixiStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const galaxyRef = useRef<GalaxyNodeRenderer | null>(null);
  const cityRef = useRef<CityNodeRenderer | null>(null);
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
  onFileClickRef.current = onFileClick;
  onFileHoverRef.current = onFileHover;

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

    const handleContextLost = () => {
      setPixiReady(false);
      appRef.current?.ticker.stop();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    const applyBundle = (bundle: PixiBundle) => {
      if (cancelled) return;
      appRef.current = bundle.app;
      worldRef.current = bundle.world;
      edgeStaticRef.current = bundle.edgeStatic;
      galaxyRef.current = bundle.galaxy;
      cityRef.current = bundle.city;
      edgeOverlayRef.current = bundle.edgeOverlay;
      setPixiReady(true);
    };

    const cached = pixiByCanvas.get(canvas);
    if (cached) {
      applyBundle(cached);
    } else {
      const existing = initInFlight.get(canvas);
      const promise = existing ?? (async () => {
        const initW = canvas.clientWidth || 800;
        const initH = canvas.clientHeight || 600;
        const app = new Application();
        await app.init({
          canvas,
          width: initW,
          height: initH,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        const world = new Container();
        app.stage.addChild(world);
        app.stage.eventMode = "static";
        const edgeStatic = new EdgeStaticRenderer(world);
        const galaxy = new GalaxyNodeRenderer(world, {
          onClick: (id: string) => onFileClickRef.current?.(id),
          onHover: (id: string | null) => onFileHoverRef.current?.(id),
        });
        const city = new CityNodeRenderer(world, {
          onClick: (id: string) => onFileClickRef.current?.(id),
          onHover: (id: string | null) => onFileHoverRef.current?.(id),
        });
        const edgeOverlay = new EdgeOverlayRenderer(world);
        const bundle: PixiBundle = { app, world, edgeStatic, galaxy, city, edgeOverlay };
        pixiByCanvas.set(canvas, bundle);
        return bundle;
      })();
      if (!existing) initInFlight.set(canvas, promise);
      void promise.then(applyBundle).catch(err => {
        console.error("[PixiStage] init failed", err);
      });
    }

    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      // IMPORTANT: Do NOT destroy the Pixi app here.
      // StrictMode double-mounts this effect in dev (mount → unmount → mount).
      // Destroying would leak WebGL contexts on every HMR/StrictMode cycle.
      // The bundle persists in pixiByCanvas (WeakMap) and will be GC'd along
      // with the canvas when the user truly leaves the Code Universe tab.
      appRef.current = null;
      worldRef.current = null;
      galaxyRef.current = null;
      cityRef.current = null;
      edgeStaticRef.current = null;
      edgeOverlayRef.current = null;
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
  useEffect(() => {
    if (!pixiReady) return;
    if (lod === "city") {
      cityRef.current?.update(visible.files, layout, viewState, viewport);
      galaxyRef.current?.update([], layout, viewState, viewport);
    } else if (lod === "galaxy") {
      galaxyRef.current?.update(visible.files, layout, viewState, viewport);
      cityRef.current?.update([], layout, viewState, viewport);
    } else {
      cityRef.current?.update([], layout, viewState, viewport);
      galaxyRef.current?.update([], layout, viewState, viewport);
    }
    // Intentional subset: viewport.x/y excluded (pan never triggers redraw);
    // scaleBucket captures scale changes; selection/hover handled via viewState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, visible.files, layout, lod, scaleBucket, viewState.selectedFileId, viewState.hoveredFileId]);

  // ── Edge static redraw ──────────────────────────────────────────
  // Edge rendering is toggleable: thousands of bezier curves hurt scroll
  // perf *and* add visual noise. Users can turn it off from CanvasControls.
  const edgesToRender = showEdges ? visible.edges : EMPTY_EDGES;
  useEffect(() => {
    if (!pixiReady) return;
    edgeStaticRef.current?.build(edgesToRender, layout, edgeCache);
  }, [pixiReady, edgesToRender, layout, edgeCache]);

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
