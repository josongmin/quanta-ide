import { useEffect, useRef, useState } from "react";
import { Application, Container } from "pixi.js";
import type { LodRendererKind } from "@quanta/canvas-engine";
import {
  RENDERER_REGISTRY,
  type RendererHandle,
  type RendererCallbacks,
} from "../renderers";
import { EffectBadgeRenderer } from "../renderers/EffectBadgeRenderer";
import { installCityFonts } from "../renderers/shared/BitmapFontAtlas";
import { RendererStack } from "../renderers/overlay-registry";

// Pixi bundle lifecycle hook.
// -------------------------------------------------------------------
// Owns (a) the StrictMode-safe canvas-keyed cache, (b) cold init,
// (c) `webglcontextlost` / `webglcontextrestored` rebuild, (d) visibility
// ticker pause, and (e) graceful destroy-on-unmount. Extracted from
// PixiStage so the stage can focus on per-frame dispatch.
//
// StrictMode-safe via `pixiByCanvas`: without the WeakMap, the dev
// mount → unmount → mount cycle spawns two concurrent `app.init()` calls
// on the same <canvas>, leaking WebGL contexts until the browser caps
// (~16) trigger a hard crash.

export interface PixiBundle {
  app: Application;
  world: Container;
  /**
   * Handles are keyed by `LodRendererKind`. Only tiers with a registered
   * factory appear here — DOM-rendered tiers (street, ground) map to no
   * handle; the update effect treats absence as "nothing to draw at Pixi".
   */
  nodeHandles: Map<LodRendererKind, RendererHandle>;
  overlays: RendererStack;
  /** Per-file effect-chip row — direct-mounted because it's per-file, not an overlay. */
  effectBadge: EffectBadgeRenderer;
}

const pixiByCanvas = new WeakMap<HTMLCanvasElement, PixiBundle>();
const initInFlight = new WeakMap<HTMLCanvasElement, Promise<PixiBundle>>();
const pendingDestroys = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();

// Grace window before an unmount-triggered destroy actually fires.
// StrictMode's mount → unmount → mount and Fast Refresh both remount
// within a few ms; we wait long enough for a remount to cancel the
// destroy, but short enough that a real tab-away still reclaims WebGL
// contexts promptly.
const UNMOUNT_DESTROY_DELAY_MS = 50;

function destroyBundle(bundle: PixiBundle): void {
  // Destroy renderers *before* the Application so the GL context is still
  // alive when their buffers unload. App.destroy() last — it nukes the
  // GL context itself.
  try {
    for (const handle of bundle.nodeHandles.values()) handle.destroy();
    bundle.overlays.destroy();
    bundle.effectBadge.destroy();
  } catch (e) {
    console.warn("[PixiStage] renderer destroy failed", e);
  }
  try {
    bundle.app.destroy(true, { children: true });
  } catch (e) {
    console.warn("[PixiStage] app destroy failed", e);
  }
}

export interface UsePixiBundleResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  appRef: React.MutableRefObject<Application | null>;
  worldRef: React.MutableRefObject<Container | null>;
  nodeHandlesRef: React.MutableRefObject<Map<LodRendererKind, RendererHandle> | null>;
  overlaysRef: React.MutableRefObject<RendererStack | null>;
  effectBadgeRef: React.MutableRefObject<EffectBadgeRenderer | null>;
  pixiReady: boolean;
}

export interface UsePixiBundleOpts {
  /** Parent-supplied callbacks — read via refs so identity changes don't re-init. */
  callbacksRef: React.MutableRefObject<RendererCallbacks>;
  onError?: (err: Error) => void;
}

export function usePixiBundle(opts: UsePixiBundleOpts): UsePixiBundleResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeHandlesRef = useRef<Map<LodRendererKind, RendererHandle> | null>(null);
  const overlaysRef = useRef<RendererStack | null>(null);
  const effectBadgeRef = useRef<EffectBadgeRenderer | null>(null);
  // State (not ref) so dispatch effects re-run when Pixi finishes async init.
  const [pixiReady, setPixiReady] = useState(false);

  const onErrorRef = useRef(opts.onError);
  onErrorRef.current = opts.onError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    // On remount, cancel a pending destroy from the previous unmount. This
    // is the mechanism that keeps the bundle alive across StrictMode double-
    // effects while still letting a *real* unmount reclaim resources.
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
      effectBadgeRef.current = bundle.effectBadge;
      setPixiReady(true);
    };

    const handleContextLost = () => {
      setPixiReady(false);
      appRef.current?.ticker.stop();
    };

    // Context restore — browsers re-raise this after a GPU reset or after
    // a tab whose GL context was dropped under memory pressure comes back.
    // Every GPU-resident resource is dead; replace the whole bundle rather
    // than surgically re-uploading per renderer. Idempotent.
    const handleContextRestored = () => {
      try {
        const old = pixiByCanvas.get(canvas);
        if (old) {
          destroyBundle(old);
          pixiByCanvas.delete(canvas);
        }
        // TODO(canvas-pixi): expose BitmapFontAtlas.reinstall() that clears
        // the `installed` flag so the GPU glyph atlas is rebuilt cleanly on
        // restore. For now lean on Pixi's lazy upload-on-demand.
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
            onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
          });
      } catch (err) {
        console.error("[PixiStage] context-restore rebuild threw", err);
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
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

      const callbacks: RendererCallbacks = {
        onFileClick: (id) => opts.callbacksRef.current.onFileClick?.(id),
        onFileHover: (id) => opts.callbacksRef.current.onFileHover?.(id),
        onClusterClick: (id) => opts.callbacksRef.current.onClusterClick?.(id),
        onSuperclusterClick: (id) => opts.callbacksRef.current.onSuperclusterClick?.(id),
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
        effectBadge: new EffectBadgeRenderer(world),
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
          onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
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
      // Null out refs immediately so a stray render during the grace
      // window can't dispatch to a bundle that's about to be destroyed.
      appRef.current = null;
      worldRef.current = null;
      nodeHandlesRef.current = null;
      overlaysRef.current = null;
      effectBadgeRef.current = null;
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
  }, [opts.callbacksRef]); // opts.callbacksRef is stable — effect runs once

  // Resize — reads the latest canvas from the ref every observe tick.
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

  return {
    canvasRef,
    appRef,
    worldRef,
    nodeHandlesRef,
    overlaysRef,
    effectBadgeRef,
    pixiReady,
  };
}
