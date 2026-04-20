import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import type {
  Entity,
  EntityTree,
  HierarchicalLayout,
  Rect,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import {
  DEFAULT_TIER_LADDER,
  rollupEdges,
  tierStore,
  type TierEdge,
  type TierSpec,
} from "../../../entities/tier";
import { ENTITY_DEPTH, entityStore, useEntityState } from "../../../entities/entity";
import { startCameraTween, type CameraState } from "../../../shared/lib/camera-animation";
import { debounce, saveViewport } from "../../../shared/api/viewport-persistence";
import { MiniMap } from "./MiniMap";
import { useKindFilter } from "../../../features/kind-filter";
import { useSnapshotShortcut } from "../../../features/snapshot";
import { rollupEntitySignals, type EntitySignals } from "@quanta/canvas-engine";
import {
  computeColorOverrides,
  useColorMode,
} from "../../../features/color-mode";
import type { SceneBadge } from "../../../shared/lib/pixi-scene";
import {
  acquirePixiScene,
  releasePixiScene,
  type PixiScene,
  type SceneCallbacks,
  type SceneFrame,
} from "../../../shared/lib/pixi-scene";

// CanvasViewport — WebGL viewport for the Code Universe product.
// Owns the camera + the Pixi scene, drives drill-in/out tweens, and
// wires store-backed selection/hover through to the renderer.
//
// Interaction model:
//   - Click on a non-leaf entity → drill IN (camera animates to the
//     entity's rect, tier switches to the next inner kind).
//   - Esc → clear selection, else drill OUT.
//   - Ctrl/Cmd + wheel (or trackpad pinch) → zoom at cursor.
//   - Plain two-finger wheel / scroll → pan.
//   - Arrow keys → pan.
//   - Cmd/Ctrl + 0 → fit to current tier.
//
// All rendering is imperative (see pixi-scene.ts). React is only
// responsible for camera state, tier transitions, and selection; the
// scene consumes a single frame object per camera change.

const KEY_PAN_PX = 40;
const DRILL_FIT_PAD = 72;
const MIN_SCALE = 0.005;
const MAX_SCALE = 80;
const KEY_ZOOM_FACTOR = 1.2;

interface Props {
  tree: EntityTree;
  layout: HierarchicalLayout;
  tier: TierSpec;
  graph: WorkspaceGraph;
  width: number;
  height: number;
  /** Optional — persists camera pose under `cu:viewport:v1:<tabId>`. */
  tabId?: string;
  /** Camera pose to seed on mount (from localStorage). If provided,
   *  suppresses the initial fit-to-content so the user lands back
   *  where they were. */
  initialCamera?: { tx: number; ty: number; scale: number };
}

const ROOT_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  outline: "none",
  background:
    "radial-gradient(circle at 20% 10%, rgba(99,102,241,0.05), transparent 60%), #f8fafc",
};

const CANVAS_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  cursor: "grab",
  touchAction: "none",
};

export function CanvasViewport({
  tree,
  layout,
  tier,
  graph,
  width,
  height,
  tabId,
  initialCamera,
}: Props): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ⌘/Ctrl+Shift+S → PNG snapshot of the current frame. The hook
  // owns the keyboard binding; we just give it the canvas ref so
  // CanvasViewport keeps the DOM element inside its slice.
  useSnapshotShortcut(canvasRef);
  const sceneRef = useRef<PixiScene | null>(null);

  const [camera, setCameraState] = useState<CameraState>(
    () => initialCamera ?? { tx: 0, ty: 0, scale: 1 },
  );
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const tweenRef = useRef<{ cancel(): void } | null>(null);
  // Wheel-driven tier crossings set this so the fit-on-tier-change
  // layoutEffect leaves the user's pointer-anchored zoom alone.
  // Seeded `initialCamera` also sets this on first mount so we don't
  // immediately fit-to-content over the restored pose.
  const skipNextFit = useRef(initialCamera != null);

  const baseVisibleEntities = useMemo<readonly Entity[]>(
    () => tree.byKind(tier.visibleKind),
    [tree, tier.visibleKind],
  );
  const baseTierEdges = useMemo<readonly TierEdge[]>(
    // Apply the tier's own edge policy — high-level tiers (universe,
    // galaxy) filter to severe-only so the picture stays legible;
    // low-level tiers (floor, room) let everything through. Memo keyed
    // on the edge policy *reference* from the spec, which is stable
    // per DEFAULT_TIER_LADDER entry.
    () => rollupEdges(tree, graph.fileEdges, tier.visibleKind, tier.edgePolicy),
    [tree, graph.fileEdges, tier.visibleKind, tier.edgePolicy],
  );
  const { hoveredId, selectedId, focusMode } = useEntityState(s => s.interaction);

  // Neighborhood focus — when the user asks to isolate the selected
  // entity, narrow the visible set to its ego graph (self + 1-hop
  // counterparts) and keep only edges that touch the anchor. We
  // preserve the underlying treemap positions so the spatial layout
  // doesn't reshuffle; the culling happens at render time. Fall
  // through to the base (unfocused) sets whenever focus is "none" or
  // the selected entity isn't at the current tier — users zooming
  // out above their focused tier should see the full structure again.
  const focusedVisibleEntities = useMemo<readonly Entity[] | null>(() => {
    if (focusMode !== "neighborhood" || !selectedId) return null;
    const anchor = tree.byId.get(selectedId);
    if (!anchor || anchor.kind !== tier.visibleKind) return null;
    const egoIds = new Set<string>([selectedId]);
    for (const edge of baseTierEdges) {
      if (edge.fromId === selectedId) egoIds.add(edge.toId);
      else if (edge.toId === selectedId) egoIds.add(edge.fromId);
    }
    return baseVisibleEntities.filter(e => egoIds.has(e.id));
  }, [focusMode, selectedId, tree, tier.visibleKind, baseTierEdges, baseVisibleEntities]);
  const focusedTierEdges = useMemo<readonly TierEdge[] | null>(() => {
    if (focusMode !== "neighborhood" || !selectedId) return null;
    const anchor = tree.byId.get(selectedId);
    if (!anchor || anchor.kind !== tier.visibleKind) return null;
    return baseTierEdges.filter(e => e.fromId === selectedId || e.toId === selectedId);
  }, [focusMode, selectedId, tree, tier.visibleKind, baseTierEdges]);
  // Apply kind-visibility toggles. The filter sits AFTER focus mode
  // so ego-net computation still sees the unfiltered neighbourhood —
  // users can hide a kind without shrinking focus-mode's reachable
  // set to whatever's left.
  const kindVisibility = useKindFilter(s => s.visibility);
  const allKindsOn =
    kindVisibility.universe &&
    kindVisibility.galaxy &&
    kindVisibility.street &&
    kindVisibility.building &&
    kindVisibility.floor &&
    kindVisibility.room;
  const preKindEntities = focusedVisibleEntities ?? baseVisibleEntities;
  const preKindEdges = focusedTierEdges ?? baseTierEdges;
  const visibleEntities = useMemo<readonly Entity[]>(
    () => (allKindsOn ? preKindEntities : preKindEntities.filter(e => kindVisibility[e.kind])),
    [preKindEntities, allKindsOn, kindVisibility],
  );
  // Drop edges whose endpoints fall under a hidden kind so we don't
  // render phantom lines between invisible rects.
  const tierEdges = useMemo<readonly TierEdge[]>(() => {
    if (allKindsOn) return preKindEdges;
    const visibleIds = new Set(visibleEntities.map(e => e.id));
    return preKindEdges.filter(e => visibleIds.has(e.fromId) && visibleIds.has(e.toId));
  }, [preKindEdges, allKindsOn, visibleEntities]);

  const cameraForRect = useCallback(
    (bounds: Rect | null, pad = DRILL_FIT_PAD): CameraState => {
      if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
        return { tx: 0, ty: 0, scale: 1 };
      }
      const avail = { w: Math.max(1, width - pad * 2), h: Math.max(1, height - pad * 2) };
      const scale = Math.min(avail.w / bounds.w, avail.h / bounds.h);
      const tx = -bounds.x * scale + (width - bounds.w * scale) / 2;
      const ty = -bounds.y * scale + (height - bounds.h * scale) / 2;
      return { tx, ty, scale };
    },
    [width, height],
  );

  const cancelTween = useCallback(() => {
    tweenRef.current?.cancel();
    tweenRef.current = null;
  }, []);
  const tweenTo = useCallback(
    (target: CameraState, durationMs?: number) => {
      cancelTween();
      tweenRef.current = startCameraTween(cameraRef.current, target, setCameraState, durationMs);
    },
    [cancelTween],
  );

  // Fit on tier change. Skipped when the tier flip was driven by the
  // wheel handler below — otherwise a mid-gesture fit yanks the view
  // away from the user's pointer.
  useLayoutEffect(() => {
    if (skipNextFit.current) {
      skipNextFit.current = false;
      return;
    }
    if (visibleEntities.length === 0) {
      setCameraState({ tx: 0, ty: 0, scale: 1 });
      return;
    }
    const bounds = unionRects(visibleEntities, layout);
    const target = cameraForRect(bounds);
    tweenTo(target);
  }, [visibleEntities, layout, cameraForRect, tweenTo]);

  useEffect(() => () => cancelTween(), [cancelTween]);

  // Persist camera pose. A debounced writer batches rapid pan/zoom
  // into one localStorage write; the flush on unmount captures the
  // last pose (tab close, navigation) since React won't run the
  // debounced timer after teardown.
  const persistRef = useRef<(c: CameraState) => void>(() => {});
  useEffect(() => {
    const write = debounce((c: CameraState) => {
      saveViewport(tabId, {
        tx: c.tx,
        ty: c.ty,
        scale: c.scale,
        tier: tier.name,
        selectedId: entityStore.getState().interaction.selectedId,
      });
    }, 200);
    persistRef.current = write;
    return () => {
      write.flush();
      persistRef.current = () => {};
    };
  }, [tabId, tier.name]);
  useEffect(() => {
    persistRef.current(camera);
  }, [camera]);

  const drillInto = useCallback(
    (entity: Entity) => {
      const rect = layout.rects.get(entity.id);
      if (!rect) return;
      tweenTo(cameraForRect(rect, 24), 240);
      const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
      const innerSpec = DEFAULT_TIER_LADDER[idx + 1];
      if (
        innerSpec &&
        entity.childIds.length > 0 &&
        ENTITY_DEPTH[entity.kind] < ENTITY_DEPTH[innerSpec.visibleKind]
      ) {
        // Defer tier flip by a microtask so the pointer-anchored tween
        // above gets to start before the tier-change fit kicks in.
        queueMicrotask(() => tierStore.jumpToTier(innerSpec.name));
      }
    },
    [tier.name, layout, cameraForRect, tweenTo],
  );
  // Not currently bound to canvas click (click = select-only per the
  // Figma convention). Kept exported via props/shared so the
  // Inspector "Drill in" button, keyboard shortcut, and future
  // double-click handler can trigger the zoom-in flow without
  // duplicating the tween + tier-flip logic.
  void drillInto;

  const drillOut = useCallback(() => {
    const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
    if (idx <= 0) return;
    const outer = DEFAULT_TIER_LADDER[idx - 1];
    if (!outer) return;
    entityStore.selectEntity(null);
    tierStore.jumpToTier(outer.name);
  }, [tier.name]);

  // Scene input callbacks — mutating camera synchronously so pan/zoom
  // feel immediate. tierStore.setScale fires on zoom so the breadcrumb
  // tracks the actual viewport scale, with `skipNextFit` blocking the
  // tier-change fit. Factor is precomputed in the scene so keyboard +/-
  // and mouse/trackpad wheel share one zoom-at-anchor path.
  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      cancelTween();
      const cur = cameraRef.current;
      const worldX = (cx - cur.tx) / cur.scale;
      const worldY = (cy - cur.ty) / cur.scale;
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cur.scale * factor));
      if (nextScale === cur.scale) return;
      setCameraState({
        tx: cx - worldX * nextScale,
        ty: cy - worldY * nextScale,
        scale: nextScale,
      });
      skipNextFit.current = true;
      tierStore.setScale(nextScale);
    },
    [cancelTween],
  );
  const onZoomAt = zoomAt;
  const onWheelPan = useCallback(
    (dx: number, dy: number) => {
      cancelTween();
      setCameraState(c => ({ ...c, tx: c.tx + dx, ty: c.ty + dy }));
    },
    [cancelTween],
  );
  const onDragStart = useCallback(() => cancelTween(), [cancelTween]);
  const onDragPan = useCallback((dx: number, dy: number) => {
    setCameraState(c => ({ ...c, tx: c.tx + dx, ty: c.ty + dy }));
  }, []);
  const onEntityClick = useCallback(
    (id: string) => {
      const entity = tree.byId.get(id);
      if (!entity) return;
      entityStore.selectEntity(id);
      drillInto(entity);
    },
    [tree, drillInto],
  );
  const onEntityHover = useCallback((id: string | null) => {
    entityStore.hoverEntity(id);
  }, []);

  // The scene binds handlers once at construction and reads the ref on
  // every dispatch, so React callback identity can change freely
  // without re-initialising Pixi or re-attaching listeners.
  const callbacksRef = useRef<SceneCallbacks>({
    onZoomAt,
    onWheelPan,
    onDragStart,
    onDragPan,
    onEntityClick,
    onEntityHover,
  });
  callbacksRef.current = {
    onZoomAt,
    onWheelPan,
    onDragStart,
    onDragPan,
    onEntityClick,
    onEntityHover,
  };

  // Pixi lifecycle — the canvas-keyed cache in pixi-scene.ts guarantees
  // StrictMode's mount → unmount → mount double-effect reuses one
  // Application (cancelling the pending destroy inside the grace
  // window). Without that, two concurrent `app.init()` calls race on
  // the same <canvas>, leak GL contexts, and freeze the tab.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = acquirePixiScene(canvas, callbacksRef);
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      releasePixiScene(canvas, scene);
    };
  }, []);

  // Static-analysis rollup: per-entity aggregated signals (riskMax,
  // taintCount, archViolations, …). Memoised on (tree, graph) — the
  // combination is stable per graph load, so colour-mode flips and
  // zoom pans reuse the same rollup without rescanning the tree.
  const entitySignals = useMemo<Map<string, EntitySignals>>(
    () => rollupEntitySignals(tree, graph),
    [tree, graph],
  );

  // Colour override — drives Risk / Heat / Layer palettes. Null for
  // the default "Kind" mode; pixi-scene falls back to its per-kind
  // palette for any entity missing from the map.
  const colorMode = useColorMode(s => s.mode);
  const colorOverride = useMemo(
    () => computeColorOverrides(colorMode, tree, graph, entitySignals),
    [colorMode, tree, graph, entitySignals],
  );

  // Alert badges — one glyph per active signal family, rendered as
  // small dots on the top-right corner of the rect. Pre-built here
  // (not in pixi-scene) so React's memoisation keeps the Map stable
  // between renders and the scene's rAF-dedup doesn't pay allocation.
  const badges = useMemo<ReadonlyMap<string, readonly SceneBadge[]>>(() => {
    const out = new Map<string, SceneBadge[]>();
    for (const [id, s] of entitySignals) {
      const list: SceneBadge[] = [];
      if (s.archViolations > 0) list.push({ kind: "arch", count: s.archViolations });
      if (s.taintCount > 0) list.push({ kind: "taint", count: s.taintCount });
      if (s.blastCritical > 0) list.push({ kind: "blast", count: s.blastCritical });
      if (s.cpxMax >= 8) list.push({ kind: "cpx", count: s.cpxMax });
      if (s.deadCount > 0) list.push({ kind: "dead", count: s.deadCount });
      if (list.length > 0) out.set(id, list);
    }
    return out;
  }, [entitySignals]);

  // Push a fresh frame to the scene on any visible change. The scene
  // holds no React state; every mutation flows through here.
  useEffect(() => {
    const frame: SceneFrame = {
      entities: visibleEntities,
      layout,
      edges: tierEdges,
      camera,
      width,
      height,
      tier,
      selectedId,
      hoveredId,
      heatMode: "none",
      colorOverride,
      badges,
    };
    sceneRef.current?.setFrame(frame);
  }, [
    visibleEntities,
    layout,
    tierEdges,
    camera,
    width,
    height,
    tier,
    selectedId,
    hoveredId,
    colorOverride,
    badges,
  ]);

  // Persist camera pose + tier + selection, debounced so a pan gesture
  // doesn't hammer localStorage. Flush on unmount so a tab switch
  // snapshots the latest pose (debounce would otherwise drop a
  // pending write if it fired mid-delay). Keyed on `tabId`, so tabs
  // with no id share the `"default"` slot — good enough for dev.
  const saveDebounced = useMemo(
    () => debounce((payload: { tx: number; ty: number; scale: number; tier: string; selectedId: string | null }) => {
      saveViewport(tabId, payload);
    }, 400),
    [tabId],
  );
  useEffect(() => {
    saveDebounced({
      tx: camera.tx,
      ty: camera.ty,
      scale: camera.scale,
      tier: tier.name,
      selectedId,
    });
  }, [camera, tier.name, selectedId, saveDebounced]);
  useEffect(() => {
    return () => {
      saveDebounced.flush();
    };
  }, [saveDebounced]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const sel = entityStore.getState().interaction.selectedId;
        if (sel) entityStore.selectEntity(null);
        else drillOut();
        return;
      }
      // Cmd/Ctrl + 0 → fit current tier. Cmd/Ctrl + 1 → 100% zoom.
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "0" || e.code === "Digit0") {
          e.preventDefault();
          const bounds = unionRects(visibleEntities, layout);
          tweenTo(cameraForRect(bounds));
          return;
        }
        if (e.key === "1" || e.code === "Digit1") {
          e.preventDefault();
          cancelTween();
          // Anchor 100% zoom on viewport center so the reset doesn't
          // pull the focus off what the user was looking at.
          zoomAt(width / 2, height / 2, 1 / cameraRef.current.scale);
          return;
        }
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          zoomAt(width / 2, height / 2, KEY_ZOOM_FACTOR);
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          zoomAt(width / 2, height / 2, 1 / KEY_ZOOM_FACTOR);
          return;
        }
      }
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = KEY_PAN_PX;
      else if (e.key === "ArrowRight") dx = -KEY_PAN_PX;
      else if (e.key === "ArrowUp") dy = KEY_PAN_PX;
      else if (e.key === "ArrowDown") dy = -KEY_PAN_PX;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      cancelTween();
      setCameraState(c => ({ ...c, tx: c.tx + dx, ty: c.ty + dy }));
    },
    [drillOut, cancelTween, cameraForRect, tweenTo, visibleEntities, layout, zoomAt, width, height],
  );

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} style={ROOT_STYLE}>
      <canvas ref={canvasRef} style={CANVAS_STYLE} />
      <MiniMap
        layout={layout}
        visibleEntities={visibleEntities}
        camera={camera}
        viewportWidth={width}
        viewportHeight={height}
        onJump={(worldX, worldY) => {
          // Single click — tween onto the target so the jump reads as
          // a move, not a teleport. Drag uses onDragPan (snap).
          const cur = cameraRef.current;
          tweenTo(
            {
              tx: width / 2 - worldX * cur.scale,
              ty: height / 2 - worldY * cur.scale,
              scale: cur.scale,
            },
            240,
          );
        }}
        onDragPan={(worldX, worldY) => {
          // Drag — snap camera 1:1 with cursor so MiniMap interaction
          // stays "feel-locked". Cancel any in-flight tween so it
          // doesn't fight the user's current gesture.
          cancelTween();
          const cur = cameraRef.current;
          setCameraState({
            tx: width / 2 - worldX * cur.scale,
            ty: height / 2 - worldY * cur.scale,
            scale: cur.scale,
          });
        }}
      />
    </div>
  );
}

function unionRects(entities: readonly Entity[], layout: HierarchicalLayout): Rect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const e of entities) {
    const r = layout.rects.get(e.id);
    if (!r) continue;
    any = true;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  if (!any) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
