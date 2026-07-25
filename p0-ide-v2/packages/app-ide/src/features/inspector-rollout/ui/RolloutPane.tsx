import "./rollout-pane.css";
import { useMemo, useState } from "react";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getRolloutPlan,
  type GateStatus,
  type ReversibilityFactor,
  type ReversibilityKind,
  type RollbackStep,
  type RolloutGate,
  type RolloutPlan,
  type RolloutStage,
} from "@quanta/app-ide/entities/rollout";

/* ─────────────────────────────────────────────────────────────
 * Static metadata
 * ───────────────────────────────────────────────────────────── */

const GATE_TONE: Record<GateStatus, "pass" | "warn" | "fail"> = {
  "predicted-pass": "pass",
  "predicted-warn": "warn",
  "predicted-fail": "fail",
};

const KIND_LABEL: Record<ReversibilityKind, string> = {
  "code-only": "code-only",
  "flag-gated": "flag-gated",
  "schema-additive": "schema(+)",
  "schema-destructive": "schema(–)",
  "data-write": "data-write",
  "external-side-effect": "side-fx",
};

/** Map a 0-100 score to display tier. */
function scoreTier(score: number): "ok" | "warn" | "bad" {
  if (score >= 80) return "ok";
  if (score >= 55) return "warn";
  return "bad";
}

function scoreTierLabel(tier: "ok" | "warn" | "bad"): string {
  switch (tier) {
    case "ok":
      return "easily reversible";
    case "warn":
      return "partially reversible";
    case "bad":
      return "hard to reverse";
  }
}

/** Format an integer with thin thousands separators. */
function fmtInt(n: number): string {
  return n.toLocaleString();
}

/** Format a request-per-minute value with k-suffix when >= 10k. */
function fmtRpm(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return fmtInt(n);
}

/** Convert seconds into compact `Xs`/`Xm`/`Xm Ys` form. */
function fmtSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

/* ─────────────────────────────────────────────────────────────
 * Sub-components
 * ───────────────────────────────────────────────────────────── */

function ReversibilityGauge({ score }: { score: number }) {
  // Semicircle from 180° (left) → 0° (right). Radius 24, centre (32,30).
  const r = 24;
  const cx = 32;
  const cy = 30;
  const clamped = Math.max(0, Math.min(100, score));
  const angle = Math.PI * (1 - clamped / 100);
  const endX = cx + r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const startX = cx - r;
  const startY = cy;
  const arc = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  const trackArc = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const tier = scoreTier(clamped);
  return (
    <svg
      className="rollout-pane__gauge"
      viewBox="0 0 64 36"
      role="img"
      aria-label={`Reversibility ${clamped} of 100`}
    >
      <path className="rollout-pane__gauge-track" d={trackArc} />
      <path
        className={`rollout-pane__gauge-fill rollout-pane__gauge-fill--${tier}`}
        d={arc}
      />
    </svg>
  );
}

function GateRow({ gate }: { gate: RolloutGate }) {
  const t = GATE_TONE[gate.status];
  return (
    <li className={`rollout-pane__gate rollout-pane__gate--${t}`}>
      <span className="rollout-pane__gate-dot" aria-hidden="true" />
      <span className="rollout-pane__gate-metric">{gate.metric}</span>
      <span className="rollout-pane__gate-thresh">≤ {gate.threshold}</span>
      <span className="rollout-pane__gate-pred">→ {gate.predictedValue}</span>
    </li>
  );
}

function StageCard({ stage }: { stage: RolloutStage }) {
  const willFail = stage.gates.some((g) => g.status === "predicted-fail");
  const idxLabel = String(stage.index + 1).padStart(2, "0");
  const fillPct = Math.max(2, Math.min(100, stage.trafficPct));
  return (
    <article
      className={`rollout-pane__stage${willFail ? " rollout-pane__stage--fail" : ""}`}
    >
      {willFail && <span className="rollout-pane__stage-stripe" aria-hidden="true" />}
      <header className="rollout-pane__stage-head">
        <span className="rollout-pane__stage-pill">{idxLabel}</span>
        <span className="rollout-pane__stage-label">{stage.label}</span>
        <span
          className="rollout-pane__stage-traffic"
          aria-label={`Traffic ${stage.trafficPct}%`}
        >
          <span
            className="rollout-pane__stage-traffic-fill"
            style={{ width: `${fillPct}%` }}
          />
          <span className="rollout-pane__stage-traffic-val">{stage.trafficPct}%</span>
        </span>
        <span className="rollout-pane__chips">
          {stage.regions.map((r) => (
            <span
              key={`r-${r}`}
              className="rollout-pane__chip rollout-pane__chip--region"
            >
              {r}
            </span>
          ))}
          {stage.segments.map((s) => (
            <span key={`s-${s}`} className="rollout-pane__chip rollout-pane__chip--seg">
              {s}
            </span>
          ))}
        </span>
        <span className="rollout-pane__bake">bake {stage.bakeMinutes}m</span>
        {willFail && (
          <span className="rollout-pane__rollback-flag">Auto-rollback predicted</span>
        )}
      </header>
      <div className="rollout-pane__stage-body">
        <ul className="rollout-pane__gates">
          {stage.gates.map((g) => (
            <GateRow key={g.id} gate={g} />
          ))}
        </ul>
        <div className="rollout-pane__impact">
          <div className="rollout-pane__impact-row">
            <span className="rollout-pane__impact-k">Users</span>
            <span className="rollout-pane__impact-v">
              {fmtInt(stage.projectedAffectedUsers)}
            </span>
          </div>
          <div className="rollout-pane__impact-row">
            <span className="rollout-pane__impact-k">Req/min</span>
            <span className="rollout-pane__impact-v">
              {fmtRpm(stage.projectedRequestsPerMin)}
            </span>
          </div>
          <div className="rollout-pane__impact-row">
            <span className="rollout-pane__impact-k">Gates</span>
            <span className="rollout-pane__impact-v">
              {stage.gates.filter((g) => g.status === "predicted-pass").length}/
              {stage.gates.length} pass
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function StageConnector() {
  return (
    <div className="rollout-pane__connector" aria-hidden="true">
      <span className="rollout-pane__connector-line" />
      <span className="rollout-pane__connector-arrow">▾</span>
    </div>
  );
}

function ReversibilityRow({ factor }: { factor: ReversibilityFactor }) {
  const kindMod = factor.reversible
    ? "rollout-pane__rev-kind--reversible"
    : "rollout-pane__rev-kind--irreversible";
  const flagMod = factor.reversible
    ? "rollout-pane__rev-flag--ok"
    : "rollout-pane__rev-flag--bad";
  const widthPct = Math.max(2, Math.min(100, factor.weight * 100));
  return (
    <li className="rollout-pane__rev-row">
      <span className={`rollout-pane__rev-kind ${kindMod}`}>{KIND_LABEL[factor.kind]}</span>
      <span className="rollout-pane__rev-detail" title={factor.detail}>
        {factor.detail}
      </span>
      <span className="rollout-pane__rev-status">
        <span
          className={`rollout-pane__rev-flag ${flagMod}`}
          aria-label={factor.reversible ? "reversible" : "irreversible"}
        >
          {factor.reversible ? "✓" : "✗"}
        </span>
        <span className="rollout-pane__rev-weight" aria-hidden="true">
          <span
            className="rollout-pane__rev-weight-fill"
            style={{ width: `${widthPct}%` }}
          />
        </span>
      </span>
    </li>
  );
}

function RollbackStepCard({ step }: { step: RollbackStep }) {
  return (
    <div className="rollout-pane__rollback-step">
      <div className="rollout-pane__rollback-step-head">
        <span className="rollout-pane__rollback-step-label" title={step.label}>
          {step.label}
        </span>
        {step.manual && (
          <span className="rollout-pane__rollback-step-badge">manual</span>
        )}
      </div>
      <div className="rollout-pane__rollback-step-meta">
        <span>{fmtSeconds(step.estSeconds)}</span>
        <span>·</span>
        <span>{fmtInt(step.blast)}u</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Main pane
 * ───────────────────────────────────────────────────────────── */

interface RolloutPaneProps {
  file: FileFacts;
}

export function RolloutPane({ file }: RolloutPaneProps) {
  const plan = useMemo<RolloutPlan | null>(() => getRolloutPlan(file.name), [file.name]);
  const [showAllFactors, setShowAllFactors] = useState(true);

  if (!plan) {
    return (
      <div className="rollout-pane">
        <div className="rollout-pane__empty">
          No rollout plan registered for <strong>{file.name}</strong>.
        </div>
      </div>
    );
  }

  const tier = scoreTier(plan.reversibilityScore);
  const tierLabel = scoreTierLabel(tier);
  const visibleFactors = showAllFactors
    ? plan.reversibilityFactors
    : plan.reversibilityFactors.filter((f) => !f.reversible);
  const hasIrreversible = plan.reversibilityFactors.some((f) => !f.reversible);

  return (
    <div className="rollout-pane">
      {/* Header tiles */}
      <div className="rollout-pane__head">
        <div className="rollout-pane__tile">
          <span className="rollout-pane__tile-k">Plan</span>
          <span className="rollout-pane__tile-v">
            {plan.stages.length} stages · {plan.estimatedTotalMinutes}m
          </span>
          <span className="rollout-pane__tile-meta">{plan.candidateTitle}</span>
        </div>
        <div className="rollout-pane__tile">
          <span className="rollout-pane__tile-k">Worst-case blast</span>
          <span className="rollout-pane__tile-v">
            {plan.worstCaseBlast.toLocaleString()} users
          </span>
          <span className="rollout-pane__tile-meta">at full traffic</span>
        </div>
        <div className="rollout-pane__tile rollout-pane__tile--gauge">
          <ReversibilityGauge score={plan.reversibilityScore} />
          <div>
            <span className="rollout-pane__tile-k">Reversibility</span>
            <div>
              <span
                className={`rollout-pane__rev-score rollout-pane__rev-score--${tier}`}
              >
                {plan.reversibilityScore}
              </span>
              <span className="rollout-pane__tile-meta"> /100 · {tierLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body: stage flow + reversibility */}
      <div className="rollout-pane__body">
        <section className="rollout-pane__section">
          <h3 className="rollout-pane__section-title">Staged canary flow</h3>
          <div className="rollout-pane__flow">
            {plan.stages.map((stage, i) => (
              <div key={stage.id}>
                <StageCard stage={stage} />
                {i < plan.stages.length - 1 && <StageConnector />}
              </div>
            ))}
          </div>
        </section>

        <aside className="rollout-pane__rev">
          <header className="rollout-pane__rev-head">
            <span
              className={`rollout-pane__rev-score rollout-pane__rev-score--${tier}`}
            >
              {plan.reversibilityScore}
            </span>
            <span className="rollout-pane__rev-tier">{tierLabel}</span>
          </header>
          {hasIrreversible && (
            <button
              type="button"
              className="rollout-pane__rev-tier"
              onClick={() => setShowAllFactors((v) => !v)}
              style={{
                appearance: "none",
                background: "transparent",
                border: 0,
                cursor: "pointer",
                padding: 0,
                textAlign: "left",
              }}
              aria-pressed={!showAllFactors}
            >
              {showAllFactors ? "show only irreversible" : "show all factors"}
            </button>
          )}
          <ul className="rollout-pane__rev-list">
            {visibleFactors.map((factor) => (
              <ReversibilityRow key={factor.id} factor={factor} />
            ))}
          </ul>
        </aside>
      </div>

      {/* Rollback plan */}
      <section className="rollout-pane__section rollout-pane__rollback">
        <h3 className="rollout-pane__section-title">Rollback plan (reverse order)</h3>
        <div className="rollout-pane__rollback-row">
          {plan.rollbackSteps.map((step, i) => (
            <RollbackArrowCell
              key={step.id}
              step={step}
              showArrow={i < plan.rollbackSteps.length - 1}
            />
          ))}
        </div>
      </section>

      <footer className="rollout-pane__foot">
        Staged canary plan · file: <strong>{file.name}</strong>
      </footer>
    </div>
  );
}

function RollbackArrowCell({
  step,
  showArrow,
}: {
  step: RollbackStep;
  showArrow: boolean;
}) {
  return (
    <>
      <RollbackStepCard step={step} />
      {showArrow && (
        <span className="rollout-pane__rollback-arrow" aria-hidden="true">
          ←
        </span>
      )}
    </>
  );
}
