import { cn } from "@quanta/ui-kit/lib";
import type { QueryMatch } from "@quanta/domain-types/policies";
import { severityClass } from "../lib/policy-page.utils";

interface QueryMatchRowProps {
  match: QueryMatch;
}

function confidenceClass(c: QueryMatch["confidence"]) {
  return severityClass(c === "high" ? "high" : c === "medium" ? "medium" : "low");
}

export function QueryMatchRow({ match }: QueryMatchRowProps) {
  const loc = match.col
    ? `${match.file}:${match.line}:${match.col}`
    : `${match.file}:${match.line}`;

  return (
    <div className="pol-match">
      <div className="pol-match__top">
        <span className="pol-match__loc">{loc}</span>
        {match.symbol && <span className="pol-tag">{match.symbol}</span>}
        {match.isNew && <span className="pol-match__new">NEW</span>}
        <span className={cn("pol-sev pol-match__confidence", confidenceClass(match.confidence))}>
          {match.confidence}
        </span>
      </div>
      {match.snippet && (
        <pre className="pol-match__snippet">{match.snippet}</pre>
      )}
      <p className="pol-match__reason">{match.reason}</p>
    </div>
  );
}
