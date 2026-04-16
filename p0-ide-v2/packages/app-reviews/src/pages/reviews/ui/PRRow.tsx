import { cn } from "@quanta/ui-kit/lib";
import { STATUS_LABEL, type ProofCarryingPR } from "@quanta/app-reviews/entities/proof-pr";

export function PRRow({
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
    <li className={cn(`rev-row rev-row--${pr.status}`, selected && "is-selected")}>
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
            <span className="rev-row__risky">{"\u26A0"} {pr.riskyHunks} risky</span>
          )}
          <span className="rev-row__cf">
            cf: +{(pr.counterfactual.dismissEngDays - pr.counterfactual.applyEngDays).toFixed(1)} ed
          </span>
        </div>
      </button>
    </li>
  );
}
