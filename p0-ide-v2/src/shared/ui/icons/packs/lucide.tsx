import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileCog,
  File,
} from "lucide-react";
import type { IconPack } from "./types";

const STROKE = 1.6;
const SIZE = 14;

export const lucidePack: IconPack = {
  id: "lucide",
  label: "Lucide",
  hint: "Clean stroke",
  Folder: ({ open }) =>
    open ? (
      <FolderOpen size={SIZE} strokeWidth={STROKE} className="ide-files-icon is-folder" />
    ) : (
      <Folder size={SIZE} strokeWidth={STROKE} className="ide-files-icon is-folder" />
    ),
  pickFile: (name) => {
    const lower = name.toLowerCase();
    const common = { size: SIZE, strokeWidth: STROKE, className: "ide-files-icon" };
    if (lower.endsWith(".py")) return <FileCode {...common} color="#4b8bbe" />;
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return <FileCode {...common} color="#3178c6" />;
    if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
      return <FileCode {...common} color="#f0db4f" />;
    if (lower.endsWith(".json")) return <FileJson {...common} color="#fbbf24" />;
    if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FileType {...common} color="#264de4" />;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FileText {...common} color="#8e8e93" />;
    if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
      return <FileCog {...common} color="#9b5de5" />;
    return <File {...common} />;
  },
};
