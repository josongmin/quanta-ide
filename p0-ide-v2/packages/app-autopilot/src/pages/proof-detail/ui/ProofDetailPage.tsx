import { Check, ExternalLink, FileText, X as XIcon, ShieldCheck, ShieldAlert } from "lucide-react";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import { Button, Chip, Kbd, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import { MetricDelta, ProofBadge } from "@quanta/app-autopilot/shared/ui/viz";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import type { ValidationResult } from "@quanta/app-autopilot/entities/proof";
import "./proof-detail-page.css";

export interface ProofDetailPageProps {
  proofId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function ProofDetailPage({ proofId, navigate }: ProofDetailPageProps) {
  const proof = useAutopilot(selectors.proofById(proofId));
  const run = useAutopilot((s) => (proof ? selectors.runById(proof.runId)(s) : undefined));
  const goal = useAutopilot((s) =>
    proof && proof.goalLinks[0] ? selectors.goalById(proof.goalLinks[0])(s) : undefined,
  );

  if (!proof) {
    return (
      <div className="ap-empty">
        <div className="ap-empty__title">Proof not found.</div>
        <button type="button" className="ap-linklike" onClick={() => navigate({ page: "runs" })}>
          Back to runs
        </button>
      </div>
    );
  }

  const allValidationsPass = proof.validations.every((v) => v.status === "pass");

  return (
    <div className="ap-proof ap-container">
      <header className="ap-detail-head">
        <div className="ap-detail-head__text">
          <div className="ap-proof__eyebrow">
            <ShieldCheck size={12} strokeWidth={2} aria-hidden />
            <span>PROOF ARTIFACT</span>
            <span className="ap-proof__eyebrow-sep">·</span>
            <span className="ap-mono" style={{ color: "var(--fg-muted)" }}>{proof.id}</span>
          </div>
          <h1 className="ap-detail-head__title">
            {run?.branchName ?? "Proof-carrying change"}
          </h1>
          <p className="ap-detail-head__sub">
            {allValidationsPass
              ? "All validations passed. Verifier-backed metrics attached. Reviewer recommendation is deterministic."
              : "Some validations require attention. Review details below."}
          </p>
          <div className="ap-proof__meta">
            {run != null && run.prNumber != null && (
              <Chip tone="accent" mono>PR #{run.prNumber}</Chip>
            )}
            <Chip tone="muted" mono>{proof.operatorId}</Chip>
            <Chip tone="muted">
              risk ·{" "}
              <span style={{ color: proof.risk.tier === "high" ? "var(--danger)" : proof.risk.tier === "medium" ? "var(--warn)" : "var(--success)" }}>
                {proof.risk.tier}
              </span>
            </Chip>
            <Chip tone="muted" mono>confidence {(proof.risk.confidence * 100).toFixed(0)}%</Chip>
            <Chip tone="muted">created {relativeTime(proof.createdAt)}</Chip>
          </div>
        </div>
        <div className="ap-detail-head__actions">
          <Button
            variant="secondary"
            leading={<ExternalLink size={14} strokeWidth={1.8} aria-hidden />}
            onClick={() => tabBus.open("reviews", "Reviews")}
          >
            Open in Reviews
          </Button>
          <Button variant="primary" leading={<Check size={14} strokeWidth={1.8} aria-hidden />}>
            Approve
          </Button>
        </div>
      </header>

      <div className="ap-proof__top">
        <ProofBadge
          recommendation={proof.reviewerRecommendation.kind}
          computedBy={proof.computedBy}
        />
        <div className="ap-proof__rationale">
          <div className="ap-proof__rationale-label">Why this recommendation</div>
          <p>{proof.reviewerRecommendation.rationale}</p>
          {proof.reviewerRecommendation.suggestedReviewerKinds.length > 0 && (
            <div className="ap-proof__reviewers">
              <span className="ap-proof__reviewers-label">Suggested reviewers:</span>
              {proof.reviewerRecommendation.suggestedReviewerKinds.map((k) => (
                <Chip key={k} tone="muted" mono>{k}</Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ap-detail-grid ap-detail-grid--wide-aside">
        <div className="ap-proof__main">
          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Validations</div>
                <div className="ap-card__title">
                  {proof.validations.filter((v) => v.status === "pass").length}/
                  {proof.validations.length} passed
                </div>
              </div>
            </div>
            <ul className="ap-proof__vals">
              {proof.validations.map((v, i) => (
                <li key={i} className={`ap-proof__val is-${v.status}`}>
                  <span className="ap-proof__val-icon" aria-hidden>
                    {v.status === "pass" ? <Check size={14} strokeWidth={2.4} /> : <XIcon size={14} strokeWidth={2.4} />}
                  </span>
                  <div className="ap-proof__val-body">
                    <div className="ap-proof__val-kind">{v.kind}</div>
                    <div className="ap-proof__val-summary">{v.summary}</div>
                  </div>
                  <ValidationStatus v={v} />
                </li>
              ))}
            </ul>
          </section>

          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Metric delta</div>
                <div className="ap-card__title">
                  {proof.metricDiffs.length} metric{proof.metricDiffs.length === 1 ? "" : "s"} moved
                </div>
              </div>
              <span className="ap-card__grow" />
              <Chip
                tone={proof.computedBy === "metric_engine" ? "success" : "warn"}
                leading={
                  proof.computedBy === "metric_engine" ? (
                    <ShieldCheck size={11} strokeWidth={2} aria-hidden />
                  ) : (
                    <ShieldAlert size={11} strokeWidth={2} aria-hidden />
                  )
                }
              >
                {proof.computedBy === "metric_engine" ? "metric engine" : "self-reported"}
              </Chip>
            </div>
            <div className="ap-proof__mdeltas">
              {proof.metricDiffs.map((d) => (
                <MetricDelta
                  key={d.metric}
                  metric={d.metric}
                  before={d.before}
                  after={d.after}
                  layout="stacked"
                />
              ))}
            </div>
          </section>

          {proof.changedFiles.length > 0 && (
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Changed files</div>
                  <div className="ap-card__title">
                    {proof.changedFiles.length} file{proof.changedFiles.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <ul className="ap-proof__files">
                {proof.changedFiles.map((f) => (
                  <li key={f}>
                    <FileText size={12} strokeWidth={1.8} aria-hidden />
                    <span className="ap-mono">{f}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {proof.uncertainties.length > 0 && (
            <section className="ap-card ap-proof__uncertain">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Uncertainties</div>
                  <div className="ap-card__title">
                    {proof.uncertainties.length} item{proof.uncertainties.length === 1 ? "" : "s"} flagged by the operator
                  </div>
                </div>
              </div>
              <ul className="ap-proof__uncertain-list">
                {proof.uncertainties.map((u, i) => (
                  <li key={i}>
                    <span className="ap-proof__uncertain-dot" aria-hidden />
                    <span>{u}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="ap-proof__aside">
          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Verifier</div>
                <div className="ap-card__title">Reproducibility</div>
              </div>
            </div>
            <dl className="ap-kv">
              <dt>computed by</dt>
              <dd>
                <Chip tone={proof.computedBy === "metric_engine" ? "success" : "warn"} mono>
                  {proof.computedBy}
                </Chip>
              </dd>
              <dt>input snap</dt>
              <dd className="ap-mono">{proof.inputSnapshotId}</dd>
              <dt>output snap</dt>
              <dd className="ap-mono">{proof.outputSnapshotId}</dd>
              <dt>repro hash</dt>
              <dd className="ap-mono" style={{ color: "var(--fg)", fontWeight: 500 }}>{proof.reproducibilityHash}</dd>
            </dl>
            <div className="ap-proof__versions">
              <div className="ap-proof__versions-label">Metric versions</div>
              <div className="ap-proof__versions-body">
                {Object.entries(proof.metricVersionSet).map(([k, v]) => (
                  <div key={k} className="ap-proof__versions-row">
                    <span className="ap-mono">{k}</span>
                    <span className="ap-mono" style={{ color: "var(--fg)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Risk</div>
                <div className="ap-card__title">
                  Tier · <span style={{ color: proof.risk.tier === "high" ? "var(--danger)" : proof.risk.tier === "medium" ? "var(--warn)" : "var(--success)" }}>{proof.risk.tier}</span>
                </div>
              </div>
            </div>
            <ul className="ap-proof__risks">
              {proof.risk.reasons.map((r, i) => (
                <li key={i}>
                  <StatDot tone="muted" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>

          {(goal != null || run != null) && (
            <section className="ap-card ap-card--muted">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Context</div>
                  <div className="ap-card__title">Links</div>
                </div>
              </div>
              <dl className="ap-kv">
                {run != null && (
                  <>
                    <dt>run</dt>
                    <dd>
                      <button
                        type="button"
                        className="ap-linklike ap-mono"
                        onClick={() => navigate({ page: "run-detail", id: run.id })}
                      >
                        {run.id}
                      </button>
                    </dd>
                  </>
                )}
                {goal != null && (
                  <>
                    <dt>goal</dt>
                    <dd>
                      <button
                        type="button"
                        className="ap-linklike"
                        onClick={() => navigate({ page: "goal-detail", id: goal.id })}
                      >
                        {goal.name}
                      </button>
                    </dd>
                  </>
                )}
              </dl>
            </section>
          )}

          <div className="ap-proof__hint">
            <Kbd>Esc</Kbd>
            <span>back</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ValidationStatus({ v }: { v: ValidationResult }) {
  return (
    <span className={`ap-proof__val-status is-${v.status}`}>
      {v.status}
    </span>
  );
}
