import { useMemo } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getObservabilityCoverage,
  type ObsSignalKind,
  type ObsSiteStatus,
  type ObsSpan,
} from "@quanta/app-ide/entities/observability-coverage";
import { focusStore } from "@quanta/app-ide/stores/focus-store";

const SIGNAL_ORDER: ObsSignalKind[] = ["log", "metric", "trace", "alert"];
const SIGNAL_LABEL: Record<ObsSignalKind, string> = {
  log: "Log",
  metric: "Metric",
  trace: "Trace",
  alert: "Alert",
};

const STATUS_WEIGHT: Record<ObsSiteStatus, number> = { covered: 1, partial: 0.5, blind: 0 };

export function ObservabilityPane({ file }: { file: FileFacts }) {
  const cov = useMemo(() => getObservabilityCoverage(file.name), [file.name]);

  const summary = useMemo(() => computeSummary(cov.spans), [cov]);

  return (
    <div className="obs-pane">
      <div className="obs-head">
        <div className="obs-head__stat">
          <div className="obs-head__stat-v">{summary.overall}%</div>
          <div className="obs-head__stat-k">overall</div>
        </div>
        <div className="obs-head__stat">
          <div className={`obs-head__stat-v obs-head__stat-v--${tonePct(summary.critical)}`}>{summary.critical}%</div>
          <div className="obs-head__stat-k">critical paths</div>
        </div>
        <div className="obs-head__stat">
          <div className="obs-head__stat-v obs-head__stat-v--bad">{summary.blindCritical}</div>
          <div className="obs-head__stat-k">blind · critical</div>
        </div>
      </div>

      <div className="obs-legend">
        <span className="obs-legend__cell obs-legend__cell--covered" /> covered
        <span className="obs-legend__cell obs-legend__cell--partial" /> partial
        <span className="obs-legend__cell obs-legend__cell--blind" /> blind
      </div>

      <div className="obs-grid" role="table" aria-label="Span × signal coverage">
        <div className="obs-grid__head" role="row">
          <div className="obs-grid__corner" role="columnheader">span</div>
          {SIGNAL_ORDER.map((s) => (
            <div key={s} className="obs-grid__col-h" role="columnheader">{SIGNAL_LABEL[s]}</div>
          ))}
          <div className="obs-grid__col-h" role="columnheader">err / call</div>
          <div className="obs-grid__col-h" role="columnheader">owner</div>
        </div>
        {[...cov.spans].sort(spanSort).map((sp) => (
          <SpanRow key={sp.symbol} sp={sp} />
        ))}
      </div>
    </div>
  );
}

function SpanRow({ sp }: { sp: ObsSpan }) {
  const errRate = sp.callsObserved === 0 ? 0 : sp.errorsObserved / sp.callsObserved;
  return (
    <button
      type="button"
      className={`obs-grid__row${sp.critical ? " is-critical" : ""}`}
      onClick={() => focusStore.jumpTo(sp.startLine)}
      role="row"
    >
      <div className="obs-grid__span" role="cell">
        {sp.critical && <span className="obs-grid__crit-dot" aria-label="critical path" />}
        <span className="obs-grid__sym">{sp.symbol}</span>
        <span className="obs-grid__loc">{sp.file}:{sp.startLine}</span>
      </div>
      {SIGNAL_ORDER.map((sig) => (
        <div key={sig} role="cell" className={`obs-grid__cell obs-grid__cell--${sp.signals[sig]}`} title={`${SIGNAL_LABEL[sig]} · ${sp.signals[sig]}`} />
      ))}
      <div className="obs-grid__err" role="cell">
        <span className={errRate > 0.001 ? "obs-grid__err-v is-bad" : "obs-grid__err-v"}>
          {(errRate * 100).toFixed(2)}%
        </span>
        <span className="obs-grid__err-sub">{sp.errorsObserved}/{(sp.callsObserved / 1000).toFixed(1)}k</span>
      </div>
      <div className="obs-grid__owner" role="cell">{sp.owner}</div>
    </button>
  );
}

function spanSort(a: ObsSpan, b: ObsSpan): number {
  if (a.critical !== b.critical) return a.critical ? -1 : 1;
  return weight(a) - weight(b);
}

function weight(sp: ObsSpan): number {
  return SIGNAL_ORDER.reduce((s, sig) => s + STATUS_WEIGHT[sp.signals[sig]], 0);
}

function computeSummary(spans: ObsSpan[]) {
  if (spans.length === 0) return { overall: 0, critical: 0, blindCritical: 0 };
  const total = spans.length * SIGNAL_ORDER.length;
  const sum = spans.reduce((s, sp) => s + weight(sp), 0);
  const overall = Math.round((sum / total) * 100);
  const critSpans = spans.filter((sp) => sp.critical);
  const critTotal = critSpans.length * SIGNAL_ORDER.length || 1;
  const critSum = critSpans.reduce((s, sp) => s + weight(sp), 0);
  const critical = Math.round((critSum / critTotal) * 100);
  const blindCritical = critSpans.filter((sp) => SIGNAL_ORDER.some((sig) => sp.signals[sig] === "blind")).length;
  return { overall, critical, blindCritical };
}

function tonePct(pct: number): "ok" | "warn" | "bad" {
  if (pct >= 80) return "ok";
  if (pct >= 50) return "warn";
  return "bad";
}
