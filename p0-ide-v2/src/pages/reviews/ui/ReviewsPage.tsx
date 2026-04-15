import {
  prStore,
  usePrStore,
  STATUS_LABEL,
  TIER_LABEL,
  TIER_DESC,
  TIER_REVIEW_HINT,
  type PatchTier,
  type PRFilter,
  type PRStatus,
  type ProofCarryingPR,
  type HunkAttestation,
} from "@/entities/proof-pr";
import { toast } from "@/shared/model/toast-store";
import "./reviews-page.css";

const FILTER_ORDER: PRFilter[] = ["all", "auto-merge-ready", "focus-risky", "full-review", "needs-proof"];

export function ReviewsPage() {
  const prs = usePrStore((s) => s.prs);
  const selectedId = usePrStore((s) => s.selectedId);
  const filter = usePrStore((s) => s.filter);

  const filtered = filter === "all" ? prs : prs.filter((pr) => pr.status === filter);
  const selected = prs.find((pr) => pr.id === selectedId) ?? filtered[0];

  const totals = {
    total: prs.length,
    autoMerge: prs.filter((p) => p.status === "auto-merge-ready").length,
    focus: prs.filter((p) => p.status === "focus-risky").length,
    full: prs.filter((p) => p.status === "full-review").length,
    needsProof: prs.filter((p) => p.status === "needs-proof").length,
  };

  return (
    <div className="rev-page">
      <header className="rev-header">
        <div className="rev-header__left">
          <span className="rev-header__kicker">Reviews</span>
          <span className="rev-header__title">Proof-carrying PR queue</span>
        </div>
        <div className="rev-header__meta">
          <span className="rev-header__stat">{totals.total} pending</span>
          <span className="rev-header__sep">·</span>
          <span className="rev-header__stat">{totals.autoMerge} auto-merge</span>
          <span className="rev-header__sep">·</span>
          <span className="rev-header__stat rev-header__stat--warn">{totals.focus} focus</span>
          <span className="rev-header__sep">·</span>
          <span className="rev-header__stat rev-header__stat--danger">{totals.needsProof} needs proof</span>
        </div>
      </header>

      <div className="rev-page__pitch">
        <span className="rev-pitch__lead">Proof travels with every PR.</span>
        <span className="rev-pitch__body">
          Verified hunks are auto-approved; risky hunks get focused review. Engine proof attached as
          <code> .quanta-proof.json</code> and commit trailer.
        </span>
      </div>

      <div className="rev-body">
        <aside className="rev-list-col">
          <nav className="rev-filter" role="tablist">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={f === filter}
                className={`rev-filter__btn${f === filter ? " is-active" : ""}`}
                onClick={() => prStore.setFilter(f)}
              >
                {f === "all" ? "All" : STATUS_LABEL[f as PRStatus]}
              </button>
            ))}
          </nav>
          <ul className="rev-list">
            {filtered.map((pr) => (
              <PRRow
                key={pr.id}
                pr={pr}
                selected={pr.id === selected?.id}
                onSelect={() => prStore.select(pr.id)}
              />
            ))}
          </ul>
        </aside>

        {selected && <PRDetail pr={selected} />}
      </div>
    </div>
  );
}

function PRRow({
  pr,
  selected,
  onSelect,
}: {
  pr: ProofCarryingPR;
  selected: boolean;
  onSelect: () => void;
}) {
  const ratioPct = pr.totalHunks > 0 ? (pr.verifiedHunks / pr.totalHunks) * 100 : 0;
  return (
    <li className={`rev-row rev-row--${pr.status}${selected ? " is-selected" : ""}`}>
      <button type="button" className="rev-row__btn" onClick={onSelect}>
        <div className="rev-row__top">
          <span className="rev-row__num">#{pr.number}</span>
          <span className={`rev-row__status rev-row__status--${pr.status}`}>
            <span className="rev-row__status-dot" aria-hidden />
            {STATUS_LABEL[pr.status]}
          </span>
          <span className="rev-row__agent">{pr.agent.label}</span>
          <span className="rev-row__time">{pr.openedAt}</span>
        </div>
        <div className="rev-row__title" title={pr.title}>{pr.title}</div>
        <div className="rev-row__proof">
          <div className="rev-row__bar">
            <span
              className="rev-row__fill"
              style={{ width: `${ratioPct}%` }}
            />
          </div>
          <span className="rev-row__ratio">
            <b>{pr.verifiedHunks}</b>/{pr.totalHunks}
          </span>
          {pr.riskyHunks > 0 && (
            <span className="rev-row__risky">⚠ {pr.riskyHunks} risky</span>
          )}
          <span className="rev-row__cf">
            cf: +{(pr.counterfactual.dismissEngDays - pr.counterfactual.applyEngDays).toFixed(1)} ed
          </span>
        </div>
      </button>
    </li>
  );
}

function PRDetail({ pr }: { pr: ProofCarryingPR }) {
  const ratioPct = pr.totalHunks > 0 ? (pr.verifiedHunks / pr.totalHunks) * 100 : 0;
  const tierCounts: Record<PatchTier, number> = {
    mechanical: 0,
    "logic-preserved": 0,
    "new-behavior": 0,
    risky: 0,
  };
  for (const h of pr.hunks) tierCounts[h.tier] += 1;

  function approveVerified() {
    prStore.approveVerified(pr.id);
    toast.success(
      `Approved ${pr.verifiedHunks} verified hunks`,
      `#${pr.number} · ${pr.riskyHunks} risky hunks remain for human review`,
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
          <span className="rev-detail__sep">·</span>
          <span>{pr.openedAt}</span>
          <span className="rev-detail__sep">·</span>
          <span className="rev-detail__branch">{pr.branch}</span>
          <span className="rev-detail__sep">·</span>
          <span>
            {pr.filesChanged} files · <span className="rev-detail__add">+{pr.additions}</span> /
            <span className="rev-detail__del"> −{pr.deletions}</span>
          </span>
          {pr.proofSignature && (
            <>
              <span className="rev-detail__sep">·</span>
              <span className="rev-detail__sig">{pr.proofSignature}</span>
            </>
          )}
        </div>
      </header>

      <div className="rev-detail__body">
        <section className="rev-card rev-card--summary">
          <header className="rev-card__h">
            <span className="rev-card__label">Proof summary</span>
            <span className="rev-card__right">
              {pr.verifiedHunks} / {pr.totalHunks} verified · {Math.round(ratioPct)}%
            </span>
          </header>
          <div className="rev-bar">
            <span className="rev-bar__fill" style={{ width: `${ratioPct}%` }} />
            <span
              className="rev-bar__risky"
              style={{ width: `${(pr.riskyHunks / Math.max(pr.totalHunks, 1)) * 100}%` }}
            />
          </div>
          <div className="rev-tiers">
            <TierChip tier="mechanical"       count={tierCounts.mechanical} />
            <TierChip tier="logic-preserved"  count={tierCounts["logic-preserved"]} />
            <TierChip tier="new-behavior"     count={tierCounts["new-behavior"]} />
            <TierChip tier="risky"            count={tierCounts.risky} />
          </div>
        </section>

        <div className="rev-side-grid">
          <section className="rev-card rev-card--cf">
            <header className="rev-card__h">
              <span className="rev-card__label">Counterfactual</span>
            </header>
            <div className="rev-cf">
              <div className="rev-cf__row rev-cf__row--apply">
                <span className="rev-cf__tag">apply</span>
                <span className="rev-cf__val">{pr.counterfactual.applyEngDays.toFixed(1)} ed</span>
              </div>
              <div className="rev-cf__row rev-cf__row--dismiss">
                <span className="rev-cf__tag">dismiss</span>
                <span className="rev-cf__val">{pr.counterfactual.dismissEngDays.toFixed(1)} ed</span>
              </div>
              <div className="rev-cf__delta">
                saved <b>{(pr.counterfactual.dismissEngDays - pr.counterfactual.applyEngDays).toFixed(1)}</b> eng-days
              </div>
            </div>
          </section>

          <section className="rev-card rev-card--compliance">
            <header className="rev-card__h">
              <span className="rev-card__label">Compliance</span>
            </header>
            <div className="rev-compliance">
              <span className="rev-compliance__item rev-compliance__item--pass">
                <span className="rev-compliance__v">{pr.compliance.pass}</span>
                <span className="rev-compliance__k">pass</span>
              </span>
              {pr.compliance.fail > 0 && (
                <span className="rev-compliance__item rev-compliance__item--fail">
                  <span className="rev-compliance__v">{pr.compliance.fail}</span>
                  <span className="rev-compliance__k">fail</span>
                </span>
              )}
              {pr.compliance.unknown > 0 && (
                <span className="rev-compliance__item rev-compliance__item--unknown">
                  <span className="rev-compliance__v">{pr.compliance.unknown}</span>
                  <span className="rev-compliance__k">unk</span>
                </span>
              )}
              {pr.compliance.lies > 0 && (
                <span className="rev-compliance__item rev-compliance__item--lie">
                  <span className="rev-compliance__v">{pr.compliance.lies}</span>
                  <span className="rev-compliance__k">LIE</span>
                </span>
              )}
            </div>
          </section>

          <section className="rev-card rev-card--risk">
            <header className="rev-card__h">
              <span className="rev-card__label">Risk delta</span>
            </header>
            <div className="rev-risk">
              <span className="rev-risk__num rev-risk__num--before">{pr.riskBefore}</span>
              <span className="rev-risk__arrow" aria-hidden>→</span>
              <span className="rev-risk__num rev-risk__num--after">{pr.riskAfter}</span>
              {pr.riskBefore !== pr.riskAfter && (
                <span className="rev-risk__delta">
                  −{pr.riskBefore - pr.riskAfter}
                </span>
              )}
            </div>
          </section>
        </div>

        <section className="rev-card rev-card--hunks">
          <header className="rev-card__h">
            <span className="rev-card__label">Hunks</span>
            <span className="rev-card__right">{pr.hunks.length}</span>
          </header>
          {pr.hunks.length === 0 ? (
            <p className="rev-hunks__empty">
              No proof attached yet. Run <code>quanta pr prepare</code> on this branch to generate per-hunk attestation.
            </p>
          ) : (
            <ul className="rev-hunks">
              {pr.hunks.map((h) => (
                <HunkRow key={h.id} hunk={h} />
              ))}
            </ul>
          )}
        </section>
      </div>

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

function TierChip({ tier, count }: { tier: PatchTier; count: number }) {
  return (
    <span className={`rev-tier rev-tier--${tier}`}>
      <span className="rev-tier__count">{count}</span>
      <span className="rev-tier__label">{TIER_LABEL[tier]}</span>
      <span className="rev-tier__hint">{TIER_REVIEW_HINT[tier]}</span>
    </span>
  );
}

function HunkRow({ hunk }: { hunk: HunkAttestation }) {
  const passCount = hunk.checks.filter((c) => c.status === "pass").length;
  const failCount = hunk.checks.filter((c) => c.status === "fail").length;
  const unknownCount = hunk.checks.filter((c) => c.status === "unknown").length;
  return (
    <li className={`rev-hunk rev-hunk--${hunk.tier}${hunk.tier === "risky" ? " is-focus" : ""}`}>
      <div className="rev-hunk__head">
        <span className={`rev-hunk__tier-badge rev-hunk__tier-badge--${hunk.tier}`}>
          {TIER_LABEL[hunk.tier]}
        </span>
        <span className="rev-hunk__file">{hunk.file}</span>
        <span className="rev-hunk__lines">L{hunk.lineRange[0]}–{hunk.lineRange[1]}</span>
        <span className="rev-hunk__hint" title={TIER_DESC[hunk.tier]}>
          {TIER_REVIEW_HINT[hunk.tier]}
        </span>
      </div>
      {hunk.note && <div className="rev-hunk__note">{hunk.note}</div>}
      <div className="rev-hunk__checks">
        {hunk.checks.map((c, i) => (
          <span key={i} className={`rev-hunk__check rev-hunk__check--${c.status}`}>
            <span className="rev-hunk__check-dot" aria-hidden />
            <span className="rev-hunk__check-verifier">{c.verifier}</span>
            {c.detail && <span className="rev-hunk__check-detail">{c.detail}</span>}
          </span>
        ))}
      </div>
      <div className="rev-hunk__foot">
        {hunk.riskBefore !== hunk.riskAfter && (
          <span className="rev-hunk__risk">
            risk {hunk.riskBefore} → <b>{hunk.riskAfter}</b>
          </span>
        )}
        <span className="rev-hunk__tally">
          {passCount > 0 && <span className="rev-hunk__tally-pass">{passCount} pass</span>}
          {failCount > 0 && <span className="rev-hunk__tally-fail">{failCount} fail</span>}
          {unknownCount > 0 && <span className="rev-hunk__tally-unk">{unknownCount} unk</span>}
        </span>
      </div>
    </li>
  );
}
