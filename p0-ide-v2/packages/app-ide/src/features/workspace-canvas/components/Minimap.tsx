import { memo, useEffect, useMemo, useRef } from "react";
import type { WorkspaceLayout, Viewport } from "@quanta/canvas-engine";
import { useInteractionStore } from "../store/interaction-store";
import { useSceneStore } from "../store/scene-store";
import { uxSettingsStore, useUxSettings } from "../store/ux-settings-store";
import { computeRiskHeatmap, type HeatCell } from "../lib/heatmap";
import { TemporalMinimapStrip } from "./TemporalMinimapStrip";

interface Props {
  layout: WorkspaceLayout | null;
  viewport: Viewport;
}

const MINIMAP_W = 180;
const MINIMAP_H = 110;
const HEAT_PX_PER_CELL = 8;
const HEAT_MAX_OPACITY = 0.55;

// Static rect grid for the file cards. Memoized on layout only — panning
// the main canvas must NOT re-render 5000+ <rect> elements (that reconciliation
// alone tanks pan FPS when the repo is large).
const FileRects = memo(function FileRects({ layout }: { layout: WorkspaceLayout }) {
  const strokeW = (layout.totalBounds.w / 180) * 1.5;
  const items = useMemo(
    () => [...layout.fileRects.entries()],
    [layout],
  );
  return (
    <>
      {items.map(([id, rect]) => (
        <rect
          key={id}
          x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          fill="#e0e7ff" stroke="#818cf8" strokeWidth={strokeW}
          rx={strokeW}
        />
      ))}
    </>
  );
});

// Cluster-level rects for supergalaxy LOD. At that zoom, 5k+ file dots
// collapse into a few blurry pixels — showing cluster boxes instead (one
// per top-level directory) keeps the minimap useful and drops DOM cost
// from 5000+ to ~150 rects.
const ClusterRects = memo(function ClusterRects({ layout }: { layout: WorkspaceLayout }) {
  const strokeW = (layout.totalBounds.w / 180) * 2.5;
  const items = useMemo(
    () => (layout.clusters ?? []).map(c => ({ id: c.id, rect: c.rect })),
    [layout],
  );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ id, rect }) => (
        <rect
          key={id}
          x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          fill="#c7d2fe" stroke="#6366f1" strokeWidth={strokeW}
          rx={strokeW * 2}
        />
      ))}
    </>
  );
});

// Supercluster-level rects for universe LOD — one tier above ClusterRects.
// Same pattern, different source: `layout.superclusters` (populated by
// the treemap layout when multiple top-level groups are present, e.g. an
// MSA monorepo). Darker tint so the tier is visually distinct from the
// supergalaxy cluster rects.
const SuperclusterRects = memo(function SuperclusterRects({ layout }: { layout: WorkspaceLayout }) {
  const strokeW = (layout.totalBounds.w / 180) * 3.5;
  const items = useMemo(
    () => (layout.superclusters ?? []).map(c => ({ id: c.id, rect: c.rect })),
    [layout],
  );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ id, rect }) => (
        <rect
          key={id}
          x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          fill="#a5b4fc" stroke="#4338ca" strokeWidth={strokeW}
          rx={strokeW * 2}
        />
      ))}
    </>
  );
});

// Canvas-backed heatmap layer. SVG was viable at ~200 cells but a 24×40
// grid = 960 rects; SVG reconciliation + paint for that count on every
// layout change is measurably slower than a single <canvas> fill loop,
// and canvas also lets us paint with partial alpha cheaply.
const HeatmapLayer = memo(function HeatmapLayer({
  cells,
  tb,
}: {
  cells: HeatCell[];
  tb: { x: number; y: number; w: number; h: number };
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // Devicepixel-scaled backing store for crisp cells on retina. We size
    // the CSS box to minimap dims and multiply the backing store by DPR.
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = MINIMAP_W;
    const cssH = MINIMAP_H;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cells.length === 0 || tb.w <= 0 || tb.h <= 0) return;

    // Fit minimap content the same way the SVG does (xMidYMid meet),
    // so the heatmap aligns pixel-for-pixel with the rect overlay.
    const sx = (cssW * dpr) / tb.w;
    const sy = (cssH * dpr) / tb.h;
    const s = Math.min(sx, sy);
    const offX = ((cssW * dpr) - tb.w * s) * 0.5;
    const offY = ((cssH * dpr) - tb.h * s) * 0.5;

    ctx.globalAlpha = HEAT_MAX_OPACITY;
    for (const c of cells) {
      const px = (c.x - tb.x) * s + offX;
      const py = (c.y - tb.y) * s + offY;
      const pw = c.w * s;
      const ph = c.h * s;
      ctx.fillStyle = heatColor(c.heat);
      ctx.fillRect(px, py, pw + 0.5, ph + 0.5);
    }
    ctx.globalAlpha = 1;

    return () => {
      // Explicit clear-on-unmount — React will drop the element, but on
      // hot-reload we've seen stale backing stores flash for a frame.
      const ctx2 = canvas.getContext("2d");
      ctx2?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [cells, tb.x, tb.y, tb.w, tb.h]);

  return <canvas ref={ref} className="ws-minimap__heat" aria-hidden="true" />;
});

// transparent → amber → red gradient, keyed on heat 0..1. Using HSL so
// the ramp is perceptually smooth without shipping a lookup table: hue
// sweeps from amber (~45) at low heat down to red (0) at peak, saturation
// stays saturated, lightness dips slightly as heat climbs.
function heatColor(heat: number): string {
  const hue = heat <= 0.5 ? 45 : 45 * (1 - (heat - 0.5) / 0.5);
  const light = 50 - heat * 5;
  return `hsl(${hue.toFixed(1)}, 95%, ${light}%)`;
}

export function Minimap({ layout, viewport }: Props) {
  // Subscribe directly to LOD so the minimap can swap between file-level
  // and cluster-level rendering without prop-drilling from MultiFileCanvas.
  const lod = useInteractionStore(s => s.lod);
  const graph = useSceneStore(s => s.graph);
  const showHeatmap = useUxSettings(s => s.showHeatmap);

  // Grid resolution scales with minimap pixel size — roughly 1 cell per
  // ~8px so the heatmap reads as a density field, not a pixelated block.
  const gridCols = Math.max(4, Math.round(MINIMAP_W / HEAT_PX_PER_CELL));
  const gridRows = Math.max(4, Math.round(MINIMAP_H / HEAT_PX_PER_CELL));

  const heatCells = useMemo(() => {
    if (!layout || !graph || !showHeatmap) return [];
    return computeRiskHeatmap(layout, graph, gridCols, gridRows);
  }, [layout, graph, gridCols, gridRows, showHeatmap]);

  if (!layout || layout.fileRects.size === 0) return null;
  const tb = layout.totalBounds;
  if (tb.w <= 0 || tb.h <= 0) return null;

  const strokeW = (tb.w / 180) * 1.5;
  const vx = -viewport.x / viewport.scale;
  const vy = -viewport.y / viewport.scale;
  const vw = viewport.width / viewport.scale;
  const vh = viewport.height / viewport.scale;

  // Tier-aware rendering: at universe draw supercluster rects (if present),
  // at supergalaxy draw cluster rects, otherwise fall back to the full
  // file-rect grid. Each tier test also requires non-empty data to avoid an
  // empty minimap — the layout may lack superclusters (small graphs) or
  // clusters (grid layouts) even when the LOD is zoomed out.
  const useSuperclusterRects = lod === "universe" && (layout.superclusters?.length ?? 0) > 0;
  const useClusterRects = !useSuperclusterRects && lod === "supergalaxy" && (layout.clusters?.length ?? 0) > 0;

  return (
    <>
    <TemporalMinimapStrip history={graph?.history} width={MINIMAP_W} />
    <div className="ws-minimap">
      {showHeatmap && <HeatmapLayer cells={heatCells} tb={tb} />}
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        viewBox={`${tb.x} ${tb.y} ${tb.w} ${tb.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {useSuperclusterRects
          ? <SuperclusterRects layout={layout} />
          : useClusterRects
            ? <ClusterRects layout={layout} />
            : <FileRects layout={layout} />}
        <rect
          x={vx} y={vy} width={vw} height={vh}
          fill="rgba(79,70,229,0.08)"
          stroke="#4f46e5"
          strokeWidth={strokeW * 1.5}
        />
      </svg>
      <button
        type="button"
        className={`ws-minimap__chip${showHeatmap ? " is-on" : ""}`}
        onClick={() => uxSettingsStore.setShowHeatmap(!showHeatmap)}
        title="toggle risk heatmap"
      >
        heat
      </button>
    </div>
    </>
  );
}
