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
import { detectFileType } from "../file-type";

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
    supportsColor: false,
    Folder: ({ open }) =>
      open ? (
        <FolderOpen size={SIZE} className="ide-files-icon is-folder" />
      ) : (
        <Folder size={SIZE} className="ide-files-icon is-folder" />
      ),
    pickFile: (name) => {
      const common = { size: SIZE, className: "ide-files-icon" } as const;
      const kind = detectFileType(name);
      switch (kind) {
        case "py": return <FileCode {...common} color="#4b8bbe" />;
        case "tsx":
        case "ts": return <FileCode {...common} color="#3178c6" />;
        case "jsx":
        case "js": return <FileCode {...common} color="#d9b02a" />;
        case "css": return <FileCode {...common} color="#264de4" />;
        case "html": return <FileCode {...common} color="#e34c26" />;
        case "json": return <FileCode {...common} color="#d9a21a" />;
        case "md": return <FileText {...common} color="#8e8e93" />;
        case "ini": return <FileSettings {...common} color="#9b5de5" />;
        default: return <File {...common} />;
      }
    },
  };
}

export const remixLinePack: IconPack = buildPack("line");
export const remixFillPack: IconPack = buildPack("fill");
