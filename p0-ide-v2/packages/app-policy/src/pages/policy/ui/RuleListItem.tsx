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

  return (
    <div
      className={cn("pol-rule-item", isSelected && "is-selected")}
      onClick={() => policyStore.selectRule(rule.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") policyStore.selectRule(rule.id);
      }}
    >
      <div className="pol-rule-item__top">
        <span className="pol-rule-item__id">{displayId}</span>
        <span className="pol-rule-item__name">{rule.name}</span>
        <EngineBadge engine={rule.engine} />
      </div>
      <p className="pol-rule-item__desc">{rule.description}</p>
      <div className="pol-rule-item__meta">
        <span className={cn("pol-sev", severityClass(rule.severity))}>{SEVERITY_LABEL[rule.severity]}</span>
        <span>{rule.owner}</span>
        {rule.lastTriggeredAt && <span>{relativeTime(rule.lastTriggeredAt)}</span>}
        <div className="pol-rule-item__tags">
          {rule.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="pol-tag">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
