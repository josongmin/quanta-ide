import type { QueryMatch } from "@quanta/domain-types/policies";
import { QueryMatchRow } from "./QueryMatchRow";

interface QueryMatchesListProps {
  matches: QueryMatch[];
}

export function QueryMatchesList({ matches }: QueryMatchesListProps) {
  if (matches.length === 0) {
    return (
      <p style={{ color: "var(--fg-subtle)", fontSize: "var(--fs-xs)" }}>
        No code matches detected yet.
      </p>
    );
  }

  return (
    <div className="pol-matches">
      {matches.map((m) => (
        <QueryMatchRow key={m.id} match={m} />
      ))}
    </div>
  );
}
