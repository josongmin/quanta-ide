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

  // ── Init PixiJS once ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const handleContextLost = () => {
      setPixiReady(false);
      appRef.current?.ticker.stop();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    void (async () => {
      const app = new Application();
      await app.init({
        canvas,
        width: canvas.clientWidth || 800,
        height: canvas.clientHeight || 600,
        backgroundColor: 0xf7f7f8,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (cancelled) {
        app.destroy();
        return;
      }

      appRef.current = app;
      const world = new Container();
      app.stage.addChild(world);
      worldRef.current = world;

      // Enable pointer events on stage
      app.stage.eventMode = "static";

      // Layer order: static edges → galaxy nodes → city nodes → overlay edges
      const edgeStatic = new EdgeStaticRenderer(world);
      const galaxy = new GalaxyNodeRenderer(world, {
        onClick: onFileClick,
        onHover: onFileHover,
      });
      const city = new CityNodeRenderer(world, {
        onClick: onFileClick,
        onHover: onFileHover,
      });
      const edgeOverlay = new EdgeOverlayRenderer(world);

      edgeStaticRef.current = edgeStatic;
      galaxyRef.current = galaxy;
      cityRef.current = city;
      edgeOverlayRef.current = edgeOverlay;
      setPixiReady(true);
    })();

    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      const app = appRef.current;
      appRef.current = null;
      worldRef.current = null;
      galaxyRef.current = null;
      cityRef.current = null;
      edgeStaticRef.current = null;
      edgeOverlayRef.current = null;
      if (app) {
        app.ticker.stop();
        // PixiJS v8 calls extensions.loseContext.loseContext() during destroy
        // as a GPU-resource hint. If the context is already gone the browser
        // logs INVALID_OPERATION regardless of try/catch. Null the extension
        // before destroy so the call is skipped entirely — safe because the
        // browser already freed GPU resources when the context was lost.
        try {
          const ctx = (app.renderer as any)?.context;
          if (ctx?.extensions) ctx.extensions.loseContext = null;
        } catch { /* renderer may already be partially torn down */ }
        try {
          app.destroy();
        } catch { /* ignore any remaining teardown errors */ }
      }
    };
  }, []); // init once — intentional empty deps

  // ── Resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !appRef.current) return;
    const ro = new ResizeObserver(() => {
      const app = appRef.current;
      if (!app) return;
      app.renderer.resize(canvas.clientWidth, canvas.clientHeight);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── Camera ───────────────────────────────────────────────────────
  // pixiReady is intentionally in deps: when pixi finishes async init,
  // worldRef becomes valid and we must apply the current camera immediately.
  // Without it, the world container stays at (0,0,scale=1) until the next
  // viewport change — causing files to render at full size off-screen.
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.x = viewState.viewport.x;
    world.y = viewState.viewport.y;
    world.scale.set(viewState.viewport.scale);
  }, [pixiReady, viewState.viewport]);

  // ── Node redraw (files or layout changed) ────────────────────────
  useEffect(() => {
    if (!pixiReady) return;
    if (lod === "city") {
      cityRef.current?.update(visible.files, layout, viewState);
      galaxyRef.current?.update([], layout, viewState);
    } else if (lod === "galaxy") {
      galaxyRef.current?.update(visible.files, layout, viewState);
      cityRef.current?.update([], layout, viewState);
    } else {
      // street / ground: DOM layer renders, clear Pixi nodes
      cityRef.current?.update([], layout, viewState);
      galaxyRef.current?.update([], layout, viewState);
    }
  }, [pixiReady, visible.files, layout, lod, viewState]);

  // ── Edge static redraw (layout changed) ──────────────────────────
  useEffect(() => {
    if (!pixiReady) return;
    edgeStaticRef.current?.build(visible.edges, layout, edgeCache);
  }, [pixiReady, visible.edges, layout, edgeCache]);

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
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
