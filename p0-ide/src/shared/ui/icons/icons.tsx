/* Icon registry. react-refresh HMR optimization only applies to files that
 * export nothing but components; this barrel exports 29 icons plus a Dot
 * primitive and is intentionally co-located. */
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode as _IconRN } from "react";
import { createIcon } from "./Icon";

export const IconClose = createIcon(
  "IconClose",
  <>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </>,
);

export const IconChevronDown = createIcon("IconChevronDown", <polyline points="6 9 12 15 18 9" />);
export const IconChevronUp = createIcon("IconChevronUp", <polyline points="18 15 12 9 6 15" />);
export const IconChevronLeft = createIcon("IconChevronLeft", <polyline points="15 6 9 12 15 18" />);
export const IconChevronRight = createIcon("IconChevronRight", <polyline points="9 6 15 12 9 18" />);

export const IconArrowUp = createIcon(
  "IconArrowUp",
  <>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </>,
);
export const IconArrowDown = createIcon(
  "IconArrowDown",
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </>,
);
export const IconArrowLeft = createIcon(
  "IconArrowLeft",
  <>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </>,
);
export const IconArrowRight = createIcon(
  "IconArrowRight",
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>,
);

export const IconPlus = createIcon(
  "IconPlus",
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);
export const IconMinus = createIcon("IconMinus", <line x1="5" y1="12" x2="19" y2="12" />);

export const IconCheck = createIcon("IconCheck", <polyline points="20 6 9 17 4 12" />);

// Send: arrow-up style to match existing agent icon
export const IconSend = createIcon(
  "IconSend",
  <>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </>,
);

export const IconSearch = createIcon(
  "IconSearch",
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>,
);

export const IconSettings = createIcon(
  "IconSettings",
  <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const IconInfo = createIcon(
  "IconInfo",
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </>,
);

export const IconWarning = createIcon(
  "IconWarning",
  <>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
);

export const IconError = createIcon(
  "IconError",
  <>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
);

export const IconMore = createIcon(
  "IconMore",
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
);

export const IconExternal = createIcon(
  "IconExternal",
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>,
);

export const IconFile = createIcon(
  "IconFile",
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </>,
);

export const IconFolder = createIcon(
  "IconFolder",
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
);

export const IconBranch = createIcon(
  "IconBranch",
  <>
    <circle cx="4" cy="3.5" r="1.5" />
    <circle cx="4" cy="12.5" r="1.5" />
    <circle cx="12" cy="3.5" r="1.5" />
    <path d="M4 5v5.5" />
    <path d="M12 5c0 3.5-8 3.5-8 7" />
  </>,
);

export const IconRepo = createIcon(
  "IconRepo",
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="9" x2="9" y2="21" />
  </>,
);

export const IconExpandAll = createIcon(
  "IconExpandAll",
  <>
    <polyline points="7 4 3 4 3 20 7 20" />
    <polyline points="17 4 21 4 21 20 17 20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </>,
);

export const IconCollapseAll = createIcon(
  "IconCollapseAll",
  <>
    <polyline points="9 6 3 12 9 18" />
    <polyline points="15 6 21 12 15 18" />
  </>,
);

export const IconGrid2x2 = createIcon(
  "IconGrid2x2",
  <>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>,
);

export const IconGlobe = createIcon(
  "IconGlobe",
  <>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="9" x2="22" y2="9" />
  </>,
);

export const IconBolt = createIcon(
  "IconBolt",
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
);

export const IconClock = createIcon(
  "IconClock",
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>,
);

/* ── Topbar action icons ─────────────────────────────────────────────── */

export const IconGitCommit = createIcon(
  "IconGitCommit",
  <>
    <circle cx="12" cy="12" r="3" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </>,
);

export const IconMessageSquare = createIcon(
  "IconMessageSquare",
  <path d="M12 21a9 9 0 1 0-7.88-4.64L2 22l5.64-2.12A8.96 8.96 0 0 0 12 21z" />,
);

export const IconBell = createIcon(
  "IconBell",
  <>
    <path d="M12 2a7 7 0 0 0-7 7c0 3.53-1.33 5.72-2.26 7-.4.53.02 1 .56 1h17.4c.54 0 .96-.47.56-1C20.33 14.72 19 12.53 19 9a7 7 0 0 0-7-7z" />
    <path d="M10 21h4" />
  </>,
);

export const IconInbox = createIcon(
  "IconInbox",
  <>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
);

export const IconDiffStat = createIcon(
  "IconDiffStat",
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="12" y1="9" x2="12" y2="15" />
  </>,
);

export const IconPlay = createIcon("IconPlay", <polygon points="6 3 20 12 6 21 6 3" />);
export const IconPause = createIcon(
  "IconPause",
  <>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </>,
);

interface DotProps {
  size?: number;
  className?: string;
  "aria-label"?: string;
}

export function IconDot({ size = 5, className, "aria-label": ariaLabel }: DotProps) {
  return (
    <span
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--color-accent-fg)",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

/* ── File type icon — minimal line-art per language (16×16 grid) ──────── */

/* viewBox 0 0 16 16, stroke-based, optimized for 14–16px rendering */
const EXT_ICON: Partial<Record<string, { color: string; paths: _IconRN }>> = {
  /* Python — S-curve snake */
  py: { color: "#3572A5", paths: (
    <>
      <path d="M8 1C5.5 1 4 2.5 4 4.5V7h4.5v1H4C2 8 1 9.5 1 11.5S2.5 15 4.5 15H6v-2c0-1.5 1-2.5 2.5-2.5H11c1 0 2-.8 2-2V4.5C13 2.5 11 1 8 1z" />
      <path d="M8 15c2.5 0 4-1.5 4-3.5V9H7.5V8H12c2 0 3-1.5 3-3.5S13.5 1 11.5 1H10v2c0 1.5-1 2.5-2.5 2.5H5c-1 0-2 .8-2 2v4c0 2 2 3.5 5 3.5z" />
      <circle cx="6" cy="4" r=".8" fill="#3572A5" stroke="none" />
      <circle cx="10" cy="12" r=".8" fill="#3572A5" stroke="none" />
    </>
  )},
  /* TypeScript — T */
  ts: { color: "#3178C6", paths: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <line x1="4" y1="6" x2="12" y2="6" />
      <line x1="8" y1="6" x2="8" y2="13" />
    </>
  )},
  tsx: { color: "#3178C6", paths: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <line x1="4" y1="6" x2="12" y2="6" />
      <line x1="8" y1="6" x2="8" y2="13" />
    </>
  )},
  /* JavaScript — J */
  js: { color: "#EAB308", paths: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <path d="M9 5v6c0 1.5-1.5 2-2.5 1.5" />
    </>
  )},
  jsx: { color: "#EAB308", paths: (
    <>
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <path d="M9 5v6c0 1.5-1.5 2-2.5 1.5" />
    </>
  )},
  /* Go — G */
  go: { color: "#00ADD8", paths: (
    <path d="M12 5.5C10.5 3 6 3 4.5 5.5S4 11 6 13s5.5 1 6-1.5H9" />
  )},
  /* Rust — R */
  rs: { color: "#DEA584", paths: (
    <>
      <line x1="5" y1="3" x2="5" y2="13" />
      <path d="M5 3h4c2 0 2.5 2 1 3.5C12 7 11.5 9 9 9H5" />
      <line x1="9" y1="9" x2="12" y2="13" />
    </>
  )},
  /* Java — coffee cup */
  java: { color: "#B07219", paths: (
    <>
      <path d="M4 4h8v6c0 2-1.5 3.5-4 3.5S4 12 4 10z" />
      <path d="M12 6c1.5 0 2 .8 2 2s-.5 2-2 2" />
      <path d="M6 2c0-.5.5-1 1-1M8 2c0-.5.5-1 1-1" />
    </>
  )},
  /* Ruby — diamond */
  rb: { color: "#CC342D", paths: (
    <polygon points="8,2 14,6 11,14 5,14 2,6" />
  )},
  /* CSS — { } */
  css: { color: "#563D7C", paths: (
    <>
      <path d="M5 2C3.5 2 3 3 3 4v2.5C3 7.5 2 8 1 8c1 0 2 .5 2 1.5V12c0 1 .5 2 2 2" />
      <path d="M11 2c1.5 0 2 1 2 2v2.5c0 1 1 1.5 2 1.5-1 0-2 .5-2 1.5V12c0 1-.5 2-2 2" />
    </>
  )},
  /* HTML — </>  */
  html: { color: "#E34C26", paths: (
    <>
      <polyline points="4.5 4 1.5 8 4.5 12" />
      <polyline points="11.5 4 14.5 8 11.5 12" />
      <line x1="10" y1="2" x2="6" y2="14" />
    </>
  )},
  /* JSON — { } */
  json: { color: "#6B7280", paths: (
    <>
      <path d="M5 2C3.5 2 3 3 3 4v2.5C3 7.5 2 8 1 8c1 0 2 .5 2 1.5V12c0 1 .5 2 2 2" />
      <path d="M11 2c1.5 0 2 1 2 2v2.5c0 1 1 1.5 2 1.5-1 0-2 .5-2 1.5V12c0 1-.5 2-2 2" />
    </>
  )},
  /* Markdown — M */
  md: { color: "#6B7280", paths: (
    <>
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <polyline points="4 10 4 6 6 9 8 6 8 10" />
      <polyline points="11 8.5 12.5 10 12.5 6" />
    </>
  )},
  /* YAML — indented lines */
  yml: { color: "#CB171E", paths: (
    <>
      <circle cx="3" cy="4" r=".8" fill="#CB171E" stroke="none" />
      <line x1="5" y1="4" x2="10" y2="4" />
      <circle cx="5" cy="8" r=".8" fill="#CB171E" stroke="none" />
      <line x1="7" y1="8" x2="13" y2="8" />
      <circle cx="5" cy="12" r=".8" fill="#CB171E" stroke="none" />
      <line x1="7" y1="12" x2="11" y2="12" />
    </>
  )},
  yaml: { color: "#CB171E", paths: (
    <>
      <circle cx="3" cy="4" r=".8" fill="#CB171E" stroke="none" />
      <line x1="5" y1="4" x2="10" y2="4" />
      <circle cx="5" cy="8" r=".8" fill="#CB171E" stroke="none" />
      <line x1="7" y1="8" x2="13" y2="8" />
      <circle cx="5" cy="12" r=".8" fill="#CB171E" stroke="none" />
      <line x1="7" y1="12" x2="11" y2="12" />
    </>
  )},
  /* Shell — >_ prompt */
  sh: { color: "#89E051", paths: (
    <>
      <polyline points="2 11 6 8 2 5" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </>
  )},
  /* SQL — db cylinder */
  sql: { color: "#E38C00", paths: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" />
      <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  )},
  /* C */
  c: { color: "#555555", paths: (
    <path d="M12 4.5C10.5 3 7 3 5 5.5S4 11 6 13s5 1.5 6-.5" />
  )},
  /* C++ */
  cpp: { color: "#F34B7D", paths: (
    <>
      <path d="M10 4C8.5 2.5 5.5 3 4 5s-1 5 1 6.5 4.5 1 6-.5" />
      <line x1="13" y1="6.5" x2="13" y2="10.5" />
      <line x1="11" y1="8.5" x2="15" y2="8.5" />
    </>
  )},
  /* H */
  h: { color: "#555555", paths: (
    <>
      <line x1="5" y1="3" x2="5" y2="13" />
      <line x1="11" y1="3" x2="11" y2="13" />
      <line x1="5" y1="8" x2="11" y2="8" />
    </>
  )},
  /* TOML — config doc */
  toml: { color: "#9C4121", paths: (
    <>
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <line x1="5" y1="5" x2="11" y2="5" />
      <line x1="5" y1="8" x2="10" y2="8" />
      <line x1="5" y1="11" x2="8" y2="11" />
    </>
  )},
  /* Config — gear */
  cfg: { color: "#6B7280", paths: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
    </>
  )},
  ini: { color: "#6B7280", paths: (
    <>
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
    </>
  )},
  /* Env — key */
  env: { color: "#EAB308", paths: (
    <>
      <circle cx="5" cy="10" r="3.5" />
      <line x1="7.5" y1="7.5" x2="14" y2="1" />
      <polyline points="11 1 14 1 14 4" />
    </>
  )},
  /* XML — tags */
  xml: { color: "#E44D26", paths: (
    <>
      <polyline points="4.5 4 1.5 8 4.5 12" />
      <polyline points="11.5 4 14.5 8 11.5 12" />
      <line x1="10" y1="2" x2="6" y2="14" />
    </>
  )},
  /* SVG — triangle/bezier */
  svg: { color: "#FFB13B", paths: (
    <>
      <polygon points="8,2 2,13 14,13" />
    </>
  )},
  /* Lock — padlock */
  lock: { color: "#6B7280", paths: (
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </>
  )},
};

interface FileTypeIconProps {
  filename: string;
  size?: number;
}

export function FileTypeIcon({ filename, size = 14 }: FileTypeIconProps) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const info = EXT_ICON[ext];

  if (!info) {
    return <IconFile size={size} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={info.color}
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {info.paths}
    </svg>
  );
}

