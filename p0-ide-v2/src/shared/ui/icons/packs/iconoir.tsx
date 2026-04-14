import type { IconPack } from "./types";

function IconoirFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <path d="M3 8.5a1.8 1.8 0 0 1 1.8-1.8h3.4l2 2H19.2a1.8 1.8 0 0 1 1.8 1.8v.3" />
          <path d="M3 10.3h18.2l-1.6 7.2a1.8 1.8 0 0 1-1.76 1.4H6.4a1.8 1.8 0 0 1-1.76-1.4z" />
        </>
      ) : (
        <path d="M3 8.5a1.8 1.8 0 0 1 1.8-1.8h3.4l2 2H19.2a1.8 1.8 0 0 1 1.8 1.8v7.2a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 17.7z" />
      )}
    </svg>
  );
}

function IconoirFile({ tag }: { tag?: string }) {
  return (
    <svg
      className="ide-files-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.2 3H6.8A1.8 1.8 0 0 0 5 4.8v14.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.8-1.8V7.8z" />
      <path d="M14.2 3v4.8H19" />
      {tag && (
        <text
          x="12"
          y="17.2"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="5"
          fontWeight="500"
          stroke="none"
          fill="currentColor"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const iconoirPack: IconPack = {
  id: "iconoir",
  label: "Iconoir",
  hint: "Hairline minimal",
  Folder: ({ open }) => <IconoirFolder open={open} />,
  pickFile: (name) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".py")) return <IconoirFile tag="py" />;
    if (lower.endsWith(".tsx")) return <IconoirFile tag="tsx" />;
    if (lower.endsWith(".ts")) return <IconoirFile tag="ts" />;
    if (lower.endsWith(".jsx")) return <IconoirFile tag="jsx" />;
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return <IconoirFile tag="js" />;
    if (lower.endsWith(".css") || lower.endsWith(".scss")) return <IconoirFile tag="css" />;
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return <IconoirFile tag="html" />;
    if (lower.endsWith(".json")) return <IconoirFile tag="{}" />;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <IconoirFile tag="md" />;
    if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg")) return <IconoirFile tag="ini" />;
    return <IconoirFile />;
  },
};
