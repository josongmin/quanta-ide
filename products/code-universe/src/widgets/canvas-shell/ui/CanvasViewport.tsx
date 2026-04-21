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
import { ColorLegend } from "../../../features/color-legend";
import { StickiesLayer } from "../../../features/stickies";
import { SourceOverlay } from "../../../features/source-viewer";
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
  const { hoveredId, selectedId, focusMode, anchorId, expandedFolderId } = useEntityState(s => s.interaction);

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
  // Same-tier anchor uses TRANSITIVE CLOSURE (BFS), not 1-hop ego —
  // user asked for "연결된 건 다 나오게". That means direct + indirect
  // deps all render at full opacity; the dim spotlight visual is
  // retired (see the spotlightIds wiring below). Higher-tier anchor
  // keeps the subtree filter (workspace → everything under it).
  const focusedSet = useMemo<ReadonlySet<string> | null>(() => {
    if (focusMode !== "neighborhood" || !anchorId) return null;
    const anchor = tree.byId.get(anchorId);
    if (!anchor) return null;
    const tierDepth = ENTITY_DEPTH[tier.visibleKind];
    const anchorDepth = ENTITY_DEPTH[anchor.kind];
    if (tierDepth === anchorDepth) {
      // Build an undirected adjacency from tier edges, then BFS from
      // the anchor. Adjacency is O(V+E); BFS O(V+E). Visible tiers
      // have |V| ≤ a few thousand, so this is cheap per anchor flip.
      const adj = new Map<string, string[]>();
      for (const edge of baseTierEdges) {
        (adj.get(edge.fromId) ?? adj.set(edge.fromId, []).get(edge.fromId)!).push(edge.toId);
        (adj.get(edge.toId) ?? adj.set(edge.toId, []).get(edge.toId)!).push(edge.fromId);
      }
      const reachable = new Set<string>([anchorId]);
      const q: string[] = [anchorId];
      while (q.length > 0) {
        const id = q.shift()!;
        const nbrs = adj.get(id);
        if (!nbrs) continue;
        for (const n of nbrs) {
          if (reachable.has(n)) continue;
          reachable.add(n);
          q.push(n);
        }
      }
      // Siblings — every entity sharing the anchor's parent is folded
      // in as an implicit dependency. Co-located files are almost
      // always edited together and show up as a cluster in the
      // mental model even when the static import graph misses them
      // (runtime wiring, re-exports, types). Without this the canvas
      // collapses to one card for a leaf with no imports, which
      // reads as broken.
      const parentId = anchor.parentId;
      if (parentId !== null) {
        for (const e of baseVisibleEntities) {
          if (e.parentId === parentId) reachable.add(e.id);
        }
      }
      return reachable;
    }
    if (tierDepth > anchorDepth) {
      const set = new Set<string>();
      for (const e of baseVisibleEntities) {
        for (const a of tree.ancestorsOf(e.id)) {
          if (a.id === anchorId) { set.add(e.id); break; }
        }
      }
      return set;
    }
    // tierDepth < anchorDepth — pin the anchor's ancestor at this tier.
    const ancestorAtTier = [...tree.ancestorsOf(anchorId)].find(a => a.kind === tier.visibleKind);
    return ancestorAtTier ? new Set<string>([ancestorAtTier.id]) : new Set<string>();
  }, [focusMode, anchorId, tree, tier.visibleKind, baseTierEdges, baseVisibleEntities]);

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

  // Auto-fit ONLY on explicit navigation — i.e. the anchor changed.
  // That covers Explorer click, drill-in, Inspector drill/focus
  // buttons. Tier crossings driven by wheel pinch do NOT change the
  // anchor, so camera stays put for the user-controlled zoom. Without
  // this, a Explorer click can land the scope offscreen (user picks
  // build.ts → filter narrows to one card → camera still at overview
  // pose → blank viewport, "아무것도 안나옴"). We tween, not snap, so
  // the navigation reads as a visible motion.
  const prevAnchorRef = useRef<string | null>(anchorId);
  useEffect(() => {
    if (prevAnchorRef.current === anchorId) return;
    prevAnchorRef.current = anchorId;
    if (!didInitialFit.current) return; // initial-fit still owns mount
    if (visibleEntities.length === 0) return;
    const bounds = unionRects(visibleEntities, layout);
    if (!bounds) return;
    tweenTo(cameraForRect(bounds), 260);
  }, [anchorId, visibleEntities, layout, cameraForRect, tweenTo]);

  useEffect(() => () => cancelTween(), [cancelTween]);

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
      tweenTo(cameraForRect(rect, 48), 320);
    } else {
      // Collapse — fit back to the base sibling set so the user sees
      // where the folder lived in context.
      if (visibleEntities.length === 0) return;
      const bounds = unionRects(visibleEntities, layout);
      if (!bounds) return;
      tweenTo(cameraForRect(bounds), 260);
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
      tweenTo(cameraForRect(rect, 24), 240);
      const idx = DEFAULT_TIER_LADDER.findIndex(t => t.name === tier.name);
      const innerSpec = DEFAULT_TIER_LADDER[idx + 1];
      if (
        innerSpec &&
        entity.childIds.length > 0 &&
        ENTITY_DEPTH[entity.kind] < ENTITY_DEPTH[innerSpec.visibleKind]
      ) {
        // Commit the drilled-into entity as the scope anchor BEFORE
        // the tier flip — the canvas's subtree filter picks it up on
        // the next render and only this entity's descendants appear
        // at the new tier. Without this the flip would show every
        // sibling entity's children, defeating the point of drilling.
        entityStore.setAnchor(entity.id);
        queueMicrotask(() => tierStore.jumpToTier(innerSpec.name));
      } else {
        // Leaf or same-depth drill — still commit the anchor so the
        // ego filter re-centers on this entity.
        entityStore.setAnchor(entity.id);
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

  return (
    <div tabIndex={0} onKeyDown={onKeyDown} style={ROOT_STYLE}>
      <canvas ref={canvasRef} style={CANVAS_STYLE} />
      <SourceOverlay
        tree={tree}
        layout={layout}
        camera={camera}
        tier={tier}
        viewportWidth={width}
        viewportHeight={height}
        selectedId={selectedId}
        onSelect={onEntityClick}
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
