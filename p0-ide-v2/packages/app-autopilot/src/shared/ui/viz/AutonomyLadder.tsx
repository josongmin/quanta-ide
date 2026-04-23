import { cn } from "@quanta/ui-kit/lib";
import { AUTONOMY_LEVEL_META, type AutonomyLevel } from "@quanta/app-autopilot/entities/autonomy";
import "./autonomy-ladder.css";

export interface AutonomyLadderProps {
  level: AutonomyLevel;
  /** "full" shows level pill + label + rail; "chip" is inline compact. */
  variant?: "full" | "chip";
  className?: string;
}

const LEVELS: AutonomyLevel[] = [0, 1, 2, 3, 4];

export function AutonomyLadder({ level, variant = "full", className }: AutonomyLadderProps) {
  const meta = AUTONOMY_LEVEL_META[level];
  if (variant === "chip") {
    return (
      <span className={cn("ap-ladder-chip", `ap-ladder-chip--${meta.tone}`, className)}>
        <span className="ap-ladder-chip__tag">L{level}</span>
        <span className="ap-ladder-chip__title">{meta.title}</span>
      </span>
    );
  }
  return (
    <div className={cn("ap-ladder", className)}>
      <div className="ap-ladder__head">
        <span className={cn("ap-ladder__tag", `ap-ladder__tag--${meta.tone}`)}>L{level}</span>
        <span className="ap-ladder__title">{meta.title}</span>
        <span className="ap-ladder__verb">— {meta.verb}</span>
      </div>
      <div className="ap-ladder__rail" aria-hidden>
        {LEVELS.map((l) => (
          <span
            key={l}
            className={cn(
              "ap-ladder__step",
              l <= level && "is-filled",
              l === level && "is-current",
              `ap-ladder__step--${AUTONOMY_LEVEL_META[l].tone}`,
            )}
          />
        ))}
      </div>
    </div>
  );
}
