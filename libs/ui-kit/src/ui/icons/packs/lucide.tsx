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
import { detectFileType } from "../file-type";

const STROKE = 1.6;
const SIZE = 14;

export const lucidePack: IconPack = {
  id: "lucide",
  label: "Lucide",
  hint: "Clean stroke",
  supportsColor: false,
  Folder: ({ open }) =>
    open ? (
      <FolderOpen size={SIZE} strokeWidth={STROKE} className="ide-files-icon is-folder" />
    ) : (
      <Folder size={SIZE} strokeWidth={STROKE} className="ide-files-icon is-folder" />
    ),
  pickFile: (name) => {
    const common = { size: SIZE, strokeWidth: STROKE, className: "ide-files-icon" };
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <FileCode {...common} color="#4b8bbe" />;
      case "ts":
      case "tsx": return <FileCode {...common} color="#3178c6" />;
      case "js":
      case "jsx": return <FileCode {...common} color="#f0db4f" />;
      case "json": return <FileJson {...common} color="#fbbf24" />;
      case "css": return <FileType {...common} color="#264de4" />;
      case "md": return <FileText {...common} color="#8e8e93" />;
      case "ini": return <FileCog {...common} color="#9b5de5" />;
      default: return <File {...common} />;
    }
  },
};
