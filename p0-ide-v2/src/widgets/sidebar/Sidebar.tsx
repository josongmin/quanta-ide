import { useCallback, useMemo, useState } from "react";
import { ChevronIcon, FolderIcon, pickFileIcon } from "./FileIcons";
import "./sidebar.css";

export interface FileNode {
  name: string;
  type: "folder" | "file";
  depth: number;
  open?: boolean;
  active?: boolean;
  issues?: number;
  risk?: 1 | 2 | 3 | 4;
  git?: "M" | "A" | "?" | "D";
  tests?: string;
  stale?: string;
}

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
  repoName?: string;
  /** optional emoji icon — overrides one auto-parsed from repoName */
  repoIcon?: string | null;
}

/** "🛵 payments-api" → ["🛵", "payments-api"] */
function splitRepoEmoji(name: string): [string | null, string] {
  const m = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u.exec(name);
  if (m) return [m[1], name.slice(m[0].length)];
  return [null, name];
}

export function Sidebar({ nodes = defaultNodes, repoName = "🛵 payments-api", repoIcon }: SidebarProps) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const toggleFolder = useCallback((name: string, depth: number) => {
    const key = `${name}__${depth}`;
    setOpenState((prev) => {
      const current = key in prev
        ? prev[key]
        : (nodes.find((n) => n.name === name && n.depth === depth)?.open ?? false);
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
    <aside className="ide-files" aria-label="Explorer">
      <button type="button" className="ide-files-repo-btn" title="레포 인사이트 보기">
        {(() => {
          const [autoEmoji, cleanName] = splitRepoEmoji(repoName);
          const emoji = repoIcon ?? autoEmoji;
          return (
            <>
              <div className={`ide-files-repo-icon-wrap${emoji ? " is-emoji" : ""}`}>
                {emoji
                  ? <span className="ide-files-repo-emoji">{emoji}</span>
                  : <RepoIcon />}
              </div>
              <div className="ide-files-repo-info">
                <span className="ide-files-repo-name">{cleanName}</span>
                <span className="ide-files-repo-meta">
                  <BranchIcon />
                  <span>main</span>
                  <span className="ide-files-repo-dot" />
                  <span className="ide-files-repo-changes">3 changes</span>
                </span>
              </div>
              <ChevronRightTiny />
            </>
          );
        })()}
      </button>

      <div className="ide-files-toolbar">
        <button type="button" className="ide-files-tool-btn" onClick={expandAll} title="모두 펼치기" aria-label="모두 펼치기">
          <ExpandAllIcon />
        </button>
        <button type="button" className="ide-files-tool-btn" onClick={collapseAll} title="모두 접기" aria-label="모두 접기">
          <CollapseAllIcon />
        </button>
        <div className="ide-files-tool-sep" />
        <span className="ide-files-count">{fileCount} files</span>
      </div>

      <div className="ide-files-tree" role="tree">
        {visibleNodes.map(({ node, idx }) => {
          const isFolder = node.type === "folder";
          const key = `${node.name}__${node.depth}`;
          const isOpen = key in openState ? openState[key] : (node.open ?? false);

          return (
            <div
              key={`${node.name}-${idx}`}
              role="treeitem"
              aria-selected={selected === node.name || node.active}
              aria-expanded={isFolder ? isOpen : undefined}
              aria-level={node.depth + 1}
              tabIndex={0}
              className={
                `ide-files-row${isFolder ? " is-folder" : ""}` +
                `${node.active ? " is-active" : ""}` +
                `${selected === node.name && !node.active ? " is-selected" : ""}`
              }
              data-depth={node.depth}
              onClick={() => {
                setSelected(node.name);
                if (isFolder) toggleFolder(node.name, node.depth);
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
              {isFolder ? <FolderIcon open={isOpen} /> : pickFileIcon(node.name)}

              <span className="ide-files-name">{node.name}</span>

              {node.git && (
                <span className={`ide-files-git ide-files-git-${node.git.toLowerCase()}`}>{node.git}</span>
              )}

              {(node.tests !== undefined || node.stale !== undefined || (node.issues !== undefined && node.issues > 0)) && (
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
    </aside>
  );
}

/* ── Inline icons ─────────────────────────────────────────────────── */

function RepoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13.5A1.5 1.5 0 0 1 5.5 12H13" />
      <path d="M5.5 2H13v12H5.5A1.5 1.5 0 0 1 4 12.5v-9A1.5 1.5 0 0 1 5.5 2z" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <path d="M4 4.5v7" />
      <path d="M12 7.5v.5a3 3 0 0 1-3 3H6" />
    </svg>
  );
}

function ChevronRightTiny() {
  return (
    <svg className="ide-files-repo-chevron" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}

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
