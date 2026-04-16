import type { PatchTier, ProofCarryingPR } from "@quanta/app-reviews/entities/proof-pr";
import { TierChip } from "./TierChip";
import { HunkRow } from "./HunkRow";

export function PRProofCards({ pr }: { pr: ProofCarryingPR }) {
  const ratioPct = pr.totalHunks > 0 ? (pr.verifiedHunks / pr.totalHunks) * 100 : 0;
  const tierCounts: Record<PatchTier, number> = {
    mechanical: 0,
    "logic-preserved": 0,
    "new-behavior": 0,
    risky: 0,
  };
  for (const h of pr.hunks) tierCounts[h.tier] += 1;

  return (
    <div className="rev-detail__body">
      <section className="rev-card rev-card--summary">
        <header className="rev-card__h">
          <span className="rev-card__label">Proof summary</span>
          <span className="rev-card__right">
            {pr.verifiedHunks} / {pr.totalHunks} verified &middot; {Math.round(ratioPct)}%
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
            <span className="rev-risk__arrow" aria-hidden>&rarr;</span>
            <span className="rev-risk__num rev-risk__num--after">{pr.riskAfter}</span>
            {pr.riskBefore !== pr.riskAfter && (
              <span className="rev-risk__delta">
                &minus;{pr.riskBefore - pr.riskAfter}
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
  );
}
