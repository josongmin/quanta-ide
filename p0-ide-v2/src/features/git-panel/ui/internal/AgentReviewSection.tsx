import { gitWorkspaceStore } from "@/shared/model/git-workspace";
import { IconChevSidebar } from "../../lib/icons";

export function AgentReviewSection({
  agentReviewOpen,
  busy,
}: {
  agentReviewOpen: boolean;
  busy: boolean;
}) {
  return (
    <section className="git-panel__section git-panel__section--tail" aria-label="Agent review">
      <button type="button" className="git-panel__section-head git-panel__section-head--toggle" onClick={() => gitWorkspaceStore.commit.toggleAgentReview()}>
        <span className="git-panel__section-left">
          <IconChevSidebar open={agentReviewOpen} />
          <span className="git-panel__section-title">Agent review</span>
        </span>
      </button>
      {agentReviewOpen && (
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
  );
}
