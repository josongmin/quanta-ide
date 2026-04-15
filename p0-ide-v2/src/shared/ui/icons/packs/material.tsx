import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

/**
 * Material — inspired by Material Icon Theme (PKief).
 * Filled folders with accent color, solid per-language file badges.
 */

function MaterialFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="none"
    >
      {open ? (
        <>
          <path d="M1.8 4.2h4l1.3 1.3h7.1a.9.9 0 0 1 .9 1v.6H1.8z" opacity="0.85" />
          <path d="M1.8 7.4h13.4l-1.1 5.2a1.3 1.3 0 0 1-1.27 1.05H3.2a1.3 1.3 0 0 1-1.27-1.05z" />
        </>
      ) : (
        <path d="M1.8 4.5a1 1 0 0 1 1-1h3.3l1.4 1.4h6.7a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z" />
      )}
    </svg>
  );
}

function MaterialFile({ fill, tag, textColor = "#fff" }: { fill: string; tag?: string; textColor?: string }) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h5.5L13 6.2V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill={fill} />
      <path d="M8.5 2v3.7a.5.5 0 0 0 .5.5H13" fill={fill} opacity="0.55" />
      {tag && (
        <text
          x="8"
          y="11"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="4"
          fontWeight="700"
          fill={textColor}
          stroke="none"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

function MaterialFileGeneric() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h5.5L13 6.2V13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#90a4ae" />
      <path d="M8.5 2v3.7a.5.5 0 0 0 .5.5H13" fill="#90a4ae" opacity="0.55" />
    </svg>
  );
}

export const materialPack: IconPack = {
  id: "material",
  label: "Material",
  hint: "Material Icon Theme",
  supportsColor: false,
  Folder: ({ open }) => <MaterialFolder open={open} />,
  pickFile: (name) => {
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <MaterialFile fill="#3572a5" tag="py" />;
      case "tsx": return <MaterialFile fill="#007acc" tag="tsx" />;
      case "ts": return <MaterialFile fill="#007acc" tag="ts" />;
      case "jsx": return <MaterialFile fill="#f7df1e" textColor="#222" tag="jsx" />;
      case "js": return <MaterialFile fill="#f7df1e" textColor="#222" tag="js" />;
      case "css": return <MaterialFile fill="#264de4" tag="css" />;
      case "html": return <MaterialFile fill="#e34c26" tag="html" />;
      case "json": return <MaterialFile fill="#f9a825" textColor="#222" tag="{}" />;
      case "md": return <MaterialFile fill="#42a5f5" tag="md" />;
      case "ini": return <MaterialFile fill="#7e57c2" tag="cfg" />;
      case "go": return <MaterialFile fill="#00acd7" tag="go" />;
      case "rs": return <MaterialFile fill="#dea584" textColor="#222" tag="rs" />;
      case "rb": return <MaterialFile fill="#cc342d" tag="rb" />;
      case "java": return <MaterialFile fill="#ea2d2e" tag="java" />;
      case "yml": return <MaterialFile fill="#cb171e" tag="yml" />;
      case "sh": return <MaterialFile fill="#4caf50" tag="sh" />;
      case "dockerfile": return <MaterialFile fill="#2496ed" tag="dkr" />;
      default: return <MaterialFileGeneric />;
    }
  },
};
