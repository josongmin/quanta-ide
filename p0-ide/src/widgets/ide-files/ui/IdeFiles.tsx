import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  IconBranch,
  IconChevronRight,
  IconClock,
  IconCollapseAll,
  IconExpandAll,
  IconRepo,
  PanelResizer,
} from "@/shared/ui";
import { ChevronIcon, FolderIcon, pickFileIcon } from "./FileIcons";

export interface FileNode {
  name: string;
  type: "folder" | "file";
  depth: number;
  open?: boolean;
  active?: boolean;
  issues?: number;
  risk?: 1 | 2 | 3 | 4;
  git?: "M" | "A" | "?" | "D";
  /** test coverage e.g. "0/12" — shown as chip */
  tests?: string;
  /** callers/dependents count */
  callers?: number;
  /** staleness e.g. "5mo" — shown when old */
  stale?: string;
  /** churn: recent commit count */
  churn?: number;
}

interface IdeFilesProps {
  nodes: FileNode[];
  repoName?: string;
  /** 프로젝트 아이콘 — 이모지 문자열, null이면 기본 SVG */
  repoIcon?: string | null;
  /** single click — show insight in inspector without opening file */
  onNodeSelect?: (name: string, type: "file" | "folder") => void;
  /** double click — open file in editor / toggle folder */
  onFileClick?: (name: string) => void;
  onRepoClick?: () => void;
  onHover?: (name: string, x: number, y: number) => void;
  onHoverEnd?: () => void;
}

/** repoName 앞에 이모지가 있으면 분리 — e.g. "🛵 payments-api" → ["🛵", "payments-api"] */
function splitRepoEmoji(name: string): [string | null, string] {
  const m = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u.exec(name);
  if (m) return [m[1], name.slice(m[0].length)];
  return [null, name];
}

function RepoIcon() {
  return <IconRepo size={12} strokeWidth={2} />;
}

function BranchIcon() {
  return <IconBranch size={10} strokeWidth={1.7} />;
}

/* ── visibility helpers ─────────────────────────────────────────────── */

function isVisible(nodes: FileNode[], idx: number, openState: Record<string, boolean>): boolean {
  const node = nodes[idx];
  if (node.depth === 0) return true;

  // Walk backwards to find all ancestor folders
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

/* ── Main component ─────────────────────────────────────────────────── */

export function IdeFiles({ nodes, repoName, repoIcon, onNodeSelect, onFileClick, onRepoClick, onHover, onHoverEnd }: IdeFilesProps) {
  const { t } = useTranslation();
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  // double-click detection
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef<Record<string, number>>({});

  const toggleFolder = useCallback((name: string, depth: number) => {
    const key = `${name}__${depth}`;
    setOpenState((prev) => {
      const current = key in prev ? prev[key] : (nodes.find((n) => n.name === name && n.depth === depth)?.open ?? false);
      return { ...prev, [key]: !current };
    });
  }, [nodes]);

  const collapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) {
      if (n.type === "folder") next[`${n.name}__${n.depth}`] = false;
    }
    setOpenState(next);
  }, [nodes]);

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const n of nodes) {
      if (n.type === "folder") next[`${n.name}__${n.depth}`] = true;
    }
    setOpenState(next);
  }, [nodes]);

  const visibleNodes = useMemo(
    () => nodes.filter((_, i) => isVisible(nodes, i, openState)),
    [nodes, openState],
  );


  return (
    <aside className="ide-files" aria-label={t("ide.files.label")}>
      <PanelResizer cssVar="--files-w" side="right" min={140} max={480} />

      {/* ── Repo header ── */}
      <button
        type="button"
        className="ide-files-repo-btn"
        onClick={onRepoClick}
        title="레포 인사이트 보기"
      >
        {(() => {
          const raw = repoName ?? t("ide.files.label");
          const [autoEmoji, cleanName] = splitRepoEmoji(raw);
          const emoji = repoIcon ?? autoEmoji;
          return (
            <>
              <div className={`ide-files-repo-icon-wrap${emoji ? " is-emoji" : ""}`}>
                {emoji
                  ? <span className="ide-files-repo-emoji">{emoji}</span>
                  : <RepoIcon />
                }
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
            </>
          );
        })()}
        <IconChevronRight className="ide-files-repo-chevron" size={10} strokeWidth={2} />
      </button>

      {/* ── Toolbar ── */}
      <div className="ide-files-toolbar">
        <button type="button" className="ide-files-tool-btn" onClick={expandAll} title="모두 펼치기" aria-label="모두 펼치기">
          <IconExpandAll size={11} strokeWidth={2} />
        </button>
        <button type="button" className="ide-files-tool-btn" onClick={collapseAll} title="모두 접기" aria-label="모두 접기">
          <IconCollapseAll size={11} strokeWidth={2} />
        </button>
        <div className="ide-files-tool-sep" />
        <span className="ide-files-count">{nodes.filter(n => n.type === "file").length} files</span>
      </div>

      {/* ── Tree ── */}
      <div className="ide-files-tree" role="tree" aria-label={t("ide.files.label")}>
        {visibleNodes.map((node, i) => {
          const isFolder = node.type === "folder";
          const key = `${node.name}__${node.depth}`;
          const isOpen = key in openState ? openState[key] : (node.open ?? false);

          const label = node.name;

          return (
            <div
              key={`${node.name}-${i.toString()}`}
              role="treeitem"
              aria-selected={selected === node.name || node.active}
              aria-expanded={isFolder ? isOpen : undefined}
              aria-level={node.depth + 1}
              tabIndex={0}
              className={`ide-files-row${isFolder ? " is-folder" : ""}${node.active ? " is-active" : ""}${selected === node.name && !node.active ? " is-selected" : ""}`}
              data-depth={node.depth}
              onClick={() => {
                // single click → select + show inspector insight
                setSelected(node.name);
                onNodeSelect?.(node.name, node.type);

                // double-click detection (300ms window)
                const nodeKey = `${node.name}__${node.depth}`;
                clickCountRef.current[nodeKey] = (clickCountRef.current[nodeKey] ?? 0) + 1;

                if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

                if (clickCountRef.current[nodeKey] >= 2) {
                  // double click
                  clickCountRef.current[nodeKey] = 0;
                  if (isFolder) {
                    toggleFolder(node.name, node.depth);
                  } else {
                    onFileClick?.(node.name);
                  }
                } else {
                  clickTimerRef.current = setTimeout(() => {
                    clickCountRef.current[nodeKey] = 0;
                  }, 300);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (isFolder) toggleFolder(node.name, node.depth);
                  else onFileClick?.(node.name);
                } else if (e.key === " ") {
                  e.preventDefault();
                  setSelected(node.name);
                  onNodeSelect?.(node.name, node.type);
                }
              }}
              onMouseEnter={onHover ? (e) => { onHover(node.name, e.clientX, e.clientY); } : undefined}
              onMouseLeave={onHoverEnd}
              style={{ cursor: "pointer" }}
            >
              {/* indent guide lines */}
              {node.depth > 0 && (
                <span className="ide-files-guides" style={{ width: (node.depth) * 8 }} aria-hidden="true">
                  {Array.from({ length: node.depth }, (_, d) => (
                    <span key={d} className="ide-files-guide-line" />
                  ))}
                </span>
              )}

              {isFolder
                ? <ChevronIcon open={isOpen} />
                : <span className="ide-files-chev-spacer" />
              }
              {isFolder ? <FolderIcon open={isOpen} /> : pickFileIcon(node.name)}

              <span className="ide-files-name">{label}</span>

              {/* git status */}
              {node.git && (
                <span className={`ide-files-git ide-files-git-${node.git.toLowerCase()}`}>
                  {node.git}
                </span>
              )}

              {/* signal chips — only shown on hover/active */}
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
                      <IconClock size={7} strokeWidth={2.5} />
                      {node.stale}
                    </span>
                  )}
                  {node.issues !== undefined && node.issues > 0 && (
                    <span className="ide-files-sig ide-files-sig-issues" data-risk={node.risk ?? 2} title={`${node.issues} issue${node.issues > 1 ? "s" : ""}`}>
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

