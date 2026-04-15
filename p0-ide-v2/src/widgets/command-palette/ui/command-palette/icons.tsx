import type { FeatureCategory } from "@/shared/model/feature-registry";

const SVG_BASE = {
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...SVG_BASE}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function CategoryIcon({
  category,
  size = 14,
}: {
  category: FeatureCategory;
  size?: number;
}) {
  const base = { width: size, height: size, viewBox: "0 0 24 24", ...SVG_BASE };
  switch (category) {
    case "intelligence":
      return (
        <svg {...base}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "editing":
      return (
        <svg {...base}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "rules":
      return (
        <svg {...base}>
          <path d="M12 3v18M5 8l7-5 7 5M5 8l3 9h8l3-9" />
        </svg>
      );
    case "integration":
      return (
        <svg {...base}>
          <path d="M9 2v6M15 2v6M7 8h10v6a5 5 0 0 1-5 5 5 5 0 0 1-5-5z" />
          <path d="M12 19v3" />
        </svg>
      );
    case "workflow":
      return (
        <svg {...base}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
  }
}
