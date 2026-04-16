import {
  counterfactualStore,
  useCounterfactualStore,
  METRIC_LABEL,
  type HorizonDays,
  type MetricId,
} from "@quanta/app-ide/entities/counterfactual";
import { TrajectoryGraph } from "@quanta/app-ide/features/counterfactual-graph";
import { tabBus } from "@quanta/shell/stores/tab-bus";

// ── RFC 4 · Counterfactual projection (trajectory graph) ─────────────
const HORIZONS: HorizonDays[] = [7, 14, 30, 90];
const METRICS: MetricId[] = ["risk", "blast", "cpx", "coverage", "incident"];

export function CounterfactualProjection() {
  const projection = useCounterfactualStore((s) => s.projection);
  const input = useCounterfactualStore((s) => s.input);
  const horizon = input.horizonDays;
  const metric = input.metric;

  const apply = projection.trajectoriesByMetric[metric].apply;
  const dismiss = projection.trajectoriesByMetric[metric].dismiss;
  const applyEnd = apply.points[apply.points.length - 1];
  const dismissEnd = dismiss.points[dismiss.points.length - 1];

  return (
    <section className="cfproj">
      <header className="cfproj__h">
        <span className="cfproj__label">Counterfactual projection</span>
        <span className="cfproj__sub">engine-projected · {projection.input.targetSymbol}</span>
        <button
          type="button"
          className="cfproj__open"
          onClick={() => tabBus.open("scenario", "Scenario · execute()")}
        >
          Open scenario <kbd>⌘⇧C</kbd>
        </button>
      </header>

      <div className="cfproj__controls">
        <div className="cfproj__control-group" role="group" aria-label="Horizon">
          <span className="cfproj__control-label">horizon</span>
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className={`cfproj__btn${h === horizon ? " is-active" : ""}`}
              onClick={() => counterfactualStore.setHorizon(h)}
            >
              {h}d
            </button>
          ))}
        </div>
        <div className="cfproj__control-group" role="group" aria-label="Metric">
          <span className="cfproj__control-label">metric</span>
          {METRICS.map((m) => (
            <button
              key={m}
              type="button"
              className={`cfproj__btn${m === metric ? " is-active" : ""}`}
              onClick={() => counterfactualStore.setMetric(m)}
              title={METRIC_LABEL[m]}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="cfproj__graph">
        <TrajectoryGraph projection={projection} metric={metric} horizon={horizon} />
      </div>

      <div className="cfproj__summary">
        <div className="cfproj__stat cfproj__stat--apply">
          <span className="cfproj__stat-k">apply</span>
          <span className="cfproj__stat-v">{fmtMetricForDisplay(metric, applyEnd.median)}</span>
          <span className="cfproj__stat-cost">
            {projection.costs.apply.median.toFixed(1)} ed
          </span>
        </div>
        <div className="cfproj__arrow" aria-hidden>vs</div>
        <div className="cfproj__stat cfproj__stat--dismiss">
          <span className="cfproj__stat-k">dismiss</span>
          <span className="cfproj__stat-v">{fmtMetricForDisplay(metric, dismissEnd.median)}</span>
          <span className="cfproj__stat-cost">
            {projection.costs.dismiss.median.toFixed(1)} ed
          </span>
        </div>
      </div>

      {projection.predictedIncidents.length > 0 && (
        <div className="cfproj__incidents">
          <div className="cfproj__incidents-h">Predicted incidents (dismiss path)</div>
          <ul className="cfproj__incidents-list">
            {projection.predictedIncidents.map((p) => (
              <li key={p.id} className="cfproj__incident">
                <span className="cfproj__incident-icon" aria-hidden>⚠</span>
                <span className="cfproj__incident-id">{p.shapeMatchId}-like</span>
                <span className="cfproj__incident-sim">{Math.round(p.similarity * 100)}%</span>
                <span className="cfproj__incident-when">~{p.likelyWithinDays}d</span>
                <span className="cfproj__incident-reason">{p.reason}</span>
                <span className="cfproj__incident-engine">{p.engineSource}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {projection.historicalAnalog && (
        <p className="cfproj__analog">
          <span className="cfproj__analog-k">historical analog</span>
          {projection.historicalAnalog.when}, {projection.historicalAnalog.where}:
          {" "}{projection.historicalAnalog.similar}. {projection.historicalAnalog.outcome}.
        </p>
      )}

      <p className="cfproj__disclaimer">
        Based on historical signal gradients + incident DNA — confidence bands shown. Not a forecast.
      </p>
    </section>
  );
}

function fmtMetricForDisplay(metric: MetricId, value: number): string {
  if (metric === "coverage") return `${Math.round(value)}%`;
  if (metric === "incident") return value.toFixed(2);
  return Math.round(value).toString();
}
