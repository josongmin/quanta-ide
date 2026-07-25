import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, fmtMs, SectionTitle } from "./helpers";

/**
 * TIER 1 — Cost forecast / ETA + comparable-task benchmark.
 *
 * Renders a horizontal "thermometer": where this run sits relative to median
 * and p95 of comparable tasks. Z-score is the headline.
 */
export function ForecastSection({ run }: { run: AgentRun }) {
  const f = run.forecast;
  const overspend = f.zScore >= 1.5;
  const zTone = f.zScore >= 2 ? "bad" : f.zScore >= 1 ? "warn" : "ok";

  // Thermometer scale: 0 → max(p95, projected) * 1.1
  const upper = Math.max(f.p95SimilarUsd, f.projectedTotalUsd, run.costUsd) * 1.1;
  const pos = (v: number) => `${Math.min(100, (v / upper) * 100).toFixed(1)}%`;

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t1"
        title="Cost forecast vs comparable tasks"
        hint={`tag "${f.comparableTag}" · n=${f.similarN}`}
        badge={`${f.zScore.toFixed(1)}σ`}
        badgeTone={zTone}
      />

      <div className={`tr-pane__forecast${overspend ? " is-overspend" : ""}`}>
        <div className="tr-pane__forecast-stats">
          <ForecastStat label="burn" value={`${fmtUsd(f.burnUsdPerMin)}/min`} tone={f.burnUsdPerMin > 1 ? "warn" : undefined} />
          <ForecastStat label="elapsed" value={fmtMs(f.elapsedMs)} />
          <ForecastStat label="projected total" value={fmtUsd(f.projectedTotalUsd)} tone={overspend ? "bad" : "ok"} />
          <ForecastStat label="median similar" value={fmtUsd(f.medianSimilarUsd)} />
          <ForecastStat label="p95 similar" value={fmtUsd(f.p95SimilarUsd)} />
        </div>

        <div className="tr-pane__therm" role="img" aria-label="cost vs comparable distribution">
          <div className="tr-pane__therm-track">
            <span className="tr-pane__therm-band tr-pane__therm-band--ok"   style={{ left: 0,             width: pos(f.medianSimilarUsd) }} />
            <span className="tr-pane__therm-band tr-pane__therm-band--warn" style={{ left: pos(f.medianSimilarUsd), width: `calc(${pos(f.p95SimilarUsd)} - ${pos(f.medianSimilarUsd)})` }} />
            <span className="tr-pane__therm-band tr-pane__therm-band--bad"  style={{ left: pos(f.p95SimilarUsd),   right: 0 }} />

            <span className="tr-pane__therm-tick tr-pane__therm-tick--median" style={{ left: pos(f.medianSimilarUsd) }} title={`median ${fmtUsd(f.medianSimilarUsd)}`}>
              <span className="tr-pane__therm-tick-label">median</span>
            </span>
            <span className="tr-pane__therm-tick tr-pane__therm-tick--p95" style={{ left: pos(f.p95SimilarUsd) }} title={`p95 ${fmtUsd(f.p95SimilarUsd)}`}>
              <span className="tr-pane__therm-tick-label">p95</span>
            </span>

            <span className="tr-pane__therm-marker tr-pane__therm-marker--current" style={{ left: pos(run.costUsd) }} title={`now ${fmtUsd(run.costUsd)}`}>
              <span className="tr-pane__therm-marker-label">now {fmtUsd(run.costUsd)}</span>
            </span>
            <span className="tr-pane__therm-marker tr-pane__therm-marker--projected" style={{ left: pos(f.projectedTotalUsd) }} title={`projected ${fmtUsd(f.projectedTotalUsd)}`}>
              <span className="tr-pane__therm-marker-label">eta {fmtUsd(f.projectedTotalUsd)}</span>
            </span>
          </div>

          <div className="tr-pane__therm-legend">
            <span><i className="tr-pane__dot tr-pane__dot--ok" /> ≤ median</span>
            <span><i className="tr-pane__dot tr-pane__dot--warn" /> median–p95</span>
            <span><i className="tr-pane__dot tr-pane__dot--bad" /> &gt; p95</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ForecastStat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="tr-pane__forecast-stat">
      <div className={`tr-pane__forecast-v${tone ? ` tr-pane__forecast-v--${tone}` : ""}`}>{value}</div>
      <div className="tr-pane__forecast-k">{label}</div>
    </div>
  );
}
