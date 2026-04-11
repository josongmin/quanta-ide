import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PanelResizer } from "@/shared/ui";

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

/* ── Icons ──────────────────────────────────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`ide-files-chev${open ? " is-open" : ""}`}
      viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
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

function FileIconPy() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <defs>
        <linearGradient id="py-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4b8bbe" />
          <stop offset="100%" stopColor="#306998" />
        </linearGradient>
        <linearGradient id="py-grad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe873" />
          <stop offset="100%" stopColor="#ffd43b" />
        </linearGradient>
      </defs>
      <path d="M7.7 1.5C5.1 1.5 5.3 2.6 5.3 2.6L5.3 3.7h2.5v.3H4.1C4.1 4 3 4.1 3 6.8c0 2.8 1.5 2.7 1.5 2.7h1V8.2s-.1-1.5 1.5-1.5h2.5s1.4 0 1.4-1.4V3.1s.2-1.6-2.2-1.6zm-1.4.9a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1z" fill="url(#py-grad)" />
      <path d="M8.3 14.5c2.6 0 2.4-1.1 2.4-1.1V12.3H8.2v-.3h3.7c0 0 1.1-.1 1.1-2.8 0-2.8-1.5-2.7-1.5-2.7H10.5V7.8s.1 1.5-1.5 1.5H6.5S5.1 9.3 5.1 10.7v2.2s-.2 1.6 2.2 1.6zm1.4-.9a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1z" fill="url(#py-grad2)" />
    </svg>
  );
}

function FileIconToml() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="#9b5de5" opacity="0.85" />
      <text x="2.5" y="11" fontFamily="monospace" fontSize="6.5" fontWeight="700" fill="#fff">TM</text>
    </svg>
  );
}

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

function FileIconJSON({ color = "#fbbf24" }: { color?: string }) {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2.5c-2 0-3 .8-3 2.5v1.2c0 .9-.5 1.3-1.5 1.3v1c1 0 1.5.4 1.5 1.3V11c0 1.7 1 2.5 3 2.5" />
      <path d="M9 2.5c2 0 3 .8 3 2.5v1.2c0 .9.5 1.3 1.5 1.3v1c-1 0-1.5.4-1.5 1.3V11c0 1.7-1 2.5-3 2.5" />
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

function FileIconNpm() {
  return (
    <svg className="ide-files-icon" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3" width="13" height="10" rx="0.5" fill="#cb3837" />
      <path d="M3 5h10v6h-2.5V6.5H9V11H3z" fill="#fff" />
    </svg>
  );
}

function pickFileIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "package.json" || lower === "package-lock.json") return <FileIconNpm />;
  if (lower === "tsconfig.json" || lower.startsWith("tsconfig.")) return <FileIconJSON color="#3178c6" />;
  if (lower.endsWith(".toml") || lower.endsWith(".ini") || lower.endsWith(".cfg")) return <FileIconToml />;
  if (lower.endsWith(".py")) return <FileIconPy />;
  if (lower.endsWith(".tsx")) return <FileIconTSX />;
  if (lower.endsWith(".ts")) return <FileIconTS />;
  if (lower.endsWith(".jsx")) return <FileIconTSX />;
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return <FileIconTS />;
  if (lower.endsWith(".json")) return <FileIconJSON />;
  if (lower.endsWith(".css") || lower.endsWith(".scss")) return <FileIconCss />;
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return <FileIconMd />;
  return <FileIconGeneric />;
}

function RepoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="3.5" r="1.5" />
      <path d="M4 5v5.5" />
      <path d="M12 5c0 3.5-8 3.5-8 7" />
    </svg>
  );
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
        <svg className="ide-files-repo-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* ── Toolbar ── */}
      <div className="ide-files-toolbar">
        <button type="button" className="ide-files-tool-btn" onClick={expandAll} title="모두 펼치기">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="7 4 3 4 3 20 7 20" /><polyline points="17 4 21 4 21 20 17 20" /><line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>
        <button type="button" className="ide-files-tool-btn" onClick={collapseAll} title="모두 접기">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 6 3 12 9 18" /><polyline points="15 6 21 12 15 18" />
          </svg>
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
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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

