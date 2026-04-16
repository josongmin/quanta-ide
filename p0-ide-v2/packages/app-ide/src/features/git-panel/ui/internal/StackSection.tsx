import { useState } from "react";
import { gitWorkspaceStore, type StackedBranch } from "@quanta/app-ide/stores/git-workspace";
import { IconChevDown, IconChevSidebar, IconRefresh, IconCloudUp, IconSettings } from "../../lib/icons";
import { StackBranchRow } from "./StackBranchRow";
import { StackPrCheckoutCard } from "./StackPrCheckoutCard";

export function StackSection({
  stackBranches,
  selectedStackBranchId,
  busy,
  onOpenFile,
}: {
  stackBranches: StackedBranch[];
  selectedStackBranchId: string | null;
  busy: boolean;
  onOpenFile: (path: string) => void;
}) {
  const [stackOpen, setStackOpen] = useState(true);
  const [stackSyncOpen, setStackSyncOpen] = useState(false);

  return (
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
            {stackBranches.map((row) => (
              <StackBranchRow
                key={row.id}
                row={row}
                all={stackBranches}
                selected={selectedStackBranchId === row.id}
                busy={busy}
                onSelect={() => gitWorkspaceStore.selectStackBranch(row.id)}
              />
            ))}
          </ul>

          {(() => {
            const sel = stackBranches.find((b) => b.id === selectedStackBranchId);
            if (!sel) return null;
            return <StackPrCheckoutCard sel={sel} busy={busy} onOpenFile={onOpenFile} />;
          })()}
        </>
      )}
    </section>
  );
}
