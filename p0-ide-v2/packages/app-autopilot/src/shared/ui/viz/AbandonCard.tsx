import { CircleSlash, ChevronsUp, Scissors } from "lucide-react";
import type { AbandonSignal } from "@quanta/app-autopilot/entities/run";
import { Button } from "@quanta/app-autopilot/shared/ui/primitives";
import "./abandon-card.css";

export interface AbandonCardProps {
  abandon: AbandonSignal;
  onPromote?: () => void;
  onNarrowScope?: () => void;
}

export function AbandonCard({ abandon, onPromote, onNarrowScope }: AbandonCardProps) {
  return (
    <section className="ap-abandon">
      <header className="ap-abandon__head">
        <span className="ap-abandon__icon">
          <CircleSlash size={18} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="ap-abandon__text">
          <h3 className="ap-abandon__title">Autopilot chose to stop</h3>
          <p className="ap-abandon__reason">{abandon.reason}</p>
        </div>
      </header>

      {abandon.blockingSignals.length > 0 && (
        <div className="ap-abandon__block">
          <div className="ap-abandon__block-label">Blocking signals</div>
          <ul className="ap-abandon__list">
            {abandon.blockingSignals.map((s, i) => (
              <li key={i}>
                <span className="ap-abandon__bullet" aria-hidden>·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {abandon.partialEvidence != null && abandon.partialEvidence.length > 0 && (
        <div className="ap-abandon__block">
          <div className="ap-abandon__block-label">Partial evidence (discarded)</div>
          <ul className="ap-abandon__list ap-abandon__list--muted">
            {abandon.partialEvidence.map((s, i) => (
              <li key={i}>
                <span className="ap-abandon__bullet" aria-hidden>·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className="ap-abandon__foot">
        <Button
          variant="primary"
          leading={<ChevronsUp size={14} strokeWidth={1.8} aria-hidden />}
          onClick={onPromote}
        >
          Promote to guarded lane
        </Button>
        <Button
          variant="secondary"
          leading={<Scissors size={14} strokeWidth={1.8} aria-hidden />}
          onClick={onNarrowScope}
        >
          Narrow scope &amp; retry
        </Button>
      </footer>
    </section>
  );
}
