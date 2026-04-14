import { useCallback, useEffect, useRef, useState } from "react";
import { gitWorkspaceStore, useGitWorkspace } from "@/shared/model/git-workspace";
import "./git-panel.css";

export interface GitPanelProps {
  onOpenFile?: (fileBasename: string) => void;
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function GitPanel({ onOpenFile }: GitPanelProps) {
  const s = useGitWorkspace();
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);
  const [commitMenuOpen, setCommitMenuOpen] = useState(false);
  const commitMenuRef = useRef<HTMLDivElement>(null);
  const [historyOpen, setHistoryOpen] = useState(true);

  const staged = s.files.filter((f) => f.staged);
  const unstaged = s.files.filter((f) => !f.staged);
  const busy = s.busy !== "idle";
  const canCommit = s.commitMessage.trim().length > 0 && staged.length > 0 && !busy;

  useEffect(() => {
    if (!commitMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (commitMenuRef.current && !commitMenuRef.current.contains(e.target as Node)) {
        setCommitMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [commitMenuOpen]);

  const openFile = useCallback(
    (path: string) => {
      onOpenFile?.(basename(path));
    },
    [onOpenFile],
  );

  return (
    <div className="git-panel">
      <div className="git-panel__inner">
        <div className="git-panel__main">
          {s.toast && (
            <div className="git-panel__toast" role="status">
              {s.toast}
            </div>
          )}

          <div className="git-panel__branch">
            <span className="git-panel__branch-label" title="Current branch">
              <GitBranchIcon />
              <span className="git-panel__branch-name">{s.branch}</span>
            </span>
            <button
              type="button"
              className={`git-panel__branch-new${branchFormOpen ? " is-active" : ""}`}
              aria-expanded={branchFormOpen}
              onClick={() => {
                setBranchFormError(null);
                setBranchFormOpen((wasOpen) => {
                  const opening = !wasOpen;
                  if (opening) {
                    setNewBranchName("feature/");
                    queueMicrotask(() => branchInputRef.current?.focus());
                  }
                  return opening;
                });
              }}
            >
              New branch
            </button>
          </div>

          {branchFormOpen && (
            <form
              className="git-panel__new-branch"
              onSubmit={(e) => {
                e.preventDefault();
                const result = gitWorkspaceStore.createAndCheckout(newBranchName);
                if (!result.ok) {
                  setBranchFormError(
                    result.reason === "empty" ? "Enter a branch name" : "Invalid name (letters, numbers, /, _, -, .)",
                  );
                  return;
                }
                setBranchFormOpen(false);
                setNewBranchName("");
                setBranchFormError(null);
              }}
            >
              <input
                ref={branchInputRef}
                type="text"
                className="git-panel__new-branch-input"
                value={newBranchName}
                onChange={(ev) => {
                  setNewBranchName(ev.target.value);
                  setBranchFormError(null);
                }}
                placeholder="feature/name"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={branchFormError != null}
              />
              <button type="submit" className="git-panel__new-branch-submit">
                Create
              </button>
              {branchFormError && <p className="git-panel__new-branch-error">{branchFormError}</p>}
            </form>
          )}

          <div className="git-panel__upstream">
            <span className="git-panel__upstream-track">origin/main</span>
            <span className="git-panel__upstream-badges">
              {s.behind > 0 && (
                <span className="git-panel__badge git-panel__badge--behind" title="Behind remote">
                  ↓{s.behind}
                </span>
              )}
              {s.ahead > 0 && (
                <span className="git-panel__badge git-panel__badge--ahead" title="Ahead of remote">
                  ↑{s.ahead}
                </span>
              )}
              {s.behind === 0 && s.ahead === 0 && (
                <span className="git-panel__badge git-panel__badge--ok">Synced</span>
              )}
            </span>
          </div>

          <section className="git-panel__commit" aria-label="Commit">
            <textarea
              className="git-panel__message"
              rows={3}
              placeholder="Message (⌘⏎ to commit)"
              value={s.commitMessage}
              disabled={busy}
              onChange={(e) => gitWorkspaceStore.setCommitMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canCommit) {
                  e.preventDefault();
                  gitWorkspaceStore.commit(false);
                }
              }}
            />
            <div className="git-panel__commit-row">
              <div className="git-panel__split" ref={commitMenuRef}>
                <button
                  type="button"
                  className="git-panel__commit-primary"
                  disabled={!canCommit}
                  title={!canCommit ? "Stage files and enter a message" : "Commit staged changes"}
                  onClick={() => gitWorkspaceStore.commit(false)}
                >
                  <IconCheck />
                  <span>Commit</span>
                </button>
                <button
                  type="button"
                  className="git-panel__split-chev"
                  disabled={!canCommit}
                  aria-haspopup="menu"
                  aria-expanded={commitMenuOpen}
                  aria-label="More commit actions"
                  onClick={() => setCommitMenuOpen((v) => !v)}
                >
                  <IconChevDown />
                </button>
                {commitMenuOpen && (
                  <div className="git-panel__commit-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="git-panel__commit-menu-item"
                      onClick={() => {
                        gitWorkspaceStore.commit(false);
                        setCommitMenuOpen(false);
                      }}
                    >
                      Commit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="git-panel__commit-menu-item"
                      onClick={() => {
                        gitWorkspaceStore.commit(true);
                        setCommitMenuOpen(false);
                      }}
                    >
                      Commit &amp; push
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="git-panel__quick-links">
              <button type="button" className="git-panel__linkish" disabled={busy || s.files.length === 0} onClick={() => gitWorkspaceStore.stageAll()}>
                Stage all
              </button>
              <span className="git-panel__quick-sep" aria-hidden>
                ·
              </span>
              <button type="button" className="git-panel__linkish" disabled={busy || staged.length === 0} onClick={() => gitWorkspaceStore.unstageAll()}>
                Unstage all
              </button>
            </div>
          </section>

          <section className="git-panel__agent" aria-label="Agent review">
            <button type="button" className="git-panel__agent-head" onClick={() => gitWorkspaceStore.toggleAgentReview()}>
              <IconChevSidebar open={s.agentReviewOpen} />
              <span>Agent review</span>
            </button>
            {s.agentReviewOpen && (
              <div className="git-panel__agent-body">
                <button type="button" className="git-panel__agent-cta" disabled={busy}>
                  Find issues
                </button>
                <button type="button" className="git-panel__agent-secondary" disabled={busy}>
                  Review diffs
                </button>
              </div>
            )}
          </section>

          <GitFileBlock
            title="Staged"
            count={staged.length}
            emptyHint="Nothing staged yet"
            files={staged}
            busy={busy}
            onOpen={openFile}
            mode="staged"
          />

          <GitFileBlock
            title="Changes"
            count={unstaged.length}
            emptyHint="No unstaged changes"
            files={unstaged}
            busy={busy}
            onOpen={openFile}
            mode="unstaged"
          />

          <section className="git-panel__history">
            <button type="button" className="git-panel__history-head" onClick={() => setHistoryOpen((o) => !o)}>
              <span className="git-panel__history-title">
                <IconChevSidebar open={historyOpen} />
                History
              </span>
              <span className="git-panel__history-tools" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="git-panel__icon-btn" disabled={busy} title="Refresh" aria-label="Refresh" onClick={() => gitWorkspaceStore.refresh()}>
                  <IconRefresh />
                </button>
                <button type="button" className="git-panel__icon-btn" disabled={busy} title="Fetch" aria-label="Fetch" onClick={() => gitWorkspaceStore.fetchRemotes()}>
                  <IconCloudDown />
                </button>
                <button type="button" className="git-panel__icon-btn" disabled={busy} title="Pull" aria-label="Pull" onClick={() => gitWorkspaceStore.pull()}>
                  <IconPull />
                </button>
                <button type="button" className="git-panel__icon-btn" disabled={busy || s.ahead === 0} title="Push" aria-label="Push" onClick={() => gitWorkspaceStore.push()}>
                  <IconPush />
                </button>
              </span>
            </button>
            {historyOpen && (
              <ul className="git-panel__log">
                {s.recentCommits.map((c) => (
                  <li key={c.hash} className="git-panel__log-row">
                    <span className={`git-panel__graph git-panel__graph--${c.graphColor}`} style={{ marginLeft: c.lane * 5 }} aria-hidden>
                      <span className="git-panel__graph-dot" />
                    </span>
                    <span className="git-panel__log-hash" title={c.hash}>
                      {c.hash}
                    </span>
                    <span className="git-panel__log-subject">{c.subject}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="git-panel__rail" aria-label="Git actions">
          <button type="button" className="git-panel__rail-btn" disabled={busy} title="Refresh" aria-label="Refresh" onClick={() => gitWorkspaceStore.refresh()}>
            <IconRefresh />
          </button>
          <button type="button" className="git-panel__rail-btn" disabled={busy} title="Fetch" aria-label="Fetch" onClick={() => gitWorkspaceStore.fetchRemotes()}>
            <IconBolt />
          </button>
          <button type="button" className="git-panel__rail-btn" disabled={busy} title="Pull" aria-label="Pull" onClick={() => gitWorkspaceStore.pull()}>
            <IconPull />
          </button>
          <button type="button" className="git-panel__rail-btn" disabled={busy || s.ahead === 0} title="Push" aria-label="Push" onClick={() => gitWorkspaceStore.push()}>
            <IconPush />
          </button>
          <div className="git-panel__rail-spacer" />
          <button type="button" className="git-panel__rail-btn git-panel__rail-btn--danger" disabled={busy || s.files.length === 0} title="Discard all (mock)" aria-label="Discard all" onClick={() => s.files.forEach((f) => gitWorkspaceStore.discardFile(f.id))}>
            <IconDiscard />
          </button>
        </aside>
      </div>
    </div>
  );
}

function GitFileBlock({
  title,
  count,
  emptyHint,
  files,
  busy,
  onOpen,
  mode,
}: {
  title: string;
  count: number;
  emptyHint: string;
  files: { id: string; path: string; letter: string; staged: boolean }[];
  busy: boolean;
  onOpen: (path: string) => void;
  mode: "staged" | "unstaged";
}) {
  return (
    <section className="git-panel__block" aria-label={title}>
      <div className="git-panel__block-head">
        <span className="git-panel__block-title">{title}</span>
        {count > 0 && <span className="git-panel__block-count">{count}</span>}
      </div>
      {files.length === 0 ? (
        <p className="git-panel__block-empty">{emptyHint}</p>
      ) : (
        <ul className="git-panel__file-list">
          {files.map((f) => (
            <li key={f.id} className="git-panel__file-li">
              <button type="button" className="git-panel__file-main" onClick={() => onOpen(f.path)} title={f.path}>
                <span className={`git-panel__letter git-panel__letter--${f.letter.toLowerCase()}`}>{f.letter}</span>
                <span className="git-panel__file-path">{f.path}</span>
              </button>
              <span className="git-panel__file-actions">
                {mode === "unstaged" && (
                  <button type="button" className="git-panel__mini" disabled={busy} title="Stage" aria-label={`Stage ${basename(f.path)}`} onClick={() => gitWorkspaceStore.stageFile(f.id)}>
                    +
                  </button>
                )}
                {mode === "staged" && (
                  <button type="button" className="git-panel__mini" disabled={busy} title="Unstage" aria-label={`Unstage ${basename(f.path)}`} onClick={() => gitWorkspaceStore.unstageFile(f.id)}>
                    −
                  </button>
                )}
                {mode === "unstaged" && (
                  <button type="button" className="git-panel__mini git-panel__mini--danger" disabled={busy} title="Discard" aria-label={`Discard ${basename(f.path)}`} onClick={() => gitWorkspaceStore.discardFile(f.id)}>
                    ×
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GitBranchIcon() {
  return (
    <svg className="git-panel__branch-icon" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="4" cy="3" r="1.4" />
      <circle cx="4" cy="13" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <path d="M4 4.4v7" />
      <path d="M12 7.4v.5a3 3 0 0 1-3 3H6" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 8 6 11 13 4" />
    </svg>
  );
}

function IconChevDown() {
  return (
    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

function IconChevSidebar({ open }: { open: boolean }) {
  return (
    <svg className={`git-panel__chev${open ? " is-open" : ""}`} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 3 11 8 6 13" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 9A5.5 5.5 0 0 0 8 14.5v0a5.5 5.5 0 0 0 5-3.5M13.5 7A5.5 5.5 0 0 0 8 1.5v0a5.5 5.5 0 0 0-5 3.5M1.5 8h4.5V3.5M14.5 8H10v4.5" />
    </svg>
  );
}

function IconCloudDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
      <path d="M8 13V7M6 9l2-2 2 2" />
    </svg>
  );
}

function IconPull() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v9M5 8l3 3 3-3M3 14h10" />
    </svg>
  );
}

function IconPush() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 14V5M5 6l3-3 3 3M3 2h10" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2L4 9h4l-1 5 6-8H9V2z" />
    </svg>
  );
}

function IconDiscard() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="5.5" />
      <line x1="5" y1="5" x2="11" y2="11" />
    </svg>
  );
}
