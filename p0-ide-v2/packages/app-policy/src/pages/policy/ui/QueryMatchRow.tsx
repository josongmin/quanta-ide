import { cn } from "@quanta/ui-kit/lib";
import type { QueryMatch } from "@quanta/domain-types/policies";
import { severityClass } from "../lib/policy-page.utils";

interface QueryMatchRowProps {
  match: QueryMatch;
}

export function QueryMatchRow({ match }: QueryMatchRowProps) {
  const loc = match.col
    ? `${match.file}:${match.line}:${match.col}`
    : `${match.file}:${match.line}`;

  return (
    <div className="pol-qm">
      <div className="pol-qm__head">
        <span className="pol-qm__loc">{loc}</span>
        {match.symbol && <span className="pol-qm__sym">{match.symbol}</span>}
        {match.isNew && <span className="pol-qm__new">new</span>}
        <span className={cn("pol-sev pol-qm__conf", severityClass(match.confidence === "high" ? "high" : match.confidence === "medium" ? "medium" : "low"))}>
          {match.confidence}
        </span>
      </div>
      {match.snippet && (
        <pre className="pol-qm__code">{match.snippet}</pre>
      )}
      <p className="pol-qm__why">{match.reason}</p>
    </div>
  );
}
