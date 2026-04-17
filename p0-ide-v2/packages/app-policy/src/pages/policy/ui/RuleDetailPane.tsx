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
  if (entries.length === 0) return <span className="pol-detail__value">any</span>;
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

  return (
    <div className="pol-split__detail">
      {/* Top: ID + status */}
      <div className="pol-detail__top">
        <span className="pol-detail__id">{displayId}</span>
        <span className={cn("pol-status", `pol-status--${rule.status}`)}>
          {rule.status}
        </span>
      </div>

      <h2 className="pol-detail__title">{rule.name}</h2>

      {/* Method description */}
      {rule.method && (
        <div className="pol-detail__method">{rule.method}</div>
      )}

      <p className="pol-detail__desc">{rule.description}</p>

      {/* PR Enforcement */}
      {rule.prEnforcement && (
        <div className="pol-detail__section">
          <span className="pol-detail__section-label">PR Enforcement</span>
          <div className="pol-enforcement">
            <div className="pol-enforcement__row">
              <span className="pol-enforcement__action">
                {rule.prEnforcement.action === "block" ? "Block PR Merge" : rule.prEnforcement.action === "warn" ? "Warn on PR" : "Comment on PR"}
              </span>
              <span className="pol-enforcement__branches">
                {rule.prEnforcement.branches.join(", ")}
              </span>
            </div>
            {rule.prEnforcement.approvalRequired && (
              <div className="pol-enforcement__row">
                <span className="pol-enforcement__action">Security approval required</span>
                {rule.prEnforcement.canaryPercent != null && (
                  <span className="pol-enforcement__branches">Canary {rule.prEnforcement.canaryPercent}%</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metadata rows */}
      <div className="pol-detail__row">
        <span className="pol-detail__label">Category</span>
        <span className="pol-cat-label">{CATEGORY_LABEL[rule.category]}</span>
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Severity</span>
        <span className={cn("pol-sev", severityClass(rule.severity))}>{SEVERITY_LABEL[rule.severity]}</span>
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Engine</span>
        <EngineBadge engine={rule.engine} />
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Constraint</span>
        <span className="pol-detail__value">{rule.constraint}</span>
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Source</span>
        <ScopePills scope={rule.sourceScope} />
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Target</span>
        <ScopePills scope={rule.targetScope} />
      </div>
      <div className="pol-detail__row">
        <span className="pol-detail__label">Owner</span>
        <span className="pol-detail__value">{rule.owner}</span>
      </div>
      {rule.lastTriggeredAt && (
        <div className="pol-detail__row">
          <span className="pol-detail__label">Last triggered</span>
          <span className="pol-detail__value">{relativeTime(rule.lastTriggeredAt)}</span>
        </div>
      )}

      {/* Tags */}
      {rule.tags.length > 0 && (
        <div className="pol-detail__row">
          <span className="pol-detail__label">Tags</span>
          <div className="pol-scope-pills">
            {rule.tags.map((t) => <span key={t} className="pol-tag">{t}</span>)}
          </div>
        </div>
      )}

      {/* Query Matches */}
      <div className="pol-detail__section">
        <span className="pol-detail__section-label">
          Query Matches ({rule.queryMatches.length})
        </span>
        <QueryMatchesList matches={rule.queryMatches} />
      </div>

      {/* Related PRs */}
      {rule.relatedPRs && rule.relatedPRs.length > 0 && (
        <div className="pol-detail__section">
          <span className="pol-detail__section-label">Related PRs</span>
          <div className="pol-related-prs">
            {rule.relatedPRs.map((pr) => (
              <div key={pr} className="pol-related-pr">{pr}</div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pol-detail__actions">
        <button
          type="button"
          className="pol-btn"
          onClick={() => policyStore.editRule(rule.id)}
        >
          Edit rule
        </button>
        <button
          type="button"
          className="pol-btn pol-btn--ghost"
          onClick={() => policyStore.toggleRuleStatus(rule.id)}
        >
          {rule.status === "active" ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
