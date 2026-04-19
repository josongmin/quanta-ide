import type { IconPack } from "./types";
import { detectFileType } from "../file-type";

function MonoFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3L8 5.5h4.5A1.5 1.5 0 0 1 14 7l-.7 4.5A1.5 1.5 0 0 1 11.8 13H3.2a1.5 1.5 0 0 1-1.5-1.3z" />
      ) : (
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3L8 4.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
      )}
    </svg>
  );
}

function MonoFile({ tag }: { tag?: string }) {
  return (
    <svg
      className="ide-files-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z" />
      <polyline points="9 2 9 6 13 6" />
      {tag && (
        <text
          x="8"
          y="12"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="4.5"
          fontWeight="700"
          stroke="none"
          fill="currentColor"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const monoPack: IconPack = {
  id: "mono",
  label: "Mono",
  hint: "Monochrome lines",
  supportsColor: true,
  Folder: ({ open }) => <MonoFolder open={open} />,
  pickFile: (name) => {
    const kind = detectFileType(name);
    switch (kind) {
      case "py": return <MonoFile tag="py" />;
      case "tsx": return <MonoFile tag="tsx" />;
      case "ts": return <MonoFile tag="ts" />;
      case "jsx": return <MonoFile tag="jsx" />;
      case "js": return <MonoFile tag="js" />;
      case "json": return <MonoFile tag="{}" />;
      case "css": return <MonoFile tag="css" />;
      case "md": return <MonoFile tag="md" />;
      case "ini": return <MonoFile tag="ini" />;
      default: return <MonoFile />;
    }
  },
};
