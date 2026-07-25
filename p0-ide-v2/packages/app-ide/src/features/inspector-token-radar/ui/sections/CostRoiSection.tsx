import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, fmtPct, fmtTokens, gradeToneCls, LinearBar, SectionTitle, StackBar } from "./helpers";

/**
 * TIER 1 — Cost ROI: Cache + Model right-sizing.
 *
 * Two-column row, mirrored by the hero KPIs above.
 * Cache section is what unlocks the largest dollar savings, so it sits left.
 */
export function CostRoiSection({ run }: { run: AgentRun }) {
  return (
    <div className="tr-pane__section">
      <div className="tr-pane__cost-grid">
        <CacheCard run={run} />
        <ModelAuditCard run={run} />
      </div>
    </div>
  );
}

function CacheCard({ run }: { run: AgentRun }) {
  const c = run.cache;
  const tone = c.hitRatio >= 0.7 ? "ok" : c.hitRatio >= 0.4 ? "warn" : "bad";
  return (
    <article className="tr-pane__card tr-pane__card--cost">
      <SectionTitle
        tier="t1"
        title="Cache hit + breakpoint advisor"
        hint="how much you're leaving on the table"
        badge={fmtPct(c.hitRatio)}
        badgeTone={tone}
      />

      <div className="tr-pane__cache-summary">
        <div className="tr-pane__cache-headline">
          <span className={`tr-pane__cache-num tr-pane__cache-num--${tone}`}>{fmtPct(c.hitRatio)}</span>
          <span className="tr-pane__cache-label">cache hit</span>
        </div>
        <div className="tr-pane__cache-savings">
          <span className="tr-pane__cache-savings-num">{fmtUsd(c.estimatedDailySavingsUsd)}</span>
          <span className="tr-pane__cache-savings-label">/day reachable if breakpoints added</span>
        </div>
      </div>

      <div className="tr-pane__cache-mix">
        <LinearBar value={c.hitRatio} toneCls={`tr-pane__bar-fill--${tone}`} height={8} />
        <div className="tr-pane__cache-mix-row">
          <span>cached {fmtTokens(c.cachedTokens)}</span>
          <span>uncached {fmtTokens(c.uncachedTokens)}</span>
        </div>
      </div>

      <div className="tr-pane__cache-suggestions">
        <div className="tr-pane__list-h">recommended cache_control breakpoints</div>
        <ul className="tr-pane__cache-list">
          {c.suggestions.map((s) => {
            const isStable = s.stability === "stable";
            return (
              <li key={s.label} className={`tr-pane__cache-row${isStable ? " is-stable" : " is-drift"}`}>
                <span className={`tr-pane__chip ${isStable ? "tr-pane__chip--ok" : "tr-pane__chip--info"}`}>
                  {s.stability}
                </span>
                <div className="tr-pane__cache-row-body">
                  <div className="tr-pane__cache-row-label">{s.label}</div>
                  <div className="tr-pane__cache-row-meta">
                    {s.uses} uses · hit {fmtPct(s.hitRatio)} ·{" "}
                    {s.savingsUsd > 0 ? (
                      <strong className="tr-pane__cache-savings-inline">+{fmtUsd(s.savingsUsd)}</strong>
                    ) : (
                      <span className="tr-pane__cache-savings-zero">already optimal</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

function ModelAuditCard({ run }: { run: AgentRun }) {
  const m = run.modelAudit;
  const total = m.actual.reduce((a, s) => a + s.costUsd, 0);
  const rsTotal = m.rightSized.reduce((a, s) => a + s.costUsd, 0);

  const actualSegs = m.actual.map((s) => ({
    share: total > 0 ? s.costUsd / total : 0,
    toneCls: modelToneCls(s.model),
    label: humanModel(s.model),
    tooltip: `${humanModel(s.model)} · ${s.calls} calls · ${fmtUsd(s.costUsd)}`,
  }));
  const rightSizedSegs = m.rightSized.map((s) => ({
    share: rsTotal > 0 ? s.costUsd / rsTotal : 0,
    toneCls: modelToneCls(s.model),
    label: humanModel(s.model),
    tooltip: `${humanModel(s.model)} · ${s.calls} calls · ${fmtUsd(s.costUsd)}`,
  }));

  return (
    <article className="tr-pane__card tr-pane__card--cost">
      <SectionTitle
        tier="t1"
        title="Model right-sizing audit"
        hint="post-hoc: was Opus needed?"
        badge={`grade ${m.score}`}
        badgeTone={m.score === "A" || m.score === "B" ? "ok" : m.score === "C" ? "warn" : "bad"}
      />

      <div className="tr-pane__model-grade">
        <span className={`tr-pane__grade-pill ${gradeToneCls(m.score)}`}>{m.score}</span>
        <div className="tr-pane__model-grade-meta">
          <div className="tr-pane__model-overspend">
            overspend <strong>{fmtUsd(m.overspendUsd)}</strong>
          </div>
          <div className="tr-pane__model-calls">{m.totalCalls} calls audited</div>
        </div>
      </div>

      <div className="tr-pane__model-rows">
        <div className="tr-pane__model-row">
          <div className="tr-pane__model-row-label">actual</div>
          <StackBar segments={actualSegs} />
        </div>
        <div className="tr-pane__model-row">
          <div className="tr-pane__model-row-label">right-sized</div>
          <StackBar segments={rightSizedSegs} />
        </div>
      </div>

      <div className="tr-pane__model-legend">
        {m.actual.map((s) => (
          <span key={s.model} className="tr-pane__model-legend-item">
            <i className={`tr-pane__dot ${modelToneCls(s.model)}`} />
            {humanModel(s.model)} · {s.calls}× · {fmtUsd(s.costUsd)}
          </span>
        ))}
      </div>

      <ul className="tr-pane__model-advice">
        {m.advice.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </article>
  );
}

function modelToneCls(model: string): string {
  if (model === "claude-opus-4-7") return "tr-pane__model--opus";
  if (model === "claude-sonnet-4-6") return "tr-pane__model--sonnet";
  if (model === "claude-haiku-4-5") return "tr-pane__model--haiku";
  return "tr-pane__model--other";
}

function humanModel(model: string): string {
  switch (model) {
    case "claude-opus-4-7":   return "opus 4.7";
    case "claude-sonnet-4-6": return "sonnet 4.6";
    case "claude-haiku-4-5":  return "haiku 4.5";
    case "gpt-4.1":           return "gpt-4.1";
    case "internal-router":   return "router";
    default:                  return model;
  }
}
