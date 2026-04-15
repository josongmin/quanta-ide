import type { ReactNode } from "react";
import type { FeatureCategory } from "@/shared/model/feature-registry";

export function CategoryIcon({ category }: { category: FeatureCategory }): ReactNode {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (category) {
    case "workflow":
      return (
        <svg {...common}>
          <path d="M2 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "intelligence":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "editing":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case "integration":
      return (
        <svg {...common}>
          <path d="M9 2v6" />
          <path d="M15 2v6" />
          <path d="M7 8h10v4a5 5 0 0 1-10 0z" />
          <path d="M12 17v5" />
        </svg>
      );
    case "rules":
      return (
        <svg {...common}>
          <path d="M12 3v18" />
          <path d="M5 8h14" />
          <path d="M5 8 2 14a4 4 0 0 0 6 0z" />
          <path d="M19 8l-3 6a4 4 0 0 0 6 0z" />
          <path d="M8 21h8" />
        </svg>
      );
  }
}
