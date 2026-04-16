import { useCallback, useEffect } from "react";
import { gitWorkspaceStore, useGitWorkspace } from "@quanta/app-ide/stores/git-workspace";
import "./git-panel.css";
import { GitFileBlock } from "./internal/GitFileBlock";
import { StackSection } from "./internal/StackSection";
import { HistorySection } from "./internal/HistorySection";
import { AgentReviewSection } from "./internal/AgentReviewSection";

export interface GitPanelProps {
  onOpenFile?: (fileBasename: string) => void;
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function GitPanel({ onOpenFile }: GitPanelProps) {
  const s = useGitWorkspace();

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

        <StackSection
          stackBranches={s.stackBranches}
          selectedStackBranchId={s.selectedStackBranchId}
          busy={busy}
          onOpenFile={openFile}
        />

        <HistorySection
          recentCommits={s.recentCommits}
          busy={busy}
          ahead={s.ahead}
        />

        <AgentReviewSection
          agentReviewOpen={s.agentReviewOpen}
          busy={busy}
        />
      </div>
    </div>
  );
}
