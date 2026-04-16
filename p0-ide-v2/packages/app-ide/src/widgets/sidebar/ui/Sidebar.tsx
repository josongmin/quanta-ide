import { useMemo, useState } from "react";
import { useActivePack } from "@quanta/ui-kit/ui/icons";
import { useGitWorkspaceChangeCount } from "@quanta/app-ide/stores/git-workspace";
import { GitPanel } from "@quanta/app-ide/features/git-panel";
import { resolveIconColor, useIconColor } from "@quanta/shell/stores/icon-pack-store";
import { defaultNodes, type FileNode } from "../lib/sidebar.utils";
import { useFileTreeState } from "../model/use-file-tree-state";
import { FileTreeHeader } from "./internal/FileTreeHeader";
import { FileTreeToolbar } from "./internal/FileTreeToolbar";
import { FileTreeRow } from "./internal/FileTreeRow";
import { GitModal } from "./internal/GitModal";
import "./sidebar.css";

export type { FileNode, FolderNode, FileLeaf } from "../lib/sidebar.utils";

interface SidebarProps {
  nodes?: FileNode[];
  onSelect?: (kind: "file" | "folder", name: string) => void;
}

export function Sidebar({ nodes = defaultNodes, onSelect }: SidebarProps) {
  const gitChangeCount = useGitWorkspaceChangeCount();
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const pack = useActivePack();
  const iconColorId = useIconColor();
  const iconColor = resolveIconColor(iconColorId);

  const { openState, visibleNodes, toggleFolder, expandAll, collapseAll } = useFileTreeState(nodes);

  const fileCount = useMemo(() => nodes.filter((n) => n.type === "file").length, [nodes]);
  const projectName = useMemo(() => {
    const root = nodes.find((n) => n.depth === 0 && n.type === "folder");
    return root?.name ?? "workspace";
  }, [nodes]);

  return (
    <aside
      className="ide-files"
      aria-label="Explorer"
      style={iconColor ? ({ "--files-icon-color": iconColor } as React.CSSProperties) : undefined}
    >
      <FileTreeHeader
        projectName={projectName}
        gitChangeCount={gitChangeCount}
        gitOpen={gitOpen}
        onOpenGit={() => { setPickerOpen(false); setGitOpen(true); }}
      />

      <FileTreeToolbar
        fileCount={fileCount}
        packLabel={pack.label}
        pickerOpen={pickerOpen}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onOpenPicker={() => setPickerOpen(true)}
        onClosePicker={() => setPickerOpen(false)}
      />

      <div className="ide-files-tree" role="tree">
        {visibleNodes.map(({ node, idx }) => {
          const isFolder = node.type === "folder";
          const key = `${node.name}__${node.depth}`;
          const folderOpen = isFolder ? (node.open ?? false) : false;
          const isOpen = key in openState ? openState[key] : folderOpen;
          return (
            <FileTreeRow
              key={`${node.name}-${idx}`}
              node={node}
              idx={idx}
              isOpen={isOpen}
              selected={selected}
              pack={pack}
              onClick={() => {
                setSelected(node.name);
                if (isFolder) toggleFolder(node.name, node.depth);
                onSelect?.(isFolder ? "folder" : "file", node.name);
              }}
              onToggleIfFolder={() => toggleFolder(node.name, node.depth)}
            />
          );
        })}
      </div>

      {gitOpen && (
        <GitModal onClose={() => setGitOpen(false)}>
          <GitPanel
            onOpenFile={(name) => {
              setSelected(name);
              setGitOpen(false);
              onSelect?.("file", name);
            }}
          />
        </GitModal>
      )}
    </aside>
  );
}
