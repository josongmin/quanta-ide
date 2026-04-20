import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
// FSD rule: `shared/` must not import from `entities/`. TierEdge /
// TierSpec originate in canvas-engine (the entities slice just
// re-exports them), so we take the lib import directly.
import type {
  Entity,
  EntityKind,
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
 *  card?" directly — the dot colour alone is an indirect encoding.
 *  Exported because the chip-drawing path is landing in a follow-up
 *  commit; these thresholds stay the tuning surface. */
export const KIND_CHIP_MIN_PX_W = 96;
export const KIND_CHIP_MIN_PX_H = 56;
/** Card screen size above which the secondary metric line appears. */
const SECONDARY_MIN_PX_W = 148;
const SECONDARY_MIN_PX_H = 72;
/** Card screen size above which the bottom-anchored path line is
 *  drawn. "필요한정보" for the user — locates this entity inside the
 *  workspace without relying on a hover tooltip. Exported for the
 *  same reason as the kind-chip thresholds above. */
export const PATH_MIN_PX_W = 160;
export const PATH_MIN_PX_H = 104;
/** Card screen size above which the kind-letter icon box is painted.
 *  Sized so the box sits flush in the top-left without eating the
 *  whole card at small scales. */
const ICON_BOX_MIN_PX_W = 60;
const ICON_BOX_MIN_PX_H = 36;
// Vector icon lives inside the 24 px left-pad — a 12 px icon with an
// 8 px top-left inset lands cleanly in the title gutter without
// crowding the primary name (which starts at leftPad = 24 px).
const ICON_BOX_SIZE_PX = 12;
const ICON_BOX_INSET_PX = 8;
// Per-kind icons are vector shapes drawn into the card's Graphics
// layer (see `drawKindIcon`) — not Text glyphs. Letters like "P" or
// "F" read as debug placeholders, not icons. The vector shapes mirror
// the mental model: package-box for galaxy, folder for street, file
// sheet for building, etc.
/** Right-side padding (screen px) reserved inside every card when
 *  fitting a label. Keeps the text from kissing the right border and
 *  leaves room for the "…" ellipsis glyph. */
const LABEL_RIGHT_PAD_PX = 8;
/** Fade level applied to non-ego rects / non-focused edges / non-ego
 *  labels when a spotlight set is active. Low enough that the dep
 *  network pops forward, high enough that the user still reads the
 *  dimmed structure as context (not as dead space). */
const SPOTLIGHT_DIM_ALPHA = 0.18;
// Labels dim one step less than rects under spotlight — users still
// need to READ the context even when its visual weight drops.
// Exported so the tuning surface stays discoverable even though the
// label-dim path is still landing.
export const SPOTLIGHT_LABEL_DIM_ALPHA = 0.22;
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

// Tier-change reveal: a short alpha cross-fade and nothing else. The
// earlier iteration also scaled `content` from 0.92 → 1.0 around the
// viewport center, which read as an involuntary zoom-in every time a
// tier flipped — the scope filter now decides what's visible on
// change, so any auto-camera motion fights that intent. Alpha-only
// keeps the "something swapped" cue without moving pixels.
const TIER_TRANSITION_MS = 180;
const TIER_TRANSITION_FROM_ALPHA = 0.25;

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
// Selection reads as a near-black hairline — previous accent-blue + warm
// yellow fill combo felt decorative and clashed with the flat aesthetic.
// Black-on-white is Linear/Notion-style: clear without shouting.
const CARD_BORDER_SELECTED = pixiColor.text;
const CARD_FILL_DEFAULT = 0xffffff;
const CARD_FILL_SELECTED = 0xffffff;
// Header-band hairline only paints on cards that render tall enough to
// give the divider somewhere to breathe. Below this the line crowds the
// text rows and reads as noise (v1 CityNodeRenderer used the same gate).
const CARD_HEADER_MIN_PX_H = 72;

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
  /** Optional spotlight set — when provided and non-empty, entities
   *  whose id is in the set render at full opacity while everyone
   *  else fades to a dimmed base. Drives the "selection → dependency
   *  map" view: selecting a file lights it and its 1-hop neighbours,
   *  the rest of the workspace recedes so the dep graph pops out. */
  spotlightIds?: ReadonlySet<string> | null;
  /** The scope anchor id. Drives the directional-edge styling:
   *  edges whose `fromId === anchorId` render as outbound (accent
   *  blue + arrowhead pointing away from the anchor), `toId === anchorId`
   *  as inbound (green + arrowhead pointing into the anchor). */
  anchorId?: string | null;
  /** Ancestor chain of the anchor/selection, each with its own
   *  layout rect. Painted as thin colored frames on top of the
   *  canvas so users see "this file is inside THIS package / dir"
   *  without leaving the tier view. Ordered leaf→root. */
  ancestorFrames?: readonly SceneAncestorFrame[] | null;
}

export interface SceneAncestorFrame {
  id: string;
  name: string;
  kind: EntityKind;
  rect: Rect;
  /** 0 = direct parent, 1 = grandparent, … The draw code uses this
   *  to fade outer ancestors and emphasise the closest one. */
  depth: number;
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
  /** Fired on a native `dblclick` whose target entity hit-tests under
   *  the cursor. Distinct from `onEntityClick` so the React side can
   *  keep single-click as pure selection and reserve double-click for
   *  explicit drill-in — the Figma convention. */
  onEntityDoubleClick(id: string): void;
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
  /** Hero metric labels — the big faint number (LoC / child count)
   *  that anchors the right side of each card. Gives every rect a
   *  visual centre of gravity instead of a blank interior. */
  private heroLabels = new Map<string, Text>();
  private heroLabelPool: Text[] = [];
  /** LoC readout at the card's top-right. Mirrors v1's
   *  CityNodeRenderer header layout: filename on the left, size on
   *  the right — the "how big is this" answer without hunting for
   *  the secondary metric line. */
  private locBadgeLabels = new Map<string, Text>();
  private locBadgeLabelPool: Text[] = [];
  /** Ancestor containment frames — thin coloured outlines drawn
   *  UNDER edges so they read as background context rather than
   *  competing with the edge graph. */
  private ancestorGfx: Graphics | null = null;
  /** Soft drop-shadows under every entity card, plus the accent glow
   *  that wraps the selected card. Separate Graphics so we can keep
   *  the rect layer clean (one fill + stroke per card) while still
   *  delivering the Linear/Figma elevation the flat version lacked. */
  private shadowGfx: Graphics | null = null;
  /** Labels for ancestor frames, anchored at their top-left corner. */
  private ancestorLabels = new Map<string, Text>();
  private ancestorLabelPool: Text[] = [];
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
    const ancestorGfx = new Graphics();
    const shadowGfx = new Graphics();
    const edgeGfx = new Graphics();
    const rectGfx = new Graphics();
    const labelLayer = new Container();
    // Order matters: ancestor frames (background context) → card
    // shadows (elevation under the cards) → edges → rects → labels.
    // Shadow sits under edges so the edge lines draw cleanly without
    // cutting through the shadow halo.
    content.addChild(ancestorGfx);
    content.addChild(shadowGfx);
    content.addChild(edgeGfx);
    content.addChild(rectGfx);
    content.addChild(labelLayer);
    this.ancestorGfx = ancestorGfx;
    this.shadowGfx = shadowGfx;
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
    this.drawAncestorFrames(frame);
    // Drop shadows / hover lift / selected glow deliberately OFF —
    // the product reads as a flat modern dashboard (Linear / Notion
    // / Vercel), not a Material-style card deck. A clean rect on a
    // clean surface is the whole aesthetic. Keep `drawShadows` in
    // the class for a potential "elevation mode" toggle later.
    this.shadowGfx?.clear();
    this.drawEdges(frame);
    this.drawRects(frame);
    this.drawLabels(frame);
  }

  // Shadow / glow layer removed — flat design stays flat. The
  // `shadowGfx` Graphics stays on the stage (cleared every frame in
  // flushFrame) so reintroducing an elevated card variant doesn't
  // need a re-add to the display list.

  private drawAncestorFrames(frame: SceneFrame): void {
    const g = this.ancestorGfx;
    const layer = this.labelLayer;
    if (!g || !layer) return;
    g.clear();
    const frames = frame.ancestorFrames ?? null;
    const used = new Set<string>();
    if (frames && frames.length > 0) {
      const { camera, width, height } = frame;
      const invS = 1 / camera.scale;
      // Two passes so chip backgrounds sit ABOVE the rect's own
      // outline but still inside `ancestorGfx` (one Graphics, one
      // draw-call). Pass 1: outlines. Pass 2: chip backgrounds.
      // Labels live in labelLayer (drawn over everything) so they
      // always read on top of their chip. Radius + stroke + fill
      // tuning below was eyeballed to get a "Figma frame" vibe:
      // hairline rim, pill tab, no cruft.
      for (const af of frames) {
        if (!isRectOnScreen(af.rect, camera, width, height)) continue;
        // Neutral hairline for the frame rim — kind colour leaks in
        // through the chip dot, not the outline. Heavy kind-tinted
        // borders stacked across 3+ ancestor rings read as a rainbow
        // and bury the cards they're supposed to contain.
        const alpha = Math.max(0.22, 0.55 - af.depth * 0.15);
        const strokeW = 1 * invS;
        const r = af.rect;
        const rad = Math.min(14 * invS, Math.min(r.w, r.h) * 0.025);
        g.roundRect(r.x, r.y, r.w, r.h, rad);
        g.stroke({ color: pixiColor.border, width: strokeW, alpha });
      }
      // Pass 2 — tabs + labels. Done after all outlines so chip fills
      // paint on top of border strokes where they visually overlap.
      // Viewport-left-edge in world coords: labels clamp there so a
      // parent frame larger than the screen keeps its name visible
      // as a sticky "you are inside X" tag instead of scrolling off.
      const viewportLeftWorld = -camera.tx / camera.scale;
      const viewportTopWorld = -camera.ty / camera.scale;
      const STICKY_MARGIN = 14 * invS;
      const STICKY_STEP = 22 * invS; // stacked tags per depth level
      for (const af of frames) {
        if (!isRectOnScreen(af.rect, camera, width, height)) continue;
        const kindCol = pixiKindColor[af.kind];
        const r = af.rect;

        const labelText = af.name;
        let t = this.ancestorLabels.get(af.id);
        if (!t) {
          const pooled = this.ancestorLabelPool.pop();
          if (pooled) {
            if (pooled.text !== labelText) pooled.text = labelText;
            t = pooled;
          } else {
            t = new Text({
              text: labelText,
              style: new TextStyle({
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 11,
                fontWeight: "600",
                fill: pixiColor.text,
                letterSpacing: -0.05,
              }),
            });
          }
          layer.addChild(t);
          this.ancestorLabels.set(af.id, t);
        } else if (t.text !== labelText) {
          t.text = labelText;
        }
        const style = t.style as TextStyle;
        if (style.fill !== pixiColor.text) style.fill = pixiColor.text;
        t.alpha = 1;
        t.scale.set(invS);

        const tw = t.width;
        const th = 18 * invS;
        const padX = 9 * invS;
        const dotR = 3 * invS;
        const dotGap = 7 * invS;
        const natX = r.x + 10 * invS;
        const natY = r.y + 10 * invS;
        const stickyX = viewportLeftWorld + STICKY_MARGIN;
        const stickyY = viewportTopWorld + STICKY_MARGIN + af.depth * STICKY_STEP;
        // Clamp INTO the viewport: if the rect's top-left fell
        // off-screen (user panned inside a huge parent) the chip
        // slides to the viewport edge so the "inside: PALETTE"
        // affordance never disappears. natX wins when the rect's
        // corner is already on-screen — chip sits on the frame rim.
        const chipX = Math.max(natX, stickyX);
        const chipY = Math.max(natY, stickyY);
        const chipW = tw + padX * 2 + dotR * 2 + dotGap;
        const chipR = 999 * invS; // pill
        // Soft shadow pad under the chip so it lifts off the frame rim.
        g.roundRect(
          chipX - 1 * invS,
          chipY + 1 * invS,
          chipW + 2 * invS,
          th,
          chipR,
        );
        g.fill({ color: pixiColor.text, alpha: 0.05 });
        g.roundRect(chipX, chipY, chipW, th, chipR);
        g.fill({ color: pixiColor.bg, alpha: 1 });
        g.stroke({ color: pixiColor.border, width: 1 * invS, alpha: 1 });
        // Kind dot — the ONE spot of kind colour on the chip.
        g.circle(chipX + padX + dotR, chipY + th / 2, dotR);
        g.fill({ color: kindCol, alpha: 1 });
        t.position.set(chipX + padX + dotR * 2 + dotGap, chipY + 3 * invS);
        used.add(af.id);
      }
    }
    // Recycle labels whose ancestor left the frame list (e.g. anchor
    // changed, tier flipped).
    for (const [id, t] of this.ancestorLabels) {
      if (used.has(id)) continue;
      layer.removeChild(t);
      this.ancestorLabels.delete(id);
      if (this.ancestorLabelPool.length < LABEL_POOL_CAP) this.ancestorLabelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
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

  private applyTierTransition(_frame: SceneFrame): void {
    const content = this.content;
    if (!content) return;
    // Keep scale/pivot at identity so `camera` is the scene's only
    // source of zoom/position. Without this clamp the old
    // scale-0.92→1 animation would leak into every frame and read
    // as an automatic zoom-in on every tier flip.
    if (content.scale.x !== 1) content.scale.set(1);
    if (content.pivot.x !== 0 || content.pivot.y !== 0) content.pivot.set(0, 0);
    if (content.position.x !== 0 || content.position.y !== 0) content.position.set(0, 0);
    const startedAt = this.tierTransitionStart;
    if (startedAt === 0) {
      if (content.alpha !== 1) content.alpha = 1;
      return;
    }
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, Math.max(0, elapsed / TIER_TRANSITION_MS));
    const e = 1 - (1 - t) * (1 - t) * (1 - t);
    if (t >= 1) {
      this.tierTransitionStart = 0;
      content.alpha = 1;
      return;
    }
    content.alpha = TIER_TRANSITION_FROM_ALPHA + (1 - TIER_TRANSITION_FROM_ALPHA) * e;
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
    for (const t of this.kindLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.kindLabels.clear();
    for (const t of this.pathLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.pathLabels.clear();
    for (const t of this.kindLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.kindLabelPool.length = 0;
    for (const t of this.pathLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.pathLabelPool.length = 0;
    for (const t of this.labelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.labelPool.length = 0;
    for (const t of this.subLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.subLabelPool.length = 0;
    for (const t of this.kindLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.kindLabels.clear();
    for (const t of this.pathLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.pathLabels.clear();
    for (const t of this.kindLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.kindLabelPool.length = 0;
    for (const t of this.pathLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.pathLabelPool.length = 0;
    for (const t of this.ancestorLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.ancestorLabels.clear();
    for (const t of this.ancestorLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.ancestorLabelPool.length = 0;
    for (const t of this.heroLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.heroLabels.clear();
    for (const t of this.heroLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.heroLabelPool.length = 0;
    for (const t of this.locBadgeLabels.values()) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.locBadgeLabels.clear();
    for (const t of this.locBadgeLabelPool) {
      try { t.destroy(); } catch { /* ignore */ }
    }
    this.locBadgeLabelPool.length = 0;
    const app = this.app;
    this.app = null;
    this.bgGfx = null;
    this.world = null;
    this.content = null;
    this.rectGfx = null;
    this.ancestorGfx = null;
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
    const radius = 8 * invS;
    const strokeDefault = 1 * invS;
    const strokeHover = 1.25 * invS;
    // Selection stroke matches hover weight — the border colour (near-
    // black vs neutral grey) carries the state, not the thickness.
    const strokeSelected = 1.25 * invS;
    const strokeEgo = 1.5 * invS;
    const iconBoxSize = ICON_BOX_SIZE_PX * invS;
    const iconBoxInset = ICON_BOX_INSET_PX * invS;
    const iconBoxStrokeW = 1 * invS;
    const headerH = 30 * invS;
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
    // Spotlight: selection + its 1-hop neighbours. Non-members fade to
    // SPOTLIGHT_DIM_ALPHA so the dep network visually isolates from the
    // rest of the workspace. Ego members (not the selection itself) get
    // an accent-tinted border so they read as "connected to the pick".
    const spotlight = frame.spotlightIds ?? null;
    const isSpot = spotlight !== null && spotlight.size > 0;
    const memberOf = (id: string): boolean => !isSpot || spotlight!.has(id);
    const headerDividerFor = (r: Rect, alpha: number): { h: number; strokeW: number; alpha: number } | null =>
      r.h * s >= CARD_HEADER_MIN_PX_H
        ? { h: headerH, strokeW: strokeDefault, alpha }
        : null;
    for (const entity of entities) {
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      if (!isRectOnScreen(r, camera, width, height)) continue;
      const isSel = entity.id === selectedId;
      const isHov = entity.id === hoveredId;
      if (isSel) { selected.push(entity); continue; }
      if (isHov) { hovered.push(entity); continue; }
      const inSpot = memberOf(entity.id);
      if (isSpot && inSpot) {
        // Ego neighbour — accent-tint border + full opacity.
        this.paintCard(g, entity, r, {
          fill: fillFor(entity, CARD_FILL_DEFAULT),
          border: CARD_BORDER_SELECTED,
          strokeW: strokeEgo,
          strokeAlpha: 0.55,
          radius,
          kindIcon: this.shouldPaintKindIcon(r, s) ? { color: pixiKindColor[entity.kind], inset: iconBoxInset, size: iconBoxSize, strokeW: iconBoxStrokeW } : null,
          headerDivider: headerDividerFor(r, 1),
        });
        continue;
      }
      const dim = isSpot && !inSpot;
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_DEFAULT),
        fillAlpha: dim ? SPOTLIGHT_DIM_ALPHA : 1,
        border: CARD_BORDER_DEFAULT,
        strokeW: strokeDefault,
        strokeAlpha: dim ? SPOTLIGHT_DIM_ALPHA : 1,
        radius,
        kindIcon: this.shouldPaintKindIcon(r, s) ? { color: pixiKindColor[entity.kind], inset: iconBoxInset, size: iconBoxSize, strokeW: iconBoxStrokeW } : null,
        iconAlpha: dim ? SPOTLIGHT_DIM_ALPHA : 1,
        headerDivider: headerDividerFor(r, dim ? SPOTLIGHT_DIM_ALPHA : 1),
      });
    }
    const haloPadPx = 3;
    for (const entity of hovered) {
      const r = layout.rects.get(entity.id)!;
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_DEFAULT),
        border: CARD_BORDER_HOVER,
        strokeW: strokeHover,
        radius,
        kindIcon: this.shouldPaintKindIcon(r, s) ? { color: pixiKindColor[entity.kind], inset: iconBoxInset, size: iconBoxSize, strokeW: iconBoxStrokeW } : null,
        headerDivider: headerDividerFor(r, 1),
        halo: {
          radius: radius + haloPadPx * invS,
          strokeW: haloPadPx * 2 * invS,
          color: pixiColor.text,
          alpha: 0.045,
        },
      });
    }
    for (const entity of selected) {
      const r = layout.rects.get(entity.id)!;
      this.paintCard(g, entity, r, {
        fill: fillFor(entity, CARD_FILL_SELECTED),
        border: CARD_BORDER_SELECTED,
        strokeW: strokeSelected,
        radius,
        kindIcon: this.shouldPaintKindIcon(r, s) ? { color: pixiKindColor[entity.kind], inset: iconBoxInset, size: iconBoxSize, strokeW: iconBoxStrokeW } : null,
        headerDivider: headerDividerFor(r, 1),
        halo: {
          radius: radius + haloPadPx * invS,
          strokeW: haloPadPx * 2 * invS,
          color: pixiColor.text,
          alpha: 0.11,
        },
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

  private shouldPaintKindIcon(r: Rect, scale: number): boolean {
    return r.w * scale >= ICON_BOX_MIN_PX_W && r.h * scale >= ICON_BOX_MIN_PX_H;
  }

  private paintCard(
    g: Graphics,
    entity: Entity,
    r: Rect,
    opts: {
      fill: number;
      /** Fill alpha override — omit for 1. */
      fillAlpha?: number;
      border: number;
      /** Stroke alpha override — omit for 1. */
      strokeAlpha?: number;
      strokeW: number;
      radius: number;
      /** Rounded-square kind icon at top-left. Paints the bg tint +
       *  ring. The letter inside is a separate Text handled by
       *  `drawLabels` so pooling / measurement stays in one place. */
      kindIcon: { color: number; inset: number; size: number; strokeW: number } | null;
      iconAlpha?: number;
      /** Header-band hairline — paint a thin horizontal divider `h`
       *  world-units down from the card top. The label layer draws the
       *  name + LoC badge above the line; the body breathes below. */
      headerDivider?: { h: number; strokeW: number; alpha: number } | null;
      /** Soft outer halo — painted BEFORE the main card so the rect
       *  fill masks the inner portion. Used to communicate selection
       *  and hover without stacking decorative borders. */
      halo?: { radius: number; strokeW: number; color: number; alpha: number } | null;
    },
  ): void {
    // Halo first so the main fill sits on top and the halo reads as an
    // outer ring, not a double border.
    if (opts.halo) {
      const pad = opts.halo.strokeW * 0.5;
      g.roundRect(
        r.x - pad,
        r.y - pad,
        r.w + pad * 2,
        r.h + pad * 2,
        opts.halo.radius,
      );
      g.stroke({ color: opts.halo.color, width: opts.halo.strokeW, alpha: opts.halo.alpha });
    }
    g.roundRect(r.x, r.y, r.w, r.h, opts.radius);
    g.fill({ color: opts.fill, alpha: opts.fillAlpha ?? 1 });
    g.stroke({ color: opts.border, width: opts.strokeW, alpha: opts.strokeAlpha ?? 1 });
    if (opts.headerDivider) {
      // Subtle tinted band in the header strip — gives the title row
      // real "section" presence instead of just a floating divider.
      // Painted AFTER the card fill so it darkens only the header area.
      const h = opts.headerDivider.h;
      g.rect(r.x + opts.strokeW, r.y + opts.strokeW, r.w - opts.strokeW * 2, h - opts.strokeW);
      g.fill({ color: pixiColor.bgSubtle, alpha: opts.headerDivider.alpha * 0.85 });
      const y = r.y + h;
      g.moveTo(r.x, y);
      g.lineTo(r.x + r.w, y);
      g.stroke({
        color: pixiColor.border,
        width: opts.headerDivider.strokeW,
        alpha: opts.headerDivider.alpha,
      });
    }
    if (opts.kindIcon) {
      const ki = opts.kindIcon;
      this.drawKindIcon(
        g,
        entity.kind,
        r.x + ki.inset,
        r.y + ki.inset,
        ki.size,
        ki.strokeW,
        ki.color,
        opts.iconAlpha ?? 1,
      );
    }
  }

  /** Vector icon per entity kind, painted into the card's Graphics
   *  layer. Shapes mirror the mental model directly — package box for
   *  galaxy, folder tab for street, file sheet for building, stacked
   *  lines for floor (module), ringed dot for universe, plain ring for
   *  room (function). Stroke-only; fills would darken the card. */
  private drawKindIcon(
    g: Graphics,
    kind: EntityKind,
    x: number,
    y: number,
    size: number,
    strokeW: number,
    color: number,
    alpha: number,
  ): void {
    const cx = x + size / 2;
    const cy = y + size / 2;
    switch (kind) {
      case "universe": {
        g.circle(cx, cy, size * 0.45);
        g.stroke({ color, width: strokeW, alpha });
        g.circle(cx, cy, size * 0.14);
        g.fill({ color, alpha });
        return;
      }
      case "galaxy": {
        const padX = size * 0.06;
        const top = y + size * 0.14;
        const bot = y + size * 0.88;
        g.roundRect(
          x + padX,
          top,
          size - padX * 2,
          bot - top,
          size * 0.08,
        );
        g.stroke({ color, width: strokeW, alpha });
        const lidY = y + size * 0.4;
        g.moveTo(x + padX, lidY);
        g.lineTo(x + size - padX, lidY);
        g.stroke({ color, width: strokeW, alpha });
        return;
      }
      case "street": {
        const tabW = size * 0.45;
        const tabSlope = size * 0.12;
        const topLeft = y + size * 0.22;
        const topRight = y + size * 0.08;
        const bottom = y + size * 0.9;
        g.moveTo(x + size * 0.08, topLeft);
        g.lineTo(x + tabW, topLeft);
        g.lineTo(x + tabW + tabSlope, topRight);
        g.lineTo(x + size * 0.92, topRight);
        g.lineTo(x + size * 0.92, bottom);
        g.lineTo(x + size * 0.08, bottom);
        g.closePath();
        g.stroke({ color, width: strokeW, alpha });
        return;
      }
      case "building": {
        const fold = size * 0.28;
        const left = x + size * 0.14;
        const right = x + size * 0.86;
        const top = y + size * 0.08;
        const bot = y + size * 0.92;
        g.moveTo(left, top);
        g.lineTo(right - fold, top);
        g.lineTo(right, top + fold);
        g.lineTo(right, bot);
        g.lineTo(left, bot);
        g.closePath();
        g.stroke({ color, width: strokeW, alpha });
        g.moveTo(right - fold, top);
        g.lineTo(right - fold, top + fold);
        g.lineTo(right, top + fold);
        g.stroke({ color, width: strokeW, alpha });
        return;
      }
      case "floor": {
        for (let i = 0; i < 3; i++) {
          const ly = y + size * (0.28 + i * 0.22);
          g.moveTo(x + size * 0.16, ly);
          g.lineTo(x + size * 0.84, ly);
        }
        g.stroke({ color, width: strokeW, alpha });
        return;
      }
      case "room": {
        g.circle(cx, cy, size * 0.36);
        g.stroke({ color, width: strokeW, alpha });
        g.circle(cx, cy, size * 0.12);
        g.fill({ color, alpha });
        return;
      }
    }
  }

  private drawEdges(frame: SceneFrame): void {
    const g = this.edgeGfx;
    if (!g) return;
    const { edges, layout, camera, width, height, selectedId, hoveredId, anchorId } = frame;
    g.clear();
    const invScale = 1 / camera.scale;
    const CURVE_K = 0.12;
    // Paint non-anchor edges first, anchor-touching edges last so the
    // directional strokes land on top. With the scope filter already
    // hiding non-reachable entities every remaining edge is "between
    // things the user wants to see", so background edges render at a
    // healthy alpha — no more ghost-faint lines.
    const focused: { edge: TierEdge; direction: "in" | "out" | "side" }[] = [];
    for (const edge of edges) {
      const a = layout.rects.get(edge.fromId);
      const b = layout.rects.get(edge.toId);
      if (!a || !b) continue;
      if (!isSegmentOnScreen(a, b, camera, width, height)) continue;
      const touchesAnchor =
        anchorId != null && (edge.fromId === anchorId || edge.toId === anchorId);
      const touchesSel =
        selectedId != null && !touchesAnchor &&
        (edge.fromId === selectedId || edge.toId === selectedId);
      const touchesHov =
        hoveredId != null && !touchesAnchor && !touchesSel &&
        (edge.fromId === hoveredId || edge.toId === hoveredId);
      if (touchesAnchor) {
        focused.push({
          edge,
          direction: edge.fromId === anchorId ? "out" : "in",
        });
        continue;
      }
      if (touchesSel || touchesHov) {
        focused.push({
          edge,
          direction:
            touchesSel
              ? edge.fromId === selectedId ? "out" : "in"
              : "side",
        });
        continue;
      }
      // Indirect edge — between two reachable neighbours but NOT
      // incident on the anchor. Kept visible (no ghost alpha) so the
      // user reads the full dep chain, just a touch below the primary
      // edges so the anchor's direct connections pop.
      const alpha = 0.5 + Math.min(0.3, edge.count * 0.04);
      this.paintEdge(g, a, b, edge, invScale, CURVE_K, pixiColor.edge, alpha, false);
    }
    for (const { edge, direction } of focused) {
      const a = layout.rects.get(edge.fromId)!;
      const b = layout.rects.get(edge.toId)!;
      const color =
        direction === "out"
          ? pixiColor.edgeOut
          : direction === "in"
            ? pixiColor.edgeIn
            : pixiColor.edgeHighlight;
      this.paintEdge(g, a, b, edge, invScale, CURVE_K, color, 0.92, true);
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
    arrow: boolean,
  ): void {
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
    if (arrow) {
      // Midpoint of the quadratic Bezier (t=0.5): 0.25A + 0.5C + 0.25B.
      // Tangent at t=0.5 ≈ direction A→B, which is what we want so the
      // arrow reads as "flow goes this way".
      const mx = 0.25 * ax + 0.5 * cx + 0.25 * bx;
      const my = 0.25 * ay + 0.5 * cy + 0.25 * by;
      this.paintArrowHead(g, mx, my, dx, dy, 10 * invScale, color, Math.min(1, alpha + 0.05));
    }
  }

  private paintArrowHead(
    g: Graphics,
    x: number,
    y: number,
    dx: number,
    dy: number,
    size: number,
    color: number,
    alpha: number,
  ): void {
    const len = Math.hypot(dx, dy);
    if (len < 0.0001) return;
    const ux = dx / len;
    const uy = dy / len;
    // Perpendicular for the base width.
    const px = -uy;
    const py = ux;
    const tipX = x + ux * size * 0.55;
    const tipY = y + uy * size * 0.55;
    const baseX = x - ux * size * 0.45;
    const baseY = y - uy * size * 0.45;
    const half = size * 0.34;
    g.moveTo(tipX, tipY);
    g.lineTo(baseX + px * half, baseY + py * half);
    g.lineTo(baseX - px * half, baseY - py * half);
    g.closePath();
    // Fill then a subtle white rim — the rim keeps the triangle crisp
    // when it lands over an underlying edge or a tinted card, which
    // would otherwise muddy the silhouette.
    g.fill({ color, alpha });
    g.stroke({ color: 0xffffff, width: size * 0.08, alpha: alpha * 0.9 });
  }

  private drawLabels(frame: SceneFrame): void {
    const layer = this.labelLayer;
    if (!layer) return;
    const { entities, layout, camera, width, height } = frame;
    const usedPrimary = new Set<string>();
    const usedSecondary = new Set<string>();
    const usedHero = new Set<string>();
    const usedLocBadge = new Set<string>();
    // Dedupe: iterate each entity.id at most once per frame. Without
    // this guard, any upstream path that accidentally produces a
    // duplicate entity (filter combos, future focus-mode overlaps)
    // would stack two Texts at the same position — the root cause of
    // the "문자 겹침" bug.
    const seen = new Set<string>();
    const s = camera.scale;
    const invS = 1 / s;
    let budget = LABEL_BUDGET;
    const spotlight = frame.spotlightIds ?? null;
    const isSpot = spotlight !== null && spotlight.size > 0;
    for (const entity of entities) {
      if (seen.has(entity.id)) continue;
      seen.add(entity.id);
      if (budget <= 0) break;
      const r = layout.rects.get(entity.id);
      if (!r) continue;
      const screenW = r.w * s;
      const screenH = r.h * s;
      if (screenW < PRIMARY_MIN_PX_W || screenH < MIN_LABEL_PX_H) continue;
      if (!isRectOnScreen(r, camera, width, height)) continue;

      const hasKindIcon =
        screenW >= ICON_BOX_MIN_PX_W && screenH >= ICON_BOX_MIN_PX_H;
      // Reserve a single glyph's worth of runway + a clean 8-px gap
      // before the primary name. 24 is generous enough for W / P / D
      // / F / M / ƒ at 12 px bold without collisions.
      const leftPadPx = hasKindIcon ? 24 : 12;
      const leftPad = leftPadPx * invS;
      // Title colour is always near-black — selection is carried by the
      // card border, not by tinting the label. Accent-blue titles on
      // selection read as two things competing for attention.
      const primaryColor = pixiColor.text;

      // Kind icon is a vector shape painted by `drawKindIcon` on the
      // rect graphics layer during drawRects. Nothing to render here —
      // drawLabels is Text-only. `leftPadPx` reserved above already
      // makes room for it to the left of the primary name.
      // Primary name sits at the top padding; secondary drops below.
      const nameTopPx = 6;
      // Screen-pixel width available for the label inside the card —
      // bounds truncation. The earlier bug ("onBlur / typingSpeed /
      // start" stacked on one card) came from labels spilling past
      // their own rect into neighbour rects at medium zoom, because
      // the render path set `.text = entity.name` with no width gate.
      const availLabelPx = screenW - leftPadPx - LABEL_RIGHT_PAD_PX;

      // Primary: entity name — 13 screen-px, semibold, near-black.
      let t = this.labels.get(entity.id);
      if (!t) {
        const pooled = this.labelPool.pop();
        if (pooled) {
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
      }
      const primaryStyle = t.style as TextStyle;
      if (primaryStyle.fill !== primaryColor) primaryStyle.fill = primaryColor;
      t.visible = true;
      // Dim non-ego labels under spotlight so the selection + its
      // 1-hop neighbours stay legible while the rest fades into
      // context. Reset every frame because labels are pool-reused.
      t.alpha = isSpot && !spotlight!.has(entity.id) ? SPOTLIGHT_LABEL_DIM_ALPHA : 1;
      if (!fitLabelToWidth(t, entity.name, availLabelPx)) {
        t.visible = false;
        continue;
      }
      t.scale.set(invS);
      t.position.set(r.x + leftPad, r.y + nameTopPx * invS);
      usedPrimary.add(entity.id);
      budget--;

      // LoC badge at the card's top-right. Matches v1
      // CityNodeRenderer's header layout — a small, muted count on
      // the opposite side of the filename. Medium-weight, not bold,
      // so it's readable without competing with the name.
      const locN = entity.metrics?.loc;
      if (locN !== undefined && locN > 0 && screenW >= 120 && budget > 0) {
        const locText = compactNum(locN);
        let lt = this.locBadgeLabels.get(entity.id);
        if (!lt) {
          const pooled = this.locBadgeLabelPool.pop();
          if (pooled) {
            if (pooled.text !== locText) pooled.text = locText;
            lt = pooled;
          } else {
            lt = new Text({
              text: locText,
              style: new TextStyle({
                fontFamily: "'Inter Tight', system-ui, sans-serif",
                fontSize: 11,
                fontWeight: "500",
                fill: pixiColor.textSubtle,
                letterSpacing: 0,
              }),
            });
          }
          layer.addChild(lt);
          this.locBadgeLabels.set(entity.id, lt);
        } else if (lt.text !== locText) {
          lt.text = locText;
        }
        lt.alpha = 1;
        lt.scale.set(invS);
        const lw = lt.width;
        lt.position.set(r.x + r.w - lw - 12 * invS, r.y + 7 * invS);
        usedLocBadge.add(entity.id);
        budget--;
      }

      // Secondary metric line — only when the card has room.
      if (screenW >= SECONDARY_MIN_PX_W && screenH >= SECONDARY_MIN_PX_H) {
        if (budget <= 0) break;
        const secondary = formatSecondary(entity);
        if (secondary) {
          let s2 = this.subLabels.get(entity.id);
          if (!s2) {
            const pooled = this.subLabelPool.pop();
            if (pooled) {
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
          }
          s2.visible = true;
          s2.alpha = isSpot && !spotlight!.has(entity.id) ? SPOTLIGHT_LABEL_DIM_ALPHA : 1;
          if (fitLabelToWidth(s2, secondary, availLabelPx)) {
            s2.scale.set(invS);
            // When the card is tall enough for the header band (30px),
            // anchor the secondary line below the divider so it reads
            // as metadata under the title, not a stacked label.
            const secondaryTopPx = screenH >= CARD_HEADER_MIN_PX_H ? 40 : nameTopPx + 18;
            s2.position.set(r.x + leftPad, r.y + secondaryTopPx * invS);
            usedSecondary.add(entity.id);
            budget--;
          } else {
            s2.visible = false;
          }
        }
      }

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
    // Drain any kind/path labels that lingered from the retired
    // experiment. Unconditional drain — we never set `usedKind` /
    // `usedPath` any more, so every entry is "not used this frame".
    for (const [id, t] of this.kindLabels) {
      layer.removeChild(t);
      this.kindLabels.delete(id);
      if (this.kindLabelPool.length < LABEL_POOL_CAP) this.kindLabelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
    for (const [id, t] of this.pathLabels) {
      layer.removeChild(t);
      this.pathLabels.delete(id);
      if (this.pathLabelPool.length < LABEL_POOL_CAP) this.pathLabelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
    for (const [id, t] of this.heroLabels) {
      if (usedHero.has(id)) continue;
      layer.removeChild(t);
      this.heroLabels.delete(id);
      if (this.heroLabelPool.length < LABEL_POOL_CAP) this.heroLabelPool.push(t);
      else { try { t.destroy(); } catch { /* ignore */ } }
    }
    for (const [id, t] of this.locBadgeLabels) {
      if (usedLocBadge.has(id)) continue;
      layer.removeChild(t);
      this.locBadgeLabels.delete(id);
      if (this.locBadgeLabelPool.length < LABEL_POOL_CAP) this.locBadgeLabelPool.push(t);
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
    // Native `dblclick` rather than a timer-based synth in pointerdown:
    // the browser already does the double-click threshold (time + pixel
    // tolerance) per OS convention, so the UX matches the rest of the
    // desktop. `onPointerDown` still fires for each click — selection
    // lands on the first one, drill-in fires on the pair.
    el.addEventListener("dblclick", this.onDoubleClick);
  }

  private detachInput(): void {
    const el = this.canvas;
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    el.removeEventListener("dblclick", this.onDoubleClick);
  }

  private readonly onDoubleClick = (e: MouseEvent): void => {
    // Respect the same force-pan escape hatches as single-click so a
    // Space-held double-click doesn't surprise-drill-in mid-pan.
    if (this.spaceHeld) return;
    const id = this.hitTestClient(e.clientX, e.clientY);
    if (id === null) return;
    e.preventDefault();
    this.stopInertia();
    this.callbacksRef.current.onEntityDoubleClick(id);
  };

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

/** Truncate a Pixi Text to fit within `availPx` screen pixels.
 *  Measures at natural scale (scale=1) because our rendered labels
 *  cancel the camera scale via `invS` — so text.width at scale 1
 *  equals the actual screen-pixel footprint. Returns true if the
 *  string fit (with or without an ellipsis), false when even a
 *  single char + "…" overflows the rect. Callers hide the Text and
 *  skip rendering on false rather than let it spill into a neighbour
 *  card (the "label-spill" regression fix).
 *
 *  After this call the Text's scale is left at 1 — the caller must
 *  re-apply `.scale.set(invS)` before positioning.
 */
function fitLabelToWidth(t: Text, full: string, availPx: number): boolean {
  if (availPx <= 0) return false;
  if (t.text !== full) t.text = full;
  t.scale.set(1);
  if (t.width <= availPx) return true;
  // Proportional initial guess from the overflow ratio, then shrink
  // linearly. Names are short (≤ a few dozen chars) so the worst-case
  // loop stays cheap per frame even at the 320-entity budget.
  let n = Math.max(1, Math.floor((full.length * availPx) / t.width) - 1);
  t.text = full.slice(0, n) + "…";
  while (t.width > availPx && n > 1) {
    n--;
    t.text = full.slice(0, n) + "…";
  }
  return t.width <= availPx;
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

/** Concrete-noun label per kind. Exported because Inspector and
 *  HoverTooltip read it — cards themselves stay minimal (primary
 *  name + one metric line) to avoid the label-stacking regression. */
export const KIND_NOUN: Readonly<Record<EntityKind, string>> = {
  universe: "WORKSPACE",
  galaxy: "PACKAGE",
  street: "DIRECTORY",
  building: "FILE",
  floor: "MODULE",
  room: "FUNCTION",
};
