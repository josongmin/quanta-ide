import {
  Folder,
  FolderOpen,
  FileCode,
  FileJs,
  FileJsx,
  FileTs,
  FileTsx,
  FilePy,
  FileCss,
  FileHtml,
  FileMd,
  FileIni,
  FileText,
  File,
} from "@phosphor-icons/react";
import type { IconPack } from "./types";
import type { IconWeight } from "@phosphor-icons/react";
import { detectFileType } from "../file-type";

const SIZE = 14;

function buildPack(
  id: "phosphor" | "phosphor-duotone" | "phosphor-bold" | "phosphor-fill",
  weight: IconWeight,
  label: string,
  hint: string,
): IconPack {
  return {
    id,
    label,
    hint,
    supportsColor: false,
    Folder: ({ open }) =>
      open ? (
        <FolderOpen size={SIZE} weight={weight} className="ide-files-icon is-folder" />
      ) : (
        <Folder size={SIZE} weight={weight} className="ide-files-icon is-folder" />
      ),
    pickFile: (name) => {
      const common = { size: SIZE, weight, className: "ide-files-icon" } as const;
      const kind = detectFileType(name);
      switch (kind) {
        case "py": return <FilePy {...common} color="#4b8bbe" />;
        case "tsx": return <FileTsx {...common} color="#3178c6" />;
        case "ts": return <FileTs {...common} color="#3178c6" />;
        case "jsx": return <FileJsx {...common} color="#f0db4f" />;
        case "js": return <FileJs {...common} color="#f0db4f" />;
        case "css": return <FileCss {...common} color="#264de4" />;
        case "html": return <FileHtml {...common} color="#e34c26" />;
        case "json": return <FileCode {...common} color="#fbbf24" />;
        case "md": return <FileMd {...common} color="#8e8e93" />;
        case "ini": return <FileIni {...common} color="#9b5de5" />;
        case "txt": return <FileText {...common} color="#8e8e93" />;
        default: return <File {...common} />;
      }
    },
  };
}

export const phosphorPack: IconPack = buildPack("phosphor", "regular", "Phosphor", "Rounded regular");
export const phosphorDuotonePack: IconPack = buildPack(
  "phosphor-duotone",
  "duotone",
  "Phosphor Duotone",
  "Two-tone color",
);
export const phosphorBoldPack: IconPack = buildPack(
  "phosphor-bold",
  "bold",
  "Phosphor Bold",
  "Rounded bold",
);
export const phosphorFillPack: IconPack = buildPack(
  "phosphor-fill",
  "fill",
  "Phosphor Fill",
  "Solid fill",
);
