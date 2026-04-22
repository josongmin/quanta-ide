// Galaxy3DView.tsx
// ---------------------------------------------------------------
// Three.js 3D galaxy — files as glowing spheres in deep space.
//
// Scene:
//   - Deep-space background (0x020510)
//   - 2000-star particle field on a large sphere
//   - Package cluster halos (large translucent spheres)
//   - File nodes: glowing sphere + additive-blend glow sprite
//   - Dependency edges: translucent lines, highlighted on select
//   - HTML label overlay (positioned via camera projection)
//
// Controls:
//   - Left drag: orbit  |  right drag: pan  |  scroll: zoom
//   - Auto-rotation when idle (pauses on hover)
//   - Click node: select + highlight connections

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { buildGalaxy3DLayout } from "../model/build-galaxy-3d-layout";
import type { Galaxy3DLayout, Galaxy3DNode } from "../model/types";
import { font, space } from "../../../shared/ui/tokens";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface Galaxy3DViewProps {
  graph: WorkspaceGraph;
  selectedId?: string;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── File glyphs (icon prefix for labels) ──────────────────────────────

/** Unicode glyph hinting at the file kind. Hubs and the centre node get
 *  their own silhouette; extension-based glyphs for leaves; symbol kind
 *  drives the glyph for expanded child nodes. */
function fileGlyph(node: Galaxy3DNode): string {
  if (node.kind === "center") return "★";
  if (node.kind === "hub")    return "⬢";
  if (node.kind === "symbol") {
    switch (node.symbolKind) {
      case "class":     return "◇";
      case "function":  return "ƒ";
      case "method":    return "ƒ";
      case "variable":  return "x";
      case "parameter": return "›";
      case "module":    return "{}";
      default:          return "ƒ";
    }
  }
  const name = node.fileName;
  const dot  = name.lastIndexOf(".");
  const ext  = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "tsx":
    case "jsx":  return "⚛";
    case "ts":   return "◆";
    case "js":
    case "mjs":
    case "cjs":  return "◇";
    case "rs":   return "◈";
    case "json": return "{}";
    case "md":
    case "mdx":  return "¶";
    case "css":
    case "scss": return "▨";
    case "html": return "⌘";
    case "svg":
    case "png":
    case "jpg":  return "▣";
    case "yml":
    case "yaml":
    case "toml": return "≡";
    default:     return "•";
  }
}

// ── Lightweight OrbitControls ─────────────────────────────────────────

interface OrbitState {
  theta: number; phi: number; radius: number;
  targetTheta: number; targetPhi: number; targetRadius: number;
  autoRotate: boolean;
  dragging: boolean; lastX: number; lastY: number;
}

function makeOrbit(initial: { radius?: number } = {}): OrbitState {
  const r = initial.radius ?? 550;
  return {
    theta: 0, phi: Math.PI / 2.5,
    targetTheta: 0, targetPhi: Math.PI / 2.5,
    radius: r, targetRadius: r,
    autoRotate: true, dragging: false, lastX: 0, lastY: 0,
  };
}

function orbitToXYZ(o: OrbitState): [number, number, number] {
  return [
    o.radius * Math.sin(o.phi) * Math.sin(o.theta),
    o.radius * Math.cos(o.phi),
    o.radius * Math.sin(o.phi) * Math.cos(o.theta),
  ];
}

// ── Scene state type ───────────────────────────────────────────────────

interface SceneState {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  nodeMeshes: THREE.Mesh[];
  nodeSprites: THREE.Sprite[];
  edgeLines: THREE.LineSegments;
  hlEdgeLines: THREE.LineSegments;
  orbit: OrbitState;
  layout: Galaxy3DLayout;
  nodeMap: Map<string, Galaxy3DNode>;
  selectedId: string | null;
  raf: number;
  labelEls: HTMLElement[];
}

// ── Main component ─────────────────────────────────────────────────────

function Galaxy3DViewImpl({ graph, selectedId, onFocusEntity, onDismiss }: Galaxy3DViewProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const labelRef   = useRef<HTMLDivElement>(null);
  const stateRef   = useRef<SceneState | null>(null);
  /** Node ids present in the previously-built layout. Used to tag newly
   *  spawned nodes (mostly symbols from expansion) with a birth time so
   *  the render loop can play a scale/position "whoosh" on them without
   *  re-animating every file that already existed. */
  const priorNodeIdsRef = useRef<Set<string>>(new Set<string>());
  /** Orbit state persisted across scene rebuilds. Expansion toggles
   *  tear down and rebuild the scene (deps on layout node count); we
   *  reuse the same OrbitState object so the user's camera framing
   *  survives — clicking a file to expand must not reset the view. */
  const orbitRef = useRef<OrbitState | null>(null);
  /** Wormhole-warp state for drill-in. `phase:"in"` is a pre-rebuild
   *  animation on the CURRENT scene (target dives to origin, others
   *  push outward, camera zooms, flash ramps up). `phase:"out"` kicks
   *  in right after the selection change has rebuilt the scene —
   *  every new node bursts from origin outward to its final slot while
   *  the flash fades. A single ref (not state) so mutations mid-frame
   *  don't trigger React renders. */
  const warpStateRef = useRef<{ phase: "in" | "out"; startMs: number; targetFileId: string } | null>(null);
  /** White/gold radial flash DOM element sitting over the canvas.
   *  Opacity is driven imperatively from the RAF loop so it lines up
   *  exactly with the warp phase timings. */
  const flashRef = useRef<HTMLDivElement>(null);
  /** Entry-warp latch. Fires the wormhole reveal exactly once per
   *  component mount — switching INTO the galaxy view should feel
   *  like popping out of hyperspace every time. Subsequent scene
   *  rebuilds (expansion toggle, recenter) skip it because the ref
   *  sticks to `true` for the remainder of this mount's lifetime. */
  const hasPlayedEntryWarpRef = useRef(false);
  /** Last selectedId the view saw. Used to detect EXTERNAL selection
   *  changes (e.g. the user clicks a file in the tree panel while
   *  Galaxy is already mounted) and fire a wormhole phase-out in
   *  response. Self-triggered drill-ins (handleDrillIn) also change
   *  selectedId, but they orchestrate their own in→out warp, so we
   *  stamp this ref to the upcoming id BEFORE calling onFocusEntity
   *  and the selectedId effect treats it as "already handled". */
  const lastSelectedIdRef = useRef<string | null | undefined>(selectedId);

  const [mounted, setMounted] = useState(false);
  const [infoNode, setInfoNode] = useState<{ name: string; pkg: string; risk: number; edges: number } | null>(null);
  /** Files (and the centre) whose symbol children are currently
   *  revealed in the scene. Transient UI state — a layout derivation,
   *  not something the entity store should own. Click a file to toggle. */
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(() => new Set());
  /** Hover preview state. Set when raycast lands on a file/centre mesh,
   *  cleared on canvas leave or empty raycast. The card anchors to
   *  (x, y) captured at the last hover update — stable while the user
   *  reads, doesn't chase the mouse frame-by-frame. */
  const [hoverInfo, setHoverInfo] = useState<{ fileId: string; x: number; y: number } | null>(null);
  /** Mirror of hoverInfo.fileId, lives in a ref so the canvas mousemove
   *  handler can short-circuit state updates when the underlying id
   *  hasn't changed (prevents re-renders on every pixel of mouse
   *  travel). Also read by the RAF loop to pause auto-rotate on hover. */
  const hoveredIdRef = useRef<string | null>(null);
  /** True while the cursor sits anywhere inside the galaxy viewport —
   *  mesh hit or not. Auto-rotate should pause the moment the user
   *  stops being a spectator, not only when the raycast catches a
   *  file. Flipped by container mouseenter/leave (see onPointerEnter /
   *  onCanvasLeave). */
  const pointerInsideRef = useRef(false);

  const layout = buildGalaxy3DLayout({ graph, selectedId, expandedFileIds });

  /** Toggle symbol expansion for a given file/centre node. Immutable
   *  Set swap so React notices; the layout effect rebuilds the scene
   *  and new symbol meshes animate in from the parent's position. */
  const toggleExpansion = useCallback((fileId: string) => {
    setExpandedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId); else next.add(fileId);
      return next;
    });
  }, []);

  const handleSelect = useCallback((fileId: string) => {
    const st = stateRef.current;
    if (!st) return;
    const node = st.nodeMap.get(fileId);
    // Hubs are visual aggregators — no interaction.
    if (node?.kind === "hub") return;
    st.selectedId = fileId;
    if (node) setInfoNode({ name: node.fileName, pkg: node.packageLabel, risk: node.riskScore, edges: node.edgeCount });
    // File/centre mesh click → expand/collapse symbols (quick peek).
    // Symbol mesh click → forward to the outer app as a select event so
    // the inspector / tree can react, without re-centering the galaxy.
    // Drilling into a file or symbol is a separate gesture (the label
    // hover "→" button below) to prevent accidental recentres.
    if (node?.kind === "file" || node?.kind === "center") {
      toggleExpansion(fileId);
      return;
    }
    if (node?.kind === "symbol") {
      onFocusEntity?.(fileId);
    }
  }, [onFocusEntity, toggleExpansion]);

  /** Label "→" drill-in click handler. Plays a wormhole sequence:
   *
   *    1. `phase:"in"` (500ms) — target mesh dives toward origin while
   *       growing; other meshes stretch radially outward and fade;
   *       camera zooms in; white radial flash ramps up cubically.
   *    2. At the end of phase-in we fire `onFocusEntity` (this drives
   *       selectedId), swap the ref to `phase:"out"`, and let the
   *       ensuing layout change tear down + rebuild the scene under
   *       cover of the fully-opaque flash.
   *    3. `phase:"out"` (550ms) — every new node originates at (0,0,0)
   *       scaled to 0 and bursts outward to its final slot via the
   *       existing whoosh pipeline; flash fades down.
   *
   *  Re-entry during an active warp is blocked so rapid clicks can't
   *  stack half-finished transitions on top of each other. */
  const handleDrillIn = useCallback((fileId: string) => {
    if (!onFocusEntity) return;
    if (warpStateRef.current) return;
    const st = stateRef.current;
    if (!st) { onFocusEntity(fileId); return; }

    warpStateRef.current = {
      phase: "in",
      startMs: performance.now(),
      targetFileId: fileId,
    };
    st.orbit.autoRotate = false;

    const WARP_IN_MS = 500;
    const WARP_OUT_MS = 600;

    setTimeout(() => {
      warpStateRef.current = {
        phase: "out",
        startMs: performance.now(),
        targetFileId: fileId,
      };
      // Stamp BEFORE the selection change propagates so the
      // selectedId-change effect below knows this drill was
      // self-triggered and skips firing another warp.
      lastSelectedIdRef.current = fileId;
      onFocusEntity(fileId);
      setTimeout(() => {
        warpStateRef.current = null;
        const s = stateRef.current;
        if (s) s.orbit.autoRotate = true;
      }, WARP_OUT_MS + 50);
    }, WARP_IN_MS);
  }, [onFocusEntity]);

  // External selection changes (tree-panel click, breadcrumb, URL
  // navigation) should also warp into the new file — otherwise the
  // scene just silently swaps its centre and the user loses the
  // "traveled somewhere" cue. Skip the initial mount (entry-warp
  // already covers that) and skip any change whose id the drill-in
  // handler has already claimed.
  useEffect(() => {
    if (lastSelectedIdRef.current === selectedId) return;
    lastSelectedIdRef.current = selectedId;
    if (warpStateRef.current) return; // handleDrillIn owns the sequence
    // Defer one frame so the scene-rebuild effect (keyed on layoutSig)
    // has run first — new meshes exist with finalX/Y/Z set, and the
    // phase-out animation can burst them out from origin.
    warpStateRef.current = {
      phase: "out",
      startMs: performance.now(),
      targetFileId: selectedId ?? "",
    };
    const s = stateRef.current;
    if (s) {
      s.orbit.radius = 170;
      s.orbit.targetRadius = 170;
      s.orbit.autoRotate = false;
    }
    if (flashRef.current) flashRef.current.style.opacity = "1";
    const tid = window.setTimeout(() => {
      warpStateRef.current = null;
      const ss = stateRef.current;
      if (ss) ss.orbit.autoRotate = true;
    }, 650);
    return () => window.clearTimeout(tid);
  }, [selectedId]);

  // Re-centring (selectedId change) collapses all prior expansions so
  // the new galaxy starts in its default file-tier framing. Without
  // this, stale symbol spheres would linger around files that no
  // longer sit at the same spatial slots.
  useEffect(() => {
    setExpandedFileIds(prev => (prev.size === 0 ? prev : new Set()));
    priorNodeIdsRef.current = new Set();
  }, [selectedId]);

  // ── Scene init ────────────────────────────────────────────────────

  // Layout signature: hashes node id / kind / position + edge endpoints.
  // Any meaningful shape change forces the scene rebuild below. Counting
  // only nodes/edges let stale meshes survive cross-selection rebuilds
  // (same count, different data) and made HMR confusing because code
  // changes didn't flip the length deps, so the effect never re-fired.
  const layoutSig =
    layout.nodes.map(n => `${n.fileId}|${n.kind}|${n.x.toFixed(1)},${n.y.toFixed(1)},${n.z.toFixed(1)}`).join(";")
    + "::"
    + layout.edges.map(e => `${e.from}->${e.to}${e.tree ? "t" : ""}`).join(";");

  useEffect(() => {
    const container = mountRef.current;
    const labelContainer = labelRef.current;
    if (!container || !labelContainer) return;

    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 560;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x020510, 1);
    container.appendChild(renderer.domElement);

    // Camera
    const camera = new THREE.PerspectiveCamera(55, W / H, 1, 8000);
    // Reuse any existing orbit so rebuilds triggered by expansion toggles
    // (see useEffect deps) don't reset the user's camera position.
    const orbit  = orbitRef.current ?? makeOrbit();
    orbitRef.current = orbit;
    const [cx, cy, cz] = orbitToXYZ(orbit);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020510, 0.00065);

    // Lights
    scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
    const pLight = new THREE.PointLight(0xaabbff, 2.0, 1800);
    pLight.position.set(0, 300, 0);
    scene.add(pLight);
    const pLight2 = new THREE.PointLight(0xffccaa, 1.2, 1400);
    pLight2.position.set(-200, -100, 200);
    scene.add(pLight2);

    // ── Star field ──────────────────────────────────────────────────
    const starPositions: number[] = [];
    for (let i = 0; i < 3000; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi   = Math.random() * Math.PI * 2;
      const r     = 1800 + Math.random() * 400;
      starPositions.push(
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.sin(phi),
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 0.75 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Node meshes (no glow sprites, no package halos — keeps the
    //    scene clean so each angular polyhedron reads clearly) ─────
    const nodeMap     = new Map<string, Galaxy3DNode>();
    const nodeMeshes: THREE.Mesh[]    = [];
    const nodeSprites: THREE.Sprite[] = []; // kept for API/state shape — stays empty
    const labelEls:   HTMLElement[]   = [];

    // CSS hover rules — inline styles can't express :hover, so a single
    // scoped <style> tag powers the filename drill-in and the "→"
    // caret reveal.
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .galaxy-label { pointer-events: auto; }
      .galaxy-label .galaxy-name {
        cursor: pointer;
        padding: 1px 3px; margin: -1px -3px;
        border-radius: 3px;
        transition: background 110ms, color 110ms;
      }
      .galaxy-label .galaxy-name:hover {
        background: rgba(255,255,255,0.10);
        color: rgba(255,255,255,0.98);
      }
      .galaxy-label .galaxy-drill {
        opacity: 0; pointer-events: auto; cursor: pointer;
        margin-left: 4px; padding: 1px 4px; border-radius: 3px;
        background: rgba(255,255,255,0.08);
        color: rgba(235,240,250,0.92);
        border: 1px solid rgba(255,255,255,0.22);
        font-family: ${font.sans}; font-size: 9px; line-height: 1;
        transition: opacity 110ms, background 110ms, border-color 110ms;
      }
      .galaxy-label:hover .galaxy-drill { opacity: 1; }
      .galaxy-label .galaxy-drill:hover {
        background: rgba(255,255,255,0.18);
        border-color: rgba(255,255,255,0.38);
      }
    `;
    labelContainer.appendChild(styleEl);

    const priorIds = priorNodeIdsRef.current;
    const now = performance.now();
    const nowPriorIds = new Set<string>();

    // ── Entry wormhole ────────────────────────────────────────────
    // Fire a warp-out on the first scene build after mount: every
    // node materialises at origin and bursts outward to its slot
    // while the flash fades from full-bright. Reuses the drill-in
    // warp machinery so the visual language stays consistent with
    // intra-galaxy navigation.
    if (!hasPlayedEntryWarpRef.current && !warpStateRef.current) {
      hasPlayedEntryWarpRef.current = true;
      warpStateRef.current = {
        phase: "out",
        startMs: performance.now(),
        targetFileId: "",
      };
      // Start close-in so the animate loop's `targetRadius = 170 + pOut*380`
      // has somewhere to pull the camera back FROM. Without this, the
      // orbit is already at its default 550 and the animation looks flat.
      orbit.radius = 170;
      orbit.targetRadius = 170;
      orbit.autoRotate = false;
      if (flashRef.current) flashRef.current.style.opacity = "1";
      window.setTimeout(() => {
        warpStateRef.current = null;
        const s = stateRef.current;
        if (s) s.orbit.autoRotate = true;
      }, 650);
    }

    for (const node of layout.nodes) {
      nodeMap.set(node.fileId, node);

      // Shape per kind:
      //   center = white wireframe CUBE. The filled polyhedron used to
      //            paint the gold glyph ("★") nearly black against
      //            similar-hued satellite files, so the target was hard
      //            to locate. A bright white cage reads as "this is the
      //            axis of the scene" from any camera angle.
      //   hub    = faceted icosahedron rendered as WIREFRAME — the
      //            aggregator cage ("CALLERS", "SIBLINGS"). detail=1
      //            keeps it clearly polygonal (80 triangles) rather
      //            than the smooth geodesic at detail=2.
      //   symbol (selected) = prominent dodecahedron (the "me" planet)
      //   symbol (other)    = tetrahedron, hidden mesh
      //   file              = dodecahedron, hidden mesh
      let geo: THREE.BufferGeometry;
      if (node.kind === "center") {
        const side = node.radius * 1.7;
        geo = new THREE.BoxGeometry(side, side, side);
      } else if (node.kind === "hub") {
        geo = new THREE.IcosahedronGeometry(node.radius * 1.35, 1);
      } else if (node.kind === "symbol") {
        geo = node.selected
          ? new THREE.DodecahedronGeometry(node.radius, 0)
          : new THREE.TetrahedronGeometry(node.radius, 0);
      } else {
        geo = new THREE.DodecahedronGeometry(node.radius, 0);
      }
      let mat: THREE.Material;
      if (node.kind === "center") {
        // White wireframe cube — no fill, no emissive colour, so every
        // edge paints crisply over the starfield background.
        mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true, opacity: 0.92,
          depthWrite: false,
        });
      } else if (node.kind === "hub") {
        mat = new THREE.MeshPhongMaterial({
          // Wireframe-only; no fill means the hub reads as a geodesic
          // cage ("abstract bucket, not a file"). depthWrite:false so
          // the lines don't occlude satellites sitting behind the hub.
          color: node.colorInt, emissive: node.colorInt,
          emissiveIntensity: 0.55,
          wireframe: true, wireframeLinewidth: 1,
          transparent: true, opacity: 0.55,
          depthWrite: false,
        });
      } else if (node.kind === "symbol" && node.selected) {
        // "Me" planet — solid filled gem with strong emissive gold glow.
        // Fill (not wireframe) distinguishes it from the aggregator
        // cages; gold hue ties it visually to the centre cube family.
        mat = new THREE.MeshPhongMaterial({
          color: node.colorInt, emissive: node.colorInt,
          emissiveIntensity: 0.65, shininess: 140, specular: 0xffffff,
          flatShading: true,
          transparent: true, opacity: 1,
        });
      } else {
        mat = new THREE.MeshPhongMaterial({
          color: node.colorInt, emissive: node.colorInt,
          emissiveIntensity: 0.38, shininess: 110, specular: 0xffffff,
          flatShading: true,
          transparent: true, opacity: 1,
        });
      }
      const mesh = new THREE.Mesh(geo, mat);

      // Animation origin per node. Three sources, in priority order:
      //   1. Wormhole warp-out: every node bursts from (0,0,0) — we
      //      just arrived out the tunnel, nothing was "already here".
      //   2. Symbol expansion whoosh: new symbol node starts at its
      //      parent file's final position and lerps outward.
      //   3. Default: no animation, placed at final position directly.
      const isNew = !priorIds.has(node.fileId);
      const warpOut = warpStateRef.current?.phase === "out" ? warpStateRef.current : null;

      let originX = node.x, originY = node.y, originZ = node.z;
      let birthTime = -Infinity;

      if (warpOut) {
        originX = 0; originY = 0; originZ = 0;
        birthTime = warpOut.startMs;
      } else if (isNew && node.kind === "symbol" && node.parentFileId) {
        const parent = nodeMap.get(node.parentFileId);
        if (parent) {
          originX = parent.x; originY = parent.y; originZ = parent.z;
          birthTime = now;
        }
      }

      const animating = Number.isFinite(birthTime);
      mesh.position.set(
        animating ? originX : node.x,
        animating ? originY : node.y,
        animating ? originZ : node.z,
      );
      if (animating) mesh.scale.setScalar(0.01);

      mesh.userData.fileId = node.fileId;
      mesh.userData.finalX = node.x;
      mesh.userData.finalY = node.y;
      mesh.userData.finalZ = node.z;
      mesh.userData.originX = originX;
      mesh.userData.originY = originY;
      mesh.userData.originZ = originZ;
      mesh.userData.birthTime = birthTime;
      mesh.userData.kind = node.kind;

      // Random rotation so identical polyhedra don't align into repeating
      // silhouettes; each node reads as its own gem.
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      // Only the centre ("본인 별"), hubs, and the symbol-the-user-selected
      // render as 3D meshes. Satellite files and other symbols rely on
      // their HTML label (glyph + name) so the scene stays text-forward.
      // The selected symbol gets a mesh so the "me" planet reads as a
      // real body in the scene, not just another label.
      const isSelectedSymbolNode = node.kind === "symbol" && node.selected === true;
      if (node.kind !== "center" && node.kind !== "hub" && !isSelectedSymbolNode) {
        mesh.visible = false;
      }
      scene.add(mesh);
      nodeMeshes.push(mesh);
      nowPriorIds.add(node.fileId);

      // HTML label — icon + filename + drill-in arrow. Symbols get a
      // smaller font so the file silhouette stays the dominant read.
      const el = document.createElement("div");
      el.className = "galaxy-label";
      const isSym = node.kind === "symbol";
      const isSelectedSym = node.kind === "symbol" && node.selected === true;
      const isInteractive = node.kind === "file" || node.kind === "center" || node.kind === "symbol";
      el.style.cssText = `
        position:absolute; user-select:none;
        font-family:${font.sans}; font-size:${isSelectedSym ? "11px" : isSym ? "9px" : "10px"};
        color:rgba(200,220,255,0.80);
        white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,0.9);
        transition:opacity 80ms; display:inline-flex; align-items:center; gap:5px;
      `;
      const iconSpan = document.createElement("span");
      iconSpan.textContent = fileGlyph(node);
      iconSpan.style.cssText = `
        color: #${node.colorInt.toString(16).padStart(6, "0")};
        font-weight: 700; font-size: ${isSelectedSym ? "12px" : isSym ? "10px" : "11px"};
        text-shadow: 0 0 6px currentColor, 0 1px 2px rgba(0,0,0,0.9);
        opacity: 0.95;
      `;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = node.fileName;
      if (isSelectedSym) {
        // "me" planet needs its file context — a bare symbol name is
        // ambiguous across files, and this is the label that represents
        // the user's own selection in the scene.
        nameSpan.style.fontWeight = "700";
        nameSpan.style.color = "rgba(255,224,140,1)";
        const fileTag = document.createElement("span");
        const parentFile = node.parentFileId
          ? graph.files.find(f => f.id === node.parentFileId)?.name
          : null;
        fileTag.textContent = parentFile ? ` · ${parentFile}` : "";
        fileTag.style.cssText = `
          color: rgba(180, 200, 230, 0.65);
          font-weight: 400;
          margin-left: 2px;
        `;
        nameSpan.appendChild(fileTag);
      }
      if (isInteractive) {
        // Filename itself is a click target — clicking the name (not
        // just the tiny "→" pill) plays the wormhole and drills into
        // the file. Matches the user's expectation that the label's
        // biggest affordance is the name.
        nameSpan.className = "galaxy-name";
        nameSpan.title = isSym ? "심볼 갤럭시로 이동" : "파일 갤럭시로 이동";
        nameSpan.addEventListener("click", ev => {
          ev.stopPropagation();
          handleDrillIn(node.fileId);
        });
      }
      el.appendChild(iconSpan);
      el.appendChild(nameSpan);

      if (isInteractive) {
        const drill = document.createElement("button");
        drill.type = "button";
        drill.className = "galaxy-drill";
        drill.textContent = "→";
        drill.title = isSym ? "심볼 갤럭시로 이동" : "파일 갤럭시로 이동";
        drill.addEventListener("click", ev => {
          ev.stopPropagation();
          handleDrillIn(node.fileId);
        });
        el.appendChild(drill);
      }
      labelContainer.appendChild(el);
      labelEls.push(el);
    }
    priorNodeIdsRef.current = nowPriorIds;

    // ── Edges ──────────────────────────────────────────────────────
    const { lines: edgeLines, hlLines: hlEdgeLines } = buildEdgeLines(layout, nodeMap, scene);

    // ── State ──────────────────────────────────────────────────────
    const st: SceneState = {
      renderer, camera, scene, nodeMeshes, nodeSprites, edgeLines, hlEdgeLines,
      orbit, layout, nodeMap,
      selectedId: selectedId ?? null,
      raf: 0, labelEls,
    };
    stateRef.current = st;

    // ── Raycaster ─────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer   = new THREE.Vector2();

    function onClick(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      if (hits.length > 0) {
        const fileId = hits[0]!.object.userData.fileId as string;
        handleSelect(fileId);
      }
    }

    // ── Mouse orbit ───────────────────────────────────────────────
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      orbit.dragging = true; orbit.autoRotate = false;
      orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    }
    function onMouseMove(e: MouseEvent) {
      if (!orbit.dragging) return;
      const dx = e.clientX - orbit.lastX;
      const dy = e.clientY - orbit.lastY;
      orbit.targetTheta -= dx * 0.006;
      orbit.targetPhi   = Math.max(0.15, Math.min(Math.PI - 0.15, orbit.targetPhi - dy * 0.005));
      orbit.lastX = e.clientX; orbit.lastY = e.clientY;
    }
    function onMouseUp() {
      orbit.dragging = false;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      orbit.targetRadius = Math.max(80, Math.min(1200, orbit.targetRadius + e.deltaY * 0.6));
    }

    // Hover raycast (distinct from the drag mousemove below). Only fires
    // on the canvas element and updates React state when the underlying
    // fileId crosses a boundary — pixel-level mouse travel inside the
    // same mesh re-anchors the card position but doesn't re-render the
    // data payload.
    function onCanvasHover(e: MouseEvent) {
      if (orbit.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      let nextId: string | null = null;
      if (hits.length > 0) {
        const fid = hits[0]!.object.userData.fileId as string;
        const n = nodeMap.get(fid);
        if (n?.kind === "file" || n?.kind === "center") nextId = fid;
      }
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (nextId === null) {
        if (hoveredIdRef.current !== null) {
          hoveredIdRef.current = null;
          setHoverInfo(null);
        }
        return;
      }
      if (hoveredIdRef.current === nextId) {
        setHoverInfo(prev => (prev && prev.fileId === nextId ? { fileId: nextId, x: cx, y: cy } : prev));
        return;
      }
      hoveredIdRef.current = nextId;
      setHoverInfo({ fileId: nextId, x: cx, y: cy });
    }
    function onCanvasLeave() {
      pointerInsideRef.current = false;
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        setHoverInfo(null);
      }
    }
    function onContainerEnter() {
      pointerInsideRef.current = true;
    }

    renderer.domElement.addEventListener("click",     onClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onCanvasHover);
    container.addEventListener("mouseenter", onContainerEnter);
    // Leave handler on the wrap (not the canvas) so moving the mouse
    // onto the floating hover card — which is an absolute-positioned
    // sibling of the canvas inside `container` — doesn't count as
    // "leaving" and dismiss itself.
    container.addEventListener("mouseleave", onCanvasLeave);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // ── Resize ────────────────────────────────────────────────────
    const resizeObs = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObs.observe(container);

    // ── Render loop ───────────────────────────────────────────────
    const clock = new THREE.Clock();
    let pulse = 0;

    // Whoosh: symbol nodes spawn collapsed at the parent file's
    // position and accelerate outward to their final slot, with a
    // short overshoot for the "pop" feeling. Duration is human-scale
    // (~450ms) — long enough to read, short enough to chain clicks.
    const WHOOSH_MS = 450;
    const WARP_IN_MS = 500;

    function animate() {
      st.raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      pulse += dt;

      const nowMs0 = performance.now();
      const warp = warpStateRef.current;

      // Warp-in: override everything else. Target mesh dives to origin
      // while growing; other nodes stretch radially outward and fade;
      // camera zooms in; flash builds up. Runs on the CURRENT scene —
      // the rebuild doesn't happen until the setTimeout in handleDrillIn
      // fires and swaps phase to "out".
      if (warp?.phase === "in") {
        const p = Math.min(1, (nowMs0 - warp.startMs) / WARP_IN_MS);
        const ep = p * p * p; // easeInCubic — feel of accelerating into a drop
        for (const mesh of nodeMeshes) {
          const mat = mesh.material as THREE.MeshPhongMaterial;
          const fx = mesh.userData.finalX as number;
          const fy = mesh.userData.finalY as number;
          const fz = mesh.userData.finalZ as number;
          if (mesh.userData.fileId === warp.targetFileId) {
            // The target becomes the new star at the centre of the
            // wormhole: it moves from its satellite slot toward origin
            // while scaling up and going white-hot.
            mesh.position.set(fx * (1 - ep), fy * (1 - ep), fz * (1 - ep));
            mesh.scale.setScalar(1 + ep * 3);
            mat.emissiveIntensity = 0.4 + ep * 0.6;
            mat.opacity = 1;
          } else {
            // Everyone else is "sucked past" the viewer — stretch along
            // their outward-from-origin vector and fade out.
            const len = Math.hypot(fx, fy, fz) || 1;
            const push = ep * 800;
            mesh.position.set(
              fx + (fx / len) * push,
              fy + (fy / len) * push,
              fz + (fz / len) * push,
            );
            mesh.scale.setScalar(Math.max(0.05, 1 - ep * 0.9));
            mat.opacity = Math.max(0, 1 - ep * 1.3);
          }
        }
        // Fade the existing edges out so their stationary endpoints
        // don't visibly detach from the stretching meshes.
        (st.edgeLines.material as THREE.LineBasicMaterial).opacity = 0.95 * (1 - ep);
        (st.hlEdgeLines.material as THREE.LineBasicMaterial).opacity = 1.00 * (1 - ep);
        // Camera dives in
        orbit.targetRadius = 550 - ep * 380;
        // Flash: subtle at first, screams at the end (masks the rebuild
        // tear-down when it happens right after this phase ends).
        if (flashRef.current) flashRef.current.style.opacity = String(Math.pow(p, 4));

        orbit.theta  += (orbit.targetTheta  - orbit.theta)  * 0.07;
        orbit.phi    += (orbit.targetPhi    - orbit.phi)    * 0.07;
        orbit.radius += (orbit.targetRadius - orbit.radius) * 0.08;
        const [cwx, cwy, cwz] = orbitToXYZ(orbit);
        camera.position.set(cwx, cwy, cwz);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        updateLabels(st, labelContainer as HTMLElement, nowMs0, WHOOSH_MS);
        return;
      }

      // Warp-out: normal whoosh + camera pull-back + flash fade.
      // Normal mesh birth animation below handles the actual mesh
      // movement (all new meshes have origin=(0,0,0), birthTime set),
      // so here we only adjust the flash, nudge the camera back, and
      // snap any non-animating meshes back to their final slot. That
      // last step covers the edge case where `onFocusEntity` didn't
      // cause a layout change (target already == current centre, or
      // a symbol that decoded to the same file); without the snap,
      // the warp-in stretches would linger and the scene would look
      // exploded even after the flash clears.
      if (warp?.phase === "out") {
        const pOut = Math.min(1, (nowMs0 - warp.startMs) / 600);
        if (flashRef.current) flashRef.current.style.opacity = String(Math.max(0, 1 - pOut * 1.5));
        orbit.targetRadius = 170 + pOut * 380; // pull back from close-in to default
        for (const mesh of nodeMeshes) {
          if (Number.isFinite(mesh.userData.birthTime as number)) continue;
          const fx = mesh.userData.finalX as number;
          const fy = mesh.userData.finalY as number;
          const fz = mesh.userData.finalZ as number;
          mesh.position.set(fx, fy, fz);
          mesh.scale.setScalar(1);
          (mesh.material as THREE.MeshPhongMaterial).opacity = 1;
        }
        (st.edgeLines.material as THREE.LineBasicMaterial).opacity = 0.95;
        (st.hlEdgeLines.material as THREE.LineBasicMaterial).opacity = 1.00;
      }

      // Auto-rotate (suppressed during warp, drag, and while hovering a
      // mesh — moving the scene under a stationary card would visually
      // detach the preview from its file).
      if (
        orbit.autoRotate &&
        !orbit.dragging &&
        !warp &&
        !hoveredIdRef.current &&
        !pointerInsideRef.current
      ) {
        orbit.targetTheta += 0.003;
      }

      // Smooth orbit
      orbit.theta  += (orbit.targetTheta  - orbit.theta)  * 0.07;
      orbit.phi    += (orbit.targetPhi    - orbit.phi)    * 0.07;
      orbit.radius += (orbit.targetRadius - orbit.radius) * 0.06;

      const [cx, cy, cz] = orbitToXYZ(orbit);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);

      const nowMs = nowMs0;

      // Selected node: tiny pulse on emissiveIntensity so it stands
      // out against its stationary siblings without the old halo blob.
      const emPulse = 0.42 + Math.sin(pulse * 1.8) * 0.18;
      for (let i = 0; i < nodeMeshes.length; i++) {
        const mesh = nodeMeshes[i]!;
        const layoutNode = layout.nodes[i]!;
        const sel = st.selectedId === layoutNode.fileId;
        const mat = mesh.material as THREE.MeshPhongMaterial;
        mat.emissiveIntensity = sel ? emPulse : 0.30;

        // Whoosh animation for freshly-born nodes (symbols from a
        // click-to-expand). Finite birthTime = animation running.
        const birth = mesh.userData.birthTime as number;
        if (Number.isFinite(birth)) {
          const age = nowMs - birth;
          const t = Math.min(1, age / WHOOSH_MS);
          // easeOutBack for a small overshoot at the end of the travel.
          const c1 = 1.7, c3 = c1 + 1;
          const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
          const ox = mesh.userData.originX as number;
          const oy = mesh.userData.originY as number;
          const oz = mesh.userData.originZ as number;
          const fx = mesh.userData.finalX as number;
          const fy = mesh.userData.finalY as number;
          const fz = mesh.userData.finalZ as number;
          mesh.position.set(
            ox + (fx - ox) * eased,
            oy + (fy - oy) * eased,
            oz + (fz - oz) * eased,
          );
          // Scale rises with the same ease; opacity fades from 0 → 1
          // over the first 70% of the travel so late overshoot stays
          // opaque and the node "lands" rather than fading in mid-air.
          mesh.scale.setScalar(Math.max(0.01, eased));
          mat.opacity = Math.min(1, t / 0.7);
          if (t >= 1) {
            mesh.userData.birthTime = -Infinity;
            mesh.position.set(fx, fy, fz);
            mesh.scale.setScalar(1);
            mat.opacity = 1;
          }
        }
      }

      renderer.render(scene, camera);

      // Update HTML labels
      updateLabels(st, labelContainer as HTMLElement, nowMs, WHOOSH_MS);
    }

    animate();
    setMounted(true);

    return () => {
      cancelAnimationFrame(st.raf);
      renderer.domElement.removeEventListener("click",     onClick);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onCanvasHover);
      container.removeEventListener("mouseenter", onContainerEnter);
      container.removeEventListener("mouseleave", onCanvasLeave);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      resizeObs.disconnect();
      // Clear label DOM
      while (labelContainer.firstChild) labelContainer.removeChild(labelContainer.firstChild);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  // Rebuild whenever layoutSig changes — hashed above, see comment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSig]);

  // ── Styles ────────────────────────────────────────────────────────

  const outerStyle: CSSProperties = {
    width: "100%", height: "100%",
    display: "flex", flexDirection: "column",
    background: "#020510",
    opacity: mounted ? 1 : 0,
    transition: "opacity 400ms ease-out",
  };

  const headerStyle: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: "1px solid rgba(100,140,200,0.18)",
    flexShrink: 0, background: "rgba(2,5,16,0.85)",
    backdropFilter: "blur(8px)",
  };

  const canvasWrapStyle: CSSProperties = {
    flex: 1, position: "relative", overflow: "hidden",
  };

  const labelOverlayStyle: CSSProperties = {
    position: "absolute", inset: 0,
    pointerEvents: "none", overflow: "hidden",
  };

  const dismissStyle: CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    color: "rgba(180,200,255,0.6)", fontSize: 16, lineHeight: 1,
    padding: "4px 6px", borderRadius: 4,
    transition: "color 120ms",
  };

  const pkgCount  = new Set(layout.nodes.map(n => n.packageId)).size;
  const fileCount = layout.nodes.length;
  const edgeCount = layout.edges.length;
  const isEmpty   = fileCount === 0;

  return (
    <div style={outerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.sm, fontWeight: 600, color: "rgba(200,220,255,0.9)", fontFamily: font.sans }}>
            Galaxy 3D
          </div>
          <div style={{ fontSize: font.size.xs, color: "rgba(140,170,220,0.65)", fontFamily: font.sans }}>
            {isEmpty
              ? "파일을 선택하세요"
              : `${pkgCount}개 패키지 · ${fileCount}개 파일 · ${edgeCount}개 엣지`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {infoNode && (
            <div style={{ fontSize: font.size.xs, color: "rgba(180,200,255,0.75)", fontFamily: font.sans, textAlign: "right" }}>
              <span style={{ fontWeight: 600, color: "rgba(220,235,255,0.9)" }}>{infoNode.name}</span>
              {" · "}{infoNode.pkg}
              {" · "}위험도 {(infoNode.risk * 100).toFixed(0)}%
              {" · "}{infoNode.edges}개 엣지
            </div>
          )}
          {onDismiss && (
            <button type="button" style={dismissStyle} onClick={onDismiss}>×</button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={mountRef} style={canvasWrapStyle}>
        <div ref={labelRef} style={labelOverlayStyle} />

        {/* Wormhole flash — additive radial bloom positioned over the
         *  canvas. Opacity is driven imperatively from the RAF loop so
         *  the ramp-up/ramp-down lines up with the warp phases. The
         *  brief full-opacity hit in the middle also hides the scene
         *  tear-down/rebuild hitch. */}
        <div
          ref={flashRef}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at 50% 50%, rgba(255,240,200,0.95) 0%, rgba(220,180,120,0.35) 30%, rgba(60,80,140,0) 72%)",
            opacity: 0,
            mixBlendMode: "screen",
            willChange: "opacity",
          }}
        />

        {/* Empty state — shown instead of the full-graph hairball when
         *  no file is selected (or the selection isn't a file). */}
        {isEmpty && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 12,
            pointerEvents: "none", userSelect: "none",
            background: "radial-gradient(circle at 50% 50%, rgba(13,153,255,0.04) 0%, transparent 60%)",
          }}>
            <div style={{
              fontSize: 44, color: "rgba(180,210,255,0.35)",
              fontFamily: font.sans, fontWeight: 300, letterSpacing: 2,
            }}>
              ✹
            </div>
            <div style={{
              fontSize: font.size.md, fontWeight: 600,
              color: "rgba(210,225,255,0.82)", fontFamily: font.sans,
              letterSpacing: -0.1,
            }}>
              파일을 선택해 Galaxy를 열어보세요
            </div>
            <div style={{
              fontSize: font.size.xs, color: "rgba(140,170,220,0.55)",
              fontFamily: font.sans, maxWidth: 360, textAlign: "center",
              lineHeight: 1.5,
            }}>
              왼쪽 트리에서 파일을 클릭하면 그 파일 주변의 callers · callees · siblings가 3D 공간에 펼쳐집니다.
            </div>
          </div>
        )}

        {/* Hover thumbnail — floating glass card that reveals the
         *  file's connected information on hover. Lives in the canvas
         *  wrap (not a portal) so it clips to the galaxy viewport and
         *  inherits the fog/backdrop. */}
        {hoverInfo && !isEmpty && (
          <HoverThumbnail
            info={hoverInfo}
            graph={graph}
            layout={layout}
            onDrillIn={handleDrillIn}
          />
        )}

        {/* hint */}
        {mounted && !isEmpty && (
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            fontSize: font.size.xxs, color: "rgba(120,150,200,0.5)", fontFamily: font.sans,
            pointerEvents: "none", userSelect: "none",
          }}>
            드래그 회전 · 스크롤 줌 · 클릭 선택 · 호버 미리보기
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers (scene-level, outside React) ─────────────────────────────

function buildEdgeLines(
  layout: Galaxy3DLayout,
  nodeMap: Map<string, Galaxy3DNode>,
  scene: THREE.Scene,
): { lines: THREE.LineSegments; hlLines: THREE.LineSegments } {
  const normalPts:  number[] = [];
  const hlPts:      number[] = [];
  const treePts:    number[] = [];

  for (const e of layout.edges) {
    const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to);
    if (!fn || !tn) continue;
    // Tree tethers (file → symbol) get their own ultra-dim bucket so
    // they read as "this dot belongs to this file", not as a real call.
    // Dependency edges split between default and highlighted as before.
    const arr = e.tree ? treePts : (e.highlighted ? hlPts : normalPts);
    arr.push(fn.x, fn.y, fn.z, tn.x, tn.y, tn.z);
  }

  // Additive blending turns thin 1px lines into glow streaks: each pixel
  // brightens the background instead of alpha-blending toward it, so the
  // lines read against the near-black scene even at device-pixel width.
  // LineBasicMaterial.linewidth is a no-op on WebGL (always 1px), so we
  // lean on color + opacity + additive to compensate.
  const makeLS = (pts: number[], c: number, opacity: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: c, transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ls  = new THREE.LineSegments(geo, mat);
    scene.add(ls);
    return ls;
  };

  // Tree lines are emitted to the scene directly — we don't need to
  // hold onto them for later recolor passes. Dependency lines are
  // returned so rebuildEdgeHighlights() can swap them on selection.
  makeLS(treePts, 0x6aa8e0, 0.55);
  return {
    lines:   makeLS(normalPts, 0xaac8ff, 0.95),
    hlLines: makeLS(hlPts,     0xffffff, 1.00),
  };
}

const _tmpVec = new THREE.Vector3();

const _tmpNodePos = new THREE.Vector3();

function updateLabels(st: SceneState, container: HTMLElement, nowMs: number, whooshMs: number): void {
  const { camera, layout, labelEls, nodeMeshes } = st;
  const W = container.clientWidth, H = container.clientHeight;
  if (!W || !H) return;

  // Depth range for perspective scaling — remapped so `t` is roughly
  // [0..1] across the typical camera-to-node range (180–1200 units).
  const NEAR_DIST = 200;
  const FAR_DIST  = 1000;
  const MIN_SCALE = 0.55;   // far-away label shrinks to ~55%
  const MAX_SCALE = 1.25;   // close label grows up to 125%
  const MIN_OP    = 0.22;   // far-away label fades to 22%
  const MAX_OP    = 1.00;

  for (let i = 0; i < layout.nodes.length; i++) {
    const node = layout.nodes[i]!;
    const el   = labelEls[i];
    const mesh = nodeMeshes[i];
    if (!el || !mesh) continue;

    // Follow the mesh's *current* position (not layout.x/y/z) so labels
    // ride along with the whoosh animation instead of popping at the
    // final slot while the node is still flying out.
    _tmpNodePos.set(mesh.position.x, mesh.position.y + node.radius + 3, mesh.position.z);

    // Screen position
    _tmpVec.copy(_tmpNodePos).project(camera);
    const x = (_tmpVec.x *  0.5 + 0.5) * W;
    const y = (_tmpVec.y * -0.5 + 0.5) * H;

    // Cull if behind camera or off-screen
    const onScreen = _tmpVec.z < 1 && x > -60 && x < W + 60 && y > -30 && y < H + 30;
    if (!onScreen) {
      el.style.opacity = "0";
      continue;
    }

    // Perspective: real world-space distance from camera → size + opacity.
    // Closer nodes loom larger, far nodes recede. The selected node
    // gets a floor on scale so it stays readable even when pushed back.
    const dist = camera.position.distanceTo(_tmpNodePos);
    const t    = Math.max(0, Math.min(1, (dist - NEAR_DIST) / (FAR_DIST - NEAR_DIST)));
    const isSelected = st.selectedId === node.fileId;
    const scale   = (isSelected ? 1.1 : 1) * (MAX_SCALE - (MAX_SCALE - MIN_SCALE) * t);
    let opacity = isSelected ? 1 : MAX_OP - (MAX_OP - MIN_OP) * t;

    // Birth fade — multiply the perspective opacity by the anim progress
    // so a whooshing symbol label ramps from invisible to its perspective
    // opacity over the same window as the mesh travel.
    const birth = mesh.userData.birthTime as number;
    if (Number.isFinite(birth)) {
      const age = nowMs - birth;
      const bt  = Math.max(0, Math.min(1, age / (whooshMs * 0.7)));
      opacity *= bt;
    }

    // Lower-z nodes (closer to camera in screen space) paint on top
    // so near labels don't get occluded by far-side labels.
    el.style.zIndex     = String(1000 - Math.round(_tmpVec.z * 500));
    el.style.opacity    = String(opacity);
    el.style.transform  = `translate(${x - el.offsetWidth / 2}px, ${y}px) scale(${scale.toFixed(3)})`;
    el.style.transformOrigin = "50% 0%";
    el.style.color      = isSelected
      ? "rgba(255,220,100,1)"
      : `rgba(180,210,255,${(0.55 + (1 - t) * 0.35).toFixed(3)})`;
    el.style.fontWeight = isSelected ? "600" : "400";
  }
}

// ── Hover thumbnail ──────────────────────────────────────────────────
//
// Floating glass card that reveals a file's connected information on
// hover. Triggered by canvas raycast (onCanvasHover above) and receives
// the live graph so callers / callees / siblings / symbols are computed
// from source-of-truth, not from the already-bucketed layout (which
// caps relations at BUCKET_CAP = 12 and skips anything outside the
// current ego view).
//
// Layout:
//   ┌──────────────────────────────┐
//   │ ▀▀▀▀▀▀▀▀ accent hue bar ▀▀▀▀ │
//   │                              │
//   │ ◇ FileName.ts      [risk]◎   │  ← header + risk ring
//   │   path/to/file.ts            │
//   │                              │
//   │   ┌──── mini constellation──┐│  ← SVG: file at centre,
//   │   │    ◆     ◆              ││     callers on left / callees
//   │   │     ╲   ╱               ││     right / siblings below,
//   │   │      ●                  ││     radial glow sphere
//   │   │     ╱   ╲               ││
//   │   │    ◇     ◇              ││
//   │   └─────────────────────────┘│
//   │                              │
//   │ [LOC 142][IN 3][OUT 7][SIB 4]│  ← stats
//   │                              │
//   │ ← CALLERS                    │  ← connection lists (top 4 each)
//   │   ◇ useFoo.ts                │
//   │   ◆ bar.ts                   │
//   │ CALLEES →                    │
//   │   ...                        │
//   │                              │
//   │ SYMBOLS  ƒ doA  ƒ doB  ◇ C   │  ← symbol chips (if file has any)
//   │                              │
//   │            Drill in  →       │  ← footer action
//   └──────────────────────────────┘

import type { FileNode, SymbolNode as WsSymbolNode } from "@quanta/canvas-engine";

function parentPath(id: string): string {
  const i = id.lastIndexOf("/");
  return i >= 0 ? id.slice(0, i) : "";
}

function fileGlyphFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "tsx":
    case "jsx":  return "⚛";
    case "ts":   return "◆";
    case "js":
    case "mjs":
    case "cjs":  return "◇";
    case "rs":   return "◈";
    case "json": return "{}";
    case "md":
    case "mdx":  return "¶";
    case "css":
    case "scss": return "▨";
    default:     return "•";
  }
}

function symbolGlyph(kind: WsSymbolNode["kind"]): string {
  switch (kind) {
    case "class":     return "◇";
    case "function":
    case "method":    return "ƒ";
    case "variable":  return "x";
    case "parameter": return "›";
    case "module":    return "{}";
    default:          return "ƒ";
  }
}

function intToHex(n: number): string {
  return `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
}

interface HoverData {
  file: FileNode;
  callers: FileNode[];
  callees: FileNode[];
  siblings: FileNode[];
  symbols: WsSymbolNode[];
  /** fileId → symbols declared there, sorted by (callers+callees) desc.
   *  Feeds the per-row symbol strip in ConxList — "what's actually
   *  inside this connected file" without drilling in. */
  symsByFile: Map<string, WsSymbolNode[]>;
  accentHex: string;
}

function buildHoverData(fileId: string, graph: WorkspaceGraph, layout: Galaxy3DLayout): HoverData | null {
  const file = graph.files.find(f => f.id === fileId);
  if (!file) return null;

  const fileById = new Map(graph.files.map(f => [f.id, f]));
  const dir = parentPath(fileId);

  // fileId → symbols declared in that file, pre-sorted by connection
  // count. ConxList renders a tiny strip under each bucket row so you
  // can see "this file matters because it holds useFoo(), renderBar(),
  // …" without drilling in. Building it once here beats re-filtering
  // graph.symbolNodes per row.
  const symsByFile = new Map<string, WsSymbolNode[]>();
  for (const s of graph.symbolNodes ?? []) {
    const arr = symsByFile.get(s.fileId) ?? [];
    arr.push(s);
    symsByFile.set(s.fileId, arr);
  }
  for (const arr of symsByFile.values()) {
    arr.sort((a, b) =>
      ((b.callers ?? 0) + (b.callees ?? 0)) - ((a.callers ?? 0) + (a.callees ?? 0)),
    );
  }

  const callerIds = new Set<string>();
  const calleeIds = new Set<string>();
  for (const e of graph.fileEdges) {
    if (e.to === fileId && e.from !== fileId) callerIds.add(e.from);
    if (e.from === fileId && e.to !== fileId) calleeIds.add(e.to);
  }
  const pluck = (ids: Set<string>) =>
    [...ids]
      .map(id => fileById.get(id))
      .filter((f): f is FileNode => !!f)
      .sort((a, b) => b.riskScore - a.riskScore);

  const callers  = pluck(callerIds);
  const callees  = pluck(calleeIds);
  const siblings = graph.files
    .filter(f => f.id !== fileId && parentPath(f.id) === dir)
    .sort((a, b) => a.name.localeCompare(b.name));

  const symbols = (graph.symbolNodes ?? [])
    .filter(s => s.fileId === fileId)
    .sort((a, b) =>
      ((b.callers ?? 0) + (b.callees ?? 0)) - ((a.callers ?? 0) + (a.callees ?? 0)),
    );

  // Accent hue comes from the layout node (satellite/centre colour), so
  // the card is visually linked to the file's hub family. Fallback to a
  // neutral cyan when hovering a file that isn't in the current ego
  // layout — shouldn't happen, but keeps the render total.
  const ln = layout.nodes.find(n => n.fileId === fileId);
  const accentHex = ln ? intToHex(ln.colorInt) : "#6aa8e0";

  return { file, callers, callees, siblings, symbols, symsByFile, accentHex };
}

// Dark-symtip palette — the galaxy canvas is near-black, so the card
// uses the same flat-white/thin-border vocabulary as `.symtip`, but
// inverted to a muted dark surface so it doesn't glare over the scene.
// No accent-per-file tints, no gradients, no colored glows.
const HT_BG          = "rgba(15, 18, 28, 0.94)";
const HT_BORDER      = "rgba(255, 255, 255, 0.10)";
const HT_BORDER_SOFT = "rgba(255, 255, 255, 0.06)";
const HT_HAIRLINE    = "rgba(255, 255, 255, 0.05)";
const HT_BG_CHIP     = "rgba(255, 255, 255, 0.04)";
const HT_BG_HOVER    = "rgba(255, 255, 255, 0.09)";
const HT_FG          = "rgba(235, 240, 250, 0.96)";
const HT_FG_MUTED    = "rgba(200, 210, 225, 0.70)";
const HT_FG_SUBTLE   = "rgba(170, 180, 200, 0.55)";
const HT_FG_DEAD     = "rgba(140, 150, 170, 0.40)";

function HoverThumbnail({
  info,
  graph,
  layout,
  onDrillIn,
}: {
  info: { fileId: string; x: number; y: number };
  graph: WorkspaceGraph;
  layout: Galaxy3DLayout;
  onDrillIn: (id: string) => void;
}) {
  const data = buildHoverData(info.fileId, graph, layout);
  if (!data) return null;
  const { file, callers, callees, siblings, symbols, symsByFile } = data;

  const CARD_W = 320;
  const CARD_MAX_H = 520;

  // Smart positioning: prefer top-right of cursor, flip to left if
  // it would clip the right edge. We don't know the canvas-wrap size
  // without a ref, so fall back to window.innerWidth — close enough
  // since the galaxy usually occupies most of the viewport.
  const rightOverflow = info.x + 22 + CARD_W > (typeof window !== "undefined" ? window.innerWidth : 9999);
  const left = rightOverflow ? Math.max(8, info.x - CARD_W - 22) : info.x + 22;
  const top  = Math.max(8, Math.min(
    info.y - 40,
    (typeof window !== "undefined" ? window.innerHeight : 9999) - CARD_MAX_H - 20,
  ));

  const cardStyle: CSSProperties = {
    position: "absolute",
    left, top,
    width: CARD_W,
    maxHeight: CARD_MAX_H,
    background: HT_BG,
    backdropFilter: "blur(14px) saturate(140%)",
    WebkitBackdropFilter: "blur(14px) saturate(140%)",
    border: `1px solid ${HT_BORDER}`,
    borderRadius: 6,
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.55)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    color: HT_FG,
    pointerEvents: "auto",
    zIndex: 20,
  };

  const path = parentPath(file.id);

  return (
    <div style={cardStyle} onMouseDown={ev => ev.stopPropagation()}>
      {/* Header — .symtip__head idiom: 18px glyph, mono name, tiny
          uppercase kind label, risk chip at the right. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
      }}>
        <GlyphCube glyph={fileGlyphFromName(file.name)} />
        <span style={{
          fontFamily: font.mono, fontSize: 12, fontWeight: 600,
          color: HT_FG, whiteSpace: "nowrap", overflow: "hidden",
          textOverflow: "ellipsis", flex: 1, minWidth: 0,
        }} title={file.name}>
          {file.name}
        </span>
        <span style={{
          fontSize: 10, color: HT_FG_MUTED, textTransform: "uppercase",
          letterSpacing: 0.08, flexShrink: 0,
        }}>
          FILE
        </span>
        <RiskPill risk={file.riskScore} />
      </div>

      {/* Path row — subtle second line under the header. */}
      <div style={{
        padding: "0 12px 8px",
        fontFamily: font.mono, fontSize: 10.5, color: HT_FG_SUBTLE,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        direction: "rtl", textAlign: "left",
        borderBottom: `1px solid ${HT_HAIRLINE}`,
      }}>
        {path || "(root)"}
      </div>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1, background: HT_HAIRLINE,
        borderBottom: `1px solid ${HT_HAIRLINE}`,
      }}>
        <StatCell label="LOC"  value={file.loc} />
        <StatCell label="IN"   value={callers.length} />
        <StatCell label="OUT"  value={callees.length} />
        <StatCell label="SIB"  value={siblings.length} />
      </div>

      {/* Connection lists */}
      {(callers.length + callees.length > 0) && (
        <div style={{
          padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8,
          borderBottom: `1px solid ${HT_HAIRLINE}`,
        }}>
          {callers.length > 0 && (
            <ConxList
              label="CALLERS" arrow="←"
              items={callers.slice(0, 4)} totalN={callers.length}
              symsByFile={symsByFile}
            />
          )}
          {callees.length > 0 && (
            <ConxList
              label="CALLEES" arrow="→"
              items={callees.slice(0, 4)} totalN={callees.length}
              symsByFile={symsByFile}
            />
          )}
        </div>
      )}

      {/* Symbols */}
      {symbols.length > 0 && (
        <div style={{ padding: "8px 12px" }}>
          <SectionLabel text="SYMBOLS" count={symbols.length} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {symbols.slice(0, 8).map(s => (
              <span key={s.id} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "2px 6px",
                fontSize: 10.5,
                color: HT_FG_MUTED,
                background: HT_BG_CHIP,
                border: `1px solid ${HT_BORDER_SOFT}`,
                borderRadius: 3,
                fontFamily: font.mono ?? font.sans,
              }} title={`${s.kind} · line ${s.line}`}>
                <span style={{ color: HT_FG, fontWeight: 600 }}>{symbolGlyph(s.kind)}</span>
                <span>{s.name}</span>
              </span>
            ))}
            {symbols.length > 8 && (
              <span style={{ fontSize: 10, color: HT_FG_DEAD, alignSelf: "center" }}>
                +{symbols.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer — flat button, .symtip__foot idiom. */}
      <div style={{
        marginTop: "auto",
        padding: "8px 12px",
        borderTop: `1px solid ${HT_HAIRLINE}`,
        background: HT_BG_CHIP,
      }}>
        <button
          type="button"
          onClick={() => onDrillIn(file.id)}
          onMouseDown={ev => ev.stopPropagation()}
          onMouseEnter={ev => { (ev.currentTarget as HTMLButtonElement).style.background = HT_BG_HOVER; }}
          onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          style={{
            width: "100%",
            padding: "6px 10px",
            background: "transparent",
            border: `1px solid ${HT_BORDER}`,
            borderRadius: 4,
            color: HT_FG,
            fontSize: 11,
            fontWeight: 500,
            fontFamily: font.sans,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "background 120ms",
          }}
        >
          이 파일로 드릴인 <span style={{ color: HT_FG_MUTED }}>→</span>
        </button>
      </div>
    </div>
  );
}

// Small glyph wrapped in a white-outline cube so even a dark/black
// unicode mark (★, ◆, etc.) stays readable against the deep-space bg.
function GlyphCube({ glyph }: { glyph: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18,
      border: `1px solid ${HT_BORDER}`,
      borderRadius: 3,
      background: HT_BG_CHIP,
      color: HT_FG,
      fontFamily: font.mono,
      fontSize: 11,
      lineHeight: 1,
      flexShrink: 0,
    }}>
      {glyph}
    </span>
  );
}

// Risk readout — flat numeric chip, no colored ring. Tone shifts
// subtly based on score (green/amber/red text only, no fills).
function RiskPill({ risk }: { risk: number }) {
  const clamped = Math.max(0, Math.min(1, risk));
  const score = Math.round(clamped * 100);
  const tone =
    clamped < 0.33 ? "rgba(130, 210, 160, 0.90)" :
    clamped < 0.66 ? "rgba(230, 180, 100, 0.90)" :
                     "rgba(235, 130, 130, 0.92)";
  return (
    <span style={{
      fontFamily: font.mono, fontSize: 10,
      padding: "1px 6px",
      borderRadius: 3,
      background: HT_BG_CHIP,
      border: `1px solid ${HT_BORDER_SOFT}`,
      color: tone,
      fontVariantNumeric: "tabular-nums",
      fontWeight: 600,
      flexShrink: 0,
    }}>
      {score}
    </span>
  );
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: HT_BG,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{
        fontFamily: font.mono, fontSize: 13, fontWeight: 600,
        color: HT_FG, fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 9, color: HT_FG_SUBTLE,
        textTransform: "uppercase", letterSpacing: 0.08,
      }}>
        {label}
      </span>
    </div>
  );
}

function SectionLabel({ text, count }: { text: string; count?: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 9, fontWeight: 600, letterSpacing: 0.08,
      color: HT_FG_MUTED, textTransform: "uppercase",
    }}>
      <span>{text}</span>
      {count !== undefined && (
        <span style={{ color: HT_FG_DEAD, fontWeight: 500, letterSpacing: 0 }}>· {count}</span>
      )}
      <span style={{ flex: 1, height: 1, background: HT_HAIRLINE, marginLeft: 2 }} />
    </div>
  );
}

function ConxList({
  label, arrow, items, totalN, symsByFile,
}: {
  label: string; arrow: string; items: FileNode[]; totalN: number;
  symsByFile: Map<string, WsSymbolNode[]>;
}) {
  // Representative-symbols cap per row — enough to hint at what's
  // inside the file without turning the card into a wall of chips.
  const SYM_CHIPS_PER_ROW = 3;
  return (
    <div>
      <SectionLabel
        text={arrow === "←" ? `${arrow} ${label}` : `${label} ${arrow}`}
        count={totalN}
      />
      <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map(f => {
          const fileSyms = symsByFile.get(f.id) ?? [];
          const shown = fileSyms.slice(0, SYM_CHIPS_PER_ROW);
          const rest  = fileSyms.length - shown.length;
          return (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "2px 4px",
                fontSize: 11,
                color: HT_FG,
                borderRadius: 3,
                fontFamily: font.mono,
              }}>
                <span style={{
                  color: HT_FG_MUTED, width: 12, textAlign: "center", fontSize: 10,
                }}>
                  {fileGlyphFromName(f.name)}
                </span>
                <span style={{
                  flex: 1, minWidth: 0, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {f.name}
                </span>
                {f.riskScore >= 0.5 && (
                  <span style={{
                    fontSize: 9,
                    color: f.riskScore < 0.66
                      ? "rgba(230, 180, 100, 0.85)"
                      : "rgba(235, 130, 130, 0.92)",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {Math.round(f.riskScore * 100)}
                  </span>
                )}
              </div>
              {shown.length > 0 && (
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: 3,
                  paddingLeft: 18,
                }}>
                  {shown.map(s => (
                    <span key={s.id} style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      padding: "1px 5px",
                      fontSize: 9.5,
                      color: HT_FG_MUTED,
                      background: HT_BG_CHIP,
                      border: `1px solid ${HT_BORDER_SOFT}`,
                      borderRadius: 3,
                      fontFamily: font.mono,
                      lineHeight: 1.3,
                    }} title={`${s.kind} · line ${s.line}`}>
                      <span style={{ color: HT_FG, fontWeight: 600 }}>{symbolGlyph(s.kind)}</span>
                      <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.name}
                      </span>
                    </span>
                  ))}
                  {rest > 0 && (
                    <span style={{
                      fontSize: 9, color: HT_FG_DEAD, alignSelf: "center",
                    }}>
                      +{rest}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {totalN > items.length && (
          <div style={{
            fontSize: 10, color: HT_FG_DEAD, paddingLeft: 18, marginTop: 1,
          }}>
            +{totalN - items.length} more
          </div>
        )}
      </div>
    </div>
  );
}

// Fix the rebuildEdgeHighlights — simple type workaround
function _rebuildEdgeHighlights(st: {
  selectedId: string | null;
  layout: Galaxy3DLayout;
  edgeLines: THREE.LineSegments;
  hlEdgeLines: THREE.LineSegments;
  nodeMap: Map<string, Galaxy3DNode>;
  scene: THREE.Scene;
}) {
  // Remove old edge lines from scene and rebuild with new highlights
  st.scene.remove(st.edgeLines);
  st.scene.remove(st.hlEdgeLines);
  st.edgeLines.geometry.dispose();
  st.hlEdgeLines.geometry.dispose();

  // Mark edges as highlighted if connected to selected node
  const updatedLayout = {
    ...st.layout,
    edges: st.layout.edges.map(e => ({
      ...e,
      highlighted: e.from === st.selectedId || e.to === st.selectedId,
    })),
  };

  const { lines, hlLines } = buildEdgeLines(updatedLayout, st.nodeMap, st.scene);
  st.edgeLines   = lines;
  st.hlEdgeLines = hlLines;
}
void _rebuildEdgeHighlights;

export const Galaxy3DView = memo(Galaxy3DViewImpl);
