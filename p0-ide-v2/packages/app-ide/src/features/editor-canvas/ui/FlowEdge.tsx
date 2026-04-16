import type { CanvasEdge } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  edge: CanvasEdge;
  fromRect: Rect;
  toRect: Rect;
}

function bezierPoint(
  x1: number, y1: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x2: number, y2: number, t: number,
) {
  const u = 1 - t;
  return {
    x: u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2,
    y: u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2,
  };
}

export function FlowEdge({ edge, fromRect, toRect }: Props) {
  const isExtFrom = edge.from.startsWith("ext:");
  const isExtTo = edge.to.startsWith("ext:");
  const isExternal = isExtFrom || isExtTo;

  let d: string;
  let cx1: number, cy1: number, cx2: number, cy2: number;
  let x1: number, y1: number, x2: number, y2: number;

  if (isExternal) {
    if (isExtFrom) {
      x1 = fromRect.x + fromRect.w;
      y1 = fromRect.y + fromRect.h / 2;
      x2 = toRect.x;
      y2 = toRect.y + toRect.h / 2;
    } else {
      x1 = fromRect.x + fromRect.w;
      y1 = fromRect.y + fromRect.h / 2;
      x2 = toRect.x;
      y2 = toRect.y + toRect.h / 2;
    }
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(dx * 0.4, 40);
    cx1 = x1 + cp; cy1 = y1;
    cx2 = x2 - cp; cy2 = y2;
    d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  } else {
    x1 = fromRect.x + fromRect.w / 2;
    y1 = fromRect.y + fromRect.h;
    x2 = toRect.x + toRect.w / 2;
    y2 = toRect.y;
    const dy = Math.abs(y2 - y1);
    const sameRank = dy < 20;
    if (sameRank) {
      const midY = Math.min(y1, y2) - 50;
      cx1 = x1; cy1 = midY; cx2 = x2; cy2 = midY;
    } else {
      const cp = Math.max(dy * 0.5, 30);
      cx1 = x1; cy1 = y1 + cp; cx2 = x2; cy2 = y2 - cp;
    }
    d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  const markerKind = isExternal ? "external" : edge.kind;
  const externalClass = isExtFrom ? "flow-edge--external-in" : isExtTo ? "flow-edge--external-out" : null;

  const steps = edge.taintSteps;
  const showSteps = edge.kind === "taint" && steps && steps.length > 0;

  return (
    <g className="flow-edge-group">
      <path
        className={cn("flow-edge", isExternal ? externalClass : `flow-edge--${edge.kind}`)}
        d={d}
        markerEnd={`url(#arrow-${markerKind})`}
      />
      {showSteps && steps!.map((step, i) => {
        const t = (i + 1) / (steps!.length + 1);
        const pt = bezierPoint(x1, y1, cx1, cy1, cx2, cy2, x2, y2, t);
        const hopClass = step.hop === "source" ? "source" : step.hop === "sink" ? "sink" : "propagate";
        // Offset label to the right, alternating above/below for readability
        const offsetY = i % 2 === 0 ? -12 : 14;
        const textW = step.symbol.length * 6.5 + 8;
        return (
          <g key={i} className={cn("flow-step", `flow-step--${hopClass}`)}>
            <circle cx={pt.x} cy={pt.y} r="4" />
            {/* Background pill for text readability */}
            <rect
              className="flow-step__bg"
              x={pt.x + 8}
              y={pt.y + offsetY - 8}
              width={textW}
              height={16}
              rx="3"
            />
            <text
              x={pt.x + 12}
              y={pt.y + offsetY + 3}
              className="flow-step__label"
            >
              {step.symbol}
            </text>
          </g>
        );
      })}
    </g>
  );
}
