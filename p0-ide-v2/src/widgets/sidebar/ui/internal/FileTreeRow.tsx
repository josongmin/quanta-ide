import { ChevronIcon, type IconPack } from "@/shared/ui/icons";
import { ClockIcon } from "../../lib/icons";
import type { FileNode } from "../../lib/sidebar.utils";

interface FileTreeRowProps {
  node: FileNode;
  idx: number;
  isOpen: boolean;
  selected: string | null;
  pack: IconPack;
  onClick: () => void;
  onToggleIfFolder: () => void;
}

export function FileTreeRow({
  node,
  idx,
  isOpen,
  selected,
  pack,
  onClick,
  onToggleIfFolder,
}: FileTreeRowProps) {
  const isFolder = node.type === "folder";
  const isFileActive = node.type === "file" && !!node.active;

  return (
    <div
      key={`${node.name}-${idx}`}
      role="treeitem"
      aria-selected={selected === node.name || isFileActive}
      aria-expanded={isFolder ? isOpen : undefined}
      aria-level={node.depth + 1}
      tabIndex={0}
      className={
        `ide-files-row${isFolder ? " is-folder" : ""}` +
        `${isFileActive ? " is-active" : ""}` +
        `${selected === node.name && !isFileActive ? " is-selected" : ""}`
      }
      data-depth={node.depth}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (isFolder) onToggleIfFolder();
        }
      }}
    >
      {node.depth > 0 && (
        <span className="ide-files-guides" style={{ width: node.depth * 8 }} aria-hidden="true">
          {Array.from({ length: node.depth }, (_, d) => (
            <span key={d} className="ide-files-guide-line" />
          ))}
        </span>
      )}

      {isFolder ? <ChevronIcon open={isOpen} /> : <span className="ide-files-chev-spacer" />}
      {isFolder ? <pack.Folder open={isOpen} /> : pack.pickFile(node.name)}

      <span className="ide-files-name">{node.name}</span>

      {node.type === "file" && node.git && (
        <span className={`ide-files-git ide-files-git-${node.git.toLowerCase()}`}>{node.git}</span>
      )}

      {node.type === "file" && (node.tests !== undefined || node.stale !== undefined || (node.issues !== undefined && node.issues > 0)) && (
        <span className="ide-files-signals">
          {node.tests !== undefined && node.tests !== "✓" && (
            <span
              className={`ide-files-sig ide-files-sig-tests${node.tests.startsWith("0/") ? " is-bad" : ""}`}
              title={`Tests: ${node.tests}`}
            >
              {node.tests}
            </span>
          )}
          {node.stale && (
            <span className="ide-files-sig ide-files-sig-stale" title={`Last changed: ${node.stale} ago`}>
              <ClockIcon />
              {node.stale}
            </span>
          )}
          {node.issues !== undefined && node.issues > 0 && (
            <span
              className="ide-files-sig ide-files-sig-issues"
              data-risk={node.risk ?? 2}
              title={`${node.issues} issue${node.issues > 1 ? "s" : ""}`}
            >
              {node.issues}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
