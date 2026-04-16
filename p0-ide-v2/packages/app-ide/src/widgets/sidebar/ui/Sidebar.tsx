import { useMemo, useState } from "react";
import { useActivePack } from "@quanta/ui-kit/ui/icons";
import { useGitWorkspaceChangeCount } from "@quanta/app-ide/stores/git-workspace";
import { GitPanel } from "@quanta/app-ide/features/git-panel";
import { resolveIconColor, useIconColor } from "@quanta/shell/stores/icon-pack-store";
import { defaultNodes, defaultDeps, type FileNode, type ExternalDep } from "../lib/sidebar.utils";
import { useFileTreeState } from "../model/use-file-tree-state";
import { FileTreeHeader } from "./internal/FileTreeHeader";
import { FileTreeToolbar } from "./internal/FileTreeToolbar";
import { FileTreeRow } from "./internal/FileTreeRow";
import { DepRow } from "./internal/DepRow";
import { GitModal } from "./internal/GitModal";
import "./sidebar.css";

export type { FileNode, FolderNode, FileLeaf, ExternalDep } from "../lib/sidebar.utils";

interface SidebarProps {
  projectName?: string;
  nodes?: FileNode[];
  deps?: ExternalDep[];
  onSelect?: (kind: "file" | "folder", name: string) => void;
}

export function Sidebar({ projectName = "codegraph_agent", nodes = defaultNodes, deps = defaultDeps, onSelect }: SidebarProps) {
  const gitChangeCount = useGitWorkspaceChangeCount();
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gitOpen, setGitOpen] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);
  const pack = useActivePack();
  const iconColorId = useIconColor();
  const iconColor = resolveIconColor(iconColorId);

  const { openState, visibleNodes, toggleFolder, expandAll, collapseAll } = useFileTreeState(nodes);

  const fileCount = useMemo(() => nodes.filter((n) => n.type === "file").length, [nodes]);

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

      {deps.length > 0 && (
        <div className={`ide-deps${depsOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="ide-deps-header"
            onClick={() => setDepsOpen((v) => !v)}
            aria-expanded={depsOpen}
          >
            <span className="ide-deps-label">Dependencies</span>
            <span className="ide-files-section-count">{deps.length}</span>
            <span className="ide-deps-chev" />
          </button>
          {depsOpen && (
            <div className="ide-deps-list" role="list">
              {deps.map((dep) => (
                <DepRow key={dep.name} dep={dep} />
              ))}
            </div>
          )}
        </div>
      )}

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
