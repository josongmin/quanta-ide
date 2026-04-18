import { useId, useMemo } from "react";

interface AreaChartProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  gradientId?: string;
  gridLines?: readonly number[];
}

const DEFAULT_GRID_LINES = [0.25, 0.5, 0.75] as const;

export function AreaChart({
  values,
  width = 760,
  height = 120,
  color = "var(--fg)",
  gradientId,
  gridLines = DEFAULT_GRID_LINES,
}: AreaChartProps) {
  const autoId = useId();
  const gradId = gradientId ?? `demo-area-${autoId}`;

  const path = useMemo(() => {
    if (values.length === 0) return "";
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    return values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - v * (height - 8) - 4).toFixed(1)}`,
      )
      .join(" ");
  }, [values, width, height]);

  const fill = useMemo(() => `${path} L${width},${height} L0,${height} Z`, [path, width, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((p) => (
        <line
          key={p}
          x1={0}
          x2={width}
          y1={height * p}
          y2={height * p}
          stroke="var(--border)"
          strokeDasharray="2 4"
          strokeWidth={0.5}
        />
      ))}
      <path d={fill} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
