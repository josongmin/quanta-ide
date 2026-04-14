import type { IconPack } from "./types";

function FeatherFolder({ open }: { open: boolean }) {
  return (
    <svg
      className="ide-files-icon is-folder"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {open ? (
        <>
          <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v.5" />
          <path d="M3 9.5h18.5l-1.7 7.8A2 2 0 0 1 17.85 19H6.15a2 2 0 0 1-1.95-1.7z" />
        </>
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      )}
    </svg>
  );
}

function FeatherFile({ tag }: { tag?: string }) {
  return (
    <svg
      className="ide-files-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <polyline points="14 3 14 8 19 8" />
      {tag && (
        <text
          x="12"
          y="17.5"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="5.5"
          fontWeight="600"
          stroke="none"
          fill="currentColor"
        >
          {tag}
        </text>
      )}
    </svg>
  );
}

export const featherPack: IconPack = {
  id: "feather",
  label: "Feather",
  hint: "Airy outline",
  Folder: ({ open }) => <FeatherFolder open={open} />,
  pickFile: (name) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".py")) return <FeatherFile tag="py" />;
    if (lower.endsWith(".tsx")) return <FeatherFile tag="tsx" />;
    if (lower.endsWith(".ts")) return <FeatherFile tag="ts" />;
    if (lower.endsWith(".jsx")) return <FeatherFile tag="jsx" />;
    if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return <FeatherFile tag="js" />;
    if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FeatherFile tag="css" />;
    if (lower.endsWith(".html") || lower.endsWith(".htm")) return <FeatherFile tag="html" />;
    if (lower.endsWith(".json")) return <FeatherFile tag="{}" />;
    if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FeatherFile tag="md" />;
    if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg")) return <FeatherFile tag="ini" />;
    return <FeatherFile />;
  },
};
