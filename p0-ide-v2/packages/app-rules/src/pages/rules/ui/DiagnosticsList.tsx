import { cn } from "@quanta/ui-kit/lib";
import type { BuildTarget, Diagnostic } from "@quanta/app-rules/entities/agent-rules";
import { labelFor } from "../lib/rules-page.utils";

export function DiagnosticsList({
  diagnostics,
  targets,
  activeTarget,
  onFocusTarget,
}: {
  diagnostics: readonly Diagnostic[];
  targets: readonly BuildTarget[];
  activeTarget: string;
  onFocusTarget: (id: string) => void;
}) {
  if (diagnostics.length === 0) {
    return (
      <footer className="rules-diag rules-diag--empty">
        <span className="rules-diag__dot" aria-hidden />
        All targets compiled without warnings.
      </footer>
    );
  }
  return (
    <footer className="rules-diag">
      <div className="rules-diag__head">
        <span className="rules-diag__label">Warnings</span>
        <span className="rules-diag__count">{diagnostics.length}</span>
      </div>
      <ul className="rules-diag__list">
        {diagnostics.map((d, i) => {
          const label = labelFor(d.targetId, targets);
          return (
            <li key={i} className={`rules-diag__row rules-diag__row--${d.kind}`}>
              <span className="rules-diag__icon" aria-hidden>⚠</span>
              <button
                type="button"
                className={cn("rules-diag__adapter", d.targetId === activeTarget && "is-active")}
                onClick={() => onFocusTarget(d.targetId)}
              >
                {label}
              </button>
              <span className="rules-diag__msg">{d.message}</span>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}
