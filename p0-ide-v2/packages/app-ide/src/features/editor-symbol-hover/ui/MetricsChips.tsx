import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";

export function MetricsChips({ info }: { info: SymbolFacts }) {
  const hasMetrics =
    info.complexity !== undefined || info.tests || info.heat || info.dead;
  if (!hasMetrics) return null;
  return (
    <div className="symtip__metrics">
      {info.complexity !== undefined && (
        <span className="symtip__chip">
          cpx {info.complexity}
          {info.bigO && <span className="symtip__chip-sub"> · {info.bigO}</span>}
        </span>
      )}
      {info.tests && (
        <span
          className={`symtip__chip${info.tests.startsWith("0/") && info.tests !== "0/0" ? " is-bad" : ""}`}
        >
          tests {info.tests}
        </span>
      )}
      {info.heat && (
        <span className={`symtip__chip symtip__chip--heat-${info.heat.level}`}>
          {info.heat.level}
          {info.heat.rate && <span className="symtip__chip-sub"> · {info.heat.rate}</span>}
        </span>
      )}
      {info.dead && <span className="symtip__chip is-muted">dead</span>}
    </div>
  );
}
