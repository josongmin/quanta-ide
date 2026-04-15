import {
  FolderIcon as HiOutlineFolder,
  FolderOpenIcon as HiOutlineFolderOpen,
  DocumentIcon as HiOutlineDocument,
  DocumentTextIcon as HiOutlineDocumentText,
  CodeBracketIcon as HiOutlineCodeBracket,
  CodeBracketSquareIcon as HiOutlineCodeSquare,
  Cog8ToothIcon as HiOutlineCog,
} from "@heroicons/react/24/outline";
import {
  FolderIcon as HiSolidFolder,
  FolderOpenIcon as HiSolidFolderOpen,
  DocumentIcon as HiSolidDocument,
  DocumentTextIcon as HiSolidDocumentText,
  CodeBracketIcon as HiSolidCodeBracket,
  CodeBracketSquareIcon as HiSolidCodeSquare,
  Cog8ToothIcon as HiSolidCog,
} from "@heroicons/react/24/solid";
import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

const SIZE = 14;

type HeroVariant = "outline" | "solid";

function buildPack(variant: HeroVariant): IconPack {
  const Folder = variant === "outline" ? HiOutlineFolder : HiSolidFolder;
  const FolderOpen = variant === "outline" ? HiOutlineFolderOpen : HiSolidFolderOpen;
  const Document = variant === "outline" ? HiOutlineDocument : HiSolidDocument;
  const DocumentText = variant === "outline" ? HiOutlineDocumentText : HiSolidDocumentText;
  const CodeBracket = variant === "outline" ? HiOutlineCodeBracket : HiSolidCodeBracket;
  const CodeSquare = variant === "outline" ? HiOutlineCodeSquare : HiSolidCodeSquare;
  const Cog = variant === "outline" ? HiOutlineCog : HiSolidCog;
  const common = { className: "ide-files-icon", width: SIZE, height: SIZE } as const;

  return {
    id: variant === "outline" ? "heroicons-outline" : "heroicons-solid",
    label: variant === "outline" ? "Heroicons Outline" : "Heroicons Solid",
    hint: variant === "outline" ? "Tailwind outline" : "Tailwind solid",
    supportsColor: false,
    Folder: ({ open }) =>
      open ? (
        <FolderOpen className="ide-files-icon is-folder" width={SIZE} height={SIZE} />
      ) : (
        <Folder className="ide-files-icon is-folder" width={SIZE} height={SIZE} />
      ),
    pickFile: (name) => {
      const kind = detectFileType(name);
      switch (kind) {
        case "py": return <CodeBracket {...common} style={{ color: "#4b8bbe" }} />;
        case "tsx":
        case "ts": return <CodeSquare {...common} style={{ color: "#3178c6" }} />;
        case "jsx":
        case "js": return <CodeSquare {...common} style={{ color: "#d9b02a" }} />;
        case "css": return <CodeBracket {...common} style={{ color: "#264de4" }} />;
        case "html": return <CodeBracket {...common} style={{ color: "#e34c26" }} />;
        case "json": return <CodeBracket {...common} style={{ color: "#d9a21a" }} />;
        case "md": return <DocumentText {...common} style={{ color: "#8e8e93" }} />;
        case "ini": return <Cog {...common} style={{ color: "#9b5de5" }} />;
        default: return <Document {...common} />;
      }
    },
  };
}

export const heroiconsOutlinePack: IconPack = buildPack("outline");
export const heroiconsSolidPack: IconPack = buildPack("solid");
