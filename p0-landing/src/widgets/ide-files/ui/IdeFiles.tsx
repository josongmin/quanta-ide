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
  onFileClick?: (name: string) => void;
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

function FolderIcon() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z" />
      <polyline points="9 2 9 6 13 6" />
    </svg>
  );
}

export function IdeFiles({ nodes, onFileClick, onHover, onHoverEnd }: IdeFilesProps) {
  return (
    <aside className="ide-files">
      <div className="ide-label">Files</div>
      <div className="ide-files-tree">
        {nodes.map((node, i) => {
          const isFolder = node.type === "folder";
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- file tree item
            <div
              key={`${node.name}-${i.toString()}`}
              className={`ide-files-row${isFolder ? " is-folder" : ""}${node.active ? " is-active" : ""}`}
              data-depth={node.depth}
              onClick={!isFolder && onFileClick ? () => { onFileClick(node.name); } : undefined}
              onMouseEnter={onHover ? (e) => { onHover(node.name, e.clientX, e.clientY); } : undefined}
              onMouseLeave={onHoverEnd}
              style={{ cursor: "pointer" }}
            >
              {isFolder ? <ChevronIcon open={node.open} /> : <span style={{ width: 10 }} />}
              {isFolder ? <FolderIcon /> : <FileIcon />}
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
