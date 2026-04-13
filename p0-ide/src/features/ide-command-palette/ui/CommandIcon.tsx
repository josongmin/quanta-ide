import type { ReactNode } from "react";
import type { Command } from "../model/commands";

interface CommandIconProps {
  kind: Command["icon"];
}

const SVG_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const COMMAND_ICONS: Record<NonNullable<Command["icon"]>, ReactNode> = {
  spark: (
    <svg {...SVG_PROPS}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
  search: (
    <svg {...SVG_PROPS}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  fix: (
    <svg {...SVG_PROPS}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z" />
    </svg>
  ),
  flow: (
    <svg {...SVG_PROPS}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 6h10M5 8v4l5 4M19 8v4l-5 4" />
    </svg>
  ),
  graph: (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v3M10.5 11l-4 6M13.5 11l4 6" />
    </svg>
  ),
  time: (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  ),
  file: (
    <svg {...SVG_PROPS}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="14 3 14 9 20 9" />
    </svg>
  ),
  play: (
    <svg {...SVG_PROPS}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  ),
};

export function CommandIcon({ kind }: CommandIconProps): ReactNode {
  if (kind === undefined) return null;
  return COMMAND_ICONS[kind] ?? null;
}
