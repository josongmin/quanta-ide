import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
// FSD rule: `shared/` must not import from `entities/`. TierEdge /
// TierSpec originate in canvas-engine (the entities slice just
// re-exports them), so we take the lib import directly.
import type {
  Entity,
  HierarchicalLayout,
  Rect,
  TierEdge,
  TierSpec,
} from "@quanta/canvas-engine";
import { pixiColor, pixiKindColor } from "../ui/tokens";

// PixiScene — framework-agnostic WebGL renderer for the Code Universe
// viewport. Owns the Pixi Application + a single world Container that
// holds edges/rects/labels. React drives it by constructing a frame
// (camera + culled entities + edges + selection/hover) and calling
// `setFrame`; this module does the actual GL work and owns pointer/
// wheel input, reporting back to React via the `callbacks` shape.
//
// Why imperative rather than a React component: per-frame geometry
// rebuilds must bypass React reconciliation entirely or we burn the
// main thread on virtual-DOM diffs for every pan tick. React state
// flips once per camera change; the scene consumes that flip and
// pushes raw vertex/text updates.

const LABEL_BUDGET = 320;
const LABEL_POOL_CAP = 256;
const MIN_LABEL_PX_H = 22;
/** Card screen size above which the primary name is rendered. */
const PRIMARY_MIN_PX_W = 54;
/** Card screen size above which the concrete-kind chip ("Directory",
 *  "File", "Module") is drawn above the name. Answers "what is this
 *  card?" directly — the dot colour alone is an indirect encoding. */
const KIND_CHIP_MIN_PX_W = 96;
const KIND_CHIP_MIN_PX_H = 56;
/** Card screen size above which the secondary metric line appears. */
const SECONDARY_MIN_PX_W = 148;
const SECONDARY_MIN_PX_H = 72;
/** Card screen size above which the bottom-anchored path line is
 *  drawn. "필요한정보" for the user — locates this entity inside the
 *  workspace without relying on a hover tooltip. */
const PATH_MIN_PX_W = 160;
const PATH_MIN_PX_H = 104;
/** Card screen size above which the kind dot (top-left marker) is
 *  drawn — smaller than this and the dot becomes noise. */
const DOT_MIN_PX_W = 44;
const DOT_MIN_PX_H = 26;
/** Dot-grid bounds — below 12 px spacing it looks like a texture,
 *  above 400 px it looks broken. Outside this range we just paint
 *  the neutral base fill. */
const GRID_MIN_SPACING = 12;
const GRID_MAX_SPACING = 400;
const GRID_WORLD_SPACING = 40;

// Inertia tuning. Velocity is px/ms in screen coords. Decay is per ms
// (raised to elapsed-ms each frame). Stop threshold picks a floor so
// the loop exits promptly instead of creeping forever at sub-pixel speeds.
const INERTIA_MIN_VELOCITY = 0.08;      // px/ms — below this, skip inertia
const INERTIA_STOP_VELOCITY = 0.02;     // px/ms — below this, stop loop
const INERTIA_DECAY_PER_MS = 0.995;     // ^elapsed → ~7%/s decay
const INERTIA_SAMPLE_WINDOW_MS = 80;    // use moves inside this window for vel

// Figma-esque wheel zoom feel. Trackpad pinch emits many small deltas;
// mouse wheel emits few large deltas (typically ±100). A single K that
// feels good on both is impossible, so we branch on magnitude: coarse
// (mouse) gets a lower K so each notch ≈ 1.2× zoom step; fine (trackpad)
// gets a higher K so a steady pinch gesture accumulates smoothly.
const WHEEL_ZOOM_K_COARSE = 0.002;
const WHEEL_ZOOM_K_FINE = 0.01;
const WHEEL_COARSE_THRESHOLD = 50;

// Tier-change reveal: new-tier content appears scaled down + transparent
// and eases toward identity. Pivots at the world-space viewport center so
// the scale-up reads as "content pushing forward from behind" instead of
// sliding in from a corner.
const TIER_TRANSITION_MS = 240;
const TIER_TRANSITION_FROM_SCALE = 0.92;
const TIER_TRANSITION_FROM_ALPHA = 0;

// Card visual tokens.
// ----------------------------------------------------------------
// Cards are treated as heatmap cells, not chips. Fill = a sequential
// heat color driven by the active layout-weight (LoC / Risk / Files)
// so the eye reads density at a glance instead of hunting for a 13-px
// number inside a 400-px empty white rectangle. Border stays hairline
// so adjacent cells read as a single continuous surface, treemap-
// style, rather than a grid of floating islands.
const CARD_BORDER_DEFAULT = pixiColor.border;
const CARD_BORDER_HOVER = pixiColor.borderStrong;
const CARD_BORDER_SELECTED = pixiColor.accent;
const CARD_FILL_DEFAULT = 0xffffff;   // neutral rest fill
const CARD_FILL_SELECTED = 0xfef3c7;  // warm tint so selection reads before border even at dense zoom

// Heat scale — 5-stop sequential palette from neutral gray through
// cool blue, warm amber, into saturated red. Designed to work on a
// white surface (t=0 is a hair off-white, t=1 stays legible under
// black text). Tuned for light-mode; dark-mode will want a mirrored
// scale when we ship it.
export const HEAT_STOPS: readonly [number, number][] = [
  [0.0, 0xf5f5f5],
  [0.25, 0xdbeafe],
  [0.5, 0xfef3c7],
  [0.75, 0xfed7aa],
  [1.0, 0xfca5a5],
];
/** Minimum heat tint — even entities with 0 metric get a readable
 *  neutral instead of pure white, so the canvas never looks empty. */
export const HEAT_FLOOR = 0xfafafa;

export type HeatMode = "loc" | "risk" | "files" | "none";

export interface SceneCamera {
  tx: number;
  ty: number;
  scale: number;
}

export interface SceneFrame {
  entities: readonly Entity[];
  layout: HierarchicalLayout;
  edges: readonly TierEdge[];
  camera: SceneCamera;
  width: number;
  height: number;
  tier: TierSpec;
  selectedId: string | null;
  hoveredId: string | null;
  /** Metric that paints each card's heatmap fill AND drives the
   *  secondary-label prefix. Mirrors the active `LayoutWeight` store
   *  mode so layout size + fill intensity tell the same story. */
  heatMode: HeatMode;
  /** Optional per-entity fill colour (0xRRGGBB). When present it
   *  wins over the kind-palette — used by Risk / Heat / Layer colour
   *  modes to paint entities with static-analysis-derived colours. */
  colorOverride?: ReadonlyMap<string, number> | null;
  /** Optional per-entity alert badges rendered at the rect's top-right
   *  corner. Each badge stands in for one signal family — taint / dead
   *  code / arch violation / blast critical / high complexity. */
  badges?: ReadonlyMap<string, readonly SceneBadge[]> | null;
}

export type SceneBadgeKind = "taint" | "dead" | "arch" | "blast" | "cpx";

export interface SceneBadge {
  kind: SceneBadgeKind;
  count: number;
}

export interface SceneCallbacks {
  onZoomAt(clientX: number, clientY: number, factor: number): void;
  onWheelPan(dx: number, dy: number): void;
  onDragStart(): void;
  onDragPan(dx: number, dy: number): void;
  onEntityClick(id: string): void;
  onEntityHover(id: string | null): void;
}

// StrictMode-safe scene lifecycle. Without the canvas-keyed WeakMap +
// grace window, React's dev-mode mount → unmount → mount double-
// effect spawns two concurrent `app.init()` calls on the same <canvas>,
// leaking WebGL contexts until the browser caps (~16) trigger a hard
// crash. Matches the pattern canvas-pixi uses in its usePixiBundle.
const sceneByCanvas = new WeakMap<HTMLCanvasElement, PixiScene>();
const pendingDestroys = new WeakMap<HTMLCanvasElement, ReturnType<typeof setTimeout>>();
const UNMOUNT_DESTROY_DELAY_MS = 50;

/** Acquire (or reuse) the scene for this canvas. Safe to call on
 *  every mount; a pending destroy from the previous unmount gets
 *  cancelled so the same scene carries across StrictMode remount. */
export function acquirePixiScene(
  canvas: HTMLCanvasElement,
  callbacksRef: { current: SceneCallbacks },
): PixiScene {
  const pending = pendingDestroys.get(canvas);
  if (pending !== undefined) {
    clearTimeout(pending);
    pendingDestroys.delete(canvas);
  }
  const existing = sceneByCanvas.get(canvas);
  if (existing) {
    existing.bindCallbacksRef(callbacksRef);
    return existing;
  }
  const scene = new PixiScene(canvas, callbacksRef);
  sceneByCanvas.set(canvas, scene);
  void scene.init();
  return scene;
}

/** Release the scene. Destruction is delayed so a remount inside the
 *  grace window reuses the same scene instead of spawning a second
 *  `app.init()` on the same canvas. */
export function releasePixiScene(canvas: HTMLCanvasElement, scene: PixiScene): void {
  const prior = pendingDestroys.get(canvas);
  if (prior !== undefined) clearTimeout(prior);
  const timer = setTimeout(() => {
    pendingDestroys.delete(canvas);
    const live = sceneByCanvas.get(canvas);
    if (live === scene) {
      sceneByCanvas.delete(canvas);
      scene.destroy();
    }
  }, UNMOUNT_DESTROY_DELAY_MS);
  pendingDestroys.set(canvas, timer);
}

export class PixiScene {
  private app: Application | null = null;
  /** Stage-level background — screen-coord Graphics that paints the
   *  neutral canvas base + the dot grid. Sits UNDER the world
   *  transform so its dots stay put in screen space while the camera
   *  moves; that's the Figma-style "world scrolls behind a static
   *  surface" feel. */
  private bgGfx: Graphics | null = null;
  private world: Container | null = null;
  private content: Container | null = null;
  private rectGfx: Graphics | null = null;
  private edgeGfx: Graphics | null = null;
  private labelLayer: Container | null = null;
  private readonly labels = new Map<string, Text>();
  private readonly subLabels = new Map<string, Text>();
  private readonly kindLabels = new Map<string, Text>();
  private readonly pathLabels = new Map<string, Text>();
  private readonly labelPool: Text[] = [];
  private readonly subLabelPool: Text[] = [];
  private readonly kindLabelPool: Text[] = [];
  private readonly pathLabelPool: Text[] = [];
  private lastFrame: SceneFrame | null = null;
  private lastTierName: string | null = null;
  private tierTransitionStart = 0;
  private tierTransitionRafId = 0;
  private ready = false;
  private disposed = false;
  private initStarted = false;

  private dragging: { id: number; x: number; y: number } | null = null;
  private pendingHover: { x: number; y: number } | null = null;
  private hoverRafId = 0;
  private lastHoverId: string | null = null;
  private drawRafId = 0;
  // Inertia state — a rolling sample window of recent pointer moves +
  // an active decay loop handle. Only one loop runs at a time; any new
  // pointer input cancels it.
  private velocitySamples: { dx: number; dy: number; t: number }[] = [];
  private inertiaRafId = 0;
  private inertiaVel: { vx: number; vy: number; lastT: number } | null = null;
  // Space-held force-pan: matches Figma's muscle memory where holding
  // Space turns the cursor into grab and any pointerdown pans the view
  // even over otherwise-clickable entities. Restored on keyup.
  private spaceHeld = false;
  private hoverUnderCursor = false;

  private callbacksRef: { current: SceneCallbacks };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    callbacksRef: { current: SceneCallbacks },
  ) {
    this.callbacksRef = callbacksRef;
  }

  /** Point the scene at a new React-side callbacks ref — used when a
   *  StrictMode remount reuses an existing scene; the first mount's
   *  ref object may have been discarded. */
  bindCallbacksRef(next: { current: SceneCallbacks }): void {
    this.callbacksRef = next;
  }

  async init(): Promise<void> {
    if (this.initStarted) return;
    this.initStarted = true;
    const app = new Application();
    try {
      await app.init({
        canvas: this.canvas,
        width: Math.max(1, this.canvas.clientWidth || 800),
        height: Math.max(1, this.canvas.clientHeight || 600),
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preference: "webgl",
      });
    } catch (err) {
      console.error("[PixiScene] app.init failed", err);
      return;
    }
    if (this.disposed) {
      // Pass { removeView: false } so a disposed scene doesn't yank
      // the <canvas> out of the DOM. The React ref still points at it
      // and a remount reuses the same element.
      try { app.destroy({ removeView: false }, { children: true }); } catch { /* ignore */ }
      return;
    }
    this.app = app;
    // Background layer first — screen-coord, parented directly to
    // stage so the world transform doesn't touch it. Paints the
    // neutral canvas fill + dot grid every frame.
    const bgGfx = new Graphics();
    app.stage.addChild(bgGfx);
    const world = new Container();
    app.stage.addChild(world);
    // `content` wraps edges/rects/labels so the tier-change reveal can
    // tween alpha + pivot-centered scale on one container instead of
    // per-layer, and without disturbing the camera transform applied to
    // `world`. Pivot/position are recomputed each frame (see flushFrame).
    const content = new Container();
    world.addChild(content);
    const edgeGfx = new Graphics();
    const rectGfx = new Graphics();
    const labelLayer = new Container();
    // Order matters: edges paint under rects, labels paint on top.
    content.addChild(edgeGfx);
    content.addChild(rectGfx);
    content.addChild(labelLayer);
    this.bgGfx = bgGfx;
    this.world = world;
    this.content = content;
    this.edgeGfx = edgeGfx;
    this.rectGfx = rectGfx;
    this.labelLayer = labelLayer;
    this.attachInput();
    this.attachContextGuards();
    this.attachVisibility();
    this.attachSpaceKey();
    this.updateCursor();
    this.ready = true;
    if (this.lastFrame) this.setFrame(this.lastFrame);
  }

  // Space-held force-pan (Figma convention). Window-level so it catches
  // the key regardless of focus — canvas focus is weak; users expect
  // Space to work from anywhere inside the viewport.
  private attachSpaceKey(): void {
    window.addEventListener("keydown", this.onWindowKeyDown);
    window.addEventListener("keyup", this.onWindowKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
  }
  private detachSpaceKey(): void {
    window.removeEventListener("keydown", this.onWindowKeyDown);
    window.removeEventListener("keyup", this.onWindowKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
  }
  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== "Space") return;
    // Don't steal Space from text inputs or contentEditable surfaces.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (this.spaceHeld) return;
    this.spaceHeld = true;
    this.updateCursor();
  };
  private readonly onWindowKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== "Space") return;
    if (!this.spaceHeld) return;
    this.spaceHeld = false;
    this.updateCursor();
  };
  private readonly onWindowBlur = (): void => {
    // Window loses focus while Space is still held (e.g. Cmd-Tab)
    // leaves the flag stuck. Resetting on blur keeps the cursor honest.
    if (this.spaceHeld) {
      this.spaceHeld = false;
      this.updateCursor();
    }
  };

  private updateCursor(): void {
    if (this.disposed) return;
    let cursor: string;
    if (this.dragging) cursor = "grabbing";
    else if (this.spaceHeld) cursor = "grab";
    else if (this.hoverUnderCursor) cursor = "pointer";
    else cursor = "grab";
    if (this.canvas.style.cursor !== cursor) {
      this.canvas.style.cursor = cursor;
    }
  }

  // Backgrounded tabs burn GPU for nothing and invite the browser to
  // drop the GL context under memory pressure. Stop the ticker when
  // hidden, resume when visible again.
  private attachVisibility(): void {
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }
  private detachVisibility(): void {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
  private readonly onVisibilityChange = (): void => {
    const app = this.app;
    if (!app) return;
    if (document.hidden) {
      try { app.ticker.stop(); } catch { /* ignore */ }
    } else {
      try { app.ticker.start(); } catch { /* ignore */ }
      if (this.lastFrame) this.setFrame(this.lastFrame);
    }
  };

  // WebGL contexts die under tab-background memory pressure, GPU driver
  // resets, or when the browser hits its ~16 live-context cap. Without
  // these handlers the Pixi ticker keeps running against a dead GL
  // context and the whole tab freezes until reload. Pause on lost,
  // flush a fresh frame on restore so the next paint catches up.
  private attachContextGuards(): void {
    const el = this.canvas;
    el.addEventListener("webglcontextlost", this.onContextLost as EventListener);
    el.addEventListener("webglcontextrestored", this.onContextRestored as EventListener);
  }
  private detachContextGuards(): void {
    const el = this.canvas;
    el.removeEventListener("webglcontextlost", this.onContextLost as EventListener);
    el.removeEventListener("webglcontextrestored", this.onContextRestored as EventListener);
  }
  private readonly onContextLost = (e: Event): void => {
    // preventDefault on the lost event is what tells the browser we
    // plan to recover — without it, restore won't fire. Ticker pause
    // stops the doomed render loop until we have a live context again.
    e.preventDefault();
    try { this.app?.ticker.stop(); } catch { /* ignore */ }
  };
  private readonly onContextRestored = (): void => {
    try { this.app?.ticker.start(); } catch { /* ignore */ }
    if (this.lastFrame) this.setFrame(this.lastFrame);
  };

  setFrame(frame: SceneFrame): void {
    this.lastFrame = frame;
    if (!this.ready) return;
    // rAF-dedup — React can push several setFrames per tick (visible
    // set change + camera tween frame + hover update all land in the
    // same microtask flush). Without coalescing we'd run drawEdges /
    // drawRects / drawLabels multiple times per paint, pegging the
    // main thread. One redraw per rAF, always on the freshest frame.
    if (this.drawRafId) return;
    this.drawRafId = requestAnimationFrame(() => {
      this.drawRafId = 0;
      this.flushFrame();
    });
  }

  private flushFrame(): void {
    const frame = this.lastFrame;
    if (!frame || !this.ready || !this.app || !this.world) return;
    const { camera, width, height } = frame;
    if (width <= 0 || height <= 0) return;
    // `renderer.screen` is the CSS-px screen size (unlike renderer.width
    // which is scaled by resolution). Only resize when the CSS size
    // changes so we don't churn GL framebuffers every React flush.
    const screen = this.app.renderer.screen;
    if (screen.width !== width || screen.height !== height) {
      this.app.renderer.resize(width, height);
    }
    this.world.position.set(camera.tx, camera.ty);
    this.world.scale.set(camera.scale);
    // Tier-change reveal: detect a new tier name and kick off a
    // 240ms ease-out tween on `content` (scale 0.92→1 + alpha 0→1),
    // pivoted on the world-space viewport center so new content reads
    // as emerging forward from behind rather than sliding from origin.
    const tierName = frame.tier.name;
    if (this.lastTierName !== null && this.lastTierName !== tierName) {
      this.tierTransitionStart = performance.now();
      this.ensureTierTransitionLoop();
    }
    this.lastTierName = tierName;
    this.applyTierTransition(frame);
    this.drawBackground(frame);
    this.drawEdges(frame);
    this.drawRects(frame);
    this.drawLabels(frame);
  }

  private drawBackground(frame: SceneFrame): void {
    const g = this.bgGfx;
    if (!g) return;
    const { camera, width, height } = frame;
    g.clear();
    // Neutral base — Pixi's backgroundAlpha is 0 so we paint it
    // ourselves. Matches --bg-subtle from the p0 token set so Pixi
    // and HTML panels sit on the same flat surface.
    g.rect(0, 0, width, height);
    g.fill(pixiColor.bgSubtle);
    // Dot grid. Spacing in screen-px = WORLD_SPACING * camera.scale.
    // Clamp so the grid isn't a dense noise at max zoom or a sparse
    // nothing at min zoom.
    const screenSpacing = GRID_WORLD_SPACING * camera.scale;
    if (screenSpacing < GRID_MIN_SPACING || screenSpacing > GRID_MAX_SPACING) return;
    const offsetX = wrapMod(camera.tx, screenSpacing);
    const offsetY = wrapMod(camera.ty, screenSpacing);
    const dotR = Math.min(1.2, 0.45 + screenSpacing / 140);
    for (let x = offsetX; x <= width; x += screenSpacing) {
      for (let y = offsetY; y <= height; y += screenSpacing) {
        g.circle(x, y, dotR);
      }
    }
    g.fill({ color: pixiColor.grid, alpha: 0.055 });
  }

  private applyTierTransition(frame: SceneFrame): void {
    const content = this.content;
    if (!content) return;
    const startedAt = this.tierTransitionStart;
    if (startedAt === 0) {
      content.alpha = 1;
      content.scale.set(1);
      content.pivot.set(0, 0);
      content.position.set(0, 0);
      return;
    }
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, Math.max(0, elapsed / TIER_TRANSITION_MS));
    const e = 1 - (1 - t) * (1 - t) * (1 - t);
    if (t >= 1) {
      this.tierTransitionStart = 0;
      content.alpha = 1;
      content.scale.set(1);
      content.pivot.set(0, 0);
      content.position.set(0, 0);
      return;
    }
    // Pivot on the viewport center in world coordinates so the scale
    // tween grows content in-place visually. Position mirrors pivot to
    // keep the on-screen center locked while scaling.
    const { camera, width, height } = frame;
    const worldCenterX = (width / 2 - camera.tx) / camera.scale;
    const worldCenterY = (height / 2 - camera.ty) / camera.scale;
    const scaleVal = TIER_TRANSITION_FROM_SCALE + (1 - TIER_TRANSITION_FROM_SCALE) * e;
    const alphaVal = TIER_TRANSITION_FROM_ALPHA + (1 - TIER_TRANSITION_FROM_ALPHA) * e;
    content.pivot.set(worldCenterX, worldCenterY);
    content.position.set(worldCenterX, worldCenterY);
    content.scale.set(scaleVal);
    content.alpha = alphaVal;
  }

  private ensureTierTransitionLoop(): void {
    if (this.tierTransitionRafId) return;
    const step = (): void => {
      this.tierTransitionRafId = 0;
      if (this.disposed || this.tierTransitionStart === 0) return;
      this.flushFrame();
      if (this.tierTransitionStart !== 0) {
        this.tierTransitionRafId = requestAnimationFrame(step);
      }
    };
    this.tierTransitionRafId = requestAnimationFrame(step);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.hoverRafId) cancelAnimationFrame(this.hoverRafId);
    if (this.drawRafId) cancelAnimationFrame(this.drawRafId);
    if (this.tierTransitionRafId) cancelAnimationFrame(this.tierTransitionRafId);
    this.tierTransitionRafId = 0;
    this.tierTransitionStart = 0;
    this.detachInput();
    this.detachContextGuards();
    this.detachVisibility();
    this.detachSpaceKey();
    this.stopInertia();
    for (const t of this.labels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.labels.clear();
    for (const t of this.subLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.subLabels.clear();
    for (const t of this.labelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.labelPool.length = 0;
    for (const t of this.subLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.subLabelPool.length = 0;
    const app = this.app;
    this.app = null;
    this.bgGfx = null;
    this.world = null;
    this.content = null;
    this.rectGfx = null;
    this.edgeGfx = null;
    this.labelLayer = null;
    if (app) {
      try { app.destroy({ removeView: false }, { children: true }); } catch { /* ignore */ }
    }
  }

  private drawRects(frame: SceneFrame): void {
    const g = this.rectGfx;
    if (!g) return;
    const { entities, layout, camera, width, height, selectedId, hoveredId } = frame;
    g.clear();
    const s = camera.scale;
    const invS = 1 / s;
    // All card measurements are in world units, derived from the
    // desired screen-px so they stay hairline at any zoom.
    const radius = 6 * invS;
    const strokeDefault = 1 * invS;
    const strokeHover = 1.25 * invS;
    const strokeSelected = 2 * invS;
    const dotR = 3.25 * invS;
    const dotInset = 10 * invS;
    // Pass 1: paint unselected cards. Pass 2: paint hovered.
    // Pass 3: paint selected ON TOP so their accent border and subtle
    // tint always win the z-order even if rects overlap.
    const selected: Entity[] = [];
    const hovered: Entity[] = [];
    // Colour override lookup — the static-analysis colour mode
    // (risk / heat / layer) supplies a per-entity fill map. Missing
    // ids fall through to the kind palette so the override never has
    // to be exhaustive.
    const colorOverride = frame.colorOverride ?? null;
    const fillFor = (entity: Entity, fallback: number): number => {
      if (colorOverride) {
        const o = colorOverride.get(entity.id);
        if (o !== undefined) return o;
      }
      return fallback;
    };
    for (const entity of entities) {
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      if (!isRectOnScreen(r, camera, width, height)) continue;
      const isSel = entity.id === selectedId;
      const isHov = entity.id === hoveredId;
      if (isSel) { selected.push(entity); continue; }
      if (isHov) { hovered.push(entity); continue; }
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_DEFAULT),
        border: CARD_BORDER_DEFAULT,
        strokeW: strokeDefault,
        radius,
        dot: this.shouldPaintDot(r, s) ? { color: pixiKindColor[entity.kind], inset: dotInset, r: dotR } : null,
      });
    }
    for (const entity of hovered) {
      const r = layout.rects.get(entity.id)!;
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_DEFAULT),
        border: CARD_BORDER_HOVER,
        strokeW: strokeHover,
        radius,
        dot: this.shouldPaintDot(r, s) ? { color: pixiKindColor[entity.kind], inset: dotInset, r: dotR } : null,
      });
    }
    for (const entity of selected) {
      const r = layout.rects.get(entity.id)!;
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_SELECTED),
        border: CARD_BORDER_SELECTED,
        strokeW: strokeSelected,
        radius,
        dot: this.shouldPaintDot(r, s) ? { color: pixiKindColor[entity.kind], inset: dotInset, r: dotR } : null,
      });
    }
    // Badge overlay — drawn after all rects so glyphs sit on top and
    // survive the selected-pass z-order. Bound by an overall size
    // threshold so a tiny rect isn't swamped by badge dots.
    if (frame.badges && frame.badges.size > 0) {
      this.drawBadges(g, frame, invS);
    }
  }

  private drawBadges(g: Graphics, frame: SceneFrame, invS: number): void {
    const { entities, layout, camera, width, height, badges } = frame;
    if (!badges) return;
    const s = camera.scale;
    const BADGE_R = 4 * invS;
    const BADGE_GAP = 2 * invS;
    const BADGE_INSET = 9 * invS;
    const MIN_PX_W = 28;
    const MIN_PX_H = 16;
    for (const entity of entities) {
      const list = badges.get(entity.id);
      if (!list || list.length === 0) continue;
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      if (r.w * s < MIN_PX_W || r.h * s < MIN_PX_H) continue;
      if (!isRectOnScreen(r, camera, width, height)) continue;
      let cx = r.x + r.w - BADGE_INSET;
      const cy = r.y + BADGE_INSET;
      for (const b of list) {
        const color = badgeColor(b.kind);
        g.circle(cx, cy, BADGE_R);
        g.fill({ color, alpha: 0.95 });
        g.stroke({ color: 0xffffff, width: 0.75 * invS, alpha: 1 });
        cx -= BADGE_R * 2 + BADGE_GAP;
      }
    }
  }

  private shouldPaintDot(r: Rect, scale: number): boolean {
    return r.w * scale >= DOT_MIN_PX_W && r.h * scale >= DOT_MIN_PX_H;
  }

  private paintCard(
    g: Graphics,
    _entity: Entity,
    r: Rect,
    opts: {
      fill: number;
      border: number;
      strokeW: number;
      radius: number;
      dot: { color: number; inset: number; r: number } | null;
    },
  ): void {
    g.roundRect(r.x, r.y, r.w, r.h, opts.radius);
    g.fill(opts.fill);
    g.stroke({ color: opts.border, width: opts.strokeW, alpha: 1 });
    if (opts.dot) {
      g.circle(r.x + opts.dot.inset, r.y + opts.dot.inset, opts.dot.r);
      g.fill({ color: opts.dot.color, alpha: 1 });
    }
  }

  private drawEdges(frame: SceneFrame): void {
    const g = this.edgeGfx;
    if (!g) return;
    const { edges, layout, camera, width, height, selectedId, hoveredId } = frame;
    g.clear();
    const invScale = 1 / camera.scale;
    // Curvature — fraction of the segment length used as the
    // perpendicular control-point offset. 0.12 reads as a gentle arc
    // without crashing into adjacent rects; all edges curve the same
    // side so parallel edges visually bundle instead of overlapping.
    const CURVE_K = 0.12;
    // Paint non-highlighted edges first, focus-touching edges after,
    // so the emphasis strokes always land on top.
    const focused: TierEdge[] = [];
    for (const edge of edges) {
      const a = layout.rects.get(edge.fromId);
      const b = layout.rects.get(edge.toId);
      if (!a || !b) continue;
      if (!isSegmentOnScreen(a, b, camera, width, height)) continue;
      const touchesFocus =
        edge.fromId === selectedId ||
        edge.toId === selectedId ||
        edge.fromId === hoveredId ||
        edge.toId === hoveredId;
      if (touchesFocus) {
        focused.push(edge);
        continue;
      }
      this.paintEdge(g, a, b, edge, invScale, CURVE_K, pixiColor.edge, 0.22 + Math.min(0.22, edge.count * 0.03));
    }
    for (const edge of focused) {
      const a = layout.rects.get(edge.fromId)!;
      const b = layout.rects.get(edge.toId)!;
      this.paintEdge(g, a, b, edge, invScale, CURVE_K, pixiColor.edgeHighlight, 0.85);
    }
  }

  private paintEdge(
    g: Graphics,
    a: Rect,
    b: Rect,
    edge: TierEdge,
    invScale: number,
    CURVE_K: number,
    color: number,
    alpha: number,
  ): void {
    // Thickness — log-scaled weight so a 100× edge doesn't dwarf the
    // card. Cap at 2.5 screen-px.
    const w = Math.min(2.5, 0.6 + Math.log1p(edge.weight) * 0.45) * invScale;
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const off = CURVE_K * len;
    const cx = (ax + bx) / 2 + (-dy / len) * off;
    const cy = (ay + by) / 2 + (dx / len) * off;
    g.moveTo(ax, ay);
    g.quadraticCurveTo(cx, cy, bx, by);
    g.stroke({ color, width: w, alpha });
  }

  private drawLabels(frame: SceneFrame): void {
    const layer = this.labelLayer;
    if (!layer) return;
    const { entities, layout, camera, width, height, selectedId } = frame;
    const usedPrimary = new Set<string>();
    const usedSecondary = new Set<string>();
    const s = camera.scale;
    const invS = 1 / s;
    let budget = LABEL_BUDGET;
    for (const entity of entities) {
      if (budget <= 0) break;
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      const screenW = r.w * s;
      const screenH = r.h * s;
      if (screenW < PRIMARY_MIN_PX_W || screenH < MIN_LABEL_PX_H) continue;
      if (!isRectOnScreen(r, camera, width, height)) continue;

      const hasDot = screenW >= DOT_MIN_PX_W && screenH >= DOT_MIN_PX_H;
      const leftPad = (hasDot ? 22 : 10) * invS;
      const topPad = 6 * invS;
      const isSel = entity.id === selectedId;
      const primaryColor = isSel ? pixiColor.accent : pixiColor.text;

      // Primary: entity name — 13 screen-px, semibold, near-black.
      let t = this.labels.get(entity.id);
      if (!t) {
        const pooled = this.labelPool.pop();
        if (pooled) {
          if (pooled.text !== entity.name) pooled.text = entity.name;
          t = pooled;
        } else {
          t = new Text({
            text: entity.name,
            style: new TextStyle({
              fontFamily: "'Inter Tight', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: "600",
              fill: primaryColor,
              letterSpacing: -0.15,
            }),
          });
        }
        layer.addChild(t);
        this.labels.set(entity.id, t);
      } else if (t.text !== entity.name) {
        t.text = entity.name;
      }
      const primaryStyle = t.style as TextStyle;
      if (primaryStyle.fill !== primaryColor) primaryStyle.fill = primaryColor;
      t.scale.set(invS);
      t.position.set(r.x + leftPad, r.y + topPad);
      usedPrimary.add(entity.id);
      budget--;

      // Secondary metric line — only when the card has room.
      if (screenW < SECONDARY_MIN_PX_W || screenH < SECONDARY_MIN_PX_H) continue;
      if (budget <= 0) break;
      const secondary = formatSecondary(entity);
      if (!secondary) continue;

      let s2 = this.subLabels.get(entity.id);
      if (!s2) {
        const pooled = this.subLabelPool.pop();
        if (pooled) {
          if (pooled.text !== secondary) pooled.text = secondary;
          s2 = pooled;
        } else {
          s2 = new Text({
            text: secondary,
            style: new TextStyle({
              fontFamily: "'Inter Tight', system-ui, sans-serif",
              fontSize: 11,
              fontWeight: "500",
              fill: pixiColor.textSubtle,
              letterSpacing: -0.05,
            }),
          });
        }
        layer.addChild(s2);
        this.subLabels.set(entity.id, s2);
      } else if (s2.text !== secondary) {
        s2.text = secondary;
      }
      s2.scale.set(invS);
      s2.position.set(r.x + leftPad, r.y + 24 * invS);
      usedSecondary.add(entity.id);
      budget--;
    }
    // Recycle primary labels that didn't show up this frame.
    for (const [id, t] of this.labels) {
      if (usedPrimary.has(id)) continue;
      layer.removeChild(t);
      this.labels.delete(id);
      if (this.labelPool.length < LABEL_POOL_CAP) this.labelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
    // Recycle secondary labels similarly — independent pool so a card
    // that kept its primary but lost secondary (e.g. zoom-out crossed
    // the SECONDARY_MIN threshold) doesn't leak.
    for (const [id, t] of this.subLabels) {
      if (usedSecondary.has(id)) continue;
      layer.removeChild(t);
      this.subLabels.delete(id);
      if (this.subLabelPool.length < LABEL_POOL_CAP) this.subLabelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
  }

  private attachInput(): void {
    const el = this.canvas;
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);
  }

  private detachInput(): void {
    const el = this.canvas;
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.stopInertia();
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
      // ctrlKey = trackpad pinch (fine deltas) or explicit ctrl+wheel
      // (coarse deltas from a mouse). Pick K by magnitude so both feel
      // right: ~1.02x per trackpad tick, ~1.2x per wheel notch.
      const absDy = Math.abs(e.deltaY);
      const k = absDy > WHEEL_COARSE_THRESHOLD ? WHEEL_ZOOM_K_COARSE : WHEEL_ZOOM_K_FINE;
      const factor = Math.exp(-e.deltaY * k);
      this.callbacksRef.current.onZoomAt(cx, cy, factor);
    } else {
      this.callbacksRef.current.onWheelPan(-e.deltaX, -e.deltaY);
    }
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    // Left (primary) and middle (pan-anywhere) buttons only. Right
    // button should pass through to the browser/native context menu.
    const isPanButton = e.button === 1;
    if (e.button !== 0 && !isPanButton) return;
    this.stopInertia();
    // Space-held or middle-click bypasses hit-test → always drag-pan,
    // even when starting on top of an entity. Matches Figma muscle
    // memory where Space temporarily turns the whole canvas into a
    // grab surface regardless of what's under the cursor.
    const forcePan = this.spaceHeld || isPanButton;
    if (!forcePan) {
      const id = this.hitTestClient(e.clientX, e.clientY);
      if (id !== null) {
        this.callbacksRef.current.onEntityClick(id);
        return;
      }
    }
    this.callbacksRef.current.onDragStart();
    this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.velocitySamples.length = 0;
    this.velocitySamples.push({ dx: 0, dy: 0, t: performance.now() });
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.updateCursor();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const d = this.dragging;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      this.pushVelocitySample(dx, dy, performance.now());
      this.callbacksRef.current.onDragPan(dx, dy);
      return;
    }
    // Hover: rAF-throttled hit-test so a 120Hz pointer stream doesn't
    // run an O(entities) scan per pointer tick.
    this.pendingHover = { x: e.clientX, y: e.clientY };
    if (this.hoverRafId) return;
    this.hoverRafId = requestAnimationFrame(() => {
      this.hoverRafId = 0;
      const at = this.pendingHover;
      this.pendingHover = null;
      if (!at || this.disposed) return;
      const nextId = this.hitTestClient(at.x, at.y);
      if (nextId !== this.lastHoverId) {
        this.lastHoverId = nextId;
        this.callbacksRef.current.onEntityHover(nextId);
      }
      const hovering = nextId !== null;
      if (hovering !== this.hoverUnderCursor) {
        this.hoverUnderCursor = hovering;
        this.updateCursor();
      }
    });
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.dragging?.id === e.pointerId) {
      try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      this.dragging = null;
      this.startInertiaIfFast();
      this.updateCursor();
    }
  };

  private readonly onPointerLeave = (): void => {
    if (this.lastHoverId !== null) {
      this.lastHoverId = null;
      this.callbacksRef.current.onEntityHover(null);
    }
    if (this.hoverUnderCursor) {
      this.hoverUnderCursor = false;
      this.updateCursor();
    }
  };

  // ── Inertia ──────────────────────────────────────────────────────
  // Figma-style flick: compute release velocity from the last ~80ms of
  // pointer motion, then ease it off. Any new input (pointerdown,
  // wheel) calls stopInertia to hand control back to the user.

  private pushVelocitySample(dx: number, dy: number, t: number): void {
    const samples = this.velocitySamples;
    samples.push({ dx, dy, t });
    const cutoff = t - INERTIA_SAMPLE_WINDOW_MS;
    while (samples.length > 1 && samples[0]!.t < cutoff) samples.shift();
  }

  private startInertiaIfFast(): void {
    const samples = this.velocitySamples;
    if (samples.length < 2) return;
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const elapsed = last.t - first.t;
    if (elapsed <= 0) return;
    let sumDx = 0;
    let sumDy = 0;
    // Skip sample[0] — it's the synthetic {0,0} seeded at pointerdown.
    for (let i = 1; i < samples.length; i++) {
      sumDx += samples[i]!.dx;
      sumDy += samples[i]!.dy;
    }
    const vx = sumDx / elapsed;
    const vy = sumDy / elapsed;
    if (Math.hypot(vx, vy) < INERTIA_MIN_VELOCITY) return;
    this.inertiaVel = { vx, vy, lastT: performance.now() };
    this.inertiaRafId = requestAnimationFrame(this.stepInertia);
  }

  private readonly stepInertia = (): void => {
    const st = this.inertiaVel;
    if (!st || this.disposed) {
      this.inertiaRafId = 0;
      return;
    }
    const now = performance.now();
    const dt = now - st.lastT;
    st.lastT = now;
    // Apply current velocity this frame, then decay for elapsed ms so
    // framerate variance doesn't skew the feel.
    this.callbacksRef.current.onDragPan(st.vx * dt, st.vy * dt);
    const decay = Math.pow(INERTIA_DECAY_PER_MS, dt);
    st.vx *= decay;
    st.vy *= decay;
    if (Math.hypot(st.vx, st.vy) < INERTIA_STOP_VELOCITY) {
      this.inertiaVel = null;
      this.inertiaRafId = 0;
      return;
    }
    this.inertiaRafId = requestAnimationFrame(this.stepInertia);
  };

  private stopInertia(): void {
    if (this.inertiaRafId) cancelAnimationFrame(this.inertiaRafId);
    this.inertiaRafId = 0;
    this.inertiaVel = null;
  }

  private hitTestClient(clientX: number, clientY: number): string | null {
    const frame = this.lastFrame;
    if (!frame) return null;
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const { camera, entities, layout } = frame;
    const wx = (sx - camera.tx) / camera.scale;
    const wy = (sy - camera.ty) / camera.scale;
    // Reverse iter — later-painted entries sit on top visually.
    for (let i = entities.length - 1; i >= 0; i--) {
      const entity = entities[i];
      if (!entity) continue;
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return entity.id;
    }
    return null;
  }
}

const BADGE_COLORS: Record<SceneBadgeKind, number> = {
  taint: 0xef4444, // red — tainted data flow
  dead:  0x64748b, // slate — dead code
  arch:  0xf97316, // orange — architectural-layer violation
  blast: 0xa855f7, // violet — blast-radius critical node
  cpx:   0x0ea5e9, // sky — high cyclomatic complexity
};

function badgeColor(kind: SceneBadgeKind): number {
  return BADGE_COLORS[kind];
}

function isRectOnScreen(r: Rect, c: SceneCamera, w: number, h: number): boolean {
  const sx = r.x * c.scale + c.tx;
  const sy = r.y * c.scale + c.ty;
  const sw = r.w * c.scale;
  const sh = r.h * c.scale;
  return sx < w && sx + sw > 0 && sy < h && sy + sh > 0;
}

function isSegmentOnScreen(a: Rect, b: Rect, c: SceneCamera, w: number, h: number): boolean {
  const ax = (a.x + a.w / 2) * c.scale + c.tx;
  const ay = (a.y + a.h / 2) * c.scale + c.ty;
  const bx = (b.x + b.w / 2) * c.scale + c.tx;
  const by = (b.y + b.h / 2) * c.scale + c.ty;
  const minX = Math.min(ax, bx);
  const maxX = Math.max(ax, bx);
  const minY = Math.min(ay, by);
  const maxY = Math.max(ay, by);
  return minX < w && maxX > 0 && minY < h && maxY > 0;
}

/** JS `%` returns negative for negative operands. This variant keeps
 *  the result in [0, n) — required for wrapping the camera offset
 *  into a positive dot-grid phase. */
function wrapMod(v: number, n: number): number {
  return ((v % n) + n) % n;
}

/** Compact number formatter — 1.2k / 34k / 1.2M. Keeps the card
 *  metric line tight enough that we don't bust past the right edge
 *  on mid-size cards. */
function compactNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1_000_000)}M`;
}

/** Build the secondary metric line shown below the entity name on
 *  mid-to-large cards. Order (LoC → children → risk) is fixed so the
 *  eye doesn't have to re-learn the layout between kinds; any of the
 *  pieces may be absent when the metrics aren't populated. */
function formatSecondary(entity: Entity): string | null {
  const m = entity.metrics;
  const childN = entity.childIds.length;
  const parts: string[] = [];
  if (m?.loc !== undefined && m.loc > 0) parts.push(`${compactNum(m.loc)} LoC`);
  if (childN > 0) parts.push(`${compactNum(childN)} ${childN === 1 ? "child" : "children"}`);
  if (m?.riskScore !== undefined) parts.push(`risk ${m.riskScore.toFixed(1)}`);
  return parts.length > 0 ? parts.join("  ·  ") : null;
}
