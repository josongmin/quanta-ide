import { cn } from "@quanta/ui-kit/lib";
import type { PolicyTemplateId } from "@quanta/domain-types/policies";
import { TEMPLATE_LABEL } from "@quanta/domain-types/policies";

const TEMPLATES: PolicyTemplateId[] = [
  "forbidden-dependency",
  "allowed-only-path",
  "must-go-through-abstraction",
  "no-direct-call",
  "only-team-can-modify",
  "retry-required",
  "no-write-without-idempotency",
  "no-logging-sensitive",
];

interface TemplatePickerStripProps {
  activeId?: PolicyTemplateId;
  onPick: (id: PolicyTemplateId) => void;
}

export function TemplatePickerStrip({ activeId, onPick }: TemplatePickerStripProps) {
  return (
    <div className="pol-templates">
      <span className="pol-templates__label">Template</span>
      {TEMPLATES.map((id) => (
        <button
          key={id}
          type="button"
          className={cn("pol-template-pill", id === activeId && "is-active")}
          onClick={() => onPick(id)}
        >
          {TEMPLATE_LABEL[id]}
        </button>
      ))}
    </div>
  );
}
