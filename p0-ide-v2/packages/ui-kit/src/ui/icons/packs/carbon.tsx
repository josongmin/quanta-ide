import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

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
  supportsColor: true,
  Folder: ({ open }) => <CarbonFolder open={open} />,
  pickFile: (name) => {
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <CarbonFile tag="py" accent="#4b8bbe" />;
      case "tsx": return <CarbonFile tag="tsx" accent="#3178c6" />;
      case "ts": return <CarbonFile tag="ts" accent="#3178c6" />;
      case "jsx": return <CarbonFile tag="jsx" accent="#f0db4f" />;
      case "js": return <CarbonFile tag="js" accent="#f0db4f" />;
      case "css": return <CarbonFile tag="css" accent="#264de4" />;
      case "html": return <CarbonFile tag="html" accent="#e34c26" />;
      case "json": return <CarbonFile tag="{}" accent="#fbbf24" />;
      case "md": return <CarbonFile tag="md" accent="#8e8e93" />;
      case "ini": return <CarbonFile tag="ini" accent="#9b5de5" />;
      default: return <CarbonFile />;
    }
  },
};
