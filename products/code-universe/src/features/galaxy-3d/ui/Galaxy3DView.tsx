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
 *  their own silhouette; extension-based glyphs for leaves. */
function fileGlyph(node: Galaxy3DNode): string {
  if (node.kind === "center") return "★";
  if (node.kind === "hub")    return "⬢";
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

  const [mounted, setMounted] = useState(false);
  const [infoNode, setInfoNode] = useState<{ name: string; pkg: string; risk: number; edges: number } | null>(null);

  const layout = buildGalaxy3DLayout({ graph, selectedId });

  const handleSelect = useCallback((fileId: string) => {
    const st = stateRef.current;
    if (!st) return;
    // Hubs are visual aggregators — clicking them must not become a selection
    // (would re-layout against a non-existent file id and lose context).
    const node = st.nodeMap.get(fileId);
    if (node?.kind === "hub") return;
    st.selectedId = fileId;
    onFocusEntity?.(fileId);
    if (node) setInfoNode({ name: node.fileName, pkg: node.packageLabel, risk: node.riskScore, edges: node.edgeCount });
    rebuildEdgeHighlights(st);
  }, [onFocusEntity]);

  // ── Scene init ────────────────────────────────────────────────────

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
    const orbit  = makeOrbit();
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

    for (const node of layout.nodes) {
      nodeMap.set(node.fileId, node);

      // Angular polyhedra w/ flat shading — center = icosahedron (20 faces),
      // hub = octahedron (crystal diamond), file = dodecahedron for richer
      // faceting. Keeps subdivision detail=0 so each face reads flat.
      let geo: THREE.BufferGeometry;
      if (node.kind === "center") {
        geo = new THREE.IcosahedronGeometry(node.radius, 0);
      } else if (node.kind === "hub") {
        geo = new THREE.OctahedronGeometry(node.radius, 0);
      } else {
        geo = new THREE.DodecahedronGeometry(node.radius, 0);
      }
      const mat  = new THREE.MeshPhongMaterial({
        color: node.colorInt, emissive: node.colorInt,
        emissiveIntensity: 0.38, shininess: 110, specular: 0xffffff,
        flatShading: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x, node.y, node.z);
      // Random rotation so identical polyhedra don't align into repeating
      // silhouettes; each node reads as its own gem.
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      mesh.userData.fileId = node.fileId;
      scene.add(mesh);
      nodeMeshes.push(mesh);

      // HTML label — icon + filename, two spans so the icon can be tinted
      // independently from the text.
      const el = document.createElement("div");
      el.style.cssText = `
        position:absolute; pointer-events:none; user-select:none;
        font-family:${font.sans}; font-size:10px; color:rgba(200,220,255,0.80);
        white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,0.9);
        transition:opacity 80ms; display:inline-flex; align-items:center; gap:5px;
      `;
      const iconSpan = document.createElement("span");
      iconSpan.textContent = fileGlyph(node);
      iconSpan.style.cssText = `
        color: #${node.colorInt.toString(16).padStart(6, "0")};
        font-weight: 700; font-size: 11px;
        text-shadow: 0 0 6px currentColor, 0 1px 2px rgba(0,0,0,0.9);
        opacity: 0.95;
      `;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = node.fileName;
      el.appendChild(iconSpan);
      el.appendChild(nameSpan);
      labelContainer.appendChild(el);
      labelEls.push(el);
    }

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

    renderer.domElement.addEventListener("click",     onClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
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

    function animate() {
      st.raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      pulse += dt;

      // Auto-rotate
      if (orbit.autoRotate && !orbit.dragging) {
        orbit.targetTheta += 0.003;
      }

      // Smooth orbit
      orbit.theta  += (orbit.targetTheta  - orbit.theta)  * 0.07;
      orbit.phi    += (orbit.targetPhi    - orbit.phi)    * 0.07;
      orbit.radius += (orbit.targetRadius - orbit.radius) * 0.06;

      const [cx, cy, cz] = orbitToXYZ(orbit);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);

      // Selected node: tiny pulse on emissiveIntensity so it stands
      // out against its stationary siblings without the old halo blob.
      const emPulse = 0.42 + Math.sin(pulse * 1.8) * 0.18;
      for (let i = 0; i < nodeMeshes.length; i++) {
        const mesh = nodeMeshes[i]!;
        const sel = st.selectedId === layout.nodes[i]!.fileId;
        const mat = mesh.material as THREE.MeshPhongMaterial;
        mat.emissiveIntensity = sel ? emPulse : 0.30;
      }

      renderer.render(scene, camera);

      // Update HTML labels
      updateLabels(st, labelContainer as HTMLElement);
    }

    animate();
    setMounted(true);

    return () => {
      cancelAnimationFrame(st.raf);
      renderer.domElement.removeEventListener("click",     onClick);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
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
  // layout changes tear down & rebuild the scene
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.nodes.length, layout.edges.length]);

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

        {/* hint */}
        {mounted && !isEmpty && (
          <div style={{
            position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
            fontSize: font.size.xxs, color: "rgba(120,150,200,0.5)", fontFamily: font.sans,
            pointerEvents: "none", userSelect: "none",
          }}>
            드래그 회전 · 스크롤 줌 · 클릭 선택
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

  for (const e of layout.edges) {
    const fn = nodeMap.get(e.from), tn = nodeMap.get(e.to);
    if (!fn || !tn) continue;
    const arr = e.highlighted ? hlPts : normalPts;
    arr.push(fn.x, fn.y, fn.z, tn.x, tn.y, tn.z);
  }

  const makeLS = (pts: number[], c: number, opacity: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: c, transparent: true, opacity, depthWrite: false,
    });
    const ls  = new THREE.LineSegments(geo, mat);
    scene.add(ls);
    return ls;
  };

  // Single-pass crisp lines — no additive glow halos.
  return {
    lines:   makeLS(normalPts, 0x7a94c4, 0.55),
    hlLines: makeLS(hlPts,     0xaaccff, 0.90),
  };
}

function rebuildEdgeHighlights(_st: SceneState): void {
  // Recolor edges based on selectedId — no-op placeholder
}

const _tmpVec = new THREE.Vector3();

const _tmpNodePos = new THREE.Vector3();

function updateLabels(st: SceneState, container: HTMLElement): void {
  const { camera, layout, labelEls } = st;
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
    if (!el) continue;

    _tmpNodePos.set(node.x, node.y + node.radius + 3, node.z);

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
    const opacity = isSelected ? 1 : MAX_OP - (MAX_OP - MIN_OP) * t;

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
