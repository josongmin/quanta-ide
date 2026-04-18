import { useEffect, useRef, useState } from "react";
import { Application, Container } from "pixi.js";
import type {
  WorkspaceView,
  WorkspaceLayout,
  ViewState,
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

export interface PixiStageProps {
  visible: WorkspaceView;
  layout: WorkspaceLayout;
  viewState: ViewState;
  lod: LodLevel;
  edgeCache?: EdgeGeometryCache;
  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
}

export function PixiStage({
  visible,
  layout,
  viewState,
  lod,
  edgeCache,
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
    world.x = viewState.viewport.x;
    world.y = viewState.viewport.y;
    world.scale.set(viewState.viewport.scale);
  }, [pixiReady, viewState.viewport]);

  // ── Node redraw — DELIBERATELY decoupled from viewport.x/y ──────
  // Full rebuild is expensive (~200 Text objects for 31 files). The renderer
  // uses viewState only for scale (invScale labels), selection, hover. Panning
  // doesn't change any of those — don't rebuild on pan. Scale is bucketed to
  // 0.05 steps so tiny zoom ticks don't thrash. File IDs are stringified so a
  // fresh array with identical contents (common during pan) skips rebuild.
  const scaleBucket = Math.round(viewState.viewport.scale * 20) / 20;
  const fileIdsKey = visible.files.map(f => f.id).join("|");
  useEffect(() => {
    if (!pixiReady) return;
    if (lod === "city") {
      cityRef.current?.update(visible.files, layout, viewState);
      galaxyRef.current?.update([], layout, viewState);
    } else if (lod === "galaxy") {
      galaxyRef.current?.update(visible.files, layout, viewState);
      cityRef.current?.update([], layout, viewState);
    } else {
      cityRef.current?.update([], layout, viewState);
      galaxyRef.current?.update([], layout, viewState);
    }
    // Intentional subset: viewport.x/y excluded (pan never triggers redraw).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, fileIdsKey, layout, lod, scaleBucket, viewState.selectedFileId, viewState.hoveredFileId]);

  // ── Edge static redraw — key off edge ID set (not array ref) ────
  // visible.edges is a fresh array each pan; rebuilding all edge paths on
  // every pan tick is expensive. Skip rebuild when the same edges are visible.
  const edgeIdsKey = visible.edges.map(e => e.id).join("|");
  useEffect(() => {
    if (!pixiReady) return;
    edgeStaticRef.current?.build(visible.edges, layout, edgeCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixiReady, edgeIdsKey, layout, edgeCache]);

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
