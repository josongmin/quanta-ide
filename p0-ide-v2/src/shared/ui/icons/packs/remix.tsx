import {
  RiFolderLine,
  RiFolderOpenLine,
  RiFileLine,
  RiFileCodeLine,
  RiFileTextLine,
  RiFileSettingsLine,
  RiFolderFill,
  RiFolderOpenFill,
  RiFileFill,
  RiFileCodeFill,
  RiFileTextFill,
  RiFileSettingsFill,
} from "@remixicon/react";
import type { IconPack } from "./types";

const SIZE = 14;

type RemixVariant = "line" | "fill";

function buildPack(variant: RemixVariant): IconPack {
  const Folder = variant === "line" ? RiFolderLine : RiFolderFill;
  const FolderOpen = variant === "line" ? RiFolderOpenLine : RiFolderOpenFill;
  const File = variant === "line" ? RiFileLine : RiFileFill;
  const FileCode = variant === "line" ? RiFileCodeLine : RiFileCodeFill;
  const FileText = variant === "line" ? RiFileTextLine : RiFileTextFill;
  const FileSettings = variant === "line" ? RiFileSettingsLine : RiFileSettingsFill;

  return {
    id: variant === "line" ? "remix-line" : "remix-fill",
    label: variant === "line" ? "Remix Line" : "Remix Fill",
    hint: variant === "line" ? "Remixicon line" : "Remixicon solid",
    Folder: ({ open }) =>
      open ? (
        <FolderOpen size={SIZE} className="ide-files-icon is-folder" />
      ) : (
        <Folder size={SIZE} className="ide-files-icon is-folder" />
      ),
    pickFile: (name) => {
      const lower = name.toLowerCase();
      const common = { size: SIZE, className: "ide-files-icon" } as const;
      if (lower.endsWith(".py")) return <FileCode {...common} color="#4b8bbe" />;
      if (lower.endsWith(".tsx") || lower.endsWith(".ts"))
        return <FileCode {...common} color="#3178c6" />;
      if (lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
        return <FileCode {...common} color="#d9b02a" />;
      if (lower.endsWith(".css") || lower.endsWith(".scss"))
        return <FileCode {...common} color="#264de4" />;
      if (lower.endsWith(".html") || lower.endsWith(".htm"))
        return <FileCode {...common} color="#e34c26" />;
      if (lower.endsWith(".json")) return <FileCode {...common} color="#d9a21a" />;
      if (lower.endsWith(".md") || lower.endsWith(".mdx"))
        return <FileText {...common} color="#8e8e93" />;
      if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
        return <FileSettings {...common} color="#9b5de5" />;
      return <File {...common} />;
    },
  };
}

export const remixLinePack: IconPack = buildPack("line");
export const remixFillPack: IconPack = buildPack("fill");
