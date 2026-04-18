import type { WorkspaceLayout, Viewport } from "@quanta/canvas-engine";

interface Props {
  layout: WorkspaceLayout | null;
  viewport: Viewport;
}

export function Minimap({ layout, viewport }: Props) {
  if (!layout || layout.fileRects.size === 0) return null;

  const tb = layout.totalBounds;
  if (tb.w <= 0 || tb.h <= 0) return null;

  const strokeW = (tb.w / 180) * 1.5;

  const vx = -viewport.x / viewport.scale;
  const vy = -viewport.y / viewport.scale;
  const vw = viewport.width / viewport.scale;
  const vh = viewport.height / viewport.scale;

  return (
    <div className="ws-minimap">
      <svg
        width={180}
        height={110}
        viewBox={`${tb.x} ${tb.y} ${tb.w} ${tb.h}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {[...layout.fileRects.entries()].map(([id, rect]) => (
          <rect
            key={id}
            x={rect.x} y={rect.y} width={rect.w} height={rect.h}
            fill="#e0e7ff" stroke="#818cf8" strokeWidth={strokeW}
            rx={strokeW}
          />
        ))}
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
