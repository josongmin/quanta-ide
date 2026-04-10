import { useTranslation } from "react-i18next";
import { PanelResizer } from "@/shared/ui/PanelResizer";

export interface FileNode {
  name: string;
  type: "folder" | "file";
  depth: number;
  open?: boolean;
  active?: boolean;
  issues?: number;
  risk?: 1 | 2 | 3 | 4;
}

interface IdeFilesProps {
  nodes: FileNode[];
  repoName?: string;
  onFileClick?: (name: string) => void;
  onRepoClick?: () => void;
  onHover?: (name: string, x: number, y: number) => void;
  onHoverEnd?: () => void;
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg className="ide-files-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {open ? <polyline points="3 6 8 11 13 6" /> : <polyline points="6 3 11 8 6 13" />}
    </svg>
  );
}

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="ide-files-icon is-folder" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 7l-.7 4.5A1.5 1.5 0 0 1 11.8 13H3.2a1.5 1.5 0 0 1-1.5-1.3z" />
      ) : (
        <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
      )}
    </svg>
  );
}

/* ── Language-specific file icons (inline SVG, VSCode-inspired) ── */

function FileIconTS() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#3178c6" />
      <path d="M6.5 7.2H5v-1h4.3v1H7.8v4.6H6.5zM10 11.1c.3.2.8.4 1.3.4.5 0 .8-.2.8-.5 0-.3-.2-.5-.9-.7-.9-.3-1.4-.8-1.4-1.5 0-.9.7-1.5 1.9-1.5.5 0 .9.1 1.2.3l-.3 1c-.2-.1-.5-.2-1-.2-.5 0-.7.2-.7.4 0 .3.2.4 1 .7.9.3 1.3.8 1.3 1.5 0 .9-.7 1.6-2 1.6-.6 0-1.1-.2-1.4-.3z" fill="#fff" />
    </svg>
  );
}

function FileIconTSX() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#3178c6" />
      <path d="M4.5 7.3H3.2v-.9h3.6v.9H5.6v4H4.5zM6.9 11.3l1.2-1.9-1.1-1.8h1.2l.6 1.1.6-1.1h1.2l-1.1 1.8 1.2 1.9H9.3l-.7-1.2-.7 1.2z" fill="#fff" />
    </svg>
  );
}

function FileIconJS() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#f7df1e" />
      <path d="M8.6 11.2c.3.5.7.9 1.4.9.6 0 1-.3 1-.7 0-.5-.4-.7-1.1-1l-.4-.2c-1.1-.5-1.8-1-1.8-2.2 0-1.1.8-2 2.2-2 1 0 1.7.3 2.1 1.2l-1.2.7c-.2-.4-.5-.6-.9-.6-.4 0-.7.3-.7.6 0 .4.3.6 1 .9l.4.2c1.3.6 2 1.1 2 2.4 0 1.3-1 2-2.4 2-1.4 0-2.3-.7-2.7-1.6zM4.5 11.3c.2.4.4.8 1 .8.5 0 .8-.2.8-1V7h1.4v4.2c0 1.4-.8 2.1-2.1 2.1-1.1 0-1.8-.6-2.1-1.3z" fill="#1a1a22" />
    </svg>
  );
}

function FileIconJSON({ color = "#fbbf24" }: { color?: string }) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5c-2 0-3 .8-3 2.5v1.2c0 .9-.5 1.3-1.5 1.3v1c1 0 1.5.4 1.5 1.3V11c0 1.7 1 2.5 3 2.5" />
      <path d="M9 2.5c2 0 3 .8 3 2.5v1.2c0 .9.5 1.3 1.5 1.3v1c-1 0-1.5.4-1.5 1.3V11c0 1.7-1 2.5-3 2.5" />
    </svg>
  );
}

function FileIconNpm() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="0.5" fill="#cb3837" />
      <path d="M3 5h10v6h-2.5V6.5H9V11H3z" fill="#fff" />
    </svg>
  );
}

function FileIconCss() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#264de4" />
      <path d="M4.2 5.2h7.6l-.2 1.2H5.5l-.1.9h5.8l-.5 3.5-2.7.8-2.7-.8-.2-1.3h1.4l.1.6 1.4.4 1.4-.4.2-1.1H4.8z" fill="#fff" />
    </svg>
  );
}

function FileIconMd() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="1" stroke="#8e8e93" strokeWidth="1.2" />
      <path d="M3.5 11V6l1.5 2 1.5-2v5M9.5 6v5M8 9.5l1.5 1.5L11 9.5" stroke="#8e8e93" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIconGeneric() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z" />
      <polyline points="9 2 9 6 13 6" />
    </svg>
  );
}

function pickFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "package.json" || lower === "package-lock.json") return <FileIconNpm />;
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return <FileIconJSON color="#3178c6" />;
  if (lower.endsWith(".tsx")) return <FileIconTSX />;
  if (lower.endsWith(".ts")) return <FileIconTS />;
  if (lower.endsWith(".jsx")) return <FileIconTSX />;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return <FileIconJS />;
  if (lower.endsWith(".json")) return <FileIconJSON />;
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FileIconCss />;
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FileIconMd />;
  return <FileIconGeneric />;
}

function RepoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v11a.5.5 0 0 1-.777.416L8 11.101l-4.223 2.815A.5.5 0 0 1 3 13.5z" />
    </svg>
  );
}

export function IdeFiles({ nodes, repoName, onFileClick, onRepoClick, onHover, onHoverEnd }: IdeFilesProps) {
  const { t } = useTranslation();
  return (
    <aside className="ide-files" aria-label={t("ide.files.label")}>
      <PanelResizer cssVar="--files-w" side="right" min={140} max={480} />
      <button
        type="button"
        className="ide-files-repo-btn"
        onClick={onRepoClick}
        title="레포 인사이트 보기"
      >
        <RepoIcon />
        <span>{repoName ?? t("ide.files.label")}</span>
      </button>
      <div className="ide-files-tree" role="tree" aria-label={t("ide.files.label")}>
        {nodes.map((node, i) => {
          const isFolder = node.type === "folder";
          return (
            <div
              key={`${node.name}-${i.toString()}`}
              role="treeitem"
              aria-label={isFolder ? `Folder ${node.name}` : `Open ${node.name}`}
              aria-selected={node.active}
              aria-level={node.depth + 1}
              tabIndex={node.active ? 0 : -1}
              className={`ide-files-row${isFolder ? " is-folder" : ""}${node.active ? " is-active" : ""}`}
              data-depth={node.depth}
              onClick={!isFolder && onFileClick ? () => { onFileClick(node.name); } : undefined}
              onKeyDown={
                !isFolder && onFileClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFileClick(node.name);
                      }
                    }
                  : undefined
              }
              onMouseEnter={onHover ? (e) => { onHover(node.name, e.clientX, e.clientY); } : undefined}
              onMouseLeave={onHoverEnd}
              style={{ cursor: "pointer" }}
            >
              {isFolder ? <ChevronIcon open={node.open} /> : <span style={{ width: 10 }} />}
              {isFolder ? <FolderIcon open={node.open} /> : pickFileIcon(node.name)}
              <span className="ide-files-name">{node.name}</span>
              {node.issues !== undefined && node.issues > 0 && (
                <span className="ide-files-badge" data-risk={node.risk ?? 2}>
                  {node.issues}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
