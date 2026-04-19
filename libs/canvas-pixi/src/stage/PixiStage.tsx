import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Application, Container, Ticker } from "pixi.js";
import {
  markDirty,
  markAllDirty,
  consumeDirty,
  anyDirty,
  type DirtyFlags,
} from "./render-dirty-store";
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
import { ensureMsdfFont } from "../renderers/shared/msdf-text";
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

// Mutable pointer to the most-recently-initialized Pixi canvas. Used by
// external thumbnail capture helpers so consumers don't need to plumb
// refs back up to the React tree. Cleared on unmount (destroyBundle).
let latestPixiCanvas: HTMLCanvasElement | null = null;

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
  /** Hierarchical Edge Bundling pre-sampled polylines, keyed by edgeId.
   *  Only consumed at galaxy LOD when the renderer's HEB flag is on —
   *  missing entries (or a null map) fall through to the bezier path. */
  hebPaths?: Map<string, Float32Array>;
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
  /** Per-file side-effect annotations — drives EffectBadgeRenderer. */
  effects?: Record<string, FileEffects>;
  /** Per-file latency — drives cost tint on city+galaxy. */
  latency?: Record<string, FileLatency>;
  showEffectBadges?: boolean;
  showLatencyOverlay?: boolean;

  /**
   * Whether the host workspace tab is visible. When `false`, the Pixi
   * ticker stops so background tabs don't burn CPU/GPU on invisible
   * frames. Defaults to `true` for callers that don't yet thread a
   * tab-visibility signal through (tests, isolated previews).
   *
   * Complements the browser-level `visibilitychange` pause already
   * wired inside the stage — that handles the user tabbing to another
   * browser window; this handles switching to a sibling tab within the
   * in-app shell (which keeps inactive tabs mounted under `display:none`,
   * so the ticker would otherwise keep firing for hidden canvases).
   */
  active?: boolean;

  onFileClick?: (fileId: string) => void;
  onFileHover?: (fileId: string | null) => void;
  onClusterClick?: (clusterId: string) => void;
  onClusterHover?: (clusterId: string | null) => void;
  onSuperclusterClick?: (superclusterId: string) => void;
  onSuperclusterHover?: (superclusterId: string | null) => void;
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

// ── Ticker-based render loop (Audit #1: dep-hell useEffect) ────────
// When the flag is true, PixiStage bypasses the 30+ dep overlay
// useEffect and instead drives renders from a Pixi ticker callback
// that consumes `render-dirty-store`. Upstream prop churn still
// re-runs the small gating effects, but those only flip dirty bits —
// the heavy `stack.update(ctx)` path only fires on no-op-free frames.
// Flag is OFF by default so we can merge + observe in dev before
// flipping. To try it locally, change the constant and rebuild.
export const TICKER_RENDER_LOOP_ENABLED: boolean = false;

/**
 * Extract a thumbnail data-URL from the most recently initialized Pixi
 * canvas. Uses `renderer.extract.canvas(stage)` (which bypasses Pixi's
 * preserveDrawingBuffer requirement) and downsamples to `maxDim`.
 *
 * Returns `null` when no Pixi canvas is live (pre-init, SSR, stage
 * torn down) so callers can short-circuit without try/catch.
 */
export async function extractActiveCanvasThumbnail(maxDim = 160): Promise<string | null> {
  const canvas = latestPixiCanvas;
  if (!canvas) return null;
  const bundle = pixiByCanvas.get(canvas);
  if (!bundle) return null;
  try {
    const snap = (await bundle.app.renderer.extract.canvas(bundle.app.stage)) as HTMLCanvasElement;
    const srcW = snap.width;
    const srcH = snap.height;
    if (srcW <= 0 || srcH <= 0) return null;
    const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));
    const dst = document.createElement("canvas");
    dst.width = dstW;
    dst.height = dstH;
    const ctx = dst.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(snap, 0, 0, dstW, dstH);
    return dst.toDataURL("image/webp", 0.7);
  } catch (e) {
    console.warn("[PixiStage] thumbnail extraction failed", e);
    return null;
  }
}

// ── WebGPU backend preference ────────────────────────────────────────
// Pixi 8's `app.init` accepts `preference: 'webgpu' | 'webgl' | 'canvas'`.
// When a single string is provided, Pixi falls back to the remaining
// renderers in priority order if the preferred one is unavailable, and
// the outer try/catch below covers the case where construction of the
// preferred backend throws hard (e.g. GPU device lost at init).
//
// IMPORTANT — SHADER COMPATIBILITY WARNING:
// The instanced mesh renderers in this package (InstancedLineMesh,
// InstancedRectMesh, InstancedCircleMesh, InstancedDecorationMesh) are
// currently authored with GlProgram (GLSL) only — no GpuProgram (WGSL)
// counterpart. If Pixi selects the WebGPU backend, those meshes will
// fail to render. Until the shaders are ported to `Shader.from({ gl, gpu })`
// with WGSL sources, this flag MUST stay `false`. Flipping this to true
// without shipping the WGSL pairs will produce a blank canvas.
//
// URL query override `?webgl` forces WebGL for test convenience.
export const WEBGPU_PREFERRED: boolean = false;

function resolveRendererPreference(): "webgpu" | "webgl" {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("webgl")) return "webgl";
    } catch {
      // URL parse failures are harmless — just fall through to the flag.
    }
  }
  return WEBGPU_PREFERRED ? "webgpu" : "webgl";
}

// Pixi 8 `RendererType` enum values — hardcoded because the enum is marked
// `@internal` in pixi.js type declarations even though the runtime value is
// exported. Keeping the numbers local avoids a TS2304 from the typings and
// matches the stable Pixi 8 API contract (WEBGL=1, WEBGPU=2, CANVAS=4).
function rendererBackendName(type: number): string {
  switch (type) {
    case 2: return "webgpu";
    case 1: return "webgl";
    case 4: return "canvas";
    default: return `unknown(${type})`;
  }
}

export function PixiStage({
  scene,
  edgeRender,
  overlays,
  temporal,
  trace,
  presence,
  highlightCrossGraph,
  effects,
  latency,
  showEffectBadges = true,
  showLatencyOverlay = false,
  active = true,
  onFileClick,
  onFileHover,
  onClusterClick,
  onClusterHover,
  onSuperclusterClick,
  onSuperclusterHover,
  onPixiError,
}: PixiStageProps) {
  const { visible, clusters, superclusters, layout, viewState, viewport, lod, edgeCache } = scene;
  const { showEdges = true, edgeKinds, edgeLayers, edgeMinSeverity, edgeWidthMul, edgeFocus, edgePredicate, edgeViolations, hebPaths } = edgeRender;
  const { showClusterEdges, showSccBubbles, showStartHereBadges, startHereTopN = 5, showCrossGraphEdges, crossGraphFlash } = overlays;
  const { temporalEdgeSet, diffAdded, diffRemoved } = temporal;
  const { activeTrace, traceEdgeSet } = trace;
  const { agentPresence, showAgentPresence = true } = presence;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const nodeHandlesRef = useRef<Map<LodRendererKind, RendererHandle> | null>(null);
  const overlaysRef = useRef<RendererStack | null>(null);
  // Tracks when the last `webglcontextlost` fired. Paired with a timer:
  // if `webglcontextrestored` doesn't arrive within LOST_GRACE_MS we treat
  // the GPU as permanently gone and surface an error to the parent so it
  // can render a "reload the page" fallback. Browsers that recover quickly
  // (memory-pressure eviction, tab-restore) never trip the escalation.
  const contextLostAtRef = useRef<number | null>(null);
  const [pixiReady, setPixiReady] = useState(false);

  // Multi-source ticker pause registry.
  // ---------------------------------------------------------------
  // Several orthogonal signals can want the Pixi ticker stopped:
  //   • "document-hidden" — browser-level `visibilitychange` when the
  //     user tabs away from the browser window entirely.
  //   • "tab-inactive"   — the shell-level `active` prop when the user
  //     switches to a sibling workspace tab (which stays mounted under
  //     `display:none`, so `visibilitychange` does not fire).
  //   • "context-lost"   — WebGL context was lost; ticker must not run
  //     until the rebuild completes.
  //
  // Before refcounting, two of these wrote `app.ticker.start/stop()`
  // directly. If both paused and one released, the release could
  // (un)pause even though the other reason was still live — e.g. the
  // user returning to the browser window while the workspace tab is
  // still inactive would incorrectly resume the ticker. Refcounted
  // pause turns it into a conjunction: the ticker runs iff the set is
  // empty. Each source owns its own reason id and is responsible for
  // setting/clearing that id idempotently.
  const tickerPauseSourcesRef = useRef<Set<string>>(new Set());
  const setTickerPause = useCallback((reason: string, paused: boolean) => {
    const set = tickerPauseSourcesRef.current;
    if (paused) set.add(reason);
    else set.delete(reason);
    const app = appRef.current;
    if (!app) return;
    if (set.size > 0) app.ticker.stop();
    else app.ticker.start();
  }, []);

  // Latest-callback refs so the init effect can use stable deps ([]).
  // Without this, a new arrow on every render would re-init Pixi.
  const onFileClickRef = useRef(onFileClick);
  const onFileHoverRef = useRef(onFileHover);
  const onClusterClickRef = useRef(onClusterClick);
  const onClusterHoverRef = useRef(onClusterHover);
  const onSuperclusterClickRef = useRef(onSuperclusterClick);
  const onSuperclusterHoverRef = useRef(onSuperclusterHover);
  const onPixiErrorRef = useRef(onPixiError);
  onFileClickRef.current = onFileClick;
  onFileHoverRef.current = onFileHover;
  onClusterClickRef.current = onClusterClick;
  onClusterHoverRef.current = onClusterHover;
  onSuperclusterClickRef.current = onSuperclusterClick;
  onSuperclusterHoverRef.current = onSuperclusterHover;
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
      // Track the active canvas so thumbnail extractors outside React can
      // find the Pixi renderer without a context prop chain.
      latestPixiCanvas = canvas;
      // Shader pre-warm.
      // ---------------------------------------------------------------
      // Every InstancedLineMesh / InstancedRectMesh / InstancedCircleMesh
      // / InstancedDecorationMesh uses `getSharedShader()` which calls
      // `GlProgram.from({ vertex, fragment })`. Pixi creates the `Shader`
      // object synchronously but the actual GLSL compile + link happens
      // the first time the program is used in a draw call. On a cold
      // load, the FIRST real frame can contend with 4 parallel shader
      // compiles (one per mesh type) — 10-50ms each on desktop, more on
      // low-end GPUs — stacking into a single 40-200ms stall that the
      // user sees as "Code Universe hangs on entry".
      //
      // Forcing one `renderer.render(stage)` right after applyBundle
      // runs every attached mesh through the render pipeline at its
      // current instanceCount of 0 (so no overdraw cost), which
      // synchronously triggers the shader compile/link for every
      // program in the stage. The subsequent user-visible frame is
      // then free of compile stalls — Pixi caches compiled programs
      // per-GlProgram for the lifetime of the GL context.
      //
      // Wrapped in try/catch because a broken shader (e.g. a future
      // WGSL port with a typo) should NOT prevent the rest of the
      // canvas from booting; the error surfaces on next real render
      // with a better stack anyway.
      try {
        bundle.app.renderer.render(bundle.app.stage);
      } catch (err) {
        console.warn("[PixiStage] shader pre-warm render failed:", err);
      }
      setPixiReady(true);
    };

    const LOST_GRACE_MS = 3000;
    let contextLostEscalation: ReturnType<typeof setTimeout> | null = null;
    const handleContextLost = () => {
      setPixiReady(false);
      // Route through the pause registry so a later release by a sibling
      // source (e.g. visibilitychange going "visible") can't accidentally
      // restart the ticker before context-restore actually finishes.
      setTickerPause("context-lost", true);
      contextLostAtRef.current = Date.now();
      // Escalate to the parent if restore doesn't fire within the grace
      // window — a permanently-lost context means the canvas stays blank,
      // and a "reload the page" CTA is the only way forward.
      if (contextLostEscalation !== null) clearTimeout(contextLostEscalation);
      contextLostEscalation = setTimeout(() => {
        contextLostEscalation = null;
        if (contextLostAtRef.current !== null) {
          onPixiErrorRef.current?.(new Error("WebGL context lost — try reloading the page"));
        }
      }, LOST_GRACE_MS);
    };

    // Context restore — browsers re-raise after a GPU reset or memory-pressure
    // tab restore. Every GPU-resident resource is dead; replace the whole
    // bundle rather than surgically re-uploading per renderer.
    const handleContextRestored = () => {
      // Clear the escalation watchdog — restore arrived in time.
      contextLostAtRef.current = null;
      if (contextLostEscalation !== null) {
        clearTimeout(contextLostEscalation);
        contextLostEscalation = null;
      }
      try {
        const old = pixiByCanvas.get(canvas);
        if (old) {
          destroyBundle(old);
          pixiByCanvas.delete(canvas);
        }
        installCityFonts();
        // Reinstall MSDF atlas after context-restore. The in-flight mode
        // flag inside msdf-text keeps this idempotent unless it fails; in
        // the unlikely case it failed the first time and would succeed on
        // restore, we accept the one-shot raster rendering.
        void ensureMsdfFont();
        initInFlight.delete(canvas);
        const promise = coldInit(canvas);
        initInFlight.set(canvas, promise);
        void promise
          .then(bundle => {
            initInFlight.delete(canvas);
            applyBundle(bundle);
            // Release the context-lost pause. If any other source
            // (e.g. `active` is still false) still holds a reason,
            // the registry keeps the ticker stopped.
            setTickerPause("context-lost", false);
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
      const preferred = resolveRendererPreference();
      const baseOpts = {
        canvas: el,
        width: initW,
        height: initH,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      } as const;
      let app: Application;
      try {
        app = new Application();
        // Pixi 8: `preference` as a single string tries that backend
        // first, then falls back automatically. The outer catch still
        // handles hard init failures (e.g. GPU device lost at boot).
        await app.init({ ...baseOpts, preference: preferred });
      } catch (err) {
        if (preferred === "webgpu") {
          console.warn("[PixiStage] WebGPU init failed, falling back to WebGL", err);
          app = new Application();
          await app.init({ ...baseOpts, preference: "webgl" });
        } else {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
      if (import.meta.env?.DEV) {
        // Dev-only so production bundles don't ship the console chatter.
        const backend = rendererBackendName(app.renderer.type);
        console.warn(`[PixiStage] renderer backend: ${backend} (preferred=${preferred})`);
      }
      const world = new Container();
      app.stage.addChild(world);
      app.stage.eventMode = "static";

      // Install the MSDF font *before* renderer constructors run. Renderers
      // call `installCityFonts()` internally, which is the raster fallback.
      // `ensureMsdfFont` is idempotent and self-logs on failure; we do not
      // want to block rendering if MSDF declines, so we await and continue.
      await ensureMsdfFont();

      const callbacks = {
        onFileClick: (id: string) => onFileClickRef.current?.(id),
        onFileHover: (id: string | null) => onFileHoverRef.current?.(id),
        onClusterClick: (id: string) => onClusterClickRef.current?.(id),
        onClusterHover: (id: string | null) => onClusterHoverRef.current?.(id),
        onSuperclusterClick: (id: string) => onSuperclusterClickRef.current?.(id),
        onSuperclusterHover: (id: string | null) => onSuperclusterHoverRef.current?.(id),
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

    // Browser-tab-visibility pause source. Only toggles its own reason
    // in the registry — sibling sources (e.g. shell tab inactive) keep
    // the ticker stopped even if the browser tab comes back to focus.
    const handleVisibility = () => {
      setTickerPause("document-hidden", document.hidden);
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
      if (latestPixiCanvas === canvas) latestPixiCanvas = null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — callbacks read via refs, cache keyed by canvas; setTickerPause is useCallback([])

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

  // ── Shell-tab ticker pause source ────────────────────────────────
  // The shell keeps inactive tabs mounted under `display:none`, which
  // means neither unmount nor the browser-level `visibilitychange`
  // fires when the user switches tabs inside the app. Without this
  // every mounted canvas keeps driving its ticker — for renderers that
  // subscribe to Ticker.shared (e.g. EdgeStaticRenderer's animated-dash
  // loop) that's 60Hz of wasted CPU + GPU per hidden tab.
  //
  // Written through the registry instead of calling
  // `app.ticker.start/stop()` directly so this source composes
  // correctly with the document-hidden + context-lost sources. The
  // ticker runs iff EVERY pause source is released — see the
  // `tickerPauseSourcesRef` comment above.
  useEffect(() => {
    if (!pixiReady) return;
    setTickerPause("tab-inactive", !active);
  }, [pixiReady, active, setTickerPause]);

  const hasClusters = !!(clusters && clusters.clusters.length > 0);
  const hasSuperclusters = !!(superclusters && superclusters.superclusters.length > 0);
  const effectiveLod: LodLevel = resolveEffectiveTier(lod, { hasClusters, hasSuperclusters });

  // Bucketed scale avoids thrash on tiny zoom ticks.
  //
  // Earlier version used `Math.round(viewport.scale * 20) / 20` — quantising
  // to 0.05-wide buckets. Problem: a continuous zoom crosses ~6 buckets
  // traversing a single LOD tier (e.g. galaxy spans 0.07–0.10), re-firing
  // the overlay-stack and node-tier dispatch useEffects on each crossing
  // even though the actual LOD tier hasn't changed — roughly 100ms of
  // extra work observed during tier transitions.
  //
  // New scheme: bucket by LOD-TIER BOUNDARY rather than scalar size.
  // `effectiveLod` already reflects tier crossings via the LodManager's
  // hysteresis, so deriving the bucket from it means dispatch effects
  // re-fire ONCE per tier transition instead of 6 times.
  //
  // A minimal "within-band" `hi`/`lo` split preserves sub-tier perceptual
  // changes (e.g. deep-galaxy vs shallow-galaxy) so renderers that care
  // about gradient tints still get one boundary signal per half-band
  // without the old fan-out.
  const tierForBucket = getTierConfig(effectiveLod);
  const tierMid = (tierForBucket.upThreshold + tierForBucket.downThreshold) * 0.5;
  const scaleBucket = `${tierForBucket.name}:${viewport.scale >= tierMid ? "hi" : "lo"}`;

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
  const effectiveLayerFilter: Record<EdgeLayer, boolean> = useMemo(() => ({
    structural: tierLayers.structural && (edgeLayers?.structural ?? true),
    flow:       tierLayers.flow       && (edgeLayers?.flow       ?? true),
    safety:     tierLayers.safety     && (edgeLayers?.safety     ?? true),
    impact:     tierLayers.impact     && (edgeLayers?.impact     ?? true),
  }), [
    tierLayers.structural, tierLayers.flow, tierLayers.safety, tierLayers.impact,
    edgeLayers?.structural, edgeLayers?.flow, edgeLayers?.safety, edgeLayers?.impact,
  ]);
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
  const effectiveEdgeFocus = useMemo(
    () => edgeFocus ?? (
      activeTrace && traceEdgeSet
        ? { edgeIds: EMPTY_EDGE_ID_SET, dimAlpha: TRACE_DIM_ALPHA }
        : undefined
    ),
    [edgeFocus, activeTrace, traceEdgeSet],
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

  // Build the overlay ctx once per React render. Cheap — it's just an
  // object literal. Both the legacy effect path and the ticker path
  // read from the same `latestCtxRef` so the data source is identical;
  // only *when* it's applied to the renderer stack differs.
  const overlayCtx: OverlayRenderCtx = useMemo(() => {
    const edgesToRender = showEdges && anyLayerOn ? visible.edges : [];
    return {
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
      hebPaths,
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
  }, [
    visible, layout, viewport, viewState, effectiveLod, edgeCache, fileLookup,
    showEdges, edgeKinds, effectiveLayerFilter, effectiveMinSeverity, edgeWidthMul,
    effectiveEdgeFocus, edgePredicate, edgeViolations,
    temporalEdgeSet, diffAdded, diffRemoved,
    showCrossGraphEdges, highlightCrossGraph, crossGraphFlash, hebPaths,
    clusterEdgesToRender, sccBubblesAllowed, startHereAllowed, startHereTopN,
    activeTrace, agentPresence, showAgentPresence, anyLayerOn,
    effects, showEffectBadges,
  ]);

  // Build the node-tier ctx similarly.
  const nodeCtx: RenderContext | null = useMemo(() => {
    switch (tier.sceneKind) {
      case "files":
        return {
          sceneKind: "files",
          files: visible.files,
          layout,
          viewState,
          viewport,
          metrics: layout.metrics,
          latency,
          showLatencyOverlay,
        };
      case "clusters":
        return { sceneKind: "clusters", clusters: clusters?.clusters ?? [], viewport };
      case "superclusters":
        return { sceneKind: "superclusters", superclusters: superclusters?.superclusters ?? [], viewport };
      default:
        return null;
    }
  }, [tier.sceneKind, visible.files, clusters, superclusters, layout, viewState, viewport, latency, showLatencyOverlay]);

  // Latest-value refs so the ticker callback can read current ctx without
  // re-subscribing. Without these, the ticker would need its own deps
  // list — reintroducing the problem we're solving.
  const latestOverlayCtxRef = useRef(overlayCtx);
  const latestNodeCtxRef = useRef(nodeCtx);
  const latestTierRef = useRef(tier);
  latestOverlayCtxRef.current = overlayCtx;
  latestNodeCtxRef.current = nodeCtx;
  latestTierRef.current = tier;

  // Last-known active renderer kind, used to avoid calling `.clear()` on
  // inactive renderers every dispatch tick. The old body iterated ALL
  // handles on every pan frame and called `.clear()` on every non-active
  // one — for 5-6 registered renderers (ground, street, city, galaxy,
  // cluster, supercluster) that was 5 redundant no-op clears per pan.
  // Individually cheap (setInstanceCount(0) + Graphics.clear()) but they
  // compound on continuous pan, and at LOD transitions they add real
  // allocator churn on the newly-deactivated renderer. We now clear
  // ONLY the prior-active renderer when the tier actually flipped.
  const prevActiveKindRef = useRef<typeof tier.rendererKind | null>(null);

  // ── Legacy path: large useEffects, run only when flag is OFF ─────
  // These are identical to the pre-refactor effects. Under the flag
  // they are no-ops; under the ticker path the render loop below
  // drives dispatch instead.
  useEffect(() => {
    if (TICKER_RENDER_LOOP_ENABLED) return;
    if (!pixiReady) return;
    const handles = nodeHandlesRef.current;
    if (!handles) return;
    const ctx = latestNodeCtxRef.current;
    const t = latestTierRef.current;
    const activeKind = t.rendererKind;
    const activeHandle = handles.get(activeKind);
    if (activeHandle && ctx) activeHandle.update(ctx);
    // Dirty-flag clear — only the previously-active renderer needs a
    // clear call on tier transition. Other renderers are already idle
    // (never dispatched, instance-count still 0) so clearing them
    // would be a no-op with overhead.
    const prevKind = prevActiveKindRef.current;
    if (prevKind !== null && prevKind !== activeKind) {
      const prevHandle = handles.get(prevKind);
      if (prevHandle) prevHandle.clear();
    }
    prevActiveKindRef.current = activeKind;
  }, [pixiReady, visible.files, clusters, superclusters, layout, effectiveLod, scaleBucket, viewState.selectedFileId, viewState.hoveredFileId, latency, showLatencyOverlay]);

  useEffect(() => {
    if (TICKER_RENDER_LOOP_ENABLED) return;
    if (!pixiReady) return;
    const stack = overlaysRef.current;
    if (!stack) return;
    stack.update(latestOverlayCtxRef.current);
  }, [
    pixiReady, visible, layout, edgeCache, scaleBucket, effectiveLod, fileLookup,
    viewState.selectedEdgeId, viewState.hoveredEdgeId, viewState.hoveredFileId,
    showEdges, edgeKinds, effectiveLayerFilter.structural, effectiveLayerFilter.flow, effectiveLayerFilter.safety, effectiveLayerFilter.impact,
    effectiveMinSeverity, edgeWidthMul, effectiveEdgeFocus, edgePredicate, edgeViolations,
    temporalEdgeSet, diffAdded, diffRemoved,
    showCrossGraphEdges, highlightCrossGraph, crossGraphFlash, hebPaths,
    clusterEdgesToRender, sccBubblesAllowed, startHereAllowed, startHereTopN,
    activeTrace, agentPresence, showAgentPresence,
    effects, showEffectBadges,
  ]);

  // ── Ticker path: mark-dirty effects + single ticker subscriber ───
  // Each small effect below only flips a dirty bit when its slice of
  // the scene changed referentially. React still runs the comparisons,
  // but each deps array has 1–4 entries instead of 30+, and the body
  // is a single boolean write — not a renderer update.
  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("layout");
  }, [visible.files, clusters, superclusters, layout, effectiveLod]);

  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("edges");
  }, [visible.edges, edgeCache, clusterEdgesToRender, edgeViolations, temporalEdgeSet, diffAdded, diffRemoved, hebPaths]);

  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("filters");
  }, [
    showEdges, edgeKinds,
    effectiveLayerFilter.structural, effectiveLayerFilter.flow, effectiveLayerFilter.safety, effectiveLayerFilter.impact,
    effectiveMinSeverity, edgeWidthMul, effectiveEdgeFocus, edgePredicate,
    showCrossGraphEdges, highlightCrossGraph, showEffectBadges, showLatencyOverlay,
  ]);

  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("viewport");
  }, [viewport, scaleBucket]);

  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("selection");
  }, [viewState.selectedFileId, viewState.hoveredFileId, viewState.selectedEdgeId, viewState.hoveredEdgeId]);

  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    markDirty("overlays");
  }, [
    sccBubblesAllowed, startHereAllowed, startHereTopN,
    activeTrace, agentPresence, showAgentPresence,
    effects, crossGraphFlash,
  ]);

  // Single ticker subscription. Runs once per animation frame, checks
  // six booleans, and dispatches only the renderers whose inputs
  // actually changed. The ticker is `Ticker.shared` so the renderer
  // stack's per-overlay tickers (PresenceRing, TraceEdge dash-offset,
  // etc.) keep ticking independently — we only own the *scene update*
  // cadence, not animation cadence.
  useEffect(() => {
    if (!TICKER_RENDER_LOOP_ENABLED) return;
    if (!pixiReady) return;
    // First frame after ready: force a full render so initial content
    // appears even if no prop has changed since mount.
    markAllDirty();
    const ticker = Ticker.shared;
    const tick = (_t: Ticker): void => {
      const flags: DirtyFlags = consumeDirty();
      if (!anyDirty(flags)) return;
      const handles = nodeHandlesRef.current;
      const stack = overlaysRef.current;
      // Node-tier dispatch: any layout/selection/viewport bit
      // potentially affects the active renderer's instance buffers
      // (selection ring, hover highlight, zoom-driven label density).
      if (handles && (flags.layout || flags.selection || flags.viewport || flags.filters)) {
        const ctx = latestNodeCtxRef.current;
        const t = latestTierRef.current;
        const activeHandle = handles.get(t.rendererKind);
        if (activeHandle && ctx) activeHandle.update(ctx);
        for (const [kind, handle] of handles) {
          if (kind !== t.rendererKind) handle.clear();
        }
      }
      // Overlay stack dispatch: any of the six bits can touch some
      // overlay, and the stack internally dispatches to each
      // registered overlay with the shared ctx. The per-overlay
      // gates inside `overlay-registry.ts` remain the fine-grained
      // filter.
      if (stack) {
        stack.update(latestOverlayCtxRef.current);
      }
    };
    ticker.add(tick);
    return () => {
      ticker.remove(tick);
    };
  }, [pixiReady]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, display: "block" }}
    />
  );
}
