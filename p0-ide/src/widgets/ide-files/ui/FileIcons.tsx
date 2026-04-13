import { IconChevronRight } from "@/shared/ui";

/* ── Icons ──────────────────────────────────────────────────────────── */

export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <IconChevronRight
      size={12}
      strokeWidth={1.8}
      className={`ide-files-chev${open ? " is-open" : ""}`}
    />
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  // Branded folder glyph: distinct open/closed silhouettes. The shared
  // IconFolder is a single closed variant, so this feature keeps its own
  // path data — the raw <svg> stays intentional.
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

export function FileIconPy() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <defs>
        <linearGradient id="py-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b8bbe" />
          <stop offset="100%" stopColor="#306998" />
        </linearGradient>
        <linearGradient id="py-grad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe873" />
          <stop offset="100%" stopColor="#ffd43b" />
        </linearGradient>
      </defs>
      <path d="M7.7 1.5C5.1 1.5 5.3 2.6 5.3 2.6L5.3 3.7h2.5v.3H4.1C4.1 4 3 4.1 3 6.8c0 2.8 1.5 2.7 1.5 2.7h1V8.2s-.1-1.5 1.5-1.5h2.5s1.4 0 1.4-1.4V3.1s.2-1.6-2.2-1.6zm-1.4.9a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z" fill="url(#py-grad)" />
      <path d="M8.3 14.5c2.6 0 2.4-1.1 2.4-1.1V12.3H8.2v-.3h3.7c0 0 1.1-.1 1.1-2.8 0-2.8-1.5-2.7-1.5-2.7H10.5V7.8s.1 1.5-1.5 1.5H6.5S5.1 9.3 5.1 10.7v2.2s-.2 1.6 2.2 1.6zm1.4-.9a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1z" fill="url(#py-grad2)" />
    </svg>
  );
}

export function FileIconToml() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#9b5de5" opacity="0.85" />
      <text x="2.5" y="11" fontFamily="monospace" fontSize="6.5" fontWeight="700" fill="#fff">TM</text>
    </svg>
  );
}

export function FileIconTS() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#3178c6" />
      <path d="M6.5 7.2H5v-1h4.3v1H7.8v4.6H6.5zM10 11.1c.3.2.8.4 1.3.4.5 0 .8-.2.8-.5 0-.3-.2-.5-.9-.7-.9-.3-1.4-.8-1.4-1.5 0-.9.7-1.5 1.9-1.5.5 0 .9.1 1.2.3l-.3 1c-.2-.1-.5-.2-1-.2-.5 0-.7.2-.7.4 0 .3.2.4 1 .7.9.3 1.3.8 1.3 1.5 0 .9-.7 1.6-2 1.6-.6 0-1.1-.2-1.4-.3z" fill="#fff" />
    </svg>
  );
}

export function FileIconTSX() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#3178c6" />
      <path d="M4.5 7.3H3.2v-.9h3.6v.9H5.6v4H4.5zM6.9 11.3l1.2-1.9-1.1-1.8h1.2l.6 1.1.6-1.1h1.2l-1.1 1.8 1.2 1.9H9.3l-.7-1.2-.7 1.2z" fill="#fff" />
    </svg>
  );
}

export function FileIconJSON({ color = "#fbbf24" }: { color?: string }) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5c-2 0-3 .8-3 2.5v1.2c0 .9-.5 1.3-1.5 1.3v1c1 0 1.5.4 1.5 1.3V11c0 1.7 1 2.5 3 2.5" />
      <path d="M9 2.5c2 0 3 .8 3 2.5v1.2c0 .9.5 1.3 1.5 1.3v1c-1 0-1.5.4-1.5 1.3V11c0 1.7-1 2.5-3 2.5" />
    </svg>
  );
}

export function FileIconCss() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#264de4" />
      <path d="M4.2 5.2h7.6l-.2 1.2H5.5l-.1.9h5.8l-.5 3.5-2.7.8-2.7-.8-.2-1.3h1.4l.1.6 1.4.4 1.4-.4.2-1.1H4.8z" fill="#fff" />
    </svg>
  );
}

export function FileIconMd() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1" stroke="#8e8e93" strokeWidth="1.2" />
      <path d="M3.5 11V6l1.5 2 1.5-2v5M9.5 6v5M8 9.5l1.5 1.5L11 9.5" stroke="#8e8e93" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FileIconGeneric() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z" />
      <polyline points="9 2 9 6 13 6" />
    </svg>
  );
}

export function FileIconNpm() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="0.5" fill="#cb3837" />
      <path d="M3 5h10v6h-2.5V6.5H9V11H3z" fill="#fff" />
    </svg>
  );
}

export function pickFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "package.json" || lower === "package-lock.json") return <FileIconNpm />;
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return <FileIconJSON color="#3178c6" />;
  if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg")) return <FileIconToml />;
  if (lower.endsWith(".py")) return <FileIconPy />;
  if (lower.endsWith(".tsx")) return <FileIconTSX />;
  if (lower.endsWith(".ts")) return <FileIconTS />;
  if (lower.endsWith(".jsx")) return <FileIconTSX />;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return <FileIconTS />;
  if (lower.endsWith(".json")) return <FileIconJSON />;
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FileIconCss />;
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FileIconMd />;
  return <FileIconGeneric />;
}
