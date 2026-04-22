// CodeCity3DView — SVG isometric "city" metaphor for the repository.
// --------------------------------------------------------------------
// Each building = one file. Height ∝ log(LoC), base area ∝ complexity.
// Districts (grounds) group buildings by their parent package / folder.
// Projection: classic 30° isometric (no Three.js / WebGL) — the whole
// scene is a single <svg> so animations + hover states ride on CSS.
//
// Reference: Wettel & Lanza.
// "Visualizing Software Systems as Cities", VISSOFT 2007 (+ TSE 2011).
//
// Camera: user drag rotates yaw only (pitch fixed at 30° for the true
// isometric look). When idle for a bit, a very subtle 8-12s sinusoidal
// drift gives the scene a "living" feel — paused the moment the user
// interacts.

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  complexity,
  hashId,
  seeded,
} from "../../../shared/analytics/synth-metrics";

// ── Geometry constants ────────────────────────────────────────────────
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);
const TILE = 30;               // px — one grid cell on the ground plane
const GAP_BETWEEN_DISTRICTS = 1;

const HEIGHT_MIN = 28;
const HEIGHT_MAX = 220;

interface Building {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  loc: number;
  cx: number;                  // complexity 0..1
  gridX: number;               // within district
  gridY: number;
  height: number;
  base: number;                // square base size (gx units)
  fill: string;
  shade: string;               // darker for side face
  topFill: string;             // lighter for top face
}

interface District {
  id: string;
  label: string;
  x0: number;                  // ground-plane origin in grid units
  y0: number;
  w: number;                   // ground width in grid units
  d: number;                   // ground depth in grid units
  buildings: Building[];
  fill: string;
  groundPoly: string;
  labelX: number;
  labelY: number;
  enrichedBuildings: EnrichedBuilding[];
}

const KEYFRAMES = `
@keyframes ccEnter {
  0%   { opacity: 0; transform: scale(0.97); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ccRise {
  0%   { opacity: 0; transform: translateY(12px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0)    scale(1); }
}
`;

export interface CodeCity3DViewProps {
  tree: EntityTree;
  width: number;
  height: number;
  selectedId: string | null;
  onFocusEntity?: (id: string) => void;
}

function CodeCity3DViewImpl({
  tree,
  width,
  height,
  selectedId,
  onFocusEntity,
}: CodeCity3DViewProps): ReactElement {
  // Yaw only. Pitch stays locked at ~30° for classic isometric look.
  const [yaw, setYaw] = useState(0);
  const [idle, setIdle] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const dragRef = useRef({ active: false, x0: 0, yaw0: 0, pointerId: -1 });

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.codeCity3dKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  // Ambient drift: a subtle sine wobble around the user-set yaw.
  const [driftYaw, setDriftYaw] = useState(0);
  useEffect(() => {
    if (!idle) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const dt = (t - t0) / 1000;
      // 10s period, ±3° sway.
      setDriftYaw(Math.sin((dt / 10) * Math.PI * 2) * (Math.PI / 60));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [idle]);

  const districts = useMemo(() => buildCity(tree), [tree]);

  // Translate the whole scene so the city centroid lands in the viewport.
  const bbox = useMemo(() => sceneBBox(districts), [districts]);

  const handleDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      active: true,
      x0: e.clientX,
      yaw0: yaw,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setIdle(false);
  };
  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const delta = (e.clientX - d.x0) * 0.006;
    setYaw(d.yaw0 + delta);
  };
  const handleUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    if (e.currentTarget.hasPointerCapture(d.pointerId)) {
      e.currentTarget.releasePointerCapture(d.pointerId);
    }
    dragRef.current = { active: false, x0: 0, yaw0: 0, pointerId: -1 };
    setDragging(false);
    // Resume ambient drift after a short grace period.
    window.setTimeout(() => setIdle(true), 900);
  };

  const effectiveYaw = yaw + (idle ? driftYaw : 0);

  // bbox.cx / bbox.cy are already in projected (post-isometric) screen
  // space — `sceneBBox` walks ground-poly points that came out of
  // `worldIso`. Centering simply lines that midpoint up with the SVG
  // centre; the small `hMid` nudge biases for the upward vertical
  // extent of the tallest building.
  const svgH = Math.max(1, height - 120);
  const viewportCenter = { x: width / 2, y: svgH / 2 };

  // Flatten all tiles for depth sorting (painter's algorithm).
  const drawables = useMemo(
    () => flatten(districts),
    [districts],
  );

  // Painter's order in screen Z: we sort by (world x + world y) ascending
  // so far cells render first.
  const sorted = useMemo(() => {
    return [...drawables].sort((a, b) => a.sortKey - b.sortKey);
  }, [drawables]);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Code City</div>
          <div style={subtitleStyle}>
            Wettel & Lanza VISSOFT 2007 · drag to rotate
          </div>
        </div>
        <div style={legendStyle}>
          <span style={legendItemStyle}>
            <span style={legendSwatch("#c9d5e8")} />
            height = LoC
          </span>
          <span style={legendItemStyle}>
            <span style={legendSwatch(color.accent)} />
            base = complexity
          </span>
          <span style={legendItemStyle}>
            <span style={{ ...legendSwatch(color.bg3), borderRadius: 2 }} />
            district = package
          </span>
        </div>
      </header>

      <div style={canvasWrapStyle}>
        <svg
          width={width}
          height={svgH}
          viewBox={`0 0 ${width} ${svgH}`}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          style={{
            width: "100%",
            height: "100%",
            cursor: dragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
            background: "linear-gradient(180deg, #fafcff 0%, #eef2f8 100%)",
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
          }}
        >
          <defs>
            {/* Soft ground shadow below every building */}
            <radialGradient id="cc-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="rgba(20, 30, 45, 0.22)" />
              <stop offset="100%" stopColor="rgba(20, 30, 45, 0)" />
            </radialGradient>
            <linearGradient id="cc-ground-sheen" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"  stopColor="rgba(255,255,255,0.45)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          <g
            transform={
              `translate(${viewportCenter.x} ${viewportCenter.y - bbox.hMid * 0.1}) ` +
              `rotate(${(effectiveYaw * 180) / Math.PI}) ` +
              `translate(${-bbox.cx} ${-bbox.cy})`
            }
            style={{
              transition: idle ? "transform 120ms linear" : "none",
              animation: "ccEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
            }}
          >
            {/* Districts: ground tiles + buildings, back-to-front */}
            {sorted.map((d, i) => {
              if (d.kind === "ground") {
                return (
                  <GroundTile
                    key={`g-${d.district.id}`}
                    district={d.district}
                    index={i}
                  />
                );
              }
              const b = d.building;
              if (!b) return null;
              return (
                <BuildingMesh
                  key={b.id}
                  building={b}
                  index={i}
                  selected={selectedId === b.id}
                  hovered={hoveredId === b.id}
                  onHover={setHoveredId}
                  onFocus={onFocusEntity}
                />
              );
            })}
          </g>
        </svg>

        {hoveredId && (
          <HoverCard
            b={findBuilding(districts, hoveredId)}
          />
        )}
      </div>
    </div>
  );
}

// ── Ground tile ───────────────────────────────────────────────────────
function GroundTile({
  district,
  index,
}: {
  district: District;
  index: number;
}) {
  const poly = district.groundPoly;
  return (
    <g
      style={{
        animation: "ccRise 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
        animationDelay: `${Math.min(index * 3, 240)}ms`,
      }}
    >
      <polygon
        points={poly}
        fill={district.fill}
        stroke="rgba(20, 30, 45, 0.08)"
        strokeWidth={0.5}
      />
      <polygon
        points={poly}
        fill="url(#cc-ground-sheen)"
        opacity={0.4}
      />
      <text
        x={district.labelX}
        y={district.labelY}
        fontSize={9}
        fontFamily="'Inter Tight', sans-serif"
        letterSpacing="0.06em"
        fontWeight={600}
        fill="rgba(20, 30, 45, 0.48)"
      >
        {district.label.toUpperCase()}
      </text>
    </g>
  );
}

// ── Building mesh ─────────────────────────────────────────────────────
function BuildingMesh({
  building,
  index,
  selected,
  hovered,
  onHover,
  onFocus,
}: {
  building: EnrichedBuilding;
  index: number;
  selected: boolean;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onFocus?: (id: string) => void;
}) {
  const strokeColor = selected
    ? color.accent
    : hovered
    ? color.text1
    : "rgba(20, 30, 45, 0.12)";
  const strokeWidth = selected ? 1.5 : hovered ? 1.1 : 0.7;
  return (
    <g
      style={{
        cursor: "pointer",
        animation: "ccRise 640ms cubic-bezier(0.22, 1, 0.28, 1) both",
        animationDelay: `${Math.min(200 + index * 4, 620)}ms`,
        filter: selected
          ? `drop-shadow(0 4px 10px rgba(13,153,255,0.35))`
          : hovered
          ? "drop-shadow(0 3px 7px rgba(20,30,45,0.18))"
          : "none",
        transition: "filter 180ms ease-out",
      }}
      onMouseEnter={() => onHover(building.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus?.(building.id)}
    >
      <ellipse
        cx={building.shadowCx}
        cy={building.shadowCy}
        rx={building.shadowRx}
        ry={building.shadowRx * 0.35}
        fill="url(#cc-shadow)"
      />
      <polygon
        points={building.rightPoly.map(p => p.join(",")).join(" ")}
        fill={building.shade}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <polygon
        points={building.leftPoly.map(p => p.join(",")).join(" ")}
        fill={building.fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <polygon
        points={building.topPoly.map(p => p.join(",")).join(" ")}
        fill={building.topFill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
}

// ── Hover card ────────────────────────────────────────────────────────
function HoverCard({ b }: { b: Building | null }) {
  if (!b) return null;
  return (
    <div style={hoverCardStyle}>
      <div style={{ fontWeight: font.weight.semibold, fontSize: font.size.sm }}>
        {b.name}
      </div>
      <div style={{ color: color.text2, fontSize: font.size.xxs, marginTop: 2 }}>
        {b.path}
      </div>
      <div
        style={{
          display: "flex",
          gap: space[3],
          fontSize: font.size.xxs,
          color: color.text1,
          marginTop: space[2],
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{b.loc} LoC</span>
        <span style={{ color: color.text3 }}>· cx {Math.round(b.cx * 100)}%</span>
      </div>
    </div>
  );
}

// ── Build layout ──────────────────────────────────────────────────────
type EnrichedDistrict = District;

type EnrichedBuilding = Building & {
  topPoly: [number, number][];
  leftPoly: [number, number][];
  rightPoly: [number, number][];
  shadowCx: number;
  shadowCy: number;
  shadowRx: number;
};

function buildCity(tree: EntityTree): EnrichedDistrict[] {
  const all = Array.from(tree.byId.values());
  const files = all.filter(e => e.kind === "building");
  if (files.length === 0) return [];

  // Group files by parent street / galaxy id.
  const groups = new Map<string, Entity[]>();
  for (const f of files) {
    const parent = findDistrictParent(f, tree);
    const list = groups.get(parent.id) ?? [];
    list.push(f);
    groups.set(parent.id, list);
  }

  const locs = files.map(f => f.metrics?.loc ?? 60);
  const maxLoc = Math.max(...locs, 1);
  const minLoc = Math.min(...locs);

  // Per district: pack children into a square grid.
  const districts: EnrichedDistrict[] = [];
  let rowX = 0;
  let rowY = 0;
  let rowMaxD = 0;
  const ROW_WIDTH_TILES = 22;

  // Sort districts by file count descending.
  const sortedGroupIds = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id]) => id);

  for (const parentId of sortedGroupIds) {
    const parentEntity = tree.byId.get(parentId);
    const childFiles = groups.get(parentId)!;
    const label = parentEntity?.name ?? "package";

    const side = Math.ceil(Math.sqrt(childFiles.length));
    const districtW = side + 2;
    const districtD = side + 2;

    if (rowX + districtW > ROW_WIDTH_TILES) {
      rowX = 0;
      rowY += rowMaxD + GAP_BETWEEN_DISTRICTS;
      rowMaxD = 0;
    }
    const x0 = rowX;
    const y0 = rowY;
    rowX += districtW + GAP_BETWEEN_DISTRICTS;
    rowMaxD = Math.max(rowMaxD, districtD);

    // District tint — deterministic hue per parent.
    const hue = hashId(parentId) % 360;
    const fill = `hsl(${hue} 34% 92%)`;

    // Sort children so tallest go toward back corner for silhouette.
    const sortedChildren = [...childFiles].sort(
      (a, b) => (b.metrics?.loc ?? 0) - (a.metrics?.loc ?? 0),
    );

    const buildings: Building[] = [];
    sortedChildren.forEach((f, i) => {
      const gridX = (i % side) + 1;
      const gridY = Math.floor(i / side) + 1;
      const loc = f.metrics?.loc ?? 60;
      const cx = complexity(f);
      const h =
        HEIGHT_MIN +
        (HEIGHT_MAX - HEIGHT_MIN) *
          Math.pow(
            (Math.log(loc + 1) - Math.log(minLoc + 1)) /
              Math.max(0.0001, Math.log(maxLoc + 1) - Math.log(minLoc + 1)),
            0.9,
          );
      const base = 0.55 + cx * 0.42;
      const bHue = hashId(f.id) % 360;
      const baseFill = `hsl(${bHue} 48% 74%)`;
      buildings.push({
        id: f.id,
        name: f.name,
        path: f.path,
        parentId,
        loc,
        cx,
        gridX,
        gridY,
        height: h,
        base,
        fill: baseFill,
        shade: shadeHex(baseFill, -0.18),
        topFill: shadeHex(baseFill, 0.14),
      });
    });

    // Ground polygon in world coordinates (four corners projected).
    const corners: [number, number][] = [
      worldIso(x0 * TILE, y0 * TILE, 0),
      worldIso((x0 + districtW) * TILE, y0 * TILE, 0),
      worldIso((x0 + districtW) * TILE, (y0 + districtD) * TILE, 0),
      worldIso(x0 * TILE, (y0 + districtD) * TILE, 0),
    ];
    const groundPoly = corners.map(p => p.join(",")).join(" ");
    const [lx, ly] = worldIso(
      (x0 + 0.4) * TILE,
      (y0 + districtD - 0.4) * TILE,
      0,
    );

    const enrichedBuildings = buildings.map(b => enrichBuilding(b, x0, y0));

    districts.push({
      id: parentId,
      label,
      x0,
      y0,
      w: districtW,
      d: districtD,
      buildings,
      fill,
      groundPoly,
      labelX: lx,
      labelY: ly + 2,
      enrichedBuildings,
    });
  }
  return districts;
}

function enrichBuilding(
  b: Building,
  dx0: number,
  dy0: number,
): EnrichedBuilding {
  // Center the building on its grid cell.
  const halfBase = (b.base * TILE) / 2;
  const cxWorld = (dx0 + b.gridX + 0.5) * TILE;
  const cyWorld = (dy0 + b.gridY + 0.5) * TILE;

  const x1 = cxWorld - halfBase;
  const x2 = cxWorld + halfBase;
  const y1 = cyWorld - halfBase;
  const y2 = cyWorld + halfBase;

  // 8 corners (4 ground, 4 top). g2 omitted — not visible at yaw = 0.
  const g1 = worldIso(x1, y1, 0);
  const g3 = worldIso(x2, y2, 0);
  const g4 = worldIso(x1, y2, 0);
  const t1 = worldIso(x1, y1, b.height);
  const t2 = worldIso(x2, y1, b.height);
  const t3 = worldIso(x2, y2, b.height);
  const t4 = worldIso(x1, y2, b.height);

  // For yaw = 0 isometric camera:
  //   - top face: t1,t2,t3,t4
  //   - left visible face: g1,g4,t4,t1  (x- side)
  //   - right visible face: g3,g4,t4,t3 (y+ side)
  const topPoly: [number, number][] = [t1, t2, t3, t4];
  const leftPoly: [number, number][] = [g1, g4, t4, t1];
  const rightPoly: [number, number][] = [g4, g3, t3, t4];

  const shadow = worldIso(cxWorld, cyWorld, 0);
  return {
    ...b,
    topPoly,
    leftPoly,
    rightPoly,
    shadowCx: shadow[0],
    shadowCy: shadow[1] + 2,
    shadowRx: halfBase * 1.4,
  };
}

function worldIso(x: number, y: number, z: number): [number, number] {
  const sx = (x - y) * COS30;
  const sy = (x + y) * SIN30 - z;
  return [sx, sy];
}

interface Flat {
  kind: "ground" | "building";
  sortKey: number;
  district: EnrichedDistrict;
  building?: EnrichedBuilding;
}

function flatten(districts: EnrichedDistrict[]): Flat[] {
  const out: Flat[] = [];
  for (const d of districts) {
    // Ground sorts first by district far corner.
    const key = d.x0 + d.y0;
    out.push({ kind: "ground", sortKey: key - 1000, district: d });
    for (const b of d.enrichedBuildings) {
      out.push({
        kind: "building",
        sortKey: (d.x0 + b.gridX) + (d.y0 + b.gridY) + b.height * 0.00001,
        district: d,
        building: b,
      });
    }
  }
  return out;
}

function findDistrictParent(entity: Entity, tree: EntityTree): Entity {
  let cur: Entity | undefined = entity;
  while (cur) {
    const parent: Entity | undefined = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
    if (!parent) return cur;
    if (parent.kind === "street" || parent.kind === "galaxy") return parent;
    cur = parent;
  }
  return entity;
}

function sceneBBox(districts: EnrichedDistrict[]) {
  let xs: number[] = [];
  let ys: number[] = [];
  let maxH = 0;
  for (const d of districts) {
    for (const c of d.groundPoly.split(" ")) {
      const [x, y] = c.split(",").map(Number) as [number, number];
      xs.push(x);
      ys.push(y);
    }
    for (const b of d.enrichedBuildings) {
      maxH = Math.max(maxH, b.height);
    }
  }
  if (xs.length === 0) return { cx: 0, cy: 0, hMid: 0 };
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    hMid: maxH / 2,
  };
}

function findBuilding(
  districts: EnrichedDistrict[],
  id: string,
): Building | null {
  for (const d of districts) {
    const b = d.enrichedBuildings.find(x => x.id === id);
    if (b) return b;
  }
  return null;
}

// ── Colour utilities ──────────────────────────────────────────────────
function shadeHex(hex: string, amt: number): string {
  // Accepts "hsl(..)" or "#rrggbb".
  const m = /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i.exec(hex);
  if (m) {
    const h = +m[1]!;
    const s = +m[2]!;
    const l = Math.max(0, Math.min(100, +m[3]! + amt * 100));
    return `hsl(${h} ${s}% ${l}%)`;
  }
  // hex fallback
  const c = hex.replace("#", "");
  if (c.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(c.slice(0, 2), 16) + amt * 255));
  const g = Math.max(0, Math.min(255, parseInt(c.slice(2, 4), 16) + amt * 255));
  const b = Math.max(0, Math.min(255, parseInt(c.slice(4, 6), 16) + amt * 255));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// ── Styles ────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: color.bg0,
  padding: `${space[6]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  color: color.text0,
  animation: "ccEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: space[4],
  gap: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  marginTop: space[1],
};

const legendStyle: CSSProperties = {
  display: "flex",
  gap: space[4],
  fontSize: font.size.xxs,
  color: color.text2,
};

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

function legendSwatch(c: string): CSSProperties {
  return {
    display: "inline-block",
    width: 12,
    height: 12,
    background: c,
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.08)",
  };
}

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: "relative",
  overflow: "hidden",
};

const hoverCardStyle: CSSProperties = {
  position: "absolute",
  top: space[3],
  right: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  pointerEvents: "none",
  maxWidth: 280,
};

// Keep seeded in use (drift jitter factor) without coupling data changes.
void seeded;

export const CodeCity3DView = memo(CodeCity3DViewImpl);
