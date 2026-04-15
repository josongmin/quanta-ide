import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { riskColor } from "@/shared/lib/risk";
import { toast } from "@/shared/model/toast-store";
import { focusStore } from "@/shared/model/focus-store";
import {
  complianceStore,
  useComplianceStore,
  type ComplianceEvent,
} from "@/entities/compliance";
import {
  counterfactualStore,
  useCounterfactualStore,
  METRIC_LABEL,
  type HorizonDays,
  type MetricId,
} from "@/entities/counterfactual";
import { TrajectoryGraph } from "@/features/counterfactual-graph";
import { tabBus } from "@/shared/model/tab-bus";

export type VerifyState = "pass" | "warn" | "info";
export interface VerifyItem {
  state: VerifyState;
  label: string;
  engine: string;
  value?: string;
}

export type CounterfactualState = "danger" | "warn";
export interface CounterfactualItem {
  state: CounterfactualState;
  label: string;
  engine: string;
  detail?: string;
}
export interface CounterfactualData {
  riskWithout: number;
  costDays: number;
  items: CounterfactualItem[];
}

export interface ProofReplayCheck {
  label: string;
  pass: boolean;
  engine: string;
  sample?: string;
}
export interface ProofReplayData {
  status: "pending" | "verified" | "failed";
  verifiedAt?: string;
  checks: ProofReplayCheck[];
}

export type PatchAction = "applied" | "dismissed" | "rolled-back";
export interface PatchTrailEntry {
  id: string;
  when: string;
  action: PatchAction;
  title: string;
  riskBefore: number;
  riskAfter: number;
  author?: string;
  reason?: string;
}

export interface SuggestionData {
  title: string;
  rationale: string;
  diff: string;
  riskBefore: number;
  riskAfter: number;
  verification: VerifyItem[];
  confidence: number;
  counterfactual: CounterfactualData;
  proofReplay: ProofReplayData;
  patchTrail: PatchTrailEntry[];
}

interface Props {
  data: SuggestionData;
  onClose: () => void;
}

const CURRENT_CHANGE_ID = "cs-live";

export function SuggestionOverlay({ data, onClose }: Props) {
  const [replay, setReplay] = useState<ProofReplayData>(data.proofReplay);
  const [applying, setApplying] = useState(false);
  const allEvents = useComplianceStore((s) => s.events);
  const complianceForChange = useMemo(
    () => allEvents.filter((e) => e.changeSetId === CURRENT_CHANGE_ID),
    [allEvents],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleApply();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  function handleApply() {
    if (applying || replay.status === "verified") return;
    setApplying(true);
    toast.info("Applying patch…", data.title, "taint v2 · behavior diff");
    setReplay((r) => ({ ...r, status: "pending" }));

    window.setTimeout(() => {
      setReplay((r) => ({
        ...r,
        status: "verified",
        verifiedAt: "just now",
      }));
      setApplying(false);

      // Run compliance verifiers against this change set
      const events = complianceStore.submit({
        id: CURRENT_CHANGE_ID,
        label: data.title,
        files: ["orchestrator.py"],
        author: "agent",
        agentId: "quanta-agent",
        agentClaim: "no-api-break",
        sessionId: "s-live",
      });
      const lies = events.filter((e) => e.isLie).length;
      const pass = events.filter((e) => e.status === "pass").length;

      toast.success(
        "Patch verified",
        `${pass}/${events.length} compliance rules passed · risk ${data.riskBefore} → ${data.riskAfter}`,
        "proof replay",
      );
      if (lies > 0) {
        toast.danger(
          `Lie detected · ${lies} rule${lies > 1 ? "s" : ""}`,
          "Agent claim did not match engine verdict",
          "compliance",
        );
      }
    }, 1800);
  }

  function handleDismiss() {
    toast.warn("Patch dismissed", "Counterfactual cost recorded in patch trail", "patch trail");
    onClose();
  }

  function handleSimulate() {
    toast.info("Simulate change opened", "Engine will preview blast · taint · cpx delta", "simulate");
    focusStore.toggleSimulate(true);
    onClose();
  }

  return createPortal(
    <div className="sugg-overlay" role="dialog" aria-label="Suggested action">
      <div className="sugg-overlay__scrim" onClick={onClose} aria-hidden />
      <div className="sugg-overlay__panel">
        <div className="sugg-overlay__head">
          <span className="sugg-overlay__kicker">L3 · Suggested action</span>
          <span className="sugg-overlay__title">evidence-backed patch</span>
          <button
            type="button"
            className="sugg-overlay__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="sugg-overlay__body">
          <div className="fix">
            <div className="fix__title-row">
              <span className="fix__title">{data.title}</span>
              <span className="fix__conf">confidence {data.confidence.toFixed(2)}</span>
            </div>
            <p className="fix__rationale">{data.rationale}</p>

            <RiskDelta before={data.riskBefore} after={data.riskAfter} />

            <pre className="fix__code">{data.diff}</pre>

            <VerificationList items={data.verification} />

            <ComplianceCard events={complianceForChange} />

            <CounterfactualProjection />

            <CounterfactualCard data={data.counterfactual} riskAfter={data.riskAfter} />

            <ProofReplay data={replay} />

            <PatchTrail entries={data.patchTrail} />
          </div>
        </div>

        <div className="sugg-overlay__foot">
          <span className="sugg-overlay__hint">
            <kbd>Esc</kbd> dismiss · <kbd>⌘⇧S</kbd> simulate · <kbd>⌘⏎</kbd> apply
          </span>
          <div className="sugg-overlay__actions">
            <button type="button" className="btn btn--ghost" onClick={handleDismiss} disabled={applying}>
              Dismiss
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleSimulate} disabled={applying}>
              Simulate
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleApply}
              disabled={applying || replay.status === "verified"}
            >
              {applying ? "Applying…" : replay.status === "verified" ? "Applied ✓" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function RiskDelta({ before, after }: { before: number; after: number }) {
  const drop = before - after;
  const dropPct = before > 0 ? Math.round((drop / before) * 100) : 0;
  return (
    <div className="rdelta">
      <div className="rdelta__side">
        <RiskRing score={before} />
        <span className="rdelta__label">before</span>
      </div>
      <div className="rdelta__bridge" aria-hidden>
        <span className="rdelta__bridge-arrow">→</span>
        <span className="rdelta__bridge-delta">−{drop}</span>
        <span className="rdelta__bridge-pct">({dropPct}%)</span>
      </div>
      <div className="rdelta__side">
        <RiskRing score={after} />
        <span className="rdelta__label">after</span>
      </div>
    </div>
  );
}

function RiskRing({ score }: { score: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 100));
  const color = riskColor(score);
  return (
    <div className="rring">
      <svg className="rring__svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="rring__score" style={{ color }}>{score}</span>
    </div>
  );
}

function VerificationList({ items }: { items: VerifyItem[] }) {
  return (
    <ul className="verify">
      {items.map((it, i) => (
        <li key={i} className={`verify__row verify__row--${it.state}`}>
          <span className="verify__icon" aria-hidden>
            {it.state === "pass" ? "✓" : it.state === "warn" ? "!" : "·"}
          </span>
          <span className="verify__label">{it.label}</span>
          {it.value && <span className="verify__val">{it.value}</span>}
          <span className="verify__engine">{it.engine}</span>
        </li>
      ))}
    </ul>
  );
}

// ── RFC 2 · Compliance verifier card ─────────────────────────────────
function ComplianceCard({ events }: { events: ComplianceEvent[] }) {
  if (events.length === 0) {
    return (
      <section className="comply comply--empty">
        <header className="comply__h">
          <span className="comply__label">Compliance</span>
          <span className="comply__sub">awaiting apply</span>
        </header>
        <p className="comply__hint">
          On <kbd>Apply</kbd>, engine runs {5} rule verifiers against this change set and issues evidence tokens for each pass.
        </p>
      </section>
    );
  }

  const pass = events.filter((e) => e.status === "pass").length;
  const fail = events.filter((e) => e.status === "fail").length;
  const unknown = events.filter((e) => e.status === "unknown").length;
  const lies = events.filter((e) => e.isLie).length;

  return (
    <section className={`comply${lies > 0 ? " has-lie" : ""}`}>
      <header className="comply__h">
        <span className="comply__label">Compliance</span>
        <span className="comply__sub">verifiers · this change</span>
        <span className="comply__pills">
          <span className="comply__pill comply__pill--pass">{pass} pass</span>
          {fail > 0 && <span className="comply__pill comply__pill--fail">{fail} fail</span>}
          {unknown > 0 && <span className="comply__pill comply__pill--unknown">{unknown} unk</span>}
          {lies > 0 && <span className="comply__pill comply__pill--lie">{lies} LIE</span>}
        </span>
      </header>
      <ul className="comply__list">
        {events.map((e) => (
          <li
            key={e.id}
            className={`comply__row comply__row--${e.status}${e.isLie ? " is-lie" : ""}`}
          >
            <span className={`comply__icon comply__icon--${e.status}`} aria-hidden>
              {e.status === "pass" ? "✓" : e.status === "fail" ? "✗" : "?"}
            </span>
            <div className="comply__text">
              <span className="comply__rule">{e.ruleLabel ?? e.verifierId}</span>
              {e.agentClaim && (
                <span className="comply__claim">
                  agent: <em>{e.agentClaim}</em>
                  {e.isLie && <span className="comply__mismatch"> ↯ mismatch</span>}
                </span>
              )}
              {e.violations && e.violations.length > 0 && (
                <span className="comply__violation">{e.violations[0].message}</span>
              )}
            </div>
            <span className="comply__engine">{e.engineSource}</span>
            {e.evidenceTokenId && (
              <span className="comply__token" title={`evidence token ${e.evidenceTokenId}`}>
                signed
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── RFC 4 · Counterfactual projection (trajectory graph) ─────────────
const HORIZONS: HorizonDays[] = [7, 14, 30, 90];
const METRICS: MetricId[] = ["risk", "blast", "cpx", "coverage", "incident"];

function CounterfactualProjection() {
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

// ── Topic ③ · Counterfactual damage ──────────────────────────────────
function CounterfactualCard({ data, riskAfter }: { data: CounterfactualData; riskAfter: number }) {
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

// ── Topic ③ · Proof replay (post-apply verification) ─────────────────
function ProofReplay({ data }: { data: ProofReplayData }) {
  const passCount = data.checks.filter((c) => c.pass).length;
  const allPass = passCount === data.checks.length;
  return (
    <section className={`proof proof--${data.status}`}>
      <header className="proof__h">
        <span className="proof__label">Proof replay</span>
        <span className={`proof__pill proof__pill--${data.status}`}>
          <span className="proof__dot" aria-hidden />
          {data.status === "verified" ? "verified" : data.status === "failed" ? "failed" : "pending"}
        </span>
        {data.verifiedAt && <span className="proof__when">{data.verifiedAt}</span>}
      </header>

      {data.status === "pending" ? (
        <div className="proof__pending">
          <p className="proof__pending-lead">
            Apply to run post-check — engine will re-run {data.checks.length} verifications against the applied patch.
          </p>
          <ul className="proof__preview">
            {data.checks.map((c, i) => (
              <li key={i} className="proof__preview-row">
                <span className="proof__preview-dot" aria-hidden />
                <span className="proof__preview-label">{c.label}</span>
                <span className="proof__preview-engine">{c.engine}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="proof__summary">
            <span className="proof__pass">{passCount} / {data.checks.length} passed</span>
            {allPass && <span className="proof__banner">behavior preserved · no regressions</span>}
          </div>
          <ul className="proof__checks">
            {data.checks.map((c, i) => (
              <li key={i} className={`proof__check${c.pass ? " is-pass" : " is-fail"}`}>
                <span className="proof__check-icon" aria-hidden>{c.pass ? "✓" : "✗"}</span>
                <span className="proof__check-label">{c.label}</span>
                {c.sample && <span className="proof__check-sample">{c.sample}</span>}
                <span className="proof__check-engine">{c.engine}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ── Topic ③ · Patch trail (session history for this symbol) ──────────
function PatchTrail({ entries }: { entries: PatchTrailEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="ptrail">
      <header className="ptrail__h">
        <span className="ptrail__label">Patch trail</span>
        <span className="ptrail__count">{entries.length} previous</span>
      </header>
      <ul className="ptrail__list">
        {entries.map((e) => {
          const delta = e.riskBefore - e.riskAfter;
          return (
            <li key={e.id} className={`ptrail__row ptrail__row--${e.action}`}>
              <span className="ptrail__icon" aria-hidden>
                {e.action === "applied" ? "✓" : e.action === "dismissed" ? "×" : "↺"}
              </span>
              <div className="ptrail__text">
                <span className="ptrail__title" title={e.title}>{e.title}</span>
                {e.reason && <span className="ptrail__reason">{e.reason}</span>}
              </div>
              <span className="ptrail__delta">
                <span className="ptrail__delta-num">{e.riskBefore}</span>
                <span className="ptrail__delta-arrow">→</span>
                <span className="ptrail__delta-num ptrail__delta-num--after">{e.riskAfter}</span>
                {delta > 0 && <span className="ptrail__delta-saved">−{delta}</span>}
              </span>
              <span className="ptrail__meta">
                {e.author && <span className="ptrail__author">{e.author}</span>}
                <span className="ptrail__when">{e.when}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
