import {
  counterfactualStore,
  useCounterfactualStore,
  METRIC_LABEL,
  METRIC_UNIT,
  type HorizonDays,
  type MetricId,
} from "@/entities/counterfactual";
import { TrajectoryGraph } from "@/features/counterfactual-graph";
import "./scenario-page.css";

const HORIZONS: HorizonDays[] = [7, 14, 30, 90];
const METRICS_GRID: MetricId[] = ["risk", "blast", "cpx", "coverage"];

export function ScenarioPage() {
  const projection = useCounterfactualStore((s) => s.projection);
  const input = useCounterfactualStore((s) => s.input);

  return (
    <div className="scen-page">
      <header className="scen-header">
        <div className="scen-header__left">
          <span className="scen-header__kicker">Scenario · counterfactual</span>
          <span className="scen-header__title">{projection.input.targetSymbol}</span>
        </div>
        <div className="scen-header__meta">
          <span className="scen-header__stat">risk now {input.currentRisk}</span>
          <span className="scen-header__sep">·</span>
          <span className="scen-header__stat">blast {input.currentBlast}</span>
          <span className="scen-header__sep">·</span>
          <span className="scen-header__stat">cpx {input.currentCpx}</span>
          <span className="scen-header__sep">·</span>
          <span className="scen-header__stat">coverage {input.currentCoverage}%</span>
        </div>
        <div className="scen-header__actions">
          <div className="scen-horizon" role="group" aria-label="Horizon">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                className={`scen-horizon__btn${input.horizonDays === h ? " is-active" : ""}`}
                onClick={() => counterfactualStore.setHorizon(h)}
              >
                {h}d
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="scen-page__pitch">
        <span className="scen-pitch__lead">Two futures, one symbol.</span>
        <span className="scen-pitch__body">
          Engine projects apply vs dismiss across 4 metrics. Confidence bands show historical spread.
          Incidents weighted by DNA similarity. Cost in engineer-days.
        </span>
      </div>

      <div className="scen-body">
        <div className="scen-metrics">
          {METRICS_GRID.map((m) => {
            const apply = projection.trajectoriesByMetric[m].apply;
            const dismiss = projection.trajectoriesByMetric[m].dismiss;
            const applyEnd = apply.points[apply.points.length - 1];
            const dismissEnd = dismiss.points[dismiss.points.length - 1];
            return (
              <section key={m} className="scen-metric">
                <header className="scen-metric__h">
                  <span className="scen-metric__label">{METRIC_LABEL[m]}</span>
                  <span className="scen-metric__unit">{METRIC_UNIT[m]}</span>
                </header>
                <div className="scen-metric__graph">
                  <TrajectoryGraph
                    projection={projection}
                    metric={m}
                    horizon={input.horizonDays}
                    width={560}
                    height={180}
                    compact
                  />
                </div>
                <footer className="scen-metric__foot">
                  <span className="scen-metric__pair">
                    <span className="scen-metric__tag scen-metric__tag--apply">apply</span>
                    <span className="scen-metric__val">{fmtMetric(m, applyEnd.median)}</span>
                  </span>
                  <span className="scen-metric__pair">
                    <span className="scen-metric__tag scen-metric__tag--dismiss">dismiss</span>
                    <span className="scen-metric__val">{fmtMetric(m, dismissEnd.median)}</span>
                  </span>
                </footer>
              </section>
            );
          })}
        </div>

        <aside className="scen-side">
          <section className="scen-card">
            <header className="scen-card__h">
              <span className="scen-card__label">Cost delta</span>
            </header>
            <div className="scen-cost">
              <div className="scen-cost__row scen-cost__row--apply">
                <span className="scen-cost__tag">apply</span>
                <span className="scen-cost__median">{projection.costs.apply.median.toFixed(1)} ed</span>
                <span className="scen-cost__range">
                  {projection.costs.apply.low.toFixed(1)}–{projection.costs.apply.high.toFixed(1)}
                </span>
              </div>
              <div className="scen-cost__row scen-cost__row--dismiss">
                <span className="scen-cost__tag">dismiss</span>
                <span className="scen-cost__median">{projection.costs.dismiss.median.toFixed(1)} ed</span>
                <span className="scen-cost__range">
                  {projection.costs.dismiss.low.toFixed(1)}–{projection.costs.dismiss.high.toFixed(1)}
                </span>
              </div>
              <div className="scen-cost__delta">
                dismiss − apply = <b>+{(projection.costs.dismiss.median - projection.costs.apply.median).toFixed(1)}</b> eng-days
              </div>
            </div>
          </section>

          <section className="scen-card">
            <header className="scen-card__h">
              <span className="scen-card__label">Predicted incidents</span>
              <span className="scen-card__count">{projection.predictedIncidents.length}</span>
            </header>
            <ul className="scen-incidents">
              {projection.predictedIncidents.map((p) => (
                <li key={p.id} className="scen-incident">
                  <span className="scen-incident__icon" aria-hidden>⚠</span>
                  <div className="scen-incident__body">
                    <span className="scen-incident__head">
                      <span className="scen-incident__id">{p.shapeMatchId}-like</span>
                      <span className="scen-incident__sim">{Math.round(p.similarity * 100)}%</span>
                      <span className="scen-incident__when">within ~{p.likelyWithinDays}d</span>
                    </span>
                    <span className="scen-incident__reason">{p.reason}</span>
                    <span className="scen-incident__engine">{p.engineSource}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="scen-card">
            <header className="scen-card__h">
              <span className="scen-card__label">Cascade map</span>
              <span className="scen-card__count">{projection.predictedCascade.length}</span>
            </header>
            <ul className="scen-cascade">
              {projection.predictedCascade.map((n) => (
                <li
                  key={n.symbol}
                  className={`scen-cascade__row${n.critical ? " is-critical" : ""}`}
                >
                  <span className={`scen-cascade__dot${n.critical ? " is-critical" : ""}`} aria-hidden />
                  <span className="scen-cascade__sym">{n.symbol}</span>
                  <span className="scen-cascade__layer">{n.layer}</span>
                  <div className="scen-cascade__bar">
                    <span
                      className="scen-cascade__fill"
                      style={{ width: `${Math.round(n.weight * 100)}%` }}
                    />
                  </div>
                  <span className="scen-cascade__reason">{n.reason}</span>
                </li>
              ))}
            </ul>
          </section>

          {projection.historicalAnalog && (
            <section className="scen-card scen-card--analog">
              <header className="scen-card__h">
                <span className="scen-card__label">Historical analog</span>
              </header>
              <div className="scen-analog">
                <div className="scen-analog__when">{projection.historicalAnalog.when}</div>
                <div className="scen-analog__where">{projection.historicalAnalog.where}</div>
                <p className="scen-analog__text">
                  {projection.historicalAnalog.similar}
                </p>
                <p className="scen-analog__outcome">
                  <strong>Outcome:</strong> {projection.historicalAnalog.outcome}
                </p>
              </div>
            </section>
          )}
        </aside>
      </div>

      <footer className="scen-foot">
        Based on historical signal gradients + incident DNA similarity. Not a forecast — treat as scenarios with confidence bands.
      </footer>
    </div>
  );
}

function fmtMetric(metric: MetricId, value: number): string {
  if (metric === "coverage") return `${Math.round(value)}%`;
  if (metric === "incident") return value.toFixed(2);
  return Math.round(value).toString();
}
