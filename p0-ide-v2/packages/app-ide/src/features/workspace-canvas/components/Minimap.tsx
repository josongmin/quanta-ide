import { memo, useMemo } from "react";
import type { WorkspaceLayout, Viewport } from "@quanta/canvas-engine";
import { useWorkspaceCanvas } from "../store/workspace-canvas-store";

interface Props {
  layout: WorkspaceLayout | null;
  viewport: Viewport;
}

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

export function Minimap({ layout, viewport }: Props) {
  // Subscribe directly to LOD so the minimap can swap between file-level
  // and cluster-level rendering without prop-drilling from MultiFileCanvas.
  const lod = useWorkspaceCanvas(s => s.lod);

  if (!layout || layout.fileRects.size === 0) return null;
  const tb = layout.totalBounds;
  if (tb.w <= 0 || tb.h <= 0) return null;

  const strokeW = (tb.w / 180) * 1.5;
  const vx = -viewport.x / viewport.scale;
  const vy = -viewport.y / viewport.scale;
  const vw = viewport.width / viewport.scale;
  const vh = viewport.height / viewport.scale;

  // Cluster-aware rendering: at supergalaxy with cluster metadata present,
  // render the few (~150) cluster rects instead of thousands of file dots.
  const useClusterRects = lod === "supergalaxy" && (layout.clusters?.length ?? 0) > 0;

  return (
    <div className="ws-minimap">
      <svg
        width={180}
        height={110}
        viewBox={`${tb.x} ${tb.y} ${tb.w} ${tb.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {useClusterRects
          ? <ClusterRects layout={layout} />
          : <FileRects layout={layout} />}
        <rect
          x={vx} y={vy} width={vw} height={vh}
          fill="rgba(79,70,229,0.08)"
          stroke="#4f46e5"
          strokeWidth={strokeW * 1.5}
        />
      </svg>
    </div>
  );
}
