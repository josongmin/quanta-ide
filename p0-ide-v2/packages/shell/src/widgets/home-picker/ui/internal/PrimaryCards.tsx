import type { FeatureRecord } from "@quanta/shell/stores/feature-registry";
import { CategoryIcon } from "./CategoryIcon";

export function PrimaryCards({ features }: { features: FeatureRecord[] }) {
  return (
    <div className="hp__cards">
      {features.map((f) => {
        const p = f.primary;
        if (!p) return null;
        return (
          <button
            key={f.id}
            type="button"
            className="hp__card"
            onClick={() => p.tileRun()}
            title={p.tileLabel}
            aria-label={p.tileLabel}
          >
            <span className="hp__card-icon" aria-hidden>
              {f.icon ?? <CategoryIcon category={f.category} />}
            </span>
            <span className="hp__card-body">
              <span className="hp__card-label">{p.tileLabel}</span>
              <span className="hp__card-sub">{f.description}</span>
            </span>
            {p.tileHint && (
              <span className="hp__card-hint" aria-hidden>
                {p.tileHint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
