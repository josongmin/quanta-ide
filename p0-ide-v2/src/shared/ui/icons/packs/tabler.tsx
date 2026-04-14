import {
  IconFolder,
  IconFolderOpen,
  IconFileTypeTs,
  IconFileTypeTsx,
  IconFileTypeJs,
  IconFileTypeJsx,
  IconFileTypeCss,
  IconFileTypeHtml,
  IconFileCode,
  IconFileDescription,
  IconFileSettings,
  IconFile,
} from "@tabler/icons-react";
import type { IconPack } from "./types";

const SIZE = 14;
const STROKE = 1.6;

export const tablerPack: IconPack = {
  id: "tabler",
  label: "Tabler",
  hint: "Geometric stroke",
  Folder: ({ open }) =>
    open ? (
      <IconFolderOpen size={SIZE} stroke={STROKE} className="ide-files-icon is-folder" />
    ) : (
      <IconFolder size={SIZE} stroke={STROKE} className="ide-files-icon is-folder" />
    ),
  pickFile: (name) => {
    const lower = name.toLowerCase();
    const common = { size: SIZE, stroke: STROKE, className: "ide-files-icon" } as const;
    if (lower.endsWith(".py")) return <IconFileCode {...common} color="#4b8bbe" />;
    if (lower.endsWith(".tsx")) return <IconFileTypeTsx {...common} color="#3178c6" />;
    if (lower.endsWith(".ts")) return <IconFileTypeTs {...common} color="#3178c6" />;
    if (lower.endsWith(".jsx")) return <IconFileTypeJsx {...common} color="#f0db4f" />;
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
      return <IconFileTypeJs {...common} color="#f0db4f" />;
    if (lower.endsWith(".css") || lower.endsWith(".scss")) return <IconFileTypeCss {...common} color="#264de4" />;
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return <IconFileTypeHtml {...common} color="#e34c26" />;
    if (lower.endsWith(".json")) return <IconFileCode {...common} color="#fbbf24" />;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <IconFileDescription {...common} color="#8e8e93" />;
    if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
      return <IconFileSettings {...common} color="#9b5de5" />;
    return <IconFile {...common} />;
  },
};
