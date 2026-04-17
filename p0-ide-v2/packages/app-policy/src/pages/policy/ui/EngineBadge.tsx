import type { EngineType } from "@quanta/domain-types/policies";

const ENGINE_SHORT: Record<EngineType, string> = {
  codeql: "codeql",
  "taint-engine": "taint",
  semgrep: "semgrep",
  custom: "custom",
  hybrid: "hybrid",
};

interface EngineBadgeProps {
  engine: EngineType;
  ruleId?: string;
}

export function EngineBadge({ engine, ruleId }: EngineBadgeProps) {
  const label = ruleId
    ? `${ENGINE_SHORT[engine]}(${ruleId})`
    : ENGINE_SHORT[engine];

  return (
    <span className={`pol-engine pol-engine--${engine}`}>
      {label}
    </span>
  );
}
