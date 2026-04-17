import type { SecurityRule } from "@quanta/app-ide/entities/security-rules";
import { cn } from "@quanta/ui-kit/lib";

interface Props {
  rules: SecurityRule[];
  onEditRule: (rule: SecurityRule) => void;
}

function RuleCard({ rule, onEdit }: { rule: SecurityRule; onEdit: () => void }) {
  const sevLabel = rule.severity === 3 ? "HIGH" : rule.severity === 2 ? "MED" : "LOW";

  return (
    <button className={cn("sr-rule-card", !rule.active && "sr-rule-card--inactive")}
      type="button" onClick={onEdit}>
      <div className="sr-rule-card__top">
        <span className={cn("sr-rule-card__sev", `sr-rule-card__sev--${rule.severity}`)}>
          {sevLabel}
        </span>
        <span className="sr-rule-card__owasp">{rule.owaspCode}</span>
        {!rule.active && <span className="sr-rule-card__badge sr-rule-card__badge--off">OFF</span>}
        <span className="sr-rule-card__spacer" />
        {rule.violationCount > 0 && (
          <span className="sr-rule-card__violations">{rule.violationCount}</span>
        )}
      </div>

      <h3 className="sr-rule-card__title">{rule.title}</h3>
      <p className="sr-rule-card__desc">{rule.description}</p>

      <div className="sr-rule-card__meta">
        {rule.scope.map((s) => (
          <span key={s} className="sr-rule-card__scope">{s}</span>
        ))}
        {rule.owner && <span className="sr-rule-card__owner">{rule.owner}</span>}
        {rule.lastTriggered && (
          <span className="sr-rule-card__triggered">last: {rule.lastTriggered}</span>
        )}
      </div>

      <div className="sr-rule-card__tags">
        {rule.sourceTags.map((t) => (
          <span key={t} className="sr-tag sr-tag--source">{t}</span>
        ))}
        {rule.sourceTags.length > 0 && rule.sinkTags.length > 0 && (
          <span className="sr-tag__arrow">→</span>
        )}
        {rule.sinkTags.map((t) => (
          <span key={t} className="sr-tag sr-tag--sink">{t}</span>
        ))}
        {rule.guardTags.length > 0 && (
          <>
            <span className="sr-tag__arrow">requires</span>
            {rule.guardTags.map((t) => (
              <span key={t} className="sr-tag sr-tag--guard">{t}</span>
            ))}
          </>
        )}
      </div>
    </button>
  );
}

export function RuleLibrary({ rules, onEditRule }: Props) {
  if (rules.length === 0) {
    return <div className="sr-empty">No rules match the current filter.</div>;
  }

  return (
    <div className="sr-rule-list">
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onEdit={() => onEditRule(rule)} />
      ))}
    </div>
  );
}
