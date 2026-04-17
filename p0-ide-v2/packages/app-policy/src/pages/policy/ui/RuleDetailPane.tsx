import { cn } from "@quanta/ui-kit/lib";
import type { PolicyRule } from "@quanta/domain-types/policies";
import { CATEGORY_LABEL, SEVERITY_LABEL, formatRuleId } from "@quanta/domain-types/policies";
import { policyStore } from "@quanta/app-policy/entities/policy";
import { severityClass, relativeTime } from "../lib/policy-page.utils";
import { EngineBadge } from "./EngineBadge";
import { QueryMatchesList } from "./QueryMatchesList";

function ScopePills({ scope }: { scope: PolicyRule["sourceScope"] }) {
  const entries = [
    ...(scope.repos ?? []).map((v) => `repo:${v}`),
    ...(scope.services ?? []).map((v) => `svc:${v}`),
    ...(scope.paths ?? []).map((v) => v),
    ...(scope.teams ?? []).map((v) => `team:${v}`),
  ];
  if (entries.length === 0) return <span className="pol-d__val">any</span>;
  return (
    <div className="pol-scope-pills">
      {entries.map((e) => (
        <span key={e} className="pol-scope-pill">{e}</span>
      ))}
    </div>
  );
}

interface RuleDetailPaneProps {
  rule: PolicyRule;
}

export function RuleDetailPane({ rule }: RuleDetailPaneProps) {
  const displayId = formatRuleId(rule.ruleIdPrefix, rule.ruleNumber);
  const matchCount = rule.queryMatches.length;
  const newCount = rule.queryMatches.filter((m) => m.isNew).length;

  return (
    <div className="pol-split__detail">
      {/* ── Hero ── */}
      <div className="pol-d__hero">
        <span className="pol-d__hero-id">{displayId}</span>
        <span className={cn("pol-status", `pol-status--${rule.status}`)}>{rule.status}</span>
      </div>
      <h2 className="pol-d__hero-name">{rule.name}</h2>

      {rule.method && (
        <p className="pol-d__method">{rule.method}</p>
      )}

      {/* ── Stat grid ── */}
      <div className="pol-d__stats">
        <div className="pol-d__stat">
          <span className="pol-d__stat-num">{rule.violationCount}</span>
          <span className="pol-d__stat-label">Violations</span>
        </div>
        <div className="pol-d__stat">
          <span className="pol-d__stat-num">{matchCount}</span>
          <span className="pol-d__stat-label">Matches</span>
        </div>
        <div className="pol-d__stat">
          <span className={cn("pol-d__stat-num", newCount > 0 && "pol-d__stat-num--accent")}>{newCount}</span>
          <span className="pol-d__stat-label">New in PR</span>
        </div>
      </div>

      {/* ── Properties ── */}
      <div className="pol-d__props">
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Severity</span>
          <span className={cn("pol-sev", severityClass(rule.severity))}>{SEVERITY_LABEL[rule.severity]}</span>
        </div>
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Category</span>
          <span className="pol-d__val">{CATEGORY_LABEL[rule.category]}</span>
        </div>
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Engine</span>
          <EngineBadge engine={rule.engine} />
        </div>
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Constraint</span>
          <span className="pol-d__val">{rule.constraint}</span>
        </div>
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Owner</span>
          <span className="pol-d__val">{rule.owner}</span>
        </div>
        {rule.lastTriggeredAt && (
          <div className="pol-d__prop">
            <span className="pol-d__prop-k">Last triggered</span>
            <span className="pol-d__val">{relativeTime(rule.lastTriggeredAt)}</span>
          </div>
        )}
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Source scope</span>
          <ScopePills scope={rule.sourceScope} />
        </div>
        <div className="pol-d__prop">
          <span className="pol-d__prop-k">Target scope</span>
          <ScopePills scope={rule.targetScope} />
        </div>
      </div>

      {/* ── Tags ── */}
      {rule.tags.length > 0 && (
        <div className="pol-d__tags">
          {rule.tags.map((t) => <span key={t} className="pol-tag">{t}</span>)}
        </div>
      )}

      {/* ── PR Enforcement ── */}
      {rule.prEnforcement && (
        <section className="pol-d__section">
          <header className="pol-d__section-head">
            <span className="pol-d__section-title">PR Enforcement</span>
          </header>
          <div className="pol-d__enforcement">
            <div className="pol-d__enf-row">
              <span className="pol-d__enf-action">{rule.prEnforcement.action === "block" ? "Block PR Merge" : rule.prEnforcement.action === "warn" ? "Warn on PR" : "Comment on PR"}</span>
              <span className="pol-d__enf-branches">{rule.prEnforcement.branches.join(" / ")}</span>
            </div>
            {rule.prEnforcement.approvalRequired && (
              <div className="pol-d__enf-row">
                <span className="pol-d__enf-action">Security approval required</span>
                {rule.prEnforcement.canaryPercent != null && (
                  <span className="pol-d__enf-branches">Canary {rule.prEnforcement.canaryPercent}%</span>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Query Matches ── */}
      <section className="pol-d__section">
        <header className="pol-d__section-head">
          <span className="pol-d__section-title">Query Matches</span>
          <span className="pol-d__section-count">{matchCount}</span>
        </header>
        <QueryMatchesList matches={rule.queryMatches} />
      </section>

      {/* ── Related PRs ── */}
      {rule.relatedPRs && rule.relatedPRs.length > 0 && (
        <section className="pol-d__section">
          <header className="pol-d__section-head">
            <span className="pol-d__section-title">Related PRs</span>
            <span className="pol-d__section-count">{rule.relatedPRs.length}</span>
          </header>
          <div className="pol-d__pr-list">
            {rule.relatedPRs.map((pr) => (
              <div key={pr} className="pol-d__pr-row">{pr}</div>
            ))}
          </div>
        </section>
      )}

      {/* ── Actions ── */}
      <div className="pol-d__actions">
        <button type="button" className="pol-btn" onClick={() => policyStore.editRule(rule.id)}>Edit rule</button>
        <button type="button" className="pol-btn pol-btn--ghost" onClick={() => policyStore.toggleRuleStatus(rule.id)}>
          {rule.status === "active" ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
