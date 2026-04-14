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

const SIZE = 14;

function buildPack(id: "phosphor" | "phosphor-duotone", weight: IconWeight, label: string, hint: string): IconPack {
  return {
    id,
    label,
    hint,
    Folder: ({ open }) =>
      open ? (
        <FolderOpen size={SIZE} weight={weight} className="ide-files-icon is-folder" />
      ) : (
        <Folder size={SIZE} weight={weight} className="ide-files-icon is-folder" />
      ),
    pickFile: (name) => {
      const lower = name.toLowerCase();
      const common = { size: SIZE, weight, className: "ide-files-icon" } as const;
      if (lower.endsWith(".py")) return <FilePy {...common} color="#4b8bbe" />;
      if (lower.endsWith(".tsx")) return <FileTsx {...common} color="#3178c6" />;
      if (lower.endsWith(".ts")) return <FileTs {...common} color="#3178c6" />;
      if (lower.endsWith(".jsx")) return <FileJsx {...common} color="#f0db4f" />;
      if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
        return <FileJs {...common} color="#f0db4f" />;
      if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FileCss {...common} color="#264de4" />;
      if (lower.endsWith(".html") || lower.endsWith(".htm")) return <FileHtml {...common} color="#e34c26" />;
      if (lower.endsWith(".json")) return <FileCode {...common} color="#fbbf24" />;
      if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FileMd {...common} color="#8e8e93" />;
      if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
        return <FileIni {...common} color="#9b5de5" />;
      if (lower.endsWith(".txt") || lower.endsWith(".log")) return <FileText {...common} color="#8e8e93" />;
      return <File {...common} />;
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
