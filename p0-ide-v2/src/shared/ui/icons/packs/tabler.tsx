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
import { detectFileType } from "../file-type";

const SIZE = 14;
const STROKE = 1.6;

export const tablerPack: IconPack = {
  id: "tabler",
  label: "Tabler",
  hint: "Geometric stroke",
  supportsColor: false,
  Folder: ({ open }) =>
    open ? (
      <IconFolderOpen size={SIZE} stroke={STROKE} className="ide-files-icon is-folder" />
    ) : (
      <IconFolder size={SIZE} stroke={STROKE} className="ide-files-icon is-folder" />
    ),
  pickFile: (name) => {
    const common = { size: SIZE, stroke: STROKE, className: "ide-files-icon" } as const;
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <IconFileCode {...common} color="#4b8bbe" />;
      case "tsx": return <IconFileTypeTsx {...common} color="#3178c6" />;
      case "ts": return <IconFileTypeTs {...common} color="#3178c6" />;
      case "jsx": return <IconFileTypeJsx {...common} color="#f0db4f" />;
      case "js": return <IconFileTypeJs {...common} color="#f0db4f" />;
      case "css": return <IconFileTypeCss {...common} color="#264de4" />;
      case "html": return <IconFileTypeHtml {...common} color="#e34c26" />;
      case "json": return <IconFileCode {...common} color="#fbbf24" />;
      case "md": return <IconFileDescription {...common} color="#8e8e93" />;
      case "ini": return <IconFileSettings {...common} color="#9b5de5" />;
      default: return <IconFile {...common} />;
    }
  },
};
