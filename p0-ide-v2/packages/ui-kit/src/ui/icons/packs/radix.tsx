import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

function RadixFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="miter"
      strokeLinecap="butt"
    >
      {open ? (
        <>
          <path d="M1.5 4h3.2l1.3 1.3H13v1.2H1.5z" />
          <path d="M1.5 6.5h12l-1 5.2H2.5z" />
        </>
      ) : (
        <path d="M1.5 4h3.2l1.3 1.3H13v6.4H1.5z" />
      )}
    </svg>
  );
}

function RadixFile({ tag }: { tag?: string }) {
  return (
    <svg
      className="ide-files-icon"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="miter"
      strokeLinecap="butt"
    >
      <path d="M3 1.5h5.3l3.2 3.2v8.8H3z" />
      <path d="M8.3 1.5v3.2h3.2" />
      {tag && (
        <text
          x="7.25"
          y="11"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="3.6"
          fontWeight="600"
          stroke="none"
          fill="currentColor"
          letterSpacing="-0.03em"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const radixPack: IconPack = {
  id: "radix",
  label: "Radix",
  hint: "Compact grid",
  supportsColor: true,
  Folder: ({ open }) => <RadixFolder open={open} />,
  pickFile: (name) => {
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <RadixFile tag="py" />;
      case "tsx": return <RadixFile tag="tsx" />;
      case "ts": return <RadixFile tag="ts" />;
      case "jsx": return <RadixFile tag="jsx" />;
      case "js": return <RadixFile tag="js" />;
      case "css": return <RadixFile tag="css" />;
      case "html": return <RadixFile tag="html" />;
      case "json": return <RadixFile tag="{}" />;
      case "md": return <RadixFile tag="md" />;
      case "ini": return <RadixFile tag="ini" />;
      default: return <RadixFile />;
    }
  },
};
