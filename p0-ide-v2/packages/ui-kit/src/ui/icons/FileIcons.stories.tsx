import type { Meta, StoryObj } from "@storybook/react";
import { pickFileIcon, FolderIcon, ChevronIcon } from "./FileIcons";

/* Wrapper component so Storybook has something to bind args to. */
function FileIconGallery({ files }: { files: string[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: 16,
        padding: 16,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--fs-sm)",
        color: "var(--fg)",
      }}
    >
      {files.map((name) => (
        <div
          key={name}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span style={{ width: 16, height: 16, flexShrink: 0, display: "flex" }}>
            {pickFileIcon(name)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "UI Kit/FileIcons",
  component: FileIconGallery,
  tags: ["autodocs"],
} satisfies Meta<typeof FileIconGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllTypes: Story = {
  name: "All file types",
  args: {
    files: [
      "main.py",
      "App.tsx",
      "index.ts",
      "utils.js",
      "Card.jsx",
      "lib.rs",
      "server.go",
      "config.json",
      "README.md",
      "styles.css",
      "Cargo.toml",
      "deploy.sh",
      "Dockerfile",
      "schema.yml",
      "package.json",
      "tsconfig.json",
      "notes.txt",
      "unknown.xyz",
    ],
  },
};

export const PythonFile: Story = {
  name: "Python file",
  args: { files: ["main.py", "utils.py", "test_handler.py"] },
};

export const TypeScriptFiles: Story = {
  name: "TypeScript / TSX",
  args: { files: ["index.ts", "App.tsx", "hooks.ts", "Button.tsx"] },
};

export const ConfigFiles: Story = {
  name: "Config files",
  args: { files: ["package.json", "tsconfig.json", "config.json", "Cargo.toml", "docker-compose.yml"] },
};

/* Folder and chevron icons shown separately since they take props, not filenames. */
function FolderDemo() {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        padding: 16,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--fs-sm)",
        color: "var(--fg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ChevronIcon open={false} />
        <FolderIcon open={false} />
        <span>src (closed)</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ChevronIcon open />
        <FolderIcon open />
        <span>src (open)</span>
      </div>
    </div>
  );
}

export const Folders: Story = {
  render: () => <FolderDemo />,
  args: { files: [] },
};
