import { useState } from "react";
import { gitWorkspaceStore } from "@/shared/model/git-workspace";
import { IconChevSidebar, IconRefresh, IconCloudDown, IconPull, IconPush } from "../../lib/icons";

export function HistorySection({
  recentCommits,
  busy,
  ahead,
}: {
  recentCommits: { hash: string; subject: string }[];
  busy: boolean;
  ahead: number;
}) {
  const [historyOpen, setHistoryOpen] = useState(true);

  return (
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
          <button type="button" className="git-panel__icon-btn" disabled={busy || ahead === 0} title="Push" aria-label="Push" onClick={() => gitWorkspaceStore.push()}>
            <IconPush />
          </button>
        </span>
      </button>
      {historyOpen && (
        <ul className="git-panel__history-list">
          {recentCommits.map((c) => (
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
  );
}
