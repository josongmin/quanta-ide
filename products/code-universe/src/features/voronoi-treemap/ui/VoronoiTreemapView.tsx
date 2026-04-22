// VoronoiTreemapView — approximate centroidal-Voronoi package map.
// --------------------------------------------------------------------
// One cell per package (galaxy / street). Seeds are placed with a
// Poisson-disk-ish spread, weighted by fileCount; a small number of
// Lloyd's-relaxation passes pull each seed toward its cell centroid
// so the partition ends up roughly equi-area.
//
// Cells themselves are reconstructed by scanning the viewport at
// 8-px resolution and assigning each sample to its nearest seed, then
// marching a thin outline along pixel boundaries where the owner
// changes. This is the "cheap approximation" called for in spec —
// exact Fortune sweep would be overkill for the aesthetic.
//
// Reference: Balzer & Deussen.
// "Voronoi Treemaps", IEEE InfoVis 2005.
// Inspiration for the pure-JS relaxation: D3's `d3-voronoi-treemap`.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color,
  font,
  kindColor,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  churn,
  hashId,
  mulberry32,
} from "../../../shared/analytics/synth-metrics";

const CELL_RES = 10;              // px sample grid for voronoi rasterisation
const RELAX_PASSES = 5;           // Lloyd's iterations
const VIEW_MARGIN = 24;

interface Seed {
  id: string;
  label: string;
  entity: Entity;
  weight: number;                 // fileCount fallback
  x: number;
  y: number;
  centroidX?: number;
  centroidY?: number;
  pixels?: number;
  fill: string;
}

interface CellOutline {
  id: string;
  d: string;                      // SVG path
  labelX: number;
  labelY: number;
  fill: string;
  seed: Seed;
  pixelCount: number;
}

const KEYFRAMES = `
@keyframes voFadeIn {
  0%   { opacity: 0; transform: scale(0.97); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes voStroke {
  0%   { stroke-dashoffset: var(--dash); opacity: 0; }
  25%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
@keyframes voFillRamp {
  0%   { fill-opacity: 0; }
  100% { fill-opacity: 0.8; }
}
`;

export interface VoronoiTreemapViewProps {
  tree: EntityTree;
  width: number;
  height: number;
  selectedId: string | null;
  onFocusEntity?: (id: string) => void;
}

function VoronoiTreemapViewImpl({
  tree,
  width,
  height,
  selectedId,
  onFocusEntity,
}: VoronoiTreemapViewProps): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.voronoiKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const canvasW = Math.max(1, width);
  const canvasH = Math.max(1, height - 120);

  const cells = useMemo(
    () => buildCells(tree, canvasW, canvasH),
    [tree, canvasW, canvasH],
  );

  if (cells.length === 0) {
    return (
      <div style={{ ...rootStyle, alignItems: "center", justifyContent: "center" }}>
        <style>{KEYFRAMES}</style>
        <div style={{ color: color.text3, fontSize: font.size.md, textAlign: "center" }}>
          패키지를 찾을 수 없습니다
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Voronoi Treemap</div>
          <div style={subtitleStyle}>
            Balzer & Deussen InfoVis 2005 · centroidal Voronoi partition
          </div>
        </div>
        <div style={legendStyle}>
          <span style={legendItemStyle}>
            <span style={{ ...legendSwatch, background: kindColor.galaxy }} />
            package
          </span>
          <span style={legendItemStyle}>
            <span style={{ ...legendSwatch, background: kindColor.street }} />
            folder
          </span>
          <span style={legendItemStyle}>
            <span style={{ ...legendSwatch, background: color.accent }} />
            selected
          </span>
        </div>
      </header>

      <div style={canvasWrapStyle}>
        <svg
          viewBox={`0 0 ${canvasW} ${canvasH}`}
          preserveAspectRatio="xMidYMid meet"
          style={svgStyle}
        >
          <defs>
            <radialGradient id="vo-vignette" cx="50%" cy="50%" r="75%">
              <stop offset="0%"  stopColor="rgba(0,0,0,0)" />
              <stop offset="85%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.04)" />
            </radialGradient>
          </defs>

          <rect x={0} y={0} width={canvasW} height={canvasH} fill={color.bg2} />
          <rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#vo-vignette)" />

          {/* Fill cells first (behind) */}
          {cells.map((c, i) => {
            const selected = selectedId === c.id;
            const hovered = hoveredId === c.id;
            return (
              <path
                key={`f-${c.id}`}
                d={c.d}
                fill={c.fill}
                fillOpacity={selected ? 0.9 : hovered ? 0.88 : 0.72}
                stroke="none"
                style={{
                  animation: `voFillRamp 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${Math.min(i * 18, 360)}ms`,
                  transition: "fill-opacity 180ms ease-out",
                }}
              />
            );
          })}

          {/* Hairline outlines */}
          {cells.map((c, i) => {
            const selected = selectedId === c.id;
            const hovered = hoveredId === c.id;
            const dash = Math.max(60, Math.round(c.d.length * 0.6));
            return (
              <path
                key={`o-${c.id}`}
                d={c.d}
                fill="none"
                stroke={selected ? color.accent : hovered ? color.text1 : "rgba(20, 30, 45, 0.45)"}
                strokeWidth={selected ? 1.6 : hovered ? 1.2 : 0.8}
                strokeDasharray={`${dash}`}
                style={{
                  ["--dash" as string]: dash.toString(),
                  animation: `voStroke 700ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${Math.min(160 + i * 18, 520)}ms`,
                  cursor: "pointer",
                  transition: "stroke 180ms ease-out, stroke-width 180ms ease-out",
                }}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onFocusEntity?.(c.id)}
              />
            );
          })}

          {/* Labels */}
          {cells.map((c, i) => {
            if (c.pixelCount < 36) return null;   // tiny cell — skip label
            const labelMax = Math.max(1, Math.floor(Math.sqrt(c.pixelCount) * 2.2));
            const text = c.seed.label.length > labelMax
              ? c.seed.label.slice(0, Math.max(4, labelMax - 1)) + "…"
              : c.seed.label;
            return (
              <text
                key={`t-${c.id}`}
                x={c.labelX}
                y={c.labelY}
                textAnchor="middle"
                fontFamily={font.sans}
                fontSize={Math.min(14, 9 + Math.sqrt(c.pixelCount) * 0.15)}
                fontWeight={font.weight.semibold}
                fill={color.text0}
                fillOpacity={0.86}
                style={{
                  pointerEvents: "none",
                  animation: `voFadeIn 520ms ease-out both`,
                  animationDelay: `${Math.min(340 + i * 18, 720)}ms`,
                }}
              >
                {text}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Build cells ───────────────────────────────────────────────────────
function buildCells(
  tree: EntityTree,
  w: number,
  h: number,
): CellOutline[] {
  // Gather "package-ish" entities: galaxies + streets.
  const all = Array.from(tree.byId.values());
  const packageish = all.filter(
    e => e.kind === "galaxy" || e.kind === "street",
  );
  if (packageish.length === 0) return [];

  // Weight by fileCount if available, else child-building count.
  const weights = new Map<string, number>();
  for (const p of packageish) {
    const fc = p.metrics?.fileCount ?? countChildrenOfKind(p, tree, "building");
    weights.set(p.id, Math.max(1, fc));
  }

  // Keep the top N largest — too many cells cram into dots.
  const pkgs = [...packageish]
    .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0))
    .slice(0, 28);

  // Deterministic RNG — seeded from the whole set so the layout
  // stays stable across re-renders.
  const seedStr = pkgs.map(p => p.id).join("|");
  const rng = mulberry32(hashId(seedStr));

  const seeds: Seed[] = pkgs.map(p => {
    const ch = churn(p);
    const fill = p.kind === "galaxy"
      ? mix(kindColor.galaxy, "#ffffff", 0.35)
      : mix(kindColor.street, "#ffffff", 0.45);
    return {
      id: p.id,
      label: p.name,
      entity: p,
      weight: weights.get(p.id)!,
      x: VIEW_MARGIN + rng() * (w - 2 * VIEW_MARGIN),
      y: VIEW_MARGIN + rng() * (h - 2 * VIEW_MARGIN),
      fill: mix(fill, color.accent, Math.min(0.4, ch * 0.4)),
    };
  });

  // Lloyd's relaxation — weighted.
  const grid = new Int16Array(
    Math.ceil(w / CELL_RES) * Math.ceil(h / CELL_RES),
  );
  const gw = Math.ceil(w / CELL_RES);
  const gh = Math.ceil(h / CELL_RES);

  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    // Assignment step: each grid cell to nearest seed.
    for (let gy = 0; gy < gh; gy++) {
      const py = gy * CELL_RES + CELL_RES / 2;
      for (let gx = 0; gx < gw; gx++) {
        const px = gx * CELL_RES + CELL_RES / 2;
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < seeds.length; i++) {
          const s = seeds[i]!;
          const dx = px - s.x;
          const dy = py - s.y;
          // Multiplicatively weighted Voronoi (approx): larger weights
          // pull borders outward. Squared-Euclidean / weight.
          const d = (dx * dx + dy * dy) / s.weight;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        grid[gy * gw + gx] = best;
      }
    }
    // Centroid step.
    const sumX = new Float64Array(seeds.length);
    const sumY = new Float64Array(seeds.length);
    const count = new Int32Array(seeds.length);
    for (let gy = 0; gy < gh; gy++) {
      const py = gy * CELL_RES + CELL_RES / 2;
      for (let gx = 0; gx < gw; gx++) {
        const px = gx * CELL_RES + CELL_RES / 2;
        const idx = grid[gy * gw + gx]!;
        sumX[idx]! += px;
        sumY[idx]! += py;
        count[idx]! += 1;
      }
    }
    for (let i = 0; i < seeds.length; i++) {
      const n = count[i]!;
      if (n > 0) {
        const nx = sumX[i]! / n;
        const ny = sumY[i]! / n;
        // Move 70% toward centroid — more damping = slower convergence
        // but avoids overshooting on the last pass.
        seeds[i]!.x = seeds[i]!.x * 0.3 + nx * 0.7;
        seeds[i]!.y = seeds[i]!.y * 0.3 + ny * 0.7;
        seeds[i]!.centroidX = nx;
        seeds[i]!.centroidY = ny;
        seeds[i]!.pixels = n;
      }
    }
  }

  // Build cell outlines by tracing the boundary of each seed's pixel set.
  // Approach: for each seed, collect all grid cells it owns, then compute
  // the convex hull — approximate but smooth, which reads well.
  const cells: CellOutline[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const owned: [number, number][] = [];
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        if (grid[gy * gw + gx] === i) {
          owned.push([gx * CELL_RES + CELL_RES / 2, gy * CELL_RES + CELL_RES / 2]);
        }
      }
    }
    if (owned.length === 0) continue;
    const hull = convexHull(expandCorners(owned, CELL_RES / 2));
    if (hull.length < 3) continue;
    // Smooth the hull slightly with chaikin-ish rounding.
    const smoothed = chaikin(hull, 2);
    const d = toPath(smoothed);
    const s = seeds[i]!;
    cells.push({
      id: s.id,
      d,
      labelX: s.centroidX ?? s.x,
      labelY: (s.centroidY ?? s.y) + 4,
      fill: s.fill,
      seed: s,
      pixelCount: owned.length,
    });
  }
  return cells;
}

// ── Geometry helpers ──────────────────────────────────────────────────
function countChildrenOfKind(
  parent: Entity,
  tree: EntityTree,
  kind: Entity["kind"],
): number {
  let n = 0;
  for (const e of tree.byId.values()) {
    if (e.kind !== kind) continue;
    let cur: Entity | undefined = e;
    while (cur) {
      if (cur.parentId === parent.id) {
        n++;
        break;
      }
      cur = cur.parentId ? tree.byId.get(cur.parentId) : undefined;
    }
  }
  return n;
}

function expandCorners(points: [number, number][], half: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of points) {
    out.push([x - half, y - half]);
    out.push([x + half, y - half]);
    out.push([x + half, y + half]);
    out.push([x - half, y + half]);
  }
  return out;
}

/** Andrew's monotone chain convex hull. */
function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = pts.length;
  if (n < 2) return pts;
  const cross = (
    O: [number, number],
    A: [number, number],
    B: [number, number],
  ) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function chaikin(points: [number, number][], iterations: number): [number, number][] {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out: [number, number][] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[i]!;
      const p1 = pts[(i + 1) % n]!;
      out.push([
        p0[0] * 0.75 + p1[0] * 0.25,
        p0[1] * 0.75 + p1[1] * 0.25,
      ]);
      out.push([
        p0[0] * 0.25 + p1[0] * 0.75,
        p0[1] * 0.25 + p1[1] * 0.75,
      ]);
    }
    pts = out;
  }
  return pts;
}

function toPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  const parts: string[] = [
    `M${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`,
  ];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L${points[i]![0].toFixed(2)},${points[i]![1].toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

function mix(a: string, b: string, t: number): string {
  const ca = parseCol(a);
  const cb = parseCol(b);
  if (!ca || !cb) return a;
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)}, ${Math.round(ca.g + (cb.g - ca.g) * t)}, ${Math.round(ca.b + (cb.b - ca.b) * t)})`;
}

function parseCol(c: string): { r: number; g: number; b: number } | null {
  if (c.startsWith("#")) {
    const v = c.slice(1);
    if (v.length === 3) {
      return {
        r: parseInt(v[0]! + v[0]!, 16),
        g: parseInt(v[1]! + v[1]!, 16),
        b: parseInt(v[2]! + v[2]!, 16),
      };
    }
    if (v.length === 6) {
      return {
        r: parseInt(v.slice(0, 2), 16),
        g: parseInt(v.slice(2, 4), 16),
        b: parseInt(v.slice(4, 6), 16),
      };
    }
  }
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(c);
  if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]! };
  return null;
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
  animation: "voFadeIn 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
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

const legendSwatch: CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.08)",
};

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

export const VoronoiTreemapView = memo(VoronoiTreemapViewImpl);
