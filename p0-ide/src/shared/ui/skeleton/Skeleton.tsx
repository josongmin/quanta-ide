import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  shape?: "rect" | "circle" | "text";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Skeleton({
  width,
  height,
  shape = "rect",
  className,
  style,
  "aria-label": ariaLabel = "Loading",
}: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`skeleton skeleton--${shape} ${className ?? ""}`}
      style={{ width, height, ...style }}
    />
  );
}
