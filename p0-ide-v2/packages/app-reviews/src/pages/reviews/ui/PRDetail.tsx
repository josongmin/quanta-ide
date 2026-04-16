import {
  prStore,
  STATUS_LABEL,
  type ProofCarryingPR,
} from "@quanta/app-reviews/entities/proof-pr";
import { toast } from "@quanta/shell/stores/toast-store";
import { PRProofCards } from "./PRProofCards";

export function PRDetail({ pr }: { pr: ProofCarryingPR }) {
  function approveVerified() {
    prStore.approveVerified(pr.id);
    toast.success(
      `Approved ${pr.verifiedHunks} verified hunks`,
      `#${pr.number} \u00b7 ${pr.riskyHunks} risky hunks remain for human review`,
      "proof-carrying PR",
    );
  }

  function openInGitHub() {
    toast.info("Would open in GitHub", `branch: ${pr.branch}`, "github");
  }

  function reviewRisky() {
    toast.info("Filtered to risky hunks", `${pr.riskyHunks} hunks queued`, "review");
  }

  return (
    <section className="rev-detail">
      <header className="rev-detail__head">
        <div className="rev-detail__title-row">
          <span className="rev-detail__num">#{pr.number}</span>
          <h2 className="rev-detail__title">{pr.title}</h2>
          <span className={`rev-detail__status rev-detail__status--${pr.status}`}>
            {STATUS_LABEL[pr.status]}
          </span>
        </div>
        <div className="rev-detail__meta">
          <span>agent: <b>{pr.agent.label}</b> ({pr.agent.runtime})</span>
          <span className="rev-detail__sep">&middot;</span>
          <span>{pr.openedAt}</span>
          <span className="rev-detail__sep">&middot;</span>
          <span className="rev-detail__branch">{pr.branch}</span>
          <span className="rev-detail__sep">&middot;</span>
          <span>
            {pr.filesChanged} files &middot; <span className="rev-detail__add">+{pr.additions}</span> /
            <span className="rev-detail__del"> &minus;{pr.deletions}</span>
          </span>
          {pr.proofSignature && (
            <>
              <span className="rev-detail__sep">&middot;</span>
              <span className="rev-detail__sig">{pr.proofSignature}</span>
            </>
          )}
        </div>
      </header>

      <PRProofCards pr={pr} />

      <footer className="rev-detail__foot">
        <button type="button" className="rev-btn rev-btn--ghost" onClick={openInGitHub}>
          Open in GitHub
        </button>
        <div className="rev-detail__foot-actions">
          {pr.riskyHunks > 0 && (
            <button type="button" className="rev-btn rev-btn--warn" onClick={reviewRisky}>
              Review risky ({pr.riskyHunks})
            </button>
          )}
          <button
            type="button"
            className="rev-btn rev-btn--primary"
            onClick={approveVerified}
            disabled={pr.verifiedHunks === 0}
          >
            Approve verified ({pr.verifiedHunks})
          </button>
        </div>
      </footer>
    </section>
  );
}
