import { useCallback, useEffect, useState } from "react";
import { gitWorkspaceStore, useGitWorkspace, type StackedBranch } from "@/shared/model/git-workspace";
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
  const [stackOpen, setStackOpen] = useState(true);
  const [stackSyncOpen, setStackSyncOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const staged = s.files.filter((f) => f.staged);
  const unstaged = s.files.filter((f) => !f.staged);
  const busy = s.busy !== "idle";

  const openFile = useCallback(
    (path: string) => {
      onOpenFile?.(basename(path));
    },
    [onOpenFile],
  );

  useEffect(() => {
    if (!s.selectedStackBranchId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable=true]")) return;
      gitWorkspaceStore.selectStackBranch(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.selectedStackBranchId]);

  return (
    <div className="git-panel">
      {s.toast ? (
        <div className="git-panel__sticky">
          <div className="git-panel__toast" role="status">
            {s.toast}
          </div>
        </div>
      ) : null}

      <div className="git-panel__scroll">
        <GitFileBlock
          title="Changes"
          count={unstaged.length}
          emptyHint="No unstaged changes"
          files={unstaged}
          busy={busy}
          onOpen={openFile}
          mode="unstaged"
        />

        <GitFileBlock
          title="Staged"
          count={staged.length}
          emptyHint="Nothing staged yet"
          files={staged}
          busy={busy}
          onOpen={openFile}
          mode="staged"
        />

        <section className="git-panel__section git-panel__section--stack" aria-label="Stacked pull requests">
          <div className="git-stack__chrome">
            <button type="button" className="git-stack__sync-split" disabled={busy} onClick={() => setStackSyncOpen((o) => !o)}>
              <span>Sync</span>
              <IconChevDown />
            </button>
            {stackSyncOpen && (
              <div className="git-stack__sync-menu" role="menu">
                <button type="button" className="git-stack__sync-item" role="menuitem" onClick={() => { setStackSyncOpen(false); gitWorkspaceStore.notify("Restacked onto trunk (mock)"); }}>
                  Restack onto trunk
                </button>
                <button type="button" className="git-stack__sync-item" role="menuitem" onClick={() => { setStackSyncOpen(false); gitWorkspaceStore.notify("Synced with remote (mock)"); }}>
                  Sync with remote
                </button>
              </div>
            )}
            <div className="git-stack__chrome-tools">
              <button type="button" className="git-panel__icon-btn" disabled={busy} title="Refresh" aria-label="Refresh" onClick={() => gitWorkspaceStore.refresh()}>
                <IconRefresh />
              </button>
              <button type="button" className="git-panel__icon-btn" disabled={busy} title="Push stack" aria-label="Push stack" onClick={() => gitWorkspaceStore.push()}>
                <IconCloudUp />
              </button>
              <button type="button" className="git-panel__icon-btn" title="Stack settings" aria-label="Stack settings" onClick={() => gitWorkspaceStore.notify("Stack settings (mock)", 1800)}>
                <IconSettings />
              </button>
            </div>
          </div>

          <button type="button" className="git-panel__section-head git-panel__section-head--toggle git-panel__section-head--stack" onClick={() => setStackOpen((o) => !o)}>
            <span className="git-panel__section-left">
              <IconChevSidebar open={stackOpen} />
              <span className="git-panel__section-title">Stack</span>
            </span>
            <span className="git-stack__subtitle">PRs · branches</span>
          </button>

          {stackOpen && (
            <>
              <ul className="git-stack__list">
                {s.stackBranches.map((row) => (
                  <StackBranchRow
                    key={row.id}
                    row={row}
                    all={s.stackBranches}
                    selected={s.selectedStackBranchId === row.id}
                    busy={busy}
                    onSelect={() => gitWorkspaceStore.selectStackBranch(row.id)}
                  />
                ))}
              </ul>

              {(() => {
                const sel = s.stackBranches.find((b) => b.id === s.selectedStackBranchId);
                if (!sel) return null;
                return <StackPrCheckoutCard sel={sel} busy={busy} onOpenFile={openFile} />;
              })()}
            </>
          )}
        </section>

        <section className="git-panel__section" aria-label="History">
          <button type="button" className="git-panel__section-head git-panel__section-head--toggle" onClick={() => setHistoryOpen((o) => !o)}>
            <span className="git-panel__section-left">
              <IconChevSidebar open={historyOpen} />
              <span className="git-panel__section-title">History</span>
            </span>
            <span className="git-panel__section-tools" onClick={(e) => e.stopPropagation()}>
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
            <ul className="git-panel__history-list">
              {s.recentCommits.map((c) => (
                <li key={`h-${c.hash}`} className="git-panel__history-row">
                  <span className="git-panel__history-hash" title={c.hash}>
                    {c.hash}
                  </span>
                  <span className="git-panel__history-subject">{c.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="git-panel__section git-panel__section--tail" aria-label="Agent review">
          <button type="button" className="git-panel__section-head git-panel__section-head--toggle" onClick={() => gitWorkspaceStore.toggleAgentReview()}>
            <span className="git-panel__section-left">
              <IconChevSidebar open={s.agentReviewOpen} />
              <span className="git-panel__section-title">Agent review</span>
            </span>
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
      </div>
    </div>
  );
}

function StackPrCheckoutCard({
  sel,
  busy,
  onOpenFile,
}: {
  sel: StackedBranch;
  busy: boolean;
  onOpenFile: (path: string) => void;
}) {
  const prLabel = sel.prNumber != null ? `#${sel.prNumber}` : "—";
  const nFiles = Math.max(1, sel.touchedFiles.length);
  const riskFrom = Math.min(99, 38 + sel.name.length * 2 + sel.depth * 6);
  const riskTo = Math.max(4, 10 - sel.depth * 2);
  const confidence = (0.93 - sel.depth * 0.015).toFixed(2);
  const primaryFile = sel.touchedFiles[0] ?? "workspace";
  const codeSnippet = `+ git fetch origin ${sel.name}\n+ git checkout ${sel.name}\n  # sync ${primaryFile}`;

  return (
    <article
      className="git-checkout-card"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || busy) return;
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        gitWorkspaceStore.checkoutStackBranch(sel.id);
      }}
      aria-label={`Pull request checkout: ${sel.name}`}
    >
      <header className="git-checkout-card__head">
        <span className="git-checkout-card__kicker">PR checkout</span>
        <IconChevDownTiny className="git-checkout-card__head-chev" />
      </header>
      <h3 className="git-checkout-card__title">Switch working tree to branch for review</h3>
      <pre className="git-checkout-card__code">
        <code>{codeSnippet}</code>
      </pre>
      <div className="git-checkout-card__meta">
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Risk</span>
          <span className="git-checkout-card__meta-v">
            {riskFrom} → {riskTo}
          </span>
        </div>
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Confidence</span>
          <span className="git-checkout-card__meta-v">{confidence}</span>
        </div>
        <div className="git-checkout-card__meta-cell">
          <span className="git-checkout-card__meta-k">Affects</span>
          <span className="git-checkout-card__meta-v">
            {nFiles} file{nFiles === 1 ? "" : "s"}
            {sel.prNumber != null ? ` · ${prLabel}` : ""}
          </span>
        </div>
      </div>
      {sel.touchedFiles.length > 0 && (
        <ul className="git-checkout-card__files">
          {sel.touchedFiles.map((p) => (
            <li key={p}>
              <button type="button" className="git-checkout-card__file-link" onClick={() => onOpenFile(p)}>
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
      <footer className="git-checkout-card__actions">
        <button type="button" className="git-checkout-card__dismiss" onClick={() => gitWorkspaceStore.selectStackBranch(null)}>
          Dismiss
          <kbd className="git-checkout-card__kbd git-checkout-card__kbd--muted">Esc</kbd>
        </button>
        <button type="button" className="git-checkout-card__apply" disabled={busy} onClick={() => gitWorkspaceStore.checkoutStackBranch(sel.id)}>
          Check out
          <kbd className="git-checkout-card__kbd git-checkout-card__kbd--on-accent">Enter</kbd>
        </button>
      </footer>
    </article>
  );
}

function IconChevDownTiny({ className }: { className?: string }) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="4 6 8 10 12 6" />
    </svg>
  );
}

function StackBranchRow({
  row,
  all,
  selected,
  busy,
  onSelect,
}: {
  row: StackedBranch;
  all: StackedBranch[];
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  const inGroup = all.filter((b) => b.stackGroup === row.stackGroup);
  const idx = inGroup.findIndex((b) => b.id === row.id);
  const lineAbove = idx > 0;
  const lineBelow = idx < inGroup.length - 1;

  return (
    <li className="git-stack__li">
      <button type="button" className={`git-stack__row${selected ? " is-selected" : ""}`} disabled={busy} onClick={onSelect}>
        <div className="git-stack__lane" aria-hidden>
          {(lineAbove || lineBelow) && (
            <span
              className={[
                "git-stack__spine",
                lineAbove && lineBelow ? "is-mid" : "",
                lineAbove && !lineBelow ? "is-end" : "",
                !lineAbove && lineBelow ? "is-start" : "",
              ].filter(Boolean).join(" ")}
            />
          )}
          <span className="git-stack__dot" />
        </div>
        <span className="git-stack__name">{row.name}</span>
        <span className="git-stack__icons">
          {row.hasOpenPr && (
            <span className="git-stack__pr-badge" title={row.prNumber != null ? `PR #${row.prNumber}` : "Open PR"}>
              <IconPrGlyph />
            </span>
          )}
          {row.pushedToRemote && (
            <span className="git-stack__pushed" title="On remote">
              <IconCloudGlyph />
            </span>
          )}
        </span>
        <span className="git-stack__time">{row.relativeTime}</span>
      </button>
    </li>
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
    <section className="git-panel__section" aria-label={title}>
      <header className="git-panel__section-head">
        <span className="git-panel__section-title">{title}</span>
        {count > 0 && <span className="git-panel__section-count">{count}</span>}
      </header>
      {files.length === 0 ? (
        <p className="git-panel__section-empty">{emptyHint}</p>
      ) : (
        <ul className="git-panel__file-list">
          {files.map((f) => (
            <li key={f.id} className="git-panel__file-li">
              <button type="button" className="git-panel__file-main" onClick={() => onOpen(f.path)} title={f.path}>
                <span
                  className={`git-panel__letter git-panel__letter--${f.letter === "?" ? "unknown" : f.letter.toLowerCase()}`}
                >
                  {f.letter}
                </span>
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

function IconCloudUp() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
      <path d="M8 3v5M6 5l2-2 2 2" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M13.2 2.8l-1.4 1.4M4.2 11.8l-1.4 1.4M13.2 13.2l-1.4-1.4M4.2 4.2 2.8 2.8" />
    </svg>
  );
}

function IconPrGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 6.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCloudGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 11h8a3 3 0 0 0 0-6 3.5 3.5 0 0 0-7 .5A2.5 2.5 0 0 0 4 11z" />
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
