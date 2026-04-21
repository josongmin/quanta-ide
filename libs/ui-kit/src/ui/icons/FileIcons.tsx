import type { CSSProperties, ReactNode } from "react";

import { detectFileType } from "./file-type";

// Shared prop shape so every FileIcon* wrapper forwards width/height/style
// all the way down to its <svg>. Without this, cloneElement(raw, { width:
// 13 }) in call sites hit the wrapper component — not the SVG — and was
// silently discarded, leaving the icon at default SVG size (which, in the
// absence of the .ide-files-icon CSS from the p0-ide package, collapses
// to nothing in a flex container).
export interface FileIconProps {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`ide-files-chev${open ? " is-open" : ""}`}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="ide-files-icon is-folder" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 7l-.7 4.5A1.5 1.5 0 0 1 11.8 13H3.2a1.5 1.5 0 0 1-1.5-1.3z" />
      ) : (
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
      )}
    </svg>
  );
}

// Flat document shell shared by every tagged file icon.
// Outline-only so the silhouette reads as "page" first, language second —
// keeps the icon calm on top of the mind-map's tinted kind backdrop.
function DocShell({ stroke, children, width = 16, height = 16, style }: { stroke: string; children?: ReactNode } & FileIconProps) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" width={width} height={height} style={style}>
      <path
        d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z"
        fill="#ffffff"
        stroke={stroke}
        strokeOpacity="0.75"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <polyline
        points="9 2 9 6 13 6"
        stroke={stroke}
        strokeOpacity="0.75"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill="none"
      />
      {children}
    </svg>
  );
}

function DocTag({ text, fill, size = 4.2 }: { text: string; fill: string; size?: number }) {
  return (
    <text
      x="8"
      y="11.7"
      textAnchor="middle"
      fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
      fontSize={size}
      fontWeight="700"
      fill={fill}
      letterSpacing="-0.02em"
    >
      {text}
    </text>
  );
}

function FileIconPy(p: FileIconProps) {
  return (
    <DocShell stroke="#3b7daa" {...p}>
      <DocTag text="PY" fill="#3b7daa" size={4.5} />
    </DocShell>
  );
}

function FileIconToml(p: FileIconProps) {
  return (
    <DocShell stroke="#9b5de5" {...p}>
      <DocTag text="TOML" fill="#9b5de5" size={3.6} />
    </DocShell>
  );
}

function FileIconTS(p: FileIconProps) {
  return (
    <DocShell stroke="#3178c6" {...p}>
      <DocTag text="TS" fill="#3178c6" size={4.5} />
    </DocShell>
  );
}

function FileIconTSX(p: FileIconProps) {
  return (
    <DocShell stroke="#3178c6" {...p}>
      <DocTag text="TSX" fill="#3178c6" size={3.9} />
    </DocShell>
  );
}

function FileIconJSON({ color = "#d97706", ...p }: { color?: string } & FileIconProps) {
  return (
    <DocShell stroke={color} {...p}>
      <DocTag text="{ }" fill={color} size={4.6} />
    </DocShell>
  );
}

function FileIconCss(p: FileIconProps) {
  return (
    <DocShell stroke="#2563eb" {...p}>
      <DocTag text="CSS" fill="#2563eb" size={4.0} />
    </DocShell>
  );
}

function FileIconMd(p: FileIconProps) {
  return (
    <DocShell stroke="#8e8e93" {...p}>
      <DocTag text="MD" fill="#8e8e93" size={4.5} />
    </DocShell>
  );
}

function FileIconNpm(p: FileIconProps) {
  return (
    <DocShell stroke="#cb3837" {...p}>
      <DocTag text="npm" fill="#cb3837" size={4.0} />
    </DocShell>
  );
}

function FileIconGeneric(p: FileIconProps) {
  return (
    <DocShell stroke="currentColor" {...p} />
  );
}

export function pickFileIcon(name: string) {
  const lower = name.toLowerCase();
  // Filename-level specials must win over the extension-based classifier.
  if (lower === "package.json" || lower === "package-lock.json") return <FileIconNpm />;
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return <FileIconJSON color="#3178c6" />;
  const kind = detectFileType(name);
  switch (kind) {
    case "ini": return <FileIconToml />;
    case "py": return <FileIconPy />;
    case "tsx":
    case "jsx": return <FileIconTSX />;
    case "ts":
    case "js": return <FileIconTS />;
    case "json": return <FileIconJSON />;
    case "css": return <FileIconCss />;
    case "md": return <FileIconMd />;
    default: return <FileIconGeneric />;
  }
}
