import type { CounterfactualData } from "./SuggestionOverlay.types";

// ── Topic ③ · Counterfactual damage ──────────────────────────────────
export function CounterfactualCard({ data, riskAfter }: { data: CounterfactualData; riskAfter: number }) {
  const delta = data.riskWithout - riskAfter;
  return (
    <section className="cfact">
      <header className="cfact__h">
        <span className="cfact__label">Counterfactual</span>
        <span className="cfact__sub">if dismissed</span>
        <span className="cfact__delta">
          <span className="cfact__delta-risk">+{delta} risk</span>
          <span className="cfact__delta-sep">·</span>
          <span className="cfact__delta-cost">{data.costDays.toFixed(1)} eng-days</span>
        </span>
      </header>
      <ul className="cfact__list">
        {data.items.map((it, i) => (
          <li key={i} className={`cfact__row cfact__row--${it.state}`}>
            <span className="cfact__icon" aria-hidden>{it.state === "danger" ? "!" : "△"}</span>
            <div className="cfact__text">
              <span className="cfact__label-row">{it.label}</span>
              {it.detail && <span className="cfact__detail">{it.detail}</span>}
            </div>
            <span className="cfact__engine">{it.engine}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
