import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronIcon, useActivePack } from "@/shared/ui/icons";
import { useGitWorkspaceChangeCount } from "@/shared/model/git-workspace";
import { GitPanel } from "@/features/git-panel";
import { resolveIconColor, useIconColor } from "@/shared/model/icon-pack-store";
import { IconPackPicker } from "./IconPackPicker";
import "./sidebar.css";

interface FileNodeBase {
  name: string;
  depth: number;
}
export interface FolderNode extends FileNodeBase {
  type: "folder";
  open?: boolean;
}
export interface FileLeaf extends FileNodeBase {
  type: "file";
  active?: boolean;
  issues?: number;
  risk?: 1 | 2 | 3 | 4;
  git?: "M" | "A" | "?" | "D";
  tests?: string;
  stale?: string;
}
export type FileNode = FolderNode | FileLeaf;

type ExplorerTab = "project" | "git";

const defaultNodes: FileNode[] = [
  { name: "codegraph_agent", type: "folder", depth: 0, open: true },
  { name: "orchestrator", type: "folder", depth: 1, open: true },
  { name: "orchestrator.py", type: "file", depth: 2, active: true, git: "M", tests: "0/12", issues: 3, risk: 4 },
  { name: "routing_policy.py", type: "file", depth: 2, git: "M" },
  { name: "tools", type: "folder", depth: 1, open: true },
  { name: "plan_orchestration", type: "folder", depth: 2, open: true },
  { name: "security.py", type: "file", depth: 3, git: "A" },
  { name: "base.py", type: "file", depth: 3 },
  { name: "infrastructure", type: "folder", depth: 1 },
  { name: "domain", type: "folder", depth: 1 },
  { name: "shared", type: "folder", depth: 1 },
  { name: "pyproject.toml", type: "file", depth: 0 },
];

function isVisible(nodes: FileNode[], idx: number, openState: Record<string, boolean>): boolean {
  const node = nodes[idx];
  if (node.depth === 0) return true;

  let remainingDepth = node.depth;
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = nodes[i];
    if (candidate.type === "folder" && candidate.depth === remainingDepth - 1) {
      const key = `${candidate.name}__${candidate.depth}`;
      const isOpen = key in openState ? openState[key] : (candidate.open ?? false);
      if (!isOpen) return false;
      remainingDepth--;
      if (remainingDepth === 0) return true;
    }
  }
  return true;
}

interface SidebarProps {
  nodes?: FileNode[];
  onSelect?: (kind: "file" | "folder", name: string) => void;
}

export function Sidebar({ nodes = defaultNodes, onSelect }: SidebarProps) {
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("project");
  const gitChangeCount = useGitWorkspaceChangeCount();
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const pack = useActivePack();
  const iconColorId = useIconColor();
  const iconColor = resolveIconColor(iconColorId);

  const toggleFolder = useCallback((name: string, depth: number) => {
    const key = `${name}__${depth}`;
    setOpenState((prev) => {
      const current = key in prev
        ? prev[key]
        : ((() => {
            const found = nodes.find((n) => n.name === name && n.depth === depth);
            return found?.type === "folder" ? (found.open ?? false) : false;
          })());
      return { ...prev, [key]: !current };
    });
  }, [nodes]);

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) if (n.type === "folder") next[`${n.name}__${n.depth}`] = true;
    setOpenState(next);
  }, [nodes]);

  const collapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) if (n.type === "folder") next[`${n.name}__${n.depth}`] = false;
    setOpenState(next);
  }, [nodes]);

  const visibleNodes = useMemo(
    () => nodes.map((node, i) => ({ node, idx: i })).filter(({ idx }) => isVisible(nodes, idx, openState)),
    [nodes, openState],
  );

  const fileCount = useMemo(() => nodes.filter((n) => n.type === "file").length, [nodes]);

  return (
    <aside
      className="ide-files"
      aria-label="Explorer"
      style={iconColor ? ({ "--files-icon-color": iconColor } as React.CSSProperties) : undefined}
    >
      <nav className="ide-files-modes" role="tablist" aria-label="Explorer">
        <button
          type="button"
          role="tab"
          aria-selected={explorerTab === "project"}
          className={`ide-files-mode${explorerTab === "project" ? " is-active" : ""}`}
          onClick={() => setExplorerTab("project")}
        >
          <span>Project</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={explorerTab === "git"}
          className={`ide-files-mode${explorerTab === "git" ? " is-active" : ""}`}
          onClick={() => { setPickerOpen(false); setExplorerTab("git"); }}
        >
          <span>Git</span>
          {gitChangeCount > 0 ? <span className="ide-files-mode-count">{gitChangeCount}</span> : null}
        </button>
      </nav>

      {explorerTab === "project" && (
        <>
      <div className="ide-files-toolbar">
        <button type="button" className="ide-files-tool-btn" onClick={expandAll} title="Expand all" aria-label="Expand all">
          <ExpandAllIcon />
        </button>
        <button type="button" className="ide-files-tool-btn" onClick={collapseAll} title="Collapse all" aria-label="Collapse all">
          <CollapseAllIcon />
        </button>
        <div className="ide-files-tool-sep" />
        <span className="ide-files-count">{fileCount} files</span>
        <button
          ref={pickerBtnRef}
          type="button"
          className={`ide-files-iconpack-btn${pickerOpen ? " is-open" : ""}`}
          onClick={() => setPickerOpen((v) => !v)}
          title={`Icon pack: ${pack.label}`}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <PaletteIcon />
          <ChevronDownTiny />
        </button>
        {pickerOpen && (
          <IconPackPicker anchorRef={pickerBtnRef} onClose={() => setPickerOpen(false)} />
        )}
      </div>

      <div className="ide-files-tree" role="tree">
        {visibleNodes.map(({ node, idx }) => {
          const isFolder = node.type === "folder";
          const key = `${node.name}__${node.depth}`;
          const folderOpen = isFolder ? (node.open ?? false) : false;
          const isOpen = key in openState ? openState[key] : folderOpen;
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
              onClick={() => {
                setSelected(node.name);
                if (isFolder) toggleFolder(node.name, node.depth);
                onSelect?.(isFolder ? "folder" : "file", node.name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (isFolder) toggleFolder(node.name, node.depth);
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
        })}
      </div>
        </>
      )}

      {explorerTab === "git" && (
        <div className="ide-files-git-pane" role="tabpanel" aria-label="Git">
          <GitPanel
            onOpenFile={(name) => {
              setSelected(name);
              onSelect?.("file", name);
            }}
          />
        </div>
      )}
    </aside>
  );
}

/* ── Inline icons ─────────────────────────────────────────────────── */

function ExpandAllIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 2 12 6" />
      <polyline points="4 10 8 14 12 10" />
    </svg>
  );
}

function CollapseAllIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 3 8 7 12 3" />
      <polyline points="4 13 8 9 12 13" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="7" height="7" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <polyline points="8 4 8 8 11 10" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14A6 6 0 1 1 14 8c0 1.1-.9 2-2 2h-1.2a1.2 1.2 0 0 0-.9 2 1.2 1.2 0 0 1-1 2z" />
      <circle cx="5.5" cy="7" r=".7" fill="currentColor" stroke="none" />
      <circle cx="8" cy="5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronDownTiny() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}
