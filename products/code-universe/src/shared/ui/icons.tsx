import type { CSSProperties, ReactElement, ReactNode } from "react";

// Inline SVG icon set — kept tiny, currentColor-driven, and free of
// any icon-font dependency so the product can be dropped into any
// host without shipping another font file. 16-px canvas, 1.5-px
// stroke matches Linear/Arc feel; widget callers override `size` per
// surface (24 for activity rail, 12 for inline pills).

interface IconProps {
  size?: number;
  style?: CSSProperties;
  strokeWidth?: number;
  className?: string;
}

function Svg({
  size = 16,
  strokeWidth = 1.5,
  style,
  className,
  children,
}: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconExplorer(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M2 4.5a1.5 1.5 0 0 1 1.5-1.5H6l1.5 1.5h5A1.5 1.5 0 0 1 14 6v5.5A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5z" />
    </Svg>
  );
}

export function IconSearch(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M13.5 13.5l-3.2-3.2" />
    </Svg>
  );
}

export function IconPin(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M8 1.5l1.8 3.2 3.6.5-2.6 2.5.6 3.5L8 9.7l-3.4 1.5.6-3.5L2.6 5.2l3.6-.5z" />
    </Svg>
  );
}

export function IconLens(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M2.5 3.5h11l-4.2 5.2v3.8l-2.6-1.3V8.7z" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M6 3.5l4.5 4.5L6 12.5" />
    </Svg>
  );
}

export function IconChevronDown(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M3.5 6L8 10.5 12.5 6" />
    </Svg>
  );
}

export function IconSidebarLeft(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6 3v10" />
    </Svg>
  );
}

export function IconSidebarRight(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M10 3v10" />
    </Svg>
  );
}

export function IconClose(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </Svg>
  );
}

export function IconTarget(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2" />
    </Svg>
  );
}

export function IconArrowIn(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M3 8h7M7 5l3 3-3 3M13 3v10" />
    </Svg>
  );
}

export function IconArrowOut(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M6 8h7M10 5l3 3-3 3M3 3v10" />
    </Svg>
  );
}

export function IconChevronLeft(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M10 12.5L5.5 8L10 3.5" />
    </Svg>
  );
}

export function IconFolder(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function IconFolderOpen(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M2 4.5a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V7H2z" />
      <path d="M2 7h12l-1.5 5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function IconFile(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M4 2h5l3 3v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M9 2v3h3" />
    </Svg>
  );
}

export function IconBraces(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M6 2.5H5a1.5 1.5 0 0 0-1.5 1.5v2.5a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1 1.5 1.5V12A1.5 1.5 0 0 0 5 13.5h1" />
      <path d="M10 2.5h1A1.5 1.5 0 0 1 12.5 4v2.5A1.5 1.5 0 0 0 14 8a1.5 1.5 0 0 0-1.5 1.5V12A1.5 1.5 0 0 1 11 13.5h-1" />
    </Svg>
  );
}

export function IconFunction(p: IconProps): ReactElement {
  return (
    <Svg {...p}>
      <path d="M10.5 3.5h-1a1.5 1.5 0 0 0-1.5 1.5L6.5 12.5A1.5 1.5 0 0 1 5 14H4" />
      <path d="M4 8h7" />
    </Svg>
  );
}
