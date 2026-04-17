import { cn } from "@quanta/ui-kit/lib";
import type { PolicyRule } from "@quanta/domain-types/policies";
import { SEVERITY_LABEL, formatRuleId } from "@quanta/domain-types/policies";
import { policyStore } from "@quanta/app-policy/entities/policy";
import { severityClass, relativeTime } from "../lib/policy-page.utils";
import { EngineBadge } from "./EngineBadge";

interface RuleListItemProps {
  rule: PolicyRule;
  isSelected: boolean;
}

export function RuleListItem({ rule, isSelected }: RuleListItemProps) {
  const displayId = formatRuleId(rule.ruleIdPrefix, rule.ruleNumber);
  const matchCount = rule.queryMatches.length;

  return (
    <div
      className={cn("pol-ri", isSelected && "is-selected")}
      onClick={() => policyStore.selectRule(rule.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") policyStore.selectRule(rule.id);
      }}
    >
      {/* Row 1: name + status */}
      <div className="pol-ri__row1">
        <div className="pol-ri__left">
          <span className="pol-ri__name">{rule.name}</span>
          <span className={cn("pol-sev", severityClass(rule.severity))}>{SEVERITY_LABEL[rule.severity]}</span>
        </div>
        <div className="pol-ri__right">
          <span className={cn("pol-ri__status", `pol-ri__status--${rule.status}`)}>
            {rule.status === "active" ? "ACTIVE" : rule.status === "draft" ? "DRAFT" : "OFF"}
          </span>
          <button
            type="button"
            className={cn("pol-ri__toggle", rule.status === "active" && "is-on")}
            onClick={(e) => { e.stopPropagation(); policyStore.toggleRuleStatus(rule.id); }}
            aria-label={rule.status === "active" ? "Deactivate" : "Activate"}
          >
            <span className="pol-ri__toggle-dot" />
          </button>
        </div>
      </div>

      {/* Row 2: description */}
      <p className="pol-ri__desc">{rule.description}</p>

      {/* Row 3: meta line */}
      <div className="pol-ri__meta">
        <span className="pol-ri__id">{displayId}</span>
        <span className="pol-ri__sep" />
        <span>{rule.owner}</span>
        {rule.lastTriggeredAt && (
          <>
            <span className="pol-ri__sep" />
            <span>{relativeTime(rule.lastTriggeredAt)}</span>
          </>
        )}
        {matchCount > 0 && (
          <>
            <span className="pol-ri__sep" />
            <span>{matchCount} matches</span>
          </>
        )}
      </div>

      {/* Row 4: tags + engine */}
      <div className="pol-ri__footer">
        <div className="pol-ri__tags">
          {rule.tags.map((tag) => (
            <span key={tag} className="pol-tag">{tag}</span>
          ))}
        </div>
        <EngineBadge engine={rule.engine} ruleId={displayId} />
      </div>
    </div>
  );
}
