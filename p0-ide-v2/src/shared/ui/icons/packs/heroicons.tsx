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
    Folder: ({ open }) =>
      open ? (
        <FolderOpen className="ide-files-icon is-folder" width={SIZE} height={SIZE} />
      ) : (
        <Folder className="ide-files-icon is-folder" width={SIZE} height={SIZE} />
      ),
    pickFile: (name) => {
      const lower = name.toLowerCase();
      if (lower.endsWith(".py")) return <CodeBracket {...common} style={{ color: "#4b8bbe" }} />;
      if (lower.endsWith(".tsx") || lower.endsWith(".ts"))
        return <CodeSquare {...common} style={{ color: "#3178c6" }} />;
      if (lower.endsWith(".jsx") || lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs"))
        return <CodeSquare {...common} style={{ color: "#d9b02a" }} />;
      if (lower.endsWith(".css") || lower.endsWith(".scss"))
        return <CodeBracket {...common} style={{ color: "#264de4" }} />;
      if (lower.endsWith(".html") || lower.endsWith(".htm"))
        return <CodeBracket {...common} style={{ color: "#e34c26" }} />;
      if (lower.endsWith(".json")) return <CodeBracket {...common} style={{ color: "#d9a21a" }} />;
      if (lower.endsWith(".md") || lower.endsWith(".mdx"))
        return <DocumentText {...common} style={{ color: "#8e8e93" }} />;
      if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg"))
        return <Cog {...common} style={{ color: "#9b5de5" }} />;
      return <Document {...common} />;
    },
  };
}

export const heroiconsOutlinePack: IconPack = buildPack("outline");
export const heroiconsSolidPack: IconPack = buildPack("solid");
