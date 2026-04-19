import { cn } from "@quanta/ui-kit/lib";
import type { FeatureRecord } from "@quanta/shell/stores/feature-registry";
import { stateLabel } from "../../lib/home-picker.utils";

export function CapabilityCard({
  feature,
  onRun,
}: {
  feature: FeatureRecord;
  onRun: () => void;
}) {
  const kbd = feature.commands?.[0]?.keybinding;
  const badge = feature.badge;
  return (
    <button type="button" className="hp__cap" onClick={onRun} title={feature.description} aria-label={feature.title}>
      {badge && (
        <span className={`hp__cap-badge hp__cap-badge--${badge}`} aria-hidden>
          {badge}
        </span>
      )}
      <h5 className="hp__cap-title">{feature.title}</h5>
      <p className="hp__cap-desc">{feature.description}</p>
      <span className="hp__cap-foot">
        <span className={cn(
          "hp__cap-state",
          feature.state === "disabled" && "hp__cap-state--disabled",
          feature.state === "error" && "hp__cap-state--error",
        )}>
          <span className="hp__cap-dot" aria-hidden />
          {stateLabel(feature.state)}
        </span>
        {kbd && <span className="hp__cap-kbd">{kbd}</span>}
      </span>
    </button>
  );
}
