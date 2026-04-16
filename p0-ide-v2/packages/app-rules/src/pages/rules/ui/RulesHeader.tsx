import { useEffect, useState } from "react";
import { cn } from "@quanta/ui-kit/lib";

export function RulesHeader({
  sourcePath,
  targetCount,
  warningCount,
  lastBuildAt,
  onBuild,
  onImport,
  onReset,
}: {
  sourcePath: string;
  targetCount: number;
  warningCount: number;
  lastBuildAt: number;
  onBuild: () => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const when = lastBuildAt
    ? `${Math.max(0, Math.round((Date.now() - lastBuildAt) / 1000))}s ago`
    : "\u2014";
  return (
    <header className="rules-header">
      <div className="rules-header__left">
        <span className="rules-header__kicker">Agent Rules</span>
        <span className="rules-header__title">{sourcePath}</span>
      </div>
      <div className="rules-header__meta">
        <span className="rules-header__stat">{targetCount} targets</span>
        <span className="rules-header__sep">&middot;</span>
        <span className={cn("rules-header__stat", warningCount > 0 && "has-warn")}>
          {warningCount} warnings
        </span>
        <span className="rules-header__sep">&middot;</span>
        <span className="rules-header__stat">last build {when}</span>
      </div>
      <div className="rules-header__actions">
        <button type="button" className="rules-btn rules-btn--ghost" onClick={onReset}>
          Reset sample
        </button>
        <button type="button" className="rules-btn rules-btn--ghost" onClick={onImport}>
          Import <kbd>⌘⇧I</kbd>
        </button>
        <button type="button" className="rules-btn rules-btn--primary" onClick={onBuild}>
          Build <kbd>⌘B</kbd>
        </button>
      </div>
    </header>
  );
}
