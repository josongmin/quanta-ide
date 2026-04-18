import { useEffect, useRef } from "react";
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
  const readyRef = useRef(false);

  // ── Init PixiJS once ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const handleContextLost = () => {
      readyRef.current = false;
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
      readyRef.current = true;
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      try {
        appRef.current?.destroy();
      } catch {
        // context may already be lost (e.g. HMR, browser resource pressure)
      }
      appRef.current = null;
      worldRef.current = null;
      galaxyRef.current = null;
      cityRef.current = null;
      edgeStaticRef.current = null;
      edgeOverlayRef.current = null;
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

  // ── Camera (runs every viewport change — no React re-render) ─────
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    world.x = viewState.viewport.x;
    world.y = viewState.viewport.y;
    world.scale.set(viewState.viewport.scale);
  }, [viewState.viewport]);

  // ── Node redraw (files or layout changed) ────────────────────────
  useEffect(() => {
    if (!readyRef.current) return;
    if (lod === "city") {
      cityRef.current?.update(visible.files, layout, viewState);
      galaxyRef.current?.update([], layout, viewState); // hide galaxy
    } else {
      galaxyRef.current?.update(visible.files, layout, viewState);
      cityRef.current?.update([], layout, viewState); // hide city
    }
  }, [visible.files, layout, lod, viewState]);

  // ── Edge static redraw (layout changed) ──────────────────────────
  useEffect(() => {
    if (!readyRef.current) return;
    edgeStaticRef.current?.build(visible.edges, layout, edgeCache);
  }, [visible.edges, layout, edgeCache]);

  // ── Overlay redraw (selection/hover only — intentional partial deps) ─
  useEffect(() => {
    if (!readyRef.current) return;
    edgeOverlayRef.current?.update(viewState, layout, edgeCache);
  }, [viewState.selectedEdgeId, viewState.hoveredFileId, layout, edgeCache]); // viewState.* intentional subset

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
