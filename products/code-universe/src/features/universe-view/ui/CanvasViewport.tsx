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
import { worldViewportRect } from "@quanta/canvas-engine";
import {
  DEFAULT_TIER_LADDER,
  rollupEdges,
  tierStore,
  type TierEdge,
  type TierSpec,
} from "../../../entities/tier";
import { ENTITY_DEPTH, entityStore, useEntityState } from "../../../entities/entity";
import { startCameraTween, type CameraState } from "../../../shared/lib/camera-animation";
import { clampCamera } from "../../../shared/lib/camera-clamp";
import { debounce, saveViewport } from "../../../shared/api/viewport-persistence";
import { MiniMap } from "./MiniMap";
import { useKindFilter } from "../../kind-filter";
import { useSnapshotShortcut } from "../../snapshot";
import { ColorLegend } from "../../color-legend";
import { StickiesLayer } from "../../stickies";
import { SourceOverlay } from "../../source-viewer";
import { openEditor } from "../../source-viewer/model/editor-target";
import { rollupEntitySignals, type EntitySignals } from "@quanta/canvas-engine";
import {
  computeColorOverrides,
  useColorMode,
} from "../../color-mode";
import type { SceneBadge } from "../../../shared/lib/pixi-scene";
import {
  acquirePixiScene,
  releasePixiScene,
  WHEEL_ZOOM_K_COARSE,
  WHEEL_ZOOM_K_FINE,
  WHEEL_COARSE_THRESHOLD,
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  // ⌘/Ctrl+Shift+S → PNG snapshot of the current frame. The hook
  // owns the keyboard binding; we just give it the canvas ref so
  // CanvasViewport keeps the DOM element inside its slice.
  useSnapshotShortcut(canvasRef);
  const sceneRef = useRef<PixiScene | null>(null);

  const [camera, setCameraRaw] = useState<CameraState>(
    () => initialCamera ?? { tx: 0, ty: 0, scale: 1 },
  );
  // Clamp every camera update so the world stays at least partly
  // visible. Wrapping the setter here means pan, zoom, and tween paths
  // all pick up the clamp with zero call-site churn — critical for
  // tween frames which fire ~60/s and would otherwise fight the
  // clamp.
  const boundsRef = useRef<Rect>(layout.totalBounds);
  boundsRef.current = layout.totalBounds;
  const sizeRef = useRef({ w: width, h: height });
  sizeRef.current = { w: width, h: height };
  const setCameraState = useCallback(
    (next: CameraState | ((prev: CameraState) => CameraState)) => {
      setCameraRaw((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        return clampCamera(
          resolved,
          boundsRef.current,
          sizeRef.current.w,
          sizeRef.current.h,
        );
      });
    },
    [],
  );
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const tweenRef = useRef<{ cancel(): void } | null>(null);
  // Viewport culling — cuts the visible-entity list from O(kind total)
  // down to O(viewport-intersecting) before it enters the focus /
  // edge-rollup / scene-frame pipeline downstream. For a 50k-file repo
  // at Galaxy tier the tier kind count stays a constant handful, but
  // at Building tier the spatial filter drops array length by 100-500×,
  // turning React memo+filter work from "noticeable" into "invisible".
  //
  // Rect is expanded by 20% on each axis so small pans don't constantly
  // re-memo: a pan that shifts the viewport by less than the margin
  // keeps the same entity set, so downstream memos hold their cache.
  // Off-screen selection/anchor rendering is handled separately by the
  // scene; culling only governs the "tile floor" at the active kind.
  const CULL_MARGIN = 0.2;
  const allByKind = useMemo<readonly Entity[]>(
    () => tree.byKind(tier.visibleKind),
    [tree, tier.visibleKind],
  );
  const baseVisibleEntities = useMemo<readonly Entity[]>(() => {
    if (allByKind.length === 0) return allByKind;
    const vp = worldViewportRect(camera, width, height);
    const mx = vp.w * CULL_MARGIN;
    const my = vp.h * CULL_MARGIN;
    const expanded: Rect = { x: vp.x - mx, y: vp.y - my, w: vp.w + mx * 2, h: vp.h + my * 2 };
    return layout.spatialIndex.filterEntities(allByKind, expanded);
  }, [allByKind, camera, width, height, layout]);
  const baseTierEdges = useMemo<readonly TierEdge[]>(
    // Apply the tier's own edge policy — high-level tiers (universe,
    // galaxy) filter to severe-only so the picture stays legible;
    // low-level tiers (floor, room) let everything through. Memo keyed
    // on the edge policy *reference* from the spec, which is stable
    // per DEFAULT_TIER_LADDER entry.
    () => rollupEdges(tree, graph.fileEdges, tier.visibleKind, tier.edgePolicy),
    [tree, graph.fileEdges, tier.visibleKind, tier.edgePolicy],
  );
  const { hoveredId, selectedId, anchorId, expandedFolderId, locateId } = useEntityState(s => s.interaction);

  // Adaptive focus filter — the rule the rest of the product hangs
  // off. Three regimes, picked by comparing anchor depth to the
  // current tier:
  //   1) anchor at current tier → ego-graph (anchor + 1-hop deps).
  //      Answers "what does this file touch?" — the default view
  //      after selecting a file.
  //   2) anchor ABOVE current tier → subtree filter (descendants of
  //      the anchor at this tier). Preserves scope across drill-ins:
  //      double-click a file, land on its modules, not every module.
  //   3) anchor BELOW current tier → zoom-out pinning (keep just the
  //      anchor's ancestor chain at this tier). Rare, but without it
  //      zooming out of a focus crashes into the overview suddenly.
  // When focus is off (or the anchor is gone), fall through to base
  // sets so overview keeps working.
  // Build a single reachable-set once so entities + edges + any
  // follow-on hop-distance computations stay consistent on the same
  // adjacency snapshot. Returns null in overview mode / when no anchor
  // has been committed; callers fall through to the base sets.
  //
  // Scope filter retired — clicking an entity no longer narrows the
  // canvas to its subtree / neighbourhood. The canonical map stays
  // intact across every nav so a click is pure navigation (camera
  // moves, selection highlights), not a filter. Anchor / focusMode
  // state is still tracked by `entityStore` for downstream UI
  // (inspector, pulse ring, breadcrumb) but no longer reshapes the
  // visible set here. Kept the useMemo signature as a stable null
  // so downstream branches simplify to the base path.
  const focusedSet = useMemo<ReadonlySet<string> | null>(() => null, []);

  const focusedVisibleEntities = useMemo<readonly Entity[] | null>(() => {
    if (!focusedSet) return null;
    return baseVisibleEntities.filter(e => focusedSet.has(e.id));
  }, [focusedSet, baseVisibleEntities]);

  // Inline folder expansion — Street tier only. When a folder is
  // expanded we collapse the visible set down to three groups:
  //   - the expanded folder itself
  //   - its descendants (injected so they paint inside the folder's
  //     rect — the hierarchical layout already nests children inside
  //     parents, so adding them to `visibleEntities` is all it takes)
  //   - the expanded folder's IMMEDIATE SIBLINGS (same parentId),
  //     which render as dim+desaturated thumbnails for context
  // Every OTHER street in the workspace gets hidden. Without this,
  // `tree.byKind("street")` drops every deeply-nested street onto the
  // canvas — so expanding one package leaks the internal sub-folder
  // structure of unrelated packages into view ("왜 다른 폴더에 있는
  // 것들이 보이고"). Siblings stay because they're the peer scope
  // the user is comparing against; ancestors are drawn separately
  // as `ancestorFrames` and give the "you are inside X" breadcrumb.
  //
  // Gated on `tier.visibleKind === "street"`: expansion is a folder-
  // level affordance, meaningless at universe/galaxy (too coarse) and
  // redundant at building/floor/room (those already show their
  // internals). If the user drills away, the store keeps the id but
  // this memo ignores it — a natural reset without a store write.
  const expansion = useMemo<{
    injected: readonly Entity[];
    thumbnailIds: ReadonlySet<string>;
    hiddenIds: ReadonlySet<string>;
  } | null>(() => {
    if (!expandedFolderId) return null;
    if (tier.visibleKind !== "street") return null;
    const folder = tree.byId.get(expandedFolderId);
    if (!folder || folder.kind !== "street") return null;
    const injected: Entity[] = [];
    const walk = (id: string): void => {
      for (const cid of tree.byId.get(id)?.childIds ?? []) {
        const child = tree.byId.get(cid);
        if (!child) continue;
        injected.push(child);
        // Recurse through descendant streets so a deep folder with
        // nested sub-dirs shows the whole sub-tree inside the expanded
        // rect. Stop at buildings/floor/room — those are leaves for
        // the expand gesture; drill-in handles deeper travel.
        if (child.kind === "street") walk(cid);
      }
    };
    walk(expandedFolderId);
    const expandedIds = new Set<string>([expandedFolderId, ...injected.map(e => e.id)]);
    const parentId = folder.parentId;
    const thumbnailIds = new Set<string>();
    const hiddenIds = new Set<string>();
    for (const e of baseVisibleEntities) {
      if (expandedIds.has(e.id)) continue;
      if (e.parentId === parentId) {
        thumbnailIds.add(e.id);
      } else {
        hiddenIds.add(e.id);
      }
    }
    return { injected, thumbnailIds, hiddenIds };
  }, [expandedFolderId, tier.visibleKind, tree, baseVisibleEntities]);
  const focusedTierEdges = useMemo<readonly TierEdge[] | null>(() => {
    if (!focusedSet) return null;
    return baseTierEdges.filter(e => focusedSet.has(e.fromId) && focusedSet.has(e.toId));
  }, [focusedSet, baseTierEdges]);
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
  // Fold expansion-injected children into the pre-kind set so the
  // kind-filter below still applies to them uniformly (a user toggling
  // "hide files" should hide the expanded folder's files too).
  // Hidden peers (not siblings of the expanded folder) are dropped
  // here so unrelated packages' nested sub-streets don't leak into the
  // focused view.
  const withExpansion = useMemo<readonly Entity[]>(() => {
    if (!expansion) return preKindEntities;
    const seen = new Set<string>();
    const out: Entity[] = [];
    for (const e of preKindEntities) {
      if (expansion.hiddenIds.has(e.id)) continue;
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    for (const e of expansion.injected) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return out;
  }, [preKindEntities, expansion]);
  const visibleEntities = useMemo<readonly Entity[]>(
    () => (allKindsOn ? withExpansion : withExpansion.filter(e => kindVisibility[e.kind])),
    [withExpansion, allKindsOn, kindVisibility],
  );
  // Drop edges whose endpoints fall under a hidden kind or the
  // expansion hide-set so we don't render phantom lines between
  // invisible rects.
  const tierEdges = useMemo<readonly TierEdge[]>(() => {
    if (allKindsOn && !expansion) return preKindEdges;
    const visibleIds = new Set(visibleEntities.map(e => e.id));
    return preKindEdges.filter(e => visibleIds.has(e.fromId) && visibleIds.has(e.toId));
  }, [preKindEdges, allKindsOn, visibleEntities, expansion]);

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

  // One-shot initial fit — lands the camera somewhere sensible when
  // the graph first appears, then never fires again. Restored
  // `initialCamera` short-circuits this entirely.
  const didInitialFit = useRef(false);
  useLayoutEffect(() => {
    if (didInitialFit.current) return;
    if (initialCamera) {
      didInitialFit.current = true;
      return;
    }
    if (visibleEntities.length === 0) return;
    const bounds = unionRects(visibleEntities, layout);
    const target = cameraForRect(bounds);
    // Snap rather than tween — this is the landing frame, not a
    // camera move. A tween here shows a brief "drifting-into-place"
    // animation on first paint that reads as lag.
    setCameraState(target);
    didInitialFit.current = true;
  }, [visibleEntities, layout, cameraForRect, initialCamera]);

  // Anchor change → camera flies to the anchor's own rect (not to
  // the old scope-filtered visibleEntities). With the scope filter
  // retired, "navigate" means "put this specific entity in frame";
  // fitting to visibleEntities would just re-fit the whole world on
  // every click. Drill-in + Inspector "show in canvas" land here.
  const prevAnchorRef = useRef<string | null>(anchorId);
  useEffect(() => {
    if (prevAnchorRef.current === anchorId) return;
    prevAnchorRef.current = anchorId;
    if (!didInitialFit.current) return; // initial-fit still owns mount
    if (!anchorId) return;
    const rect = layout.rects.get(anchorId);
    if (!rect) return;
    tweenTo(cameraForRect(rect));
  }, [anchorId, layout, cameraForRect, tweenTo]);

  useEffect(() => () => cancelTween(), [cancelTween]);

  // Locate — pan to an entity on tree-hover / tree-click (scale-
  // preserving). Fires when `locateId` transitions from null → id
  // after a 350 ms pause in the Explorer tree, or immediately on
  // Explorer click. The layout carries rects for every tier so we
  // pan even when the entity's kind doesn't match the active tier —
  // the user sees the ancestor container that holds their pick, not
  // a blank viewport.
  const prevLocateRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevLocateRef.current === locateId) return;
    prevLocateRef.current = locateId;
    if (!locateId) return;
    const rect = layout.rects.get(locateId);
    if (!rect) return;
    const cur = cameraRef.current;
    const sl = rect.x * cur.scale + cur.tx;
    const st = rect.y * cur.scale + cur.ty;
    const sr = sl + rect.w * cur.scale;
    const sb = st + rect.h * cur.scale;
    const pad = 48;
    if (sl > pad && st > pad && sr < width - pad && sb < height - pad) return;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    tweenTo({ tx: width / 2 - cx * cur.scale, ty: height / 2 - cy * cur.scale, scale: cur.scale });
  }, [locateId, layout, visibleEntities, width, height, tweenTo]);

  // Anchor pulse — fire an expanding ring on the entity card after the
  // fly-to tween settles. Delayed so the ring lands on a stable
  // screen position rather than chasing a moving camera.
  const [pulseKey, setPulseKey] = useState(0);
  const [pulseAnchorId, setPulseAnchorId] = useState<string | null>(null);
  const prevAnchorForPulse = useRef<string | null>(anchorId);
  useEffect(() => {
    if (prevAnchorForPulse.current === anchorId) return;
    prevAnchorForPulse.current = anchorId;
    if (!anchorId) { setPulseAnchorId(null); return; }
    const t = setTimeout(() => {
      setPulseKey(k => k + 1);
      setPulseAnchorId(anchorId);
    }, 280);
    return () => clearTimeout(t);
  }, [anchorId]);

  // Camera follow on inline expansion — glide to the expanded
  // folder's rect so the user's eye doesn't have to hunt for where
  // the children just materialised. Uses a slightly longer tween than
  // drill-in (320 vs 260 ms) because the camera move is SMALLER
  // (staying at the same tier, not crossing a ladder step) and a
  // too-fast move reads as a jump cut. Collapse fits back to the peer
  // set so the user regains overview.
  //
  // Gated on actual id transition (prevRef) so a re-render with the
  // same expandedFolderId doesn't re-tween. Initial-fit owns the very
  // first frame; this hook ignores that transition to avoid fighting
  // the landing camera.
  const prevExpandedRef = useRef<string | null>(expandedFolderId);
  useEffect(() => {
    const prev = prevExpandedRef.current;
    prevExpandedRef.current = expandedFolderId;
    if (prev === expandedFolderId) return;
    if (!didInitialFit.current) return;
    if (expandedFolderId) {
      const rect = layout.rects.get(expandedFolderId);
      if (!rect) return;
      // Slightly smaller pad than drill-in — inline expansion wants
      // the folder to dominate but keeps a slice of peers visible as
      // thumbnail context.
      tweenTo(cameraForRect(rect, 48));
    } else {
      // Collapse — fit back to the base sibling set so the user sees
      // where the folder lived in context.
      if (visibleEntities.length === 0) return;
      const bounds = unionRects(visibleEntities, layout);
      if (!bounds) return;
      tweenTo(cameraForRect(bounds));
    }
  }, [expandedFolderId, layout, cameraForRect, tweenTo, visibleEntities]);

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
      // Buildings are leaves in the ladder — dblclick means "open this
      // file for reading/editing", not "drill another tier down".
      // Skip the camera tween here: the overlay centres itself over
      // the viewport, so moving the camera underneath would just make
      // the background jump while the user is focused on the editor.
      if (entity.kind === "building") {
        entityStore.selectEntity(entity.id);
        openEditor(entity.id);
        return;
      }
      tweenTo(cameraForRect(rect, 24));
      const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
      const innerSpec = DEFAULT_TIER_LADDER[idx + 1];
      if (
        innerSpec &&
        entity.childIds.length > 0 &&
        ENTITY_DEPTH[entity.kind] < ENTITY_DEPTH[innerSpec.visibleKind]
      ) {
        // Higher-tier drill: select the entity and flip the tier one
        // rung deeper. Anchor is no longer used to filter (scope
        // filter is retired) — selection alone is enough for the
        // inspector / highlight seam.
        entityStore.selectEntity(entity.id);
        queueMicrotask(() => tierStore.jumpToTier(innerSpec.name));
      } else {
        entityStore.selectEntity(entity.id);
      }
    },
    [tier.name, layout, cameraForRect, tweenTo],
  );

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
  // tracks the actual viewport scale. With the one-shot initial fit,
  // there's no tier-change auto-zoom to race against any more —
  // `skipNextFit` is gone.
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
    },
    [cancelTween],
  );

  // Tier store mirrors the actual camera scale — every update path
  // (wheel zoom, drag pan, initial-fit, drill-in tween, saved-
  // viewport restore) flows through `setCameraState`, so syncing in
  // a single effect covers them all. Without this, a saved viewport
  // loaded at galaxy scale would keep rendering the building tier
  // because `tierStore` was initialised with the default 0.1 and
  // never heard about the restored camera ("Galaxy/Street 적용 안 됨"
  // report — initial scale was already in galaxy band but tier HUD
  // still said building).
  useEffect(() => {
    tierStore.setScale(camera.scale);
  }, [camera.scale]);
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
      // Click = select ONLY. No auto camera-zoom, no tier flip.
      // Forcing users into a zoom on every click broke exploration —
      // pick an entity, lose your mental map, have to pan back. Drill-
      // in is the `dblclick` handler below; Inspector "Drill in" and
      // Cmd/Ctrl + 0 also trigger the same flow.
      const entity = tree.byId.get(id);
      if (!entity) return;
      const isFolderExpand = tier.visibleKind === "street" && entity.kind === "street";
      entityStore.selectEntity(id);
      if (isFolderExpand) {
        // Toggle inline expansion. Two store mutations after this:
        // `setExpandedFolder` publishes the new expansion target, and
        // `setAnchor(null)` cancels the auto-focus that `selectEntity`
        // triggers on the first click out of an empty state — without
        // this, the `focusedSet` filter in CanvasViewport would prune
        // every peer folder away (they're not graph-adjacent to the
        // clicked folder), leaving just the expanded folder on screen
        // and killing the thumbnail context effect. Selection itself
        // survives (setAnchor preserves selectedId when passed null).
        const cur = entityStore.getState().interaction.expandedFolderId;
        entityStore.setExpandedFolder(cur === id ? null : id);
        entityStore.setAnchor(null);
      }
    },
    [tree, tier.visibleKind],
  );
  const onEntityDoubleClick = useCallback(
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
  const onAncestorChipClick = useCallback(
    (id: string) => {
      // Breadcrumb chip → same drill-in flow as dblclick on the rect:
      // commit the entity as anchor and zoom/flip the tier so the user
      // lands inside that ancestor's scope.
      const entity = tree.byId.get(id);
      if (!entity) return;
      entityStore.selectEntity(id);
      drillInto(entity);
    },
    [tree, drillInto],
  );

  // The scene binds handlers once at construction and reads the ref on
  // every dispatch, so React callback identity can change freely
  // without re-initialising Pixi or re-attaching listeners.
  const callbacksRef = useRef<SceneCallbacks>({
    onZoomAt,
    onWheelPan,
    onDragStart,
    onDragPan,
    onEntityClick,
    onEntityDoubleClick,
    onEntityHover,
    onAncestorChipClick,
  });
  callbacksRef.current = {
    onZoomAt,
    onWheelPan,
    onDragStart,
    onDragPan,
    onEntityClick,
    onEntityDoubleClick,
    onEntityHover,
    onAncestorChipClick,
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

  // Container-level wheel handler — catches zoom/pan events that fire
  // on HTML overlays (SourceCard headers, MiniMap, CanvasToolbar) which
  // are siblings of the <canvas>, not ancestors. Pixi's own listener is
  // attached to the <canvas> element so it never fires for overlay
  // targets; this handler fills that gap. Canvas events are skipped
  // (pixi already handled them) by checking e.target.
  const wheelCbRef = useRef({ zoomAt, onWheelPan });
  useEffect(() => { wheelCbRef.current = { zoomAt, onWheelPan }; });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.target === canvasRef.current) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const { zoomAt: za, onWheelPan: owp } = wheelCbRef.current;
      if (e.ctrlKey || e.metaKey) {
        const k = Math.abs(e.deltaY) > WHEEL_COARSE_THRESHOLD ? WHEEL_ZOOM_K_COARSE : WHEEL_ZOOM_K_FINE;
        za(cx, cy, Math.exp(-e.deltaY * k));
      } else {
        owp(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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

  // Spotlight dimming retired — the adaptive scope filter already
  // hides non-connected entities, so dimming on top would grey out
  // cards the user explicitly asked to see. `spotlightIds: null`
  // keeps the pixi scene's dim path dormant while preserving the
  // type/prop surface in case we want a different visual treatment
  // (e.g. indirect-hop subtle tint) later.
  const spotlightIds = null;

  // Ancestor containment frames — when anything is anchored or
  // selected, hand the scene the chain of parent rects (leaf→root)
  // so the canvas can paint "this file is inside THIS package /
  // directory" as faint outlined frames behind the edges. The
  // universe root is skipped (its frame covers the whole world,
  // adds no value). The anchor itself is included as depth-0 ONLY
  // when it's a container at the current tier (i.e., its kind is
  // above visibleKind) — otherwise the anchor IS one of the cards
  // on screen and framing it would double-draw the selection.
  // Closest parent gets the strongest alpha in the renderer.
  const ancestorFrames = useMemo(() => {
    const id = anchorId ?? selectedId;
    if (!id) return null;
    const anchor = tree.byId.get(id);
    if (!anchor) return null;
    const out: { id: string; name: string; path: string; kind: Entity["kind"]; rect: Rect; depth: number }[] = [];
    const anchorIsContainer = ENTITY_DEPTH[anchor.kind] < ENTITY_DEPTH[tier.visibleKind];
    let depth = 0;
    for (const a of tree.ancestorsOf(id)) {
      if (a.id === id && !anchorIsContainer) continue;
      if (a.parentId === null) continue;
      const rect = layout.rects.get(a.id);
      if (!rect) continue;
      out.push({ id: a.id, name: a.name, path: a.path, kind: a.kind, rect, depth });
      depth++;
    }
    return out.length > 0 ? out : null;
  }, [anchorId, selectedId, tree, layout, tier.visibleKind]);

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

  const thumbnailIds = expansion?.thumbnailIds ?? null;

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
      spotlightIds,
      thumbnailIds,
      anchorId,
      ancestorFrames,
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
    spotlightIds,
    thumbnailIds,
    anchorId,
    ancestorFrames,
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
        const interaction = entityStore.getState().interaction;
        // Priority: collapse expansion → clear selection → drill out.
        // Each Esc peels one layer; mashing Esc eventually gets the
        // user all the way to the overview without a risky reset.
        if (interaction.expandedFolderId) {
          entityStore.setExpandedFolder(null);
        } else if (interaction.selectedId) {
          entityStore.selectEntity(null);
        } else {
          drillOut();
        }
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

  const pulseRingProps = useMemo((): { left: number; top: number; w: number; h: number } | null => {
    if (!pulseAnchorId) return null;
    const rect = layout.rects.get(pulseAnchorId);
    if (!rect) return null;
    const sl = Math.round(rect.x * camera.scale + camera.tx);
    const st = Math.round(rect.y * camera.scale + camera.ty);
    const sw = Math.max(1, Math.round(rect.w * camera.scale));
    const sh = Math.max(1, Math.round(rect.h * camera.scale));
    if (sl + sw < -20 || st + sh < -20 || sl > width + 20 || st > height + 20) return null;
    return { left: sl, top: st, w: sw, h: sh };
  }, [pulseAnchorId, layout, camera, width, height]);

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={onKeyDown} style={ROOT_STYLE}>
      <canvas ref={canvasRef} style={CANVAS_STYLE} />
      {pulseRingProps && (
        <AnchorPulseRing key={pulseKey} {...pulseRingProps} />
      )}
      <SourceOverlay
        tree={tree}
        viewportWidth={width}
        viewportHeight={height}
      />
      <StickiesLayer
        layout={layout}
        visibleEntities={visibleEntities}
        camera={camera}
      />
      <ColorLegend />
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
          tweenTo({
            tx: width / 2 - worldX * cur.scale,
            ty: height / 2 - worldY * cur.scale,
            scale: cur.scale,
          });
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

function AnchorPulseRing({ left, top, w, h }: {
  left: number; top: number; w: number; h: number;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.animate(
      [
        { opacity: 0,    transform: "scale(0.88)" },
        { opacity: 0.85, transform: "scale(1.0)",  offset: 0.12 },
        { opacity: 0,    transform: "scale(1.38)" },
      ],
      { duration: 560, easing: "ease-out", fill: "forwards" },
    );
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        border: "2px solid rgba(99, 102, 241, 0.75)",
        borderRadius: 5,
        pointerEvents: "none",
        zIndex: 12,
        transformOrigin: "center",
      }}
    />
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
