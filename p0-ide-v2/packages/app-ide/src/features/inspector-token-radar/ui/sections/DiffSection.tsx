import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtTokens, fmtUsd, gradeToneCls, SectionTitle } from "./helpers";

/**
 * TIER 2 — Diff efficiency + churn.
 * Same row: how much output we paid for, how much was reverted in-flight.
 */
export function DiffSection({ run }: { run: AgentRun }) {
  const eff = run.diffEfficiency;
  const churn = run.diffChurn;

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Diff efficiency & churn"
        hint="dollars per useful line of code"
      />
      <div className="tr-pane__diff-grid">
        <article className="tr-pane__card">
          <div className="tr-pane__card-h">diff efficiency</div>
          <div className="tr-pane__diff-efficiency">
            <span className={`tr-pane__grade-pill tr-pane__grade-pill--lg ${gradeToneCls(eff.grade)}`}>
              {eff.grade}
            </span>
            <div className="tr-pane__diff-eff-meta">
              <div className="tr-pane__diff-eff-label">{eff.label}</div>
              <div className="tr-pane__diff-eff-tpl">
                <strong>{eff.tokensPerLoc.toLocaleString()}</strong> tokens / changed LoC
              </div>
              <div className="tr-pane__diff-eff-foot">
                {fmtTokens(eff.totalTokens)} tokens · {eff.linesChanged} lines · p{eff.percentile} vs comparable
              </div>
            </div>
          </div>
        </article>

        <article className="tr-pane__card">
          <div className="tr-pane__card-h">diff churn</div>
          <div className="tr-pane__churn-stats">
            <ChurnStat label="added"     value={churn.linesAdded.toString()}   />
            <ChurnStat label="deleted"   value={churn.linesDeleted.toString()} />
            <ChurnStat label="re-added"  value={churn.reAdded.toString()}      tone={churn.reAdded > 50 ? "warn" : undefined} />
            <ChurnStat label="reverted"  value={churn.reverted.toString()}     tone={churn.reverted > 50 ? "warn" : undefined} />
          </div>
          <div className="tr-pane__churn-foot">
            churn ratio <strong>{churn.churnRatio.toFixed(2)}×</strong> · paid <strong>{fmtUsd(churn.churnUsd)}</strong> on lines later removed
          </div>
        </article>
      </div>
    </div>
  );
}

function ChurnStat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div className="tr-pane__churn-stat">
      <div className={`tr-pane__churn-v${tone ? ` tr-pane__churn-v--${tone}` : ""}`}>{value}</div>
      <div className="tr-pane__churn-k">{label}</div>
    </div>
  );
}
