type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconTaint({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M12 3c3.5 4 5.5 6.5 5.5 9.5a5.5 5.5 0 1 1-11 0C6.5 9.5 8.5 7 12 3z" />
    </svg>
  );
}

export function IconNoTests({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

export function IconComplexity({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" />
    </svg>
  );
}

export function IconDead({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true" strokeDasharray="2.4 2.4">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function IconFunction({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M8 20c0-4 1-8 1-12s2-4 4-4" />
      <path d="M6 12h7" />
    </svg>
  );
}

export function IconClass({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M4 10h16" />
    </svg>
  );
}

export function IconArrowOut({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M5 12h13" />
      <path d="M13 6l5 6-5 6" />
    </svg>
  );
}

export function IconArrowIn({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M19 12H6" />
      <path d="M11 6l-5 6 5 6" />
    </svg>
  );
}

export function IconChevron({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconSlash({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M16 4L8 20" />
    </svg>
  );
}

export function IconTrendUp({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M5 14l5-5 4 4 6-7" />
      <path d="M14 6h6v6" />
    </svg>
  );
}

export function IconTrendDown({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M5 10l5 5 4-4 6 7" />
      <path d="M14 18h6v-6" />
    </svg>
  );
}

export function IconTrendFlat({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <path d="M4 12h13" />
      <path d="M14 8l4 4-4 4" />
    </svg>
  );
}

export function IconClock({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconPlay({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} aria-hidden="true">
      <polygon points="7 5 19 12 7 19 7 5" />
    </svg>
  );
}

export function Sparkline({
  points,
  width = 56,
  height = 16,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
