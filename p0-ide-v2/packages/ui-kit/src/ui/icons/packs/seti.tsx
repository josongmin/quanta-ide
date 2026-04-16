import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

/**
 * Seti — inspired by Seti UI icon theme.
 * Monochrome geometric shapes with compact ext tags. currentColor-driven.
 */

function SetiFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="none"
    >
      {open ? (
        <>
          <path d="M2 4.5h3.8l1.3 1.3H14v1.1H2z" opacity="0.65" />
          <path d="M2 7.2h12l-1 5.2a.8.8 0 0 1-.78.6H3.78A.8.8 0 0 1 3 12.4z" opacity="0.9" />
        </>
      ) : (
        <path d="M2 4.7a.9.9 0 0 1 .9-.9h3l1.3 1.3h6a.9.9 0 0 1 .9.9v6a.9.9 0 0 1-.9.9H2.9a.9.9 0 0 1-.9-.9z" opacity="0.9" />
      )}
    </svg>
  );
}

function SetiFile({ tag }: { tag?: string }) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.2 2.5h5L12.6 6v7a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M3.2 2.5h5L12.6 6v7a.8.8 0 0 1-.8.8H4a.8.8 0 0 1-.8-.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path d="M8.2 2.5V6h4.4" stroke="currentColor" strokeWidth="1" fill="none" />
      {tag && (
        <text
          x="8"
          y="11.3"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="3.6"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
          letterSpacing="-0.03em"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const setiPack: IconPack = {
  id: "seti",
  label: "Seti",
  hint: "Seti UI minimal",
  supportsColor: true,
  Folder: ({ open }) => <SetiFolder open={open} />,
  pickFile: (name) => {
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <SetiFile tag="py" />;
      case "tsx": return <SetiFile tag="tsx" />;
      case "ts": return <SetiFile tag="ts" />;
      case "jsx": return <SetiFile tag="jsx" />;
      case "js": return <SetiFile tag="js" />;
      case "css": return <SetiFile tag="css" />;
      case "html": return <SetiFile tag="htm" />;
      case "json": return <SetiFile tag="{}" />;
      case "md": return <SetiFile tag="md" />;
      case "ini": return <SetiFile tag="ini" />;
      case "go": return <SetiFile tag="go" />;
      case "rs": return <SetiFile tag="rs" />;
      case "rb": return <SetiFile tag="rb" />;
      case "yml": return <SetiFile tag="yml" />;
      case "sh": return <SetiFile tag="sh" />;
      default: return <SetiFile />;
    }
  },
};
