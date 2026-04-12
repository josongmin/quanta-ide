/* Icon registry. react-refresh HMR optimization only applies to files that
 * export nothing but components; this barrel exports 29 icons plus a Dot
 * primitive and is intentionally co-located. */
/* eslint-disable react-refresh/only-export-components */
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
  <>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
  </>,
);

export const IconBell = createIcon(
  "IconBell",
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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

/* ── File type icon — extension-based colored label ────────────────────── */

const EXT_MAP: Record<string, { label: string; color: string }> = {
  py:   { label: "PY",  color: "#3572A5" },
  ts:   { label: "TS",  color: "#3178C6" },
  tsx:  { label: "TX",  color: "#3178C6" },
  js:   { label: "JS",  color: "#F7DF1E" },
  jsx:  { label: "JX",  color: "#F7DF1E" },
  go:   { label: "GO",  color: "#00ADD8" },
  rs:   { label: "RS",  color: "#DEA584" },
  java: { label: "JV",  color: "#B07219" },
  rb:   { label: "RB",  color: "#CC342D" },
  css:  { label: "CS",  color: "#563D7C" },
  html: { label: "HT",  color: "#E34C26" },
  json: { label: "{}",  color: "#6B7280" },
  md:   { label: "MD",  color: "#6B7280" },
  yml:  { label: "YM",  color: "#CB171E" },
  yaml: { label: "YM",  color: "#CB171E" },
  sh:   { label: "SH",  color: "#89E051" },
  sql:  { label: "SQ",  color: "#E38C00" },
  c:    { label: "C",   color: "#555555" },
  cpp:  { label: "C+",  color: "#F34B7D" },
  h:    { label: "H",   color: "#555555" },
};

interface FileTypeIconProps {
  filename: string;
  size?: number;
}

export function FileTypeIcon({ filename, size = 14 }: FileTypeIconProps) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const info = EXT_MAP[ext];

  if (!info) {
    return <IconFile size={size} />;
  }

  const fontSize = size * 0.55;
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 2,
        background: info.color,
        color: "#fff",
        fontSize,
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "-0.03em",
        flexShrink: 0,
      }}
    >
      {info.label}
    </span>
  );
}

