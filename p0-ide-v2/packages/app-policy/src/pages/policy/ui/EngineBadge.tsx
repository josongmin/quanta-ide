import type { EngineType } from "@quanta/domain-types/policies";
import { ENGINE_LABEL } from "@quanta/domain-types/policies";

interface EngineBadgeProps {
  engine: EngineType;
}

export function EngineBadge({ engine }: EngineBadgeProps) {
  return (
    <span className={`pol-engine pol-engine--${engine}`}>
      {ENGINE_LABEL[engine]}
    </span>
  );
}
