import { useMemo } from "react";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({
  values,
  width = 220,
  height = 48,
  color = "var(--fg)",
  strokeWidth = 1.6,
}: SparklineProps) {
  const path = useMemo(() => {
    if (values.length === 0) return "";
    const step = values.length > 1 ? width / (values.length - 1) : 0;
    return values
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - v * (height - 4) - 2).toFixed(1)}`,
      )
      .join(" ");
  }, [values, width, height]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  );
}
