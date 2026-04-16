import { cn } from "@/shared/lib";
import type { BuildArtifact, BuildTarget } from "@/entities/agent-rules";
import { labelFor } from "../lib/rules-page.utils";

export function BuildStatusStrip({
  artifacts,
  targets,
  activeTarget,
  onPick,
}: {
  artifacts: readonly BuildArtifact[];
  targets: readonly BuildTarget[];
  activeTarget: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rules-build">
      <span className="rules-build__label">Build</span>
      <div className="rules-build__targets">
        {artifacts.map((a) => {
          const hasWarn = a.diagnostics.length > 0;
          const state: "ok" | "warn" = hasWarn ? "warn" : "ok";
          const label = labelFor(a.targetId, targets);
          return (
            <button
              key={a.targetId}
              type="button"
              className={cn(`rules-build__target rules-build__target--${state}`, a.targetId === activeTarget && "is-active")}
              onClick={() => onPick(a.targetId)}
              title={`${label} → ${a.outputPath}`}
            >
              <span className={`rules-build__icon rules-build__icon--${state}`} aria-hidden>
                {state === "ok" ? "✓" : "!"}
              </span>
              <span className="rules-build__name">{label}</span>
              <span className="rules-build__count">
                {a.diagnostics.length > 0 && (
                  <span className="rules-build__dropped">−{a.diagnostics.length}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
