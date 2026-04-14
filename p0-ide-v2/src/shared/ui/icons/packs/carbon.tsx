import type { IconPack } from "./types";

/**
 * Carbon — inspired by IBM Carbon Design System icons.
 * Geometric, sharp corners, thin uniform stroke.
 */

function CarbonFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="miter"
      strokeLinecap="square"
    >
      {open ? (
        <>
          <path d="M2 4.5h4l1.5 1.5H14V13H2z" />
          <path d="M2 6.5h12" />
        </>
      ) : (
        <>
          <path d="M2 4h4l1.5 1.5H14V13H2z" />
          <path d="M2 6h12" />
        </>
      )}
    </svg>
  );
}

function CarbonFile({ tag, accent }: { tag?: string; accent?: string }) {
  return (
    <svg
      className="ide-files-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="miter"
      strokeLinecap="square"
    >
      <path d="M3 2h5.5L13 6v8H3z" />
      <path d="M8.5 2v4H13" />
      {accent && <rect x="3.5" y="11" width="9" height="1.5" fill={accent} stroke="none" />}
      {tag && (
        <text
          x="8"
          y="10.5"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="3.8"
          fontWeight="600"
          stroke="none"
          fill="currentColor"
          letterSpacing="-0.04em"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const carbonPack: IconPack = {
  id: "carbon",
  label: "Carbon",
  hint: "IBM geometric lines",
  Folder: ({ open }) => <CarbonFolder open={open} />,
  pickFile: (name) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".py")) return <CarbonFile tag="py" accent="#4b8bbe" />;
    if (lower.endsWith(".tsx")) return <CarbonFile tag="tsx" accent="#3178c6" />;
    if (lower.endsWith(".ts")) return <CarbonFile tag="ts" accent="#3178c6" />;
    if (lower.endsWith(".jsx")) return <CarbonFile tag="jsx" accent="#f0db4f" />;
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
      return <CarbonFile tag="js" accent="#f0db4f" />;
    if (lower.endsWith(".css") || lower.endsWith(".scss")) return <CarbonFile tag="css" accent="#264de4" />;
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return <CarbonFile tag="html" accent="#e34c26" />;
    if (lower.endsWith(".json")) return <CarbonFile tag="{}" accent="#fbbf24" />;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <CarbonFile tag="md" accent="#8e8e93" />;
    if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
      return <CarbonFile tag="ini" accent="#9b5de5" />;
    return <CarbonFile />;
  },
};
