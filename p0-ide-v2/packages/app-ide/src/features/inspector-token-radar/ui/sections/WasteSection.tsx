import type { AgentRun, WasteCategory } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, fmtKb, fmtPct, MiniDonut, SectionTitle } from "./helpers";

const WASTE_LABEL: Record<WasteCategory, string> = {
  repeated_context:   "repeated context",
  failed_retries:     "failed retries",
  overbroad_review:   "overbroad review",
  full_file_reads:    "full file reads",
  test_log_bloat:     "test log bloat",
  unclear_task_scope: "unclear task scope",
  cancelled_streams:  "cancelled streams",
  compaction_regen:   "compaction regen",
};

const WASTE_TONE: Record<WasteCategory, string> = {
  repeated_context:   "tr-pane__waste--rc",
  failed_retries:     "tr-pane__waste--fr",
  overbroad_review:   "tr-pane__waste--or",
  full_file_reads:    "tr-pane__waste--ff",
  test_log_bloat:     "tr-pane__waste--tl",
  unclear_task_scope: "tr-pane__waste--us",
  cancelled_streams:  "tr-pane__waste--cs",
  compaction_regen:   "tr-pane__waste--cr",
};

/**
 * TIER 2 — Waste attribution (donut) + Context leak detector.
 *
 * "Why was it expensive?" answered as a donut + ranked fixes.
 */
export function WasteSection({ run }: { run: AgentRun }) {
  const totalUsd = run.waste.reduce((a, w) => a + w.usd, 0);
  const slices = run.waste.map((w) => ({
    value: w.percent,
    toneCls: WASTE_TONE[w.category],
    label: WASTE_LABEL[w.category],
  }));

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Waste attribution & context leaks"
        hint="why this run was expensive"
        badge={fmtUsd(totalUsd)}
      />

      <div className="tr-pane__waste-grid">
        <article className="tr-pane__card tr-pane__card--waste">
          <div className="tr-pane__card-h">waste donut</div>
          <div className="tr-pane__waste-donut-wrap">
            <MiniDonut slices={slices} size={132} stroke={18} />
            <div className="tr-pane__waste-donut-center">
              <div className="tr-pane__waste-donut-num">{fmtUsd(totalUsd)}</div>
              <div className="tr-pane__waste-donut-label">avoidable</div>
            </div>
          </div>
          <ul className="tr-pane__waste-list">
            {run.waste.map((w) => (
              <li key={w.category} className="tr-pane__waste-row">
                <i className={`tr-pane__dot ${WASTE_TONE[w.category]}`} />
                <span className="tr-pane__waste-label">{WASTE_LABEL[w.category]}</span>
                <span className="tr-pane__waste-pct">{w.percent}%</span>
                <span className="tr-pane__waste-usd">−{fmtUsd(w.usd)}</span>
                <span className="tr-pane__waste-fix">{w.fix}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="tr-pane__card">
          <div className="tr-pane__card-h">
            context leak detector
            <span className="tr-pane__card-badge">{run.contextLeaks.length}</span>
          </div>
          {run.contextLeaks.length === 0 ? (
            <div className="tr-pane__empty-row">no leaks detected</div>
          ) : (
            <ul className="tr-pane__leaks">
              {run.contextLeaks.map((l) => (
                <li key={l.id} className="tr-pane__leak-row">
                  <div className="tr-pane__leak-row-h">
                    <code className="tr-pane__mono">{l.source}</code>
                    <span className="tr-pane__chip tr-pane__chip--warn">{l.injections}× injected</span>
                    <span className="tr-pane__leak-size">{fmtKb(l.sizeKb)}</span>
                    <span className="tr-pane__leak-waste">−{fmtUsd(l.wastedUsd)}</span>
                  </div>
                  <div className="tr-pane__leak-meta">
                    repetition ratio {fmtPct(l.repetitionRatio)} · {l.recommendation}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
