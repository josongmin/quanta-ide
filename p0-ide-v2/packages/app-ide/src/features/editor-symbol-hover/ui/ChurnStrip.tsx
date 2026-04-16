import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";
import { churnState } from "./symbol-popup.utils";

export function ChurnStrip({ info }: { info: SymbolFacts }) {
  const hasChurn = info.churn90d !== undefined || info.blame;
  if (!hasChurn) return null;
  return (
    <div className="symtip__churn">
      {info.churn90d !== undefined && (
        <span className={`symtip__churn-state symtip__churn-state--${churnState(info.churn90d)}`}>
          {churnState(info.churn90d)}
        </span>
      )}
      {info.blame && (
        <>
          <span className="symtip__sep">·</span>
          <span className="symtip__churn-when">{info.blame.when}</span>
        </>
      )}
      {info.churn90d !== undefined && (
        <>
          <span className="symtip__sep">·</span>
          <span className="symtip__churn-count">{info.churn90d} commits / 90d</span>
        </>
      )}
    </div>
  );
}

export function IncidentBadge({ match }: { match: NonNullable<SymbolFacts["incidentMatch"]> }) {
  return (
    <div className="symtip__incident">
      <span className="symtip__incident-mark">!</span>
      <span className="symtip__incident-body">
        matches <span className="symtip__incident-id">{match.id}</span>
        <span className="symtip__incident-sim">
          {Math.round(match.similarity * 100)}%
        </span>
        <span className="symtip__incident-reason">{match.reason}</span>
      </span>
    </div>
  );
}
